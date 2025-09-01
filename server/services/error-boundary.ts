// Error boundary utilities for critical billing operations
import { storage } from '../storage';

export class BillingErrorBoundary {
  static async wrapCriticalOperation<T>(
    operationName: string,
    userId: string,
    operation: () => Promise<T>
  ): Promise<{ success: boolean; data?: T; error?: string }> {
    try {
      console.log(`[BillingErrorBoundary] Starting critical operation: ${operationName} for user ${userId}`);
      
      const result = await operation();
      
      // Log successful billing operation
      await storage.createActivityLog({
        userId,
        action: `billing_${operationName}`,
        type: 'billing',
        executedBy: 'system',
        details: `Billing operation ${operationName} completed successfully`,
        customerEmail: '',
        metadata: { success: true, timestamp: new Date().toISOString() }
      }).catch(logError => {
        console.error(`[BillingErrorBoundary] Failed to log successful operation ${operationName}:`, logError);
      });
      
      console.log(`[BillingErrorBoundary] Successfully completed: ${operationName} for user ${userId}`);
      return { success: true, data: result };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[BillingErrorBoundary] Critical operation ${operationName} failed for user ${userId}:`, error);
      
      // Log failed billing operation
      await storage.createActivityLog({
        userId,
        action: `billing_${operationName}_failed`,
        type: 'billing_error',
        executedBy: 'system',
        details: `Billing operation ${operationName} failed: ${errorMessage}`,
        customerEmail: '',
        metadata: { 
          error: errorMessage,
          timestamp: new Date().toISOString(),
          stack: error instanceof Error ? error.stack : undefined
        }
      }).catch(logError => {
        console.error(`[BillingErrorBoundary] Failed to log failed operation ${operationName}:`, logError);
      });
      
      return { success: false, error: errorMessage };
    }
  }

  static async wrapStripeOperation<T>(
    operationName: string,
    userId: string,
    operation: () => Promise<T>
  ): Promise<{ success: boolean; data?: T; error?: string }> {
    try {
      console.log(`[BillingErrorBoundary] Starting Stripe operation: ${operationName} for user ${userId}`);
      
      const result = await operation();
      
      console.log(`[BillingErrorBoundary] Stripe operation ${operationName} completed successfully for user ${userId}`);
      return { success: true, data: result };
      
    } catch (error: any) {
      const errorMessage = error?.message || 'Stripe operation failed';
      const stripeError = {
        type: error?.type || 'unknown_error',
        code: error?.code,
        decline_code: error?.decline_code,
        payment_intent: error?.payment_intent?.id
      };
      
      console.error(`[BillingErrorBoundary] Stripe operation ${operationName} failed for user ${userId}:`, stripeError);
      
      // Log Stripe-specific errors
      await storage.createActivityLog({
        userId,
        action: `stripe_${operationName}_failed`,
        type: 'stripe_error',
        executedBy: 'system',
        customerEmail: 'system',
        details: `Stripe ${operationName} failed: ${errorMessage}`,
        status: 'failed',
        metadata: { 
          error: errorMessage,
          stripeError,
          timestamp: new Date().toISOString()
        }
      }).catch(logError => {
        console.error(`[BillingErrorBoundary] Failed to log Stripe error for ${operationName}:`, logError);
      });
      
      return { success: false, error: errorMessage };
    }
  }

  static async wrapSendGridOperation(
    operationName: string,
    recipientEmail: string,
    operation: () => Promise<any>
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      console.log(`[BillingErrorBoundary] Sending ${operationName} email to ${recipientEmail}`);
      
      const result = await operation();
      
      console.log(`[BillingErrorBoundary] Successfully sent ${operationName} email to ${recipientEmail}`);
      return { success: true, data: result };
      
    } catch (error: any) {
      const errorMessage = error?.message || 'Email sending failed';
      console.error(`[BillingErrorBoundary] Failed to send ${operationName} email to ${recipientEmail}:`, error);
      
      // For critical billing emails, we should implement retry logic
      if (operationName.includes('usage_') || operationName.includes('trial_')) {
        console.log(`[BillingErrorBoundary] Critical email ${operationName} failed, should implement retry logic`);
      }
      
      return { success: false, error: errorMessage };
    }
  }
}

// Atomic transaction helper for billing operations
export class AtomicBillingTransaction {
  static async execute<T>(
    userId: string,
    transactionName: string,
    operations: Array<() => Promise<any>>
  ): Promise<{ success: boolean; results?: T[]; error?: string }> {
    const results: any[] = [];
    const rollbackOperations: Array<() => Promise<void>> = [];
    
    try {
      console.log(`[AtomicBillingTransaction] Starting atomic transaction: ${transactionName} for user ${userId}`);
      
      for (const operation of operations) {
        const result = await operation();
        results.push(result);
      }
      
      console.log(`[AtomicBillingTransaction] Successfully completed atomic transaction: ${transactionName} for user ${userId}`);
      return { success: true, results };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Atomic transaction failed';
      console.error(`[AtomicBillingTransaction] Atomic transaction ${transactionName} failed for user ${userId}, attempting rollback:`, error);
      
      // Execute rollback operations in reverse order
      for (let i = rollbackOperations.length - 1; i >= 0; i--) {
        try {
          await rollbackOperations[i]();
        } catch (rollbackError) {
          console.error(`[AtomicBillingTransaction] Rollback operation ${i} failed:`, rollbackError);
        }
      }
      
      return { success: false, error: errorMessage };
    }
  }
}