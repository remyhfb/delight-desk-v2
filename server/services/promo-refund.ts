import { storage } from "../storage";
import { orderLookupService } from "./order-lookup";
import { sharedEmailService } from "./shared-email";
import { logger, LogCategory } from './logger';
import type { AutoResponderRule } from "@shared/schema";

interface RefundCalculation {
  eligible: boolean;
  refundAmount: number;
  refundType: 'percentage' | 'fixed_amount';
  reason: string;
}

/**
 * Promo Refund Automation Service
 * Handles intelligent refund processing for first-time customers with configurable rules
 */
class PromoRefundService {

  /**
   * Check if customer is eligible for promo refund automation
   */
  async isFirstTimeCustomer(customerEmail: string, userId: string): Promise<boolean> {
    try {
      // Check activity logs to see if this customer has previous orders
      const activities = await storage.getActivityLogs(userId);
      const customerActivities = activities.filter(activity => 
        activity.customerEmail === customerEmail && 
        (activity.action === 'sent_order_info' || activity.action === 'processed_refund')
      );
      
      // If no previous activities, likely first-time customer
      return customerActivities.length === 0;
    } catch (error) {
      logger.error(LogCategory.SYSTEM, 'Error checking first-time customer status', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return false;
    }
  }

  /**
   * Calculate refund amount based on automation rule and order details
   */
  async calculateRefund(rule: AutoResponderRule, orderData: any): Promise<RefundCalculation> {
    const orderTotal = parseFloat(orderData.total || orderData.total_price || '0');
    
    // Check if order meets minimum/maximum thresholds
    if (rule.minOrderAmount && orderTotal < parseFloat(rule.minOrderAmount)) {
      return {
        eligible: false,
        refundAmount: 0,
        refundType: rule.refundType as any,
        reason: `Order amount $${orderTotal} is below minimum threshold of $${rule.minOrderAmount}`
      };
    }

    if (rule.maxOrderAmount && orderTotal > parseFloat(rule.maxOrderAmount)) {
      return {
        eligible: false,
        refundAmount: 0,
        refundType: rule.refundType as any,
        reason: `Order amount $${orderTotal} exceeds maximum threshold of $${rule.maxOrderAmount}`
      };
    }

    let refundAmount = 0;
    
    if (rule.refundType === 'percentage') {
      const percentage = parseFloat(rule.refundValue || '0');
      refundAmount = orderTotal * percentage;
      
      // Apply cap if specified
      if (rule.refundCap && refundAmount > parseFloat(rule.refundCap)) {
        refundAmount = parseFloat(rule.refundCap);
      }
    } else if (rule.refundType === 'fixed_amount') {
      refundAmount = parseFloat(rule.refundValue || '0');
    }

    return {
      eligible: true,
      refundAmount: Math.round(refundAmount * 100) / 100, // Round to 2 decimal places
      refundType: rule.refundType as any,
      reason: `Eligible for ${rule.refundType === 'percentage' ? `${(parseFloat(rule.refundValue || '0') * 100)}%` : `$${rule.refundValue}`} refund`
    };
  }

  /**
   * Process promo refund automation for an email
   */
  async processPromoRefund(
    emailId: string, 
    customerEmail: string, 
    userId: string, 
    rule: AutoResponderRule
  ): Promise<boolean> {
    try {
      // Check if customer is first-time only if rule requires it
      if (rule.firstTimeCustomerOnly) {
        const isFirstTime = await this.isFirstTimeCustomer(customerEmail, userId);
        if (!isFirstTime) {
          logger.info(LogCategory.SYSTEM, `Customer is not first-time, skipping automation`, { customerEmail });
          return false;
        }
      }

      // Try to extract order number from email or use customer email to lookup recent orders
      let orderData = null;
      
      // First try to find order from recent customer activities
      const activities = await storage.getActivityLogs(userId);
      const customerActivity = activities.find(activity => 
        activity.customerEmail === customerEmail && 
        activity.orderNumber
      );

      if (customerActivity?.orderNumber) {
        try {
          orderData = await orderLookupService.searchOrderByNumber('user1', customerActivity.orderNumber);
        } catch (error) {
          logger.warn(LogCategory.SYSTEM, 'Could not lookup order from activity log');
        }
      }

      // If no order found, we cannot process refund automatically
      if (!orderData) {
        logger.warn(LogCategory.SYSTEM, `No order data found for customer, escalating`, { customerEmail });
        await storage.createEscalationQueue({
          emailId,
          userId,
          priority: 'medium',
          reason: 'Promo refund request - unable to locate order automatically',
          status: 'pending'
        });
        return false;
      }

      // Calculate refund
      const calculation = await this.calculateRefund(rule, orderData);
      
      if (!calculation.eligible) {
        logger.info(LogCategory.SYSTEM, `Refund not eligible`, { reason: calculation.reason });
        
        // Send explanation email
        const template = `Dear Customer,

Thank you for contacting us about your refund request. We've reviewed your order and unfortunately it does not qualify for an automated refund under our current promotion terms.

${calculation.reason}

If you believe this is an error or have special circumstances, please reply to this email and our customer service team will review your case manually.

Best regards,
Customer Service Team`;

        await sharedEmailService.sendCustomEmail(
          userId,
          customerEmail,
          'Refund Request - Review Required',
          template,
          'sent_refund_explanation'
        );

        return true; // Successfully handled, just not eligible
      }

      // Process the refund
      const refundData = {
        orderNumber: orderData.id || orderData.orderNumber,
        amount: calculation.refundAmount.toString(),
        method: 'Original payment method',
        processingTime: '3-5 business days',
        reason: 'Promotional refund - first-time customer offer'
      };

      const success = await sharedEmailService.processRefund(userId, customerEmail, refundData);

      if (success) {
        logger.info(LogCategory.SYSTEM, `Successfully processed automated refund`, { 
          amount: calculation.refundAmount, 
          customerEmail 
        });
      }

      return success;

    } catch (error) {
      logger.error(LogCategory.SYSTEM, 'Error processing promo refund', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      
      // Escalate on error
      await storage.createEscalationQueue({
        emailId,
        userId,
        priority: 'high',
        reason: `Promo refund automation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        status: 'pending'
      });
      
      return false;
    }
  }

  /**
   * Get refund processing statistics
   */
  async getRefundStats(userId: string, timeframe: 'today' | 'week' | 'month' = 'today') {
    const activities = await storage.getActivityLogs(userId);
    
    let startDate = new Date();
    if (timeframe === 'week') {
      startDate.setDate(startDate.getDate() - 7);
    } else if (timeframe === 'month') {
      startDate.setDate(startDate.getDate() - 30);
    } else {
      startDate.setHours(0, 0, 0, 0);
    }

    const recentActivities = activities.filter(activity => 
      activity.createdAt && new Date(activity.createdAt) >= startDate
    );

    const refundActivities = recentActivities.filter(a => a.action === 'processed_refund');
    const totalRefunds = refundActivities.length;
    const totalRefundAmount = refundActivities.reduce((sum, activity) => {
      const amount = parseFloat(activity.amount || '0');
      return sum + amount;
    }, 0);

    const automatedRefunds = refundActivities.filter(a => a.executedBy === 'ai').length;
    const manualRefunds = refundActivities.filter(a => a.executedBy === 'human').length;

    return {
      totalRefunds,
      totalRefundAmount: Math.round(totalRefundAmount * 100) / 100,
      automatedRefunds,
      manualRefunds,
      automationRate: totalRefunds > 0 ? Math.round((automatedRefunds / totalRefunds) * 100) : 0
    };
  }
}

export const promoRefundService = new PromoRefundService();