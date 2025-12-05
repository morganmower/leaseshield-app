import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { scheduledJobs } from "./scheduledJobs";
import { closePool } from "./db";
import { validateEnv } from "./utils/env";

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

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}

// IMPORTANT: Stripe webhook must receive raw body for signature verification
// Apply raw body parser ONLY to webhook route, JSON parser to all other routes
app.use((req, res, next) => {
  if (req.path === '/api/stripe-webhook') {
    // Use raw body parser for Stripe webhook
    express.raw({ type: 'application/json' })(req, res, next);
  } else {
    // Use JSON parser for all other routes
    next();
  }
});

app.use(express.json({ limit: '10mb' })); // Add size limit to prevent large payloads
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// Apply security headers
app.use(cspMiddleware);

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
    
    // Start scheduled jobs (trial reminders, legal update notifications)
    scheduledJobs.start();
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    log(`${signal} received, shutting down gracefully...`);

    try {
      // Stop scheduled jobs first
      scheduledJobs.stop();

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
