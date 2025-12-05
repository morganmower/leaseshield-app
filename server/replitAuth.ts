import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";
import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: sessionTtl,
    },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(claims: any) {
  // Check if user already exists
  const existingUser = await storage.getUser(claims["sub"]);
  
  if (existingUser) {
    // Update only profile information for existing users, preserve subscription state
    await storage.upsertUser({
      id: claims["sub"],
      email: claims["email"],
      firstName: claims["first_name"],
      lastName: claims["last_name"],
      profileImageUrl: claims["profile_image_url"],
    });
  } else {
    // New user: initialize with 7-day free trial
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 7);

    await storage.upsertUser({
      id: claims["sub"],
      email: claims["email"],
      firstName: claims["first_name"],
      lastName: claims["last_name"],
      profileImageUrl: claims["profile_image_url"],
      subscriptionStatus: "trialing",
      trialEndsAt,
    });
  }
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    const user = {};
    updateUserSession(user, tokens);
    await upsertUser(tokens.claims());
    verified(null, user);
  };

  const registeredStrategies = new Set<string>();

  const ensureStrategy = (domain: string) => {
    const strategyName = `replitauth:${domain}`;
    if (!registeredStrategies.has(strategyName)) {
      const strategy = new Strategy(
        {
          name: strategyName,
          config,
          scope: "openid email profile offline_access",
          callbackURL: `https://${domain}/api/callback`,
        },
        verify,
      );
      passport.use(strategy);
      registeredStrategies.add(strategyName);
    }
  };

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get("/api/login", (req, res, next) => {
    ensureStrategy(req.hostname);
    passport.authenticate(`replitauth:${req.hostname}`, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    ensureStrategy(req.hostname);
    passport.authenticate(`replitauth:${req.hostname}`, {
      successReturnToOrRedirect: "/",
      failureRedirect: "/api/login",
    })(req, res, next);
  });

  app.get("/api/logout", (req, res) => {
    // First logout from passport
    req.logout(() => {
      // Then explicitly destroy the session to ensure complete cleanup
      req.session.destroy((err) => {
        if (err) {
          console.error("Error destroying session:", err);
        }
        // Clear session cookie
        res.clearCookie('connect.sid');
        // Redirect to Replit's end session URL
        res.redirect(
          client.buildEndSessionUrl(config, {
            client_id: process.env.REPL_ID!,
            post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
          }).href
        );
      });
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as any;
  console.error(`[isAuthenticated] ${req.method} ${req.path} - checking auth...`);
  console.error(`[isAuthenticated] req.isAuthenticated()=${req.isAuthenticated()}, user=${!!user}, expires_at=${user?.expires_at}`);

  if (!req.isAuthenticated() || !user.expires_at) {
    console.error(`[isAuthenticated] ❌ REJECTED: Not authenticated or no expires_at`);
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  console.error(`[isAuthenticated] Token check: now=${now}, expires_at=${user.expires_at}, expired=${now > user.expires_at}`);
  
  if (now <= user.expires_at) {
    console.error(`[isAuthenticated] ✅ ALLOWED: Token still valid`);
    return next();
  }

  const refreshToken = user.refresh_token;
  console.error(`[isAuthenticated] Token expired, refreshToken=${!!refreshToken}`);
  
  if (!refreshToken) {
    console.error(`[isAuthenticated] ❌ REJECTED: No refresh token`);
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    console.error(`[isAuthenticated] 🔄 Attempting token refresh...`);
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    console.error(`[isAuthenticated] ✅ ALLOWED: Token refreshed`);
    return next();
  } catch (error) {
    console.error(`[isAuthenticated] ❌ REJECTED: Token refresh failed`, error);
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};

export const requireAccess: RequestHandler = async (req, res, next) => {
  const user = req.user as any;
  
  if (!req.isAuthenticated() || !user.claims?.sub) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    // Get user from database to check admin status and subscription
    const dbUser = await storage.getUser(user.claims.sub);
    
    if (!dbUser) {
      return res.status(401).json({ message: "User not found" });
    }

    // Admin users have full access
    if (dbUser.isAdmin) {
      return next();
    }

    // Check if user has active subscription or trial
    const hasActiveSubscription = 
      dbUser.subscriptionStatus === 'active' || 
      dbUser.subscriptionStatus === 'trialing';

    if (!hasActiveSubscription) {
      return res.status(403).json({ 
        message: "Subscription required",
        requiresSubscription: true 
      });
    }

    next();
  } catch (error) {
    console.error('Access check error:', error);
    res.status(500).json({ message: "Internal server error" });
  }
};
