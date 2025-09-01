import type { Request, Response, NextFunction } from 'express';

export function handleDatabaseErrors(error: any, req: Request, res: Response, next: NextFunction) {
  // Check if it's a database connection error
  if (error.code === 'ECONNREFUSED' || 
      error.code === 'ENOTFOUND' || 
      error.message?.includes('connect ECONNREFUSED') ||
      error.message?.includes('WebSocket connection failed') ||
      error.message?.includes('neon') ||
      error.message?.includes('database')) {
    
    console.error(`[DATABASE ERROR] ${error.message}`);
    
    // Return a graceful error response instead of crashing
    return res.status(503).json({
      error: 'Database temporarily unavailable',
      message: 'Please try again in a moment',
      code: 'DATABASE_UNAVAILABLE'
    });
  }
  
  // If it's not a database error, pass it to the next error handler
  next(error);
}

export function withDatabaseErrorHandling<T>(operation: () => Promise<T>): Promise<T | null> {
  return operation().catch(error => {
    console.error('[DATABASE] Operation failed:', error.message);
    if (error.code === 'ECONNREFUSED' || 
        error.code === 'ENOTFOUND' || 
        error.message?.includes('connect ECONNREFUSED') ||
        error.message?.includes('WebSocket connection failed') ||
        error.message?.includes('neon')) {
      console.warn('[DATABASE] Connection issue detected, returning null');
      return null;
    }
    throw error;
  });
}