// Payment Method Storage Service
import { storage } from '../storage';
import { BillingErrorBoundary } from './error-boundary';

export interface PaymentMethodData {
  stripePaymentMethodId: string;
  type: string;
  cardBrand?: string;
  cardLast4?: string;
  cardExpMonth?: number;
  cardExpYear?: number;
  isDefault?: boolean;
}

export class PaymentMethodService {
  static async storePaymentMethod(
    userId: string, 
    paymentMethodData: PaymentMethodData
  ): Promise<{ success: boolean; paymentMethodId?: string; error?: string }> {
    return await BillingErrorBoundary.wrapCriticalOperation(
      'store_payment_method',
      userId,
      async () => {
        // If this is set as default, remove default flag from others
        if (paymentMethodData.isDefault) {
          await storage.updateUserPaymentMethodsSetDefault(userId, false);
        }

        const paymentMethod = await storage.createPaymentMethod({
          userId,
          stripePaymentMethodId: paymentMethodData.stripePaymentMethodId,
          type: paymentMethodData.type,
          cardBrand: paymentMethodData.cardBrand,
          cardLast4: paymentMethodData.cardLast4,
          cardExpMonth: paymentMethodData.cardExpMonth,
          cardExpYear: paymentMethodData.cardExpYear,
          isDefault: paymentMethodData.isDefault || false,
          isActive: true
        });

        return paymentMethod.id;
      }
    );
  }

  static async getPaymentMethods(userId: string) {
    return await BillingErrorBoundary.wrapCriticalOperation(
      'get_payment_methods',
      userId,
      async () => {
        return await storage.getUserPaymentMethods(userId);
      }
    );
  }

  static async setDefaultPaymentMethod(userId: string, paymentMethodId: string) {
    return await BillingErrorBoundary.wrapCriticalOperation(
      'set_default_payment_method',
      userId,
      async () => {
        // Remove default flag from all payment methods
        await storage.updateUserPaymentMethodsSetDefault(userId, false);
        
        // Set the specified method as default
        await storage.updatePaymentMethod(paymentMethodId, { isDefault: true });
        
        return true;
      }
    );
  }

  static async removePaymentMethod(userId: string, paymentMethodId: string) {
    return await BillingErrorBoundary.wrapCriticalOperation(
      'remove_payment_method',
      userId,
      async () => {
        // Mark as inactive instead of deleting
        await storage.updatePaymentMethod(paymentMethodId, { isActive: false });
        return true;
      }
    );
  }
}