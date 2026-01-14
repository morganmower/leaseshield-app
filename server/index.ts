import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { scheduledJobs } from "./scheduledJobs";
import { startScreeningPoller, stopScreeningPoller } from "./screeningPoller";
import { closePool } from "./db";
import { validateEnv } from "./utils/env";
import { RateLimiter } from "./utils/validation";

// Rate limiters for different endpoint types
const authRateLimiter = new RateLimiter(10, 60 * 1000); // 10 auth attempts per minute
const apiRateLimiter = new RateLimiter(100, 60 * 1000); // 100 API requests per minute
const strictRateLimiter = new RateLimiter(5, 60 * 1000); // 5 requests per minute for sensitive ops

// Content Security Policy middleware
const cspMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const isDev = process.env.NODE_ENV === 'development';
  
  // Skip CSP for Vite dev server assets in development
  if (isDev && !req.path.startsWith('/api')) {
    return next();
  }
  
  // Production CSP is stricter - development allows unsafe-inline/eval for HMR
  const scriptSrc = isDev 
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com"
    : "script-src 'self' https://js.stripe.com";
    
  const styleSrc = isDev
    ? "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com"
    : "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com"; // Inline needed for Tailwind
  
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    scriptSrc,
    styleSrc,
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
    "connect-src 'self' https://api.stripe.com https://api.openai.com wss:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests"
  ].join('; '));
  
  // Additional security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  // Strict Transport Security (HSTS) - enforce HTTPS
  if (!isDev) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  
  next();
};

// Validate environment variables on startup
try {
  validateEnv();
  log('✓ Environment variables validated');
} catch (error) {
  console.error('Failed to start server:', error);
  process.exit(1);
}

const app = express();

// CRITICAL: Root health check MUST be first - before any middleware
// This ensures deployment health checks pass immediately
app.get('/', (req, res, next) => {
  // Only respond with health check if no other route handles it
  // Check if this is a health check (no specific page requested)
  const userAgent = req.headers['user-agent'] || '';
  const isHealthCheck = userAgent.includes('health') || 
                        userAgent.includes('kube') || 
                        userAgent.includes('replit') ||
                        req.headers['x-health-check'] === 'true';
  
  // For health checks, respond immediately
  if (isHealthCheck) {
    return res.status(200).json({ status: 'ok' });
  }
  
  // For regular requests, continue to Vite/static serving
  next();
});

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}

// IMPORTANT: Webhooks must receive raw body for signature verification
// Apply raw/text body parser ONLY to webhook routes, JSON parser to all other routes
app.use((req, res, next) => {
  if (req.path === '/api/stripe-webhook') {
    // Use raw body parser for Stripe webhook
    express.raw({ type: 'application/json' })(req, res, next);
  } else if (req.path.startsWith('/api/webhooks/digitaldelve/')) {
    // Use text body parser for DigitalDelve XML webhooks
    express.text({ type: ['application/xml', 'text/xml', '*/*'], limit: '1mb' })(req, res, next);
  } else {
    // Use JSON parser for all other routes
    next();
  }
});

app.use(express.json({ limit: '10mb' })); // Add size limit to prevent large payloads
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// Apply security headers
app.use(cspMiddleware);

// CORS configuration - restrict to allowed origins
app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin;
  const allowedOriginPatterns = [
    /^https:\/\/.*\.replit\.dev$/,
    /^https:\/\/.*\.repl\.co$/,
    /^https:\/\/.*\.replit\.app$/,
  ];
  
  // Check if origin matches any allowed pattern
  if (origin && allowedOriginPatterns.some(pattern => pattern.test(origin))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  
  next();
});

// Rate limiting middleware - protect against brute force and abuse
app.use((req: Request, res: Response, next: NextFunction) => {
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
  
  // Auth endpoints - strict rate limiting
  if (req.path === '/api/login' || req.path === '/api/callback') {
    if (!authRateLimiter.check(clientIp)) {
      log(`Rate limited auth request from ${clientIp}`);
      return res.status(429).json({ 
        message: 'Too many login attempts. Please wait a minute and try again.' 
      });
    }
  }
  // Sensitive admin operations - very strict
  else if (req.path.startsWith('/api/admin') && req.method !== 'GET') {
    if (!strictRateLimiter.check(clientIp)) {
      log(`Rate limited admin request from ${clientIp}`);
      return res.status(429).json({ 
        message: 'Too many requests. Please slow down.' 
      });
    }
  }
  // General API rate limiting
  else if (req.path.startsWith('/api')) {
    if (!apiRateLimiter.check(clientIp)) {
      log(`Rate limited API request from ${clientIp}`);
      return res.status(429).json({ 
        message: 'Too many requests. Please slow down.' 
      });
    }
  }
  
  next();
});

// Catch body parsing errors
app.use((err: any, req: any, res: any, next: any) => {
  if (err instanceof SyntaxError && 'body' in err) {
    console.error('❌ JSON PARSE ERROR:', err.message);
    return res.status(400).json({ message: 'Invalid JSON' });
  }
  next(err);
});

// Request timeout middleware - prevent hanging requests
app.use((req, res, next) => {
  // Set timeout to 30 seconds for all requests
  req.setTimeout(30000, () => {
    log(`Request timeout: ${req.method} ${req.path}`);
    if (!res.headersSent) {
      res.status(408).json({ message: 'Request timeout' });
    }
  });

  res.setTimeout(30000, () => {
    log(`Response timeout: ${req.method} ${req.path}`);
    if (!res.headersSent) {
      res.status(504).json({ message: 'Gateway timeout' });
    }
  });

  next();
});

// Simple health check endpoint - responds immediately without any DB or heavy operations
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: Date.now() });
});

app.use((req, res, next) => {
  // Log ALL incoming requests immediately
  if (req.path.startsWith("/api")) {
    console.error(`\n🚀 INCOMING ${req.method} ${req.path}`);
  }
  
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  // Global error handler - must be last middleware
  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    // Log error details
    console.error('Error occurred:', {
      path: req.path,
      method: req.method,
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });

    // Don't send response if headers already sent
    if (res.headersSent) {
      return;
    }

    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    // Send appropriate error response
    res.status(status).json({
      message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
    
    // Delay starting scheduled jobs to allow health checks to pass first
    // This ensures the server is fully ready before heavy operations begin
    setTimeout(() => {
      scheduledJobs.start();
      startScreeningPoller();
    }, 15000); // 15 second delay for reliable health check passing
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    log(`${signal} received, shutting down gracefully...`);

    try {
      // Stop scheduled jobs first
      scheduledJobs.stop();
      stopScreeningPoller();

      // Close HTTP server
      await new Promise<void>((resolve, reject) => {
        server.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      log('HTTP server closed');

      // Close database pool
      await closePool();

      log('Graceful shutdown complete');
      process.exit(0);
    } catch (error) {
      log(`Error during shutdown: ${error}`);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
})();
