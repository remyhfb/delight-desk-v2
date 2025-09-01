import { autoResponderService } from "./auto-responder";
import { emailRoutingService } from "./email-routing";
import { storage } from "../storage";
import { logger, LogCategory } from './logger';

/**
 * Shared email processing service used by both Auto-Responders and Quick Actions
 * Now uses smart email routing (OAuth-first) with SendGrid fallback
 */
class SharedEmailService {

  private isValidEmailForProduction(email: string): boolean {
    // Block test/demo/invalid email patterns that damage sender reputation
    const blockedPatterns = [
      /^test/i,
      /^demo/i,
      /example\.com$/i,
      /test\.com$/i,
      /\.test$/i,
      /user\d+/i,
      /demo_/i,
      /\+test/i,
      /noreply/i,
      /donotreply/i
    ];
    
    return !blockedPatterns.some(pattern => pattern.test(email));
  }

  /**
   * Send order information email (used by Quick Actions and Automated Campaigns)
   */
  async sendOrderInformation(userId: string, customerEmail: string, orderData: any, campaignId?: string): Promise<boolean> {
    // CRITICAL: Validate email before sending to protect sender reputation
    if (!this.isValidEmailForProduction(customerEmail)) {
      logger.warn(LogCategory.EMAIL, 'Blocked order email send to protect sender reputation', { customerEmail });
      return false;
    }
    // Get user's system settings for company name
    const settings = await storage.getSystemSettings(userId);
    const companyName = settings?.companyName || 'your store';
    
    // Use professional email template
    const { EmailTemplates } = await import('./email-templates');
    const emailContent = EmailTemplates.generateOrderStatusEmail({
      customerName: orderData.customerName || 'Customer',
      orderNumber: orderData.orderNumber,
      status: orderData.status || 'processing',
      companyName,
      trackingNumber: orderData.tracking,
      trackingUrl: orderData.trackingUrl,
      carrier: orderData.carrier,
      aiPrediction: orderData.estimatedDelivery
    });
    
    const template = emailContent.html;

    // Use smart email routing instead of hardcoded SendGrid
    const success = await emailRoutingService.sendEmail(userId, {
      to: customerEmail,
      subject: `Status and estimated delivery date for ${companyName || 'your store'} order number ${orderData.orderNumber}`,
      html: template,
      text: template
    });

    if (success) {
      await storage.createActivityLog({
        userId,
        action: 'Sent order status',
        type: 'quick_action',
        executedBy: 'human',
        customerEmail,
        details: `Sent order information email with tracking number ${orderData.tracking || 'N/A'}`,
        status: 'completed',
        metadata: { orderData }
      });
    }

    return success;
  }

  /**
   * Process refund email (used by Quick Actions)
   */
  async processRefund(userId: string, customerEmail: string, refundData: any): Promise<boolean> {
    // CRITICAL: Validate email before sending to protect sender reputation
    if (!this.isValidEmailForProduction(customerEmail)) {
      logger.warn(LogCategory.EMAIL, 'Blocked refund email send to protect sender reputation', { customerEmail });
      return false;
    }

    // Get user's system settings for company name
    const settings = await storage.getSystemSettings(userId);
    const companyName = settings?.companyName || 'your store';
    
    // Use professional email template
    const { EmailTemplates } = await import('./email-templates');
    const emailContent = EmailTemplates.generateRefundEmail({
      customerName: refundData.customerName?.split(' ')[0] || 'Customer',
      orderNumber: refundData.orderNumber,
      refundAmount: refundData.amount,
      companyName
    });
    
    // Use from address from settings
    const fromAddress = settings?.fromEmail || 'support@delightdesk.io';
    
    const success = await emailRoutingService.sendEmail(userId, {
      to: customerEmail,
      subject: `Your ${companyName} refund has been processed - Order #${refundData.orderNumber}`,
      text: emailContent.text,
      html: emailContent.html
    });

    if (success) {
      await storage.createActivityLog({
        userId,
        action: 'Processed refund',
        type: 'quick_action',
        executedBy: 'human',
        customerEmail,
        details: `Processed refund of $${refundData.amount} for order ${refundData.orderNumber}`,
        status: 'completed',
        metadata: { refundData }
      });
    }

    return success;
  }

  /**
   * Update subscription email (used by Quick Actions)
   */
  async updateSubscription(userId: string, customerEmail: string, subscriptionData: any): Promise<boolean> {
    const template = `Dear Customer,

Your subscription has been updated successfully.

Subscription Details:
${subscriptionData.action === 'cancel' ? 'Status: Cancelled' : 
  subscriptionData.action === 'pause' ? 'Status: Paused' :
  subscriptionData.action === 'modify' ? `Updated Plan: ${subscriptionData.newPlan}` :
  'Status: Updated'}

${subscriptionData.effectiveDate ? `Effective Date: ${subscriptionData.effectiveDate}` : ''}
${subscriptionData.nextBilling ? `Next Billing Date: ${subscriptionData.nextBilling}` : ''}
${subscriptionData.reason ? `Reason: ${subscriptionData.reason}` : ''}

If you need to make any additional changes or have questions about your subscription, please contact us.

Best regards,
Customer Service Team`;

    const success = await autoResponderService.processManualResponse(
      userId, 
      customerEmail, 
      'updated_subscription', 
      template,
      { subscriptionAction: subscriptionData.action, effectiveDate: subscriptionData.effectiveDate }
    );

    if (success) {
      await storage.createActivityLog({
        userId,
        action: 'Updated subscription',
        type: 'quick_action',
        executedBy: 'human',
        customerEmail,
        details: `${subscriptionData.action === 'cancel' ? 'Cancelled' : 
                   subscriptionData.action === 'pause' ? 'Paused' :
                   subscriptionData.action === 'modify' ? 'Modified' : 'Updated'} subscription for customer`,
        status: 'completed',
        metadata: { subscriptionData }
      });
    }

    return success;
  }

  /**
   * Send custom email response (used by both systems)
   */
  async sendCustomEmail(userId: string, customerEmail: string, subject: string, message: string, action: string = 'sent_custom_email', orderNumber?: string): Promise<boolean> {
    const settings = await storage.getSystemSettings(userId);
    const fromAddress = settings?.fromEmail || 'support@delightdesk.io';
    const replyToAddress = settings?.replyToEmail || fromAddress;

    // Use smart email routing (OAuth-first) instead of SendGrid for customer emails
    const success = await emailRoutingService.sendEmail(userId, {
      to: customerEmail,
      subject: subject,
      html: message.replace(/\n/g, '<br>'),
      text: message
    });

    if (success) {
      await storage.createActivityLog({
        userId,
        action,
        type: 'custom_email',
        executedBy: 'human',
        customerEmail,
        details: `Sent custom email: ${subject}`,
        status: 'completed',
        metadata: { subject, messageLength: message.length }
      });
    }

    return success;
  }

  /**
   * Test email sending functionality
   */
  async sendTestEmail(userId: string, recipientEmail: string): Promise<boolean> {
    const testMessage = `This is a test email from your Customer Service Email Automation System.

System Status: Operational
SendGrid Integration: Active
Auto-Responder Rules: Ready

If you received this email, your email configuration is working correctly.

Best regards,
Customer Service System`;

    return await this.sendCustomEmail(
      userId, 
      recipientEmail, 
      'Customer Service System - Test Email', 
      testMessage,
      'Sent test email'
    );
  }

  /**
   * Get email sending statistics
   */
  async getEmailStats(userId: string, timeframe: 'today' | 'week' | 'month' = 'today') {
    return await autoResponderService.getProcessingStats(userId, timeframe);
  }
}

export const sharedEmailService = new SharedEmailService();