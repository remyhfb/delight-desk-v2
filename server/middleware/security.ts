import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { body, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';

// Rate limiting configuration
export const createRateLimiter = (windowMs: number, max: number, message?: string) => {
  return rateLimit({
    windowMs,
    max,
    message: message || 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    // Skip rate limiting in development to avoid proxy issues
    skip: () => process.env.NODE_ENV === 'development',
  });
};

// General API rate limiter (100 requests per 15 minutes)
export const apiLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  100,
  'Too many API requests from this IP, please try again in 15 minutes.'
);

// Strict rate limiter for auth endpoints (5 attempts per 15 minutes)
export const authLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  5,
  'Too many authentication attempts from this IP, please try again in 15 minutes.'
);

// Security headers middleware
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https:"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://js.stripe.com", "https://replit.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "https:", "wss:", "https://api.stripe.com"],
      fontSrc: ["'self'", "https:", "data:"],
      frameSrc: ["https://js.stripe.com", "https://hooks.stripe.com"],
      mediaSrc: ["'self'", "data:", "blob:"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
});

// Input validation schemas
export const validateLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Must be a valid email address'),
  body('password')
    .isLength({ min: 6, max: 128 })
    .withMessage('Password must be between 6 and 128 characters'),
];

export const validateRegistration = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Must be a valid email address'),
  body('password')
    .isLength({ min: 6, max: 128 })
    .withMessage('Password must be between 6 and 128 characters'),
  body('firstName')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('First name must be between 1 and 50 characters'),
  body('lastName')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Last name must be between 1 and 50 characters'),
  body('company')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Company name must be less than 100 characters'),
];

export const validateEmailContent = [
  body('subject')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Subject must be between 1 and 200 characters'),
  body('body')
    .trim()
    .isLength({ min: 1, max: 10000 })
    .withMessage('Body must be between 1 and 10,000 characters'),
  body('customerEmail')
    .isEmail()
    .normalizeEmail()
    .withMessage('Must be a valid customer email address'),
];

// Validation error handler
export const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: 'Validation failed',
      errors: errors.array().map(err => ({
        field: err.type === 'field' ? err.path : 'unknown',
        message: err.msg
      }))
    });
  }
  next();
};

// Sanitize HTML content to prevent XSS
export const sanitizeHtml = (content: string): string => {
  return content
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
};