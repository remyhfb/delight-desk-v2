import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import { Request, Response, NextFunction } from 'express';

// Initialize Sentry for error monitoring
export const initSentry = () => {
  Sentry.init({
    dsn: process.env.SENTRY_DSN, // Will be undefined in development, which disables Sentry
    environment: process.env.NODE_ENV || 'development',
    integrations: [
      nodeProfilingIntegration(),
    ],
    // Performance monitoring
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    // Profiling
    profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  });
};

// Request tracing middleware
export const requestTracing = Sentry.setupExpressErrorHandler;

// Error handler middleware  
export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  // Log to Sentry
  Sentry.captureException(err);
  
  // Don't expose internal errors in production
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : err.message;
    
  res.status(500).json({ message });
};

// Custom error logging middleware
export const logErrors = (err: Error, req: Request, res: Response, next: NextFunction) => {
  // Log error details
  console.error('Error occurred:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString(),
  });

  // Send to Sentry in production
  if (process.env.NODE_ENV === 'production') {
    Sentry.captureException(err, {
      tags: {
        endpoint: req.url,
        method: req.method,
      },
      extra: {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      },
    });
  }

  next(err);
};

// Lightweight health check endpoint data
export const getHealthStatus = () => {
  return {
    status: 'healthy',
    timestamp: Date.now(),
    uptime: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV || 'development',
  };
};