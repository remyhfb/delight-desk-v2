import { storage } from "../storage";
import { orderLookupService } from "./order-lookup";
import { sharedEmailService } from "./shared-email";
import { WooCommerceService } from "./woocommerce";
import { logger, LogCategory } from './logger';
import type { ReturnsAgentConfig, ReturnsConversation, InsertReturnsConversation } from "@shared/schema";

interface ReturnProcessingResult {
  success: boolean;
  refundProcessed?: boolean;
  refundId?: string;
  refundAmount?: number;
  escalationReason?: string;
  conversationStarted?: boolean;
  infoNeeded?: string[];
  conversationId?: string;
}

interface OrderInfo {
  id: string;
  orderNumber: string;
  total: string;
  date_created: string;
  status: string;
  [key: string]: any; // Allow additional properties from UnifiedOrderData
}

/**
 * Returns Processing Service
 * Handles return request evaluation and automatic refund processing using WooCommerce
 */
class ReturnsProcessorService {

  /**
   * Start or continue a conversation for return processing
   */
  private async handleReturnConversation(
    emailId: string,
    threadId: string,
    fromEmail: string,
    subject: string,
    body: string,
    userId: string,
    config: ReturnsAgentConfig
  ): Promise<ReturnProcessingResult> {
    // Check if conversation already exists
    const existingConversation = await storage.getReturnsConversationByThread(threadId);
    
    if (existingConversation) {
      // Continue existing conversation
      return await this.continueReturnConversation(existingConversation, body, config);
    } else {
      // Start new conversation
      return await this.startReturnConversation(emailId, threadId, fromEmail, subject, body, userId, config);
    }
  }

  /**
   * Start a new return conversation
   */
  private async startReturnConversation(
    emailId: string,
    threadId: string,
    fromEmail: string,
    subject: string,
    body: string,
    userId: string,
    config: ReturnsAgentConfig
  ): Promise<ReturnProcessingResult> {
    const orderNumber = this.extractOrderNumber(subject, body);
    const infoNeeded: string[] = [];

    // Analyze what information we need
    if (!orderNumber) {
      infoNeeded.push('order_number');
    }

    if (config.requireReasonForReturn && !this.extractReturnReason(body)) {
      infoNeeded.push('reason');
    }

    if (config.requirePhotosForDamaged && this.isDamagedItemReturn(body) && !this.hasPhotos(body)) {
      infoNeeded.push('photos');
    }

    // If we have all needed info, process normally
    if (infoNeeded.length === 0) {
      return await this.processDirectReturn(emailId, fromEmail, subject, body, userId);
    }

    // Create conversation record
    const conversationData: InsertReturnsConversation = {
      userId,
      customerEmail: fromEmail,
      threadId,
      originalEmailId: emailId,
      state: 'pending_info',
      infoNeeded,
      followUpAttempts: 0,
      orderNumber: orderNumber || null,
      orderFound: false
    };

    const conversation = await storage.createReturnsConversation(conversationData);
    
    // Send follow-up email asking for missing information
    await this.sendInfoRequestEmail(fromEmail, infoNeeded, config, conversation.id);

    return {
      success: true,
      conversationStarted: true,
      infoNeeded,
      conversationId: conversation.id
    };
  }

  /**
   * Continue an existing return conversation
   */
  private async continueReturnConversation(
    conversation: ReturnsConversation,
    newMessage: string,
    config: ReturnsAgentConfig
  ): Promise<ReturnProcessingResult> {
    const infoStillNeeded: string[] = [...(conversation.infoNeeded || [])];
    let orderData = null;

    // Process new information provided
    if (infoStillNeeded.includes('order_number')) {
      const orderNumber = this.extractOrderNumber('', newMessage);
      if (orderNumber) {
        // Look up order
        orderData = await orderLookupService.searchOrderByNumber(conversation.userId, orderNumber);
        await storage.updateReturnsConversation(conversation.id, {
          orderNumber,
          orderFound: !!orderData,
          orderData: orderData ? JSON.stringify(orderData) : null
        });
        infoStillNeeded.splice(infoStillNeeded.indexOf('order_number'), 1);
      }
    }

    if (infoStillNeeded.includes('reason') && this.extractReturnReason(newMessage)) {
      const returnReason = this.extractReturnReason(newMessage);
      await storage.updateReturnsConversation(conversation.id, {
        returnReason
      });
      infoStillNeeded.splice(infoStillNeeded.indexOf('reason'), 1);
    }

    if (infoStillNeeded.includes('photos') && this.hasPhotos(newMessage)) {
      await storage.updateReturnsConversation(conversation.id, {
        photosProvided: true
      });
      infoStillNeeded.splice(infoStillNeeded.indexOf('photos'), 1);
    }

    // Update conversation state
    if (infoStillNeeded.length === 0) {
      // All info collected, evaluate return
      return await this.evaluateReturnRequest(conversation, orderData, config);
    } else {
      // Still need more info
      const maxAttempts = config.maxFollowUpAttempts || 2;
      const currentAttempts = conversation.followUpAttempts + 1;

      if (currentAttempts >= maxAttempts) {
        // Max attempts reached, escalate
        await storage.updateReturnsConversation(conversation.id, {
          state: 'escalated',
          finalDecision: 'escalated',
          decisionReason: `Max follow-up attempts (${maxAttempts}) reached`,
          resolvedAt: new Date()
        });

        return {
          success: false,
          escalationReason: `Customer did not provide required information after ${maxAttempts} attempts`
        };
      } else {
        // Send another follow-up
        await storage.updateReturnsConversation(conversation.id, {
          followUpAttempts: currentAttempts,
          lastFollowUpAt: new Date(),
          infoNeeded: infoStillNeeded
        });

        await this.sendInfoRequestEmail(conversation.customerEmail, infoStillNeeded, config, conversation.id);

        return {
          success: true,
          conversationStarted: false,
          infoNeeded: infoStillNeeded,
          conversationId: conversation.id
        };
      }
    }
  }

  /**
   * Evaluate return request after all info is collected
   */
  private async evaluateReturnRequest(
    conversation: ReturnsConversation,
    orderData: any,
    config: ReturnsAgentConfig
  ): Promise<ReturnProcessingResult> {
    if (!orderData) {
      await storage.updateReturnsConversation(conversation.id, {
        state: 'denied',
        finalDecision: 'denied',
        decisionReason: 'Order not found',
        resolvedAt: new Date()
      });

      return {
        success: false,
        escalationReason: 'Order not found in system'
      };
    }

    // Convert to OrderInfo format
    const orderInfo: OrderInfo = {
      id: orderData.id?.toString() || orderData.orderNumber,
      orderNumber: orderData.orderNumber,
      total: orderData.total?.toString() || '0',
      date_created: orderData.date || orderData.createdAt || new Date().toISOString(),
      status: orderData.status || 'unknown'
    };

    // Check eligibility
    const eligibility = this.isEligibleForAutoApproval(orderInfo, config);
    
    if (eligibility.eligible) {
      // Approve and process
      await storage.updateReturnsConversation(conversation.id, {
        state: 'approved',
        finalDecision: 'approved',
        decisionReason: 'Meets auto-approval criteria',
        resolvedAt: new Date()
      });

      // Process refund if enabled
      let refundResult = { success: false, refundId: undefined as string | undefined, amount: undefined as number | undefined };
      if (config.enableAutoRefund) {
        refundResult = await this.processWooCommerceRefund(orderInfo, config);
      }

      // Send approval email
      await this.sendReturnApprovalEmail(conversation.customerEmail, orderInfo.orderNumber, refundResult, config);

      return {
        success: true,
        refundProcessed: refundResult.success,
        refundId: refundResult.refundId,
        refundAmount: refundResult.amount
      };
    } else {
      // Escalate for manual review
      await storage.updateReturnsConversation(conversation.id, {
        state: 'escalated',
        finalDecision: 'escalated',
        decisionReason: eligibility.reason,
        resolvedAt: new Date()
      });

      return {
        success: false,
        escalationReason: eligibility.reason
      };
    }
  }

  /**
   * Send email requesting missing information
   */
  private async sendInfoRequestEmail(
    customerEmail: string,
    infoNeeded: string[],
    config: ReturnsAgentConfig,
    conversationId: string
  ): Promise<void> {
    const infoMessages: Record<string, string> = {
      order_number: "your order number (e.g., #12345 or HFB-ABC123)",
      reason: "the reason for your return",
      photos: "photos of the damaged or defective items"
    };

    const neededList = infoNeeded.map(info => `• ${infoMessages[info] || info}`).join('\n');

    const emailTemplate = `Dear Customer,

Thank you for contacting us about your return request. To process your return quickly, we need a bit more information:

${neededList}

Please reply to this email with the requested information, and we'll review your return request right away.

If you have any questions, feel free to reach out to us.

Best regards,
Customer Service Team`;

    await sharedEmailService.sendCustomEmail(
      config.userId,
      customerEmail,
      'Return Request - Additional Information Needed',
      emailTemplate,
      'return_info_request'
    );
  }

  /**
   * Send return approval email
   */
  private async sendReturnApprovalEmail(
    customerEmail: string,
    orderNumber: string,
    refundResult: { success: boolean; refundId?: string; amount?: number },
    config: ReturnsAgentConfig
  ): Promise<void> {
    const refundText = refundResult.success 
      ? `Your refund of $${refundResult.amount} has been processed and will appear in your original payment method within 3-5 business days.`
      : "Your return has been approved. Please follow the instructions below to send back your items.";

    const emailTemplate = `Dear Customer,

Your return request for order #${orderNumber} has been approved!

${refundText}

${config.returnInstructions || 'Please package your items and send them back to us.'}

Thank you for your business, and we apologize for any inconvenience.

Best regards,
Customer Service Team`;

    await sharedEmailService.sendCustomEmail(
      config.userId,
      customerEmail,
      `Return Approved - Order #${orderNumber}`,
      emailTemplate,
      'return_approved'
    );
  }

  /**
   * Process return without conversation (when all info is available)
   */
  private async processDirectReturn(
    emailId: string,
    fromEmail: string,
    subject: string,
    body: string,
    userId: string
  ): Promise<ReturnProcessingResult> {
    // Use existing logic for direct processing
    const config = await storage.getReturnsAgentConfig(userId);
    if (!config) {
      return { success: false, escalationReason: "Returns agent not configured" };
    }

    const orderNumber = this.extractOrderNumber(subject, body);
    if (!orderNumber) {
      return { success: false, escalationReason: "Order number not found" };
    }

    const orderData = await orderLookupService.searchOrderByNumber(userId, orderNumber);
    if (!orderData) {
      return { success: false, escalationReason: `Order ${orderNumber} not found` };
    }

    const orderInfo: OrderInfo = {
      id: orderData.id?.toString() || orderData.orderNumber,
      orderNumber: orderData.orderNumber,
      total: orderData.total?.toString() || '0',
      date_created: orderData.date || orderData.createdAt || new Date().toISOString(),
      status: orderData.status || 'unknown'
    };

    const eligibility = this.isEligibleForAutoApproval(orderInfo, config);
    if (!eligibility.eligible) {
      return { success: false, escalationReason: eligibility.reason };
    }

    // Process refund
    let refundResult = { success: false, refundId: undefined as string | undefined, amount: undefined as number | undefined };
    if (config.enableAutoRefund) {
      refundResult = await this.processWooCommerceRefund(orderInfo, config);
    }

    // Send approval email
    await this.sendReturnApprovalEmail(fromEmail, orderInfo.orderNumber, refundResult, config);

    return {
      success: true,
      refundProcessed: refundResult.success,
      refundId: refundResult.refundId,
      refundAmount: refundResult.amount
    };
  }

  /**
   * Extract return reason from email content
   */
  private extractReturnReason(body: string): string | null {
    const text = body.toLowerCase();
    const reasons = ['damaged', 'defective', 'wrong size', 'wrong item', 'not as described', 'changed mind'];
    
    for (const reason of reasons) {
      if (text.includes(reason)) {
        return reason;
      }
    }
    
    return null;
  }

  /**
   * Check if this is a damaged item return
   */
  private isDamagedItemReturn(body: string): boolean {
    const text = body.toLowerCase();
    return text.includes('damaged') || text.includes('defective') || text.includes('broken');
  }

  /**
   * Check if email contains photos/attachments
   */
  private hasPhotos(body: string): boolean {
    const text = body.toLowerCase();
    return text.includes('photo') || text.includes('image') || text.includes('picture') || text.includes('attachment');
  }

  /**
   * Extract order number from email content
   */
  private extractOrderNumber(subject: string, body: string): string | null {
    const text = `${subject} ${body}`;
    
    // Look for order number patterns
    const patterns = [
      /#([A-Z0-9\-]+)/g,
      /order[:\s#]+([A-Z0-9\-]+)/gi,
      /HFB-[A-Z0-9\-]+/gi,
      /\b[A-Z0-9]{3,}-[A-Z0-9]{3,}\b/g
    ];

    for (const pattern of patterns) {
      const matches = text.match(pattern);
      if (matches) {
        for (const match of matches) {
          const cleanOrderNumber = match.replace(/^(order|#)[:\s]*/i, '').trim();
          if (cleanOrderNumber.length >= 5) {
            return cleanOrderNumber;
          }
        }
      }
    }

    return null;
  }

  /**
   * Check if order is eligible for auto-approval
   */
  private isEligibleForAutoApproval(
    orderInfo: OrderInfo, 
    config: ReturnsAgentConfig
  ): { eligible: boolean; reason?: string } {
    if (!config.enableAutoApproval) {
      return { eligible: false, reason: "Auto-approval is disabled" };
    }

    // Calculate days since purchase
    const orderDate = new Date(orderInfo.date_created);
    const daysSincePurchase = Math.floor((Date.now() - orderDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysSincePurchase > (config.autoApprovalDays || 30)) {
      return { 
        eligible: false, 
        reason: `Order is ${daysSincePurchase} days old, exceeds ${config.autoApprovalDays || 30} day auto-approval window` 
      };
    }

    // Check order status - don't auto-approve already cancelled/refunded orders
    if (['cancelled', 'refunded', 'failed'].includes(orderInfo.status.toLowerCase())) {
      return { 
        eligible: false, 
        reason: `Order status is ${orderInfo.status}, cannot process return` 
      };
    }

    return { eligible: true };
  }

  /**
   * Process automatic WooCommerce refund
   */
  private async processWooCommerceRefund(
    orderInfo: OrderInfo,
    config: ReturnsAgentConfig
  ): Promise<{ success: boolean; refundId?: string; amount?: number }> {
    if (!config.enableAutoRefund) {
      return { success: false };
    }

    try {
      logger.info(LogCategory.SYSTEM, 'Processing automatic WooCommerce refund', { 
        orderNumber: orderInfo.orderNumber,
        orderId: orderInfo.id 
      });

      // Use existing WooCommerce refund service
      const wooCommerce = new WooCommerceService();
      const refundResult = await wooCommerce.processRefund(orderInfo.id);
      
      if (refundResult.success) {
        logger.info(LogCategory.SYSTEM, 'WooCommerce refund processed successfully', {
          refundId: refundResult.refundId,
          amount: refundResult.amount
        });
      }

      return refundResult;
    } catch (error) {
      logger.error(LogCategory.SYSTEM, 'Failed to process WooCommerce refund', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        orderNumber: orderInfo.orderNumber 
      });
      return { success: false };
    }
  }

  /**
   * Process return request with smart conversation handling
   */
  async processReturnRequest(
    emailId: string,
    fromEmail: string,
    subject: string,
    body: string,
    userId: string,
    threadId?: string
  ): Promise<ReturnProcessingResult> {
    try {
      logger.info(LogCategory.SYSTEM, 'Processing return request', { 
        emailId, 
        customerEmail: fromEmail 
      });

      // Get returns agent configuration
      const config = await storage.getReturnsAgentConfig(userId);
      if (!config || !config.isEnabled) {
        return {
          success: false,
          escalationReason: "Returns agent is not enabled"
        };
      }

      // Use conversation handling if smart follow-up is enabled
      if (config.enableSmartFollowUp && threadId) {
        return await this.handleReturnConversation(
          emailId, 
          threadId, 
          fromEmail, 
          subject, 
          body, 
          userId, 
          config
        );
      }

      // Fallback to direct processing for legacy behavior
      return await this.processDirectReturn(emailId, fromEmail, subject, body, userId);

    } catch (error) {
      logger.error(LogCategory.SYSTEM, 'Error processing return request', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        emailId 
      });
      
      return {
        success: false,
        escalationReason: `Return processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Get return processing statistics
   */
  async getReturnStats(userId: string, timeframe: 'today' | 'week' | 'month' = 'today') {
    try {
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
        activity.createdAt && 
        new Date(activity.createdAt) >= startDate &&
        activity.type === 'returns_processing'
      );

      const autoReturns = recentActivities.filter(a => a.action === 'auto_return_approved').length;
      const autoReturnsWithRefunds = recentActivities.filter(a => a.action === 'auto_return_with_refund').length;
      const totalRefundAmount = recentActivities
        .filter(a => a.metadata && typeof a.metadata === 'object' && 'refundAmount' in a.metadata)
        .reduce((sum, activity) => {
          const metadata = activity.metadata as any;
          return sum + parseFloat(metadata?.refundAmount || '0');
        }, 0);

      return {
        totalReturnsProcessed: recentActivities.length,
        autoApprovals: autoReturns + autoReturnsWithRefunds,
        refundsProcessed: autoReturnsWithRefunds,
        totalRefundAmount: Math.round(totalRefundAmount * 100) / 100,
        automationRate: recentActivities.length > 0 ? 
          Math.round(((autoReturns + autoReturnsWithRefunds) / recentActivities.length) * 100) : 0
      };
    } catch (error) {
      logger.error(LogCategory.SYSTEM, 'Error getting return stats', { error });
      return {
        totalReturnsProcessed: 0,
        autoApprovals: 0,
        refundsProcessed: 0,
        totalRefundAmount: 0,
        automationRate: 0
      };
    }
  }
}

export const returnsProcessorService = new ReturnsProcessorService();