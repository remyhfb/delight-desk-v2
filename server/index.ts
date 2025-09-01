import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import pg from "pg";
import memorystore from 'memorystore';
import cors from "cors";
import { registerRoutes } from "./routes";
import { sentimentTestRouter } from "./routes/sentiment-test";
import { setupVite, serveStatic, log } from "./vite";
import {
  apiLimiter,
  authLimiter,
  securityHeaders,
  handleValidationErrors,
} from "./middleware/security";
import {
  initSentry,
  errorHandler,
  logErrors,
  getHealthStatus,
} from "./middleware/monitoring";
import { handleDatabaseErrors } from "./middleware/database-error-handler";
import { logger, LogCategory } from "./services/logger";
// Demo data removed - using real data only

const app = express();

// Configure proxy settings for Replit environment
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1); // Trust first proxy
} else {
  // Skip proxy trust in development to avoid rate limiting issues
  app.set("trust proxy", false);
}

// Initialize Sentry for error monitoring
initSentry();

// CORS configuration to allow credentials
app.use(cors({
  credentials: true,
  origin: true, // Allow any origin in development
}));

// Security middleware
app.use(securityHeaders);

// Rate limiting
app.use("/api/auth", authLimiter);
app.use("/api", apiLimiter);

// Skip express.json() for Stripe webhook endpoint to handle raw body
app.use("/api/billing/webhook", express.raw({ type: "application/json" }));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// PostgreSQL session store for true persistence across server restarts
const PgSession = connectPgSimple(session);

// Create the PostgreSQL session store
const sessionStore = new PgSession({
  pg: pg,
  conString: process.env.DATABASE_URL,
  tableName: 'session',
  createTableIfMissing: true,
  ttl: 7 * 24 * 60 * 60 // 7 days in seconds
});

// Session configuration - using PostgreSQL store for true persistence
app.use(
  session({
    store: sessionStore,
    secret:
      process.env.SESSION_SECRET || "delightdesk-persistent-session-secret-2025",
    resave: false,
    saveUninitialized: false, // Only create sessions when needed
    rolling: true, // Reset expiration on activity
    cookie: {
      secure: false, // Set to false for both development and production on Replit
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days for better persistence
      sameSite: "lax", // Ensure cookies work with navigation
    },
    name: "sessionId", // Explicit session cookie name
  }),
);

app.use((req, res, next) => {
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

// Define health check endpoints BEFORE expensive middleware
const healthCheckHandler = (req: express.Request, res: express.Response) => {
  res.status(200).send("OK");
};

// Ultra-fast health check endpoints - respond immediately without any processing
app.get("/health", healthCheckHandler);

// Detailed health check for monitoring
app.get("/api/health", (req, res) => {
  res.json(getHealthStatus());
});

// Add request timeout middleware for all routes
app.use((req, res, next) => {
  // Set timeout for health check endpoints to be very short
  if (req.path === "/health") {
    res.setTimeout(1000); // 1 second for health checks
  } else {
    res.setTimeout(30000); // 30 seconds for other endpoints
  }
  next();
});

// Error handling middleware (must be last)
app.use(logErrors);
app.use(errorHandler);

(async () => {
  try {
    // Register routes with error handling
    let server;
    try {
      server = await registerRoutes(app);
      log('API routes registered successfully');
    } catch (error) {
      log('Warning: Some routes failed to register, continuing with basic server', 'warn');
      console.error('Route registration error:', error);
      server = require("http").createServer(app);
    }
    
    // Add sentiment testing routes
    try {
      app.use(sentimentTestRouter);
      log('Sentiment test routes registered');
    } catch (error) {
      log('Warning: Sentiment test routes failed to register', 'warn');
    }

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      res.status(status).json({ message });
      throw err;
    });

    // CRITICAL FIX: Ensure API routes are registered AFTER Vite to avoid interference
    // The comment above is misleading - Vite was being setup BEFORE routes registration
    // Moving Vite setup to AFTER route registration to fix webhook 404 issues
    if (app.get("env") === "development") {
      try {
        log('Attempting to setup Vite development server...');
        await setupVite(app, server);
        log('Vite setup completed successfully');
      } catch (error) {
        log('Vite setup failed, continuing without frontend serving', 'error');
        console.error('Vite error:', error);
        // Continue without Vite - server can still serve API endpoints
      }
    } else {
      serveStatic(app);
    }

    // ALWAYS serve the app on the port specified in the environment variable PORT
    // Other ports are firewalled. Default to 5000 if not specified.
    // this serves both the API and the client.
    // It is the only port that is not firewalled.
    const port = parseInt(process.env.PORT || "5000", 10);
    
    // Add server error handling
    server.on('error', (error: any) => {
      console.error('Server error:', error);
      if (error.code === 'EADDRINUSE') {
        console.error(`Port ${port} is already in use`);
      }
      process.exit(1);
    });
    
    // Background initialization function
    const initializeBackgroundServices = async () => {
      try {
        log('Starting background service initialization...');
        
        // Initialize PostgreSQL session store in background
        try {
          const PgSession = connectPgSimple(session);
          const { Pool } = pg;
          const sessionPool = new Pool({
            connectionString: process.env.DATABASE_URL,
          });

          sessionPool.on('error', (err) => {
            logger.error(LogCategory.DATABASE, 'Session pool connection error', { error: err.message });
          });

          sessionPool.on('connect', () => {
            logger.info(LogCategory.DATABASE, 'Session pool connected successfully');
          });

          logger.info(LogCategory.DATABASE, "PostgreSQL session store initialized in background");
        } catch (error) {
          logger.error(LogCategory.DATABASE, 'Failed to initialize PostgreSQL session store', { error });
        }

        // Initialize billing plans
        try {
          const initBillingPlansModule = await import('./scripts/init-billing-plans.ts');
          await initBillingPlansModule.default();
          log('Billing plans initialization completed');
        } catch (error) {
          logger.error(LogCategory.SYSTEM, 'Failed to initialize billing plans', { error: error instanceof Error ? error.message : 'Unknown error' });
        }

        // Initialize email schedulers in background
        const ENABLE_EMAIL_SCHEDULERS = process.env.ENABLE_EMAIL_SCHEDULERS === "true";
        
        if (ENABLE_EMAIL_SCHEDULERS) {
          try {
            logger.info(LogCategory.EMAILSCHEDULERS, "Email schedulers enabled by environment variable");

            // Start weekly report scheduler
            const { weeklyReportScheduler } = await import("./services/weekly-report");
            weeklyReportScheduler.start();

            // Start setup reminder scheduler
            const { setupReminderService } = await import("./services/setup-reminder");
            setupReminderService.startScheduler();

            // Start trial expiration reminder scheduler
            const { trialExpirationReminderService } = await import("./services/trial-expiration-reminder");
            trialExpirationReminderService.startScheduler();

            log('Email schedulers started successfully');
          } catch (error) {
            logger.error(LogCategory.EMAILSCHEDULERS, 'Failed to start email schedulers', { error });
          }
        } else {
          logger.warn(LogCategory.EMAILSCHEDULERS, "Email schedulers DISABLED for sender reputation protection. Set ENABLE_EMAIL_SCHEDULERS=true to enable.");
        }

        log('Background service initialization completed - server will continue running');
      } catch (error) {
        logger.error(LogCategory.SYSTEM, 'Background service initialization failed', { error });
      }
    };

    server.listen(port, "0.0.0.0", () => {
      log(`serving on port ${port}`);
      log('Server initialization completed - ready to accept connections');
      
      // Initialize background services with proper error isolation
      setTimeout(() => {
        initializeBackgroundServices().catch((error) => {
          logger.error(LogCategory.SYSTEM, 'Background initialization failed but server continues', { error });
        });
      }, 1000); // Longer delay to ensure server is stable
    });


    
    // Keep the process alive - server is now running and ready
    log('Server fully initialized and ready to handle requests');
    
    // Prevent the process from exiting by keeping event loop active
    const heartbeatInterval = setInterval(() => {
      // Lightweight heartbeat to keep process alive
      log('Server heartbeat - process alive', 'heartbeat');
    }, 30000);
    
    // Handle graceful shutdown
    process.on('SIGTERM', () => {
      log('SIGTERM received, shutting down gracefully');
      clearInterval(heartbeatInterval);
      server.close(() => {
        log('Server closed');
        process.exit(0);
      });
    });
    
    process.on('SIGINT', () => {
      log('SIGINT received, shutting down gracefully');
      clearInterval(heartbeatInterval);
      server.close(() => {
        log('Server closed');
        process.exit(0);
      });
    });
    
    // Prevent unhandled promise rejections from crashing the server
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Promise Rejection at:', promise, 'reason:', reason);
    });
    
    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
})().then(() => {
  // Server initialization complete - keep process alive
  console.log("Server startup complete, process will remain alive");
  
  // Additional heartbeat to ensure process stays alive
  const mainHeartbeat = setInterval(() => {
    // Silent heartbeat every 60 seconds
  }, 60000);
  
  // Keep the main process alive indefinitely
  process.on('exit', () => {
    clearInterval(mainHeartbeat);
  });
  
}).catch((error) => {
  console.error("Unhandled error during server startup:", error);
  process.exit(1);
});
