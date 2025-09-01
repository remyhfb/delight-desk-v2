import { storage } from "../storage";
import { emailRoutingService } from "./email-routing";
import { contentSafetyService } from "./content-safety";
import { WooCommerceService, OrderData as WooOrderData } from "./woocommerce";
import { ShipBobService } from "./shipbob";
import { ShipStationService } from "./shipstation";
import { logger, LogCategory } from "./logger";
import { openaiService } from "./openai";
import { 
  InsertOrderCancellationWorkflow, 
  InsertOrderCancellationEvent,
  OrderCancellationWorkflow 
} from "@shared/schema";

interface OrderEligibilityResult {
  isEligible: boolean;
  reason: string;
  orderCreatedAt: Date;
  storeTimezone: string;
}

interface OrderData {
  id: string;
  number: string;
  status: string;
  date_created: string;
  customer: {
    email: string;
    first_name?: string;
    last_name?: string;
  };
  total: string;
  billing: {
    first_name?: string;
    last_name?: string;
  };
}

export class OrderCancellationService {
  
  /**
   * Extract order number from email using AI-powered content understanding
   */
  private async extractOrderNumber(subject: string, body: string): Promise<string | null> {
    try {
      // First try quick pattern matching for performance
      const content = `${subject} ${body}`;
      const quickPatterns = [
        /#(\d{4,})/i,                    // #12345
        /order\s*#?(\d{4,})/i,          // order 12345, order #12345
        /order\s*number\s*#?(\d{4,})/i, // order number 12345
      ];
      
      for (const pattern of quickPatterns) {
        const match = content.match(pattern);
        if (match && match[1]) {
          return match[1];
        }
      }

      // If no clear match, use AI to understand order reference intent
      const prompt = `Analyze this customer email to extract any order number or order reference they mention.

Email Subject: ${subject}
Email Content: ${body}

TASK: Find any order number, order ID, or order reference the customer is mentioning.

LOOK FOR:
- Explicit order numbers (like #12345, Order 67890)
- Order IDs they reference when asking about cancellation
- Purchase numbers or confirmation numbers
- Any numeric identifiers related to their order

CONTEXT: Customer wants to cancel their order, so they would typically mention their order number.

If you find an order reference, respond with JUST the number (no symbols). 
If no clear order reference is found, respond with "NONE".

Examples:
- "Cancel order #12345" → 12345
- "I want to cancel order 67890" → 67890  
- "Please cancel my recent purchase" → NONE (no specific number mentioned)
- "Cancel my order from yesterday" → NONE (no number provided)`;

      const response = await openaiService.generateFromInstructions(
        'Extract order number from cancellation request',
        prompt,
        'Order Cancellation Service'
      );

      const cleanedResponse = response.trim();
      
      // Validate AI response
      if (cleanedResponse === 'NONE' || !cleanedResponse) {
        return null;
      }
      
      // Extract just numbers from AI response
      const numberMatch = cleanedResponse.match(/\d+/);
      return numberMatch ? numberMatch[0] : null;
      
    } catch (error) {
      logger.error(LogCategory.AUTOMATION, 'Failed to extract order number', { error });
      return null;
    }
  }

  /**
   * Find order by customer email (most recent order)
   */
  private async findOrderByCustomerEmail(userId: string, customerEmail: string): Promise<OrderData | null> {
    try {
      const storeConnections = await storage.getStoreConnections(userId);
      const wooConnection = storeConnections.find(conn => 
        conn.platform === 'woocommerce' && conn.isActive
      );

      if (!wooConnection) {
        logger.warn(LogCategory.AUTOMATION, 'No active WooCommerce connection found for order lookup');
        return null;
      }

      const wooService = new WooCommerceService({
        storeUrl: wooConnection.storeUrl,
        consumerKey: wooConnection.apiKey || '',
        consumerSecret: wooConnection.apiSecret || ''
      });

      // Search orders by customer email (get most recent)
      const wooOrderData = await wooService.searchOrderByNumber(customerEmail); // Simplified search
      if (!wooOrderData) return null;
      
      // Convert WooCommerce OrderData to our OrderData format
      return {
        id: wooOrderData.id,
        number: wooOrderData.orderNumber,
        status: wooOrderData.status,
        date_created: wooOrderData.dateCreated,
        customer: {
          email: wooOrderData.customerEmail,
          first_name: wooOrderData.customerName.split(' ')[0] || '',
          last_name: wooOrderData.customerName.split(' ')[1] || ''
        },
        total: wooOrderData.total,
        billing: {
          first_name: wooOrderData.customerName.split(' ')[0] || '',
          last_name: wooOrderData.customerName.split(' ')[1] || ''
        }
      };
    } catch (error) {
      logger.error(LogCategory.AUTOMATION, 'Failed to find order by customer email', { 
        error: error instanceof Error ? error.message : error,
        customerEmail 
      });
      return null;
    }
  }

  /**
   * Validate order data integrity and business rules
   */
  private validateOrderData(orderData: OrderData, customerEmail: string): { isValid: boolean; reason?: string } {
    // Check if order status allows cancellation
    const nonCancellableStatuses = ['completed', 'shipped', 'delivered', 'cancelled', 'refunded'];
    if (nonCancellableStatuses.includes(orderData.status?.toLowerCase())) {
      return {
        isValid: false,
        reason: `Order status '${orderData.status}' does not allow cancellation. Order has already been processed.`
      };
    }

    // Verify customer email matches
    if (orderData.customer?.email?.toLowerCase() !== customerEmail.toLowerCase()) {
      return {
        isValid: false,
        reason: 'Customer email does not match order records. Cannot process cancellation for security reasons.'
      };
    }

    // Check for refund eligibility (orders with $0 total are unusual)
    if (parseFloat(orderData.total || '0') <= 0) {
      return {
        isValid: false,
        reason: 'Order total is $0 or invalid. No refund processing required.'
      };
    }

    // Check if order is too old (beyond any reasonable cancellation window)
    const orderAge = Date.now() - new Date(orderData.date_created).getTime();
    const maxOrderAge = 30 * 24 * 60 * 60 * 1000; // 30 days
    if (orderAge > maxOrderAge) {
      return {
        isValid: false,
        reason: 'Order is too old for cancellation. Please contact customer service for assistance.'
      };
    }

    return { isValid: true };
  }

  /**
   * Check if order is eligible for cancellation based on timing rules
   */
  private checkOrderEligibility(orderCreatedAt: Date, storeTimezone: string = 'UTC'): OrderEligibilityResult {
    const now = new Date();
    const orderCreated = new Date(orderCreatedAt);
    
    // Convert to store local time (simplified - assumes store timezone is known)
    // In production, you'd use a timezone library like moment-timezone
    const orderLocalTime = new Date(orderCreated.getTime());
    const orderDay = orderLocalTime.getDay(); // 0 = Sunday, 5 = Friday, 6 = Saturday
    const orderHour = orderLocalTime.getHours();
    
    // Rule 2: Weekend orders (Fri after 12:00, Sat/Sun) are eligible until Mon 12:00
    if (orderDay === 5 && orderHour >= 12) { // Friday after 12:00
      const mondayNoon = new Date(orderLocalTime);
      mondayNoon.setDate(mondayNoon.getDate() + (8 - orderDay)); // Next Monday
      mondayNoon.setHours(12, 0, 0, 0);
      
      if (now <= mondayNoon) {
        return {
          isEligible: true,
          reason: "Friday afternoon order - eligible until Monday 12:00 PM",
          orderCreatedAt: orderCreated,
          storeTimezone
        };
      }
    }
    
    if (orderDay === 6 || orderDay === 0) { // Saturday or Sunday
      const nextMonday = new Date(orderLocalTime);
      nextMonday.setDate(nextMonday.getDate() + (1 + 7 - orderDay) % 7); // Next Monday
      nextMonday.setHours(12, 0, 0, 0);
      
      if (now <= nextMonday) {
        return {
          isEligible: true,
          reason: "Weekend order - eligible until Monday 12:00 PM",
          orderCreatedAt: orderCreated,
          storeTimezone
        };
      }
    }
    
    // Rule 3: Otherwise, eligible if within 24 hours
    const twentyFourHoursLater = new Date(orderCreated.getTime() + 24 * 60 * 60 * 1000);
    if (now <= twentyFourHoursLater) {
      return {
        isEligible: true,
        reason: "Within 24-hour cancellation window",
        orderCreatedAt: orderCreated,
        storeTimezone
      };
    }
    
    // Rule 5: If uncertain, proceed with cancellation attempt
    return {
      isEligible: true,
      reason: "Proceeding with cancellation attempt as per policy",
      orderCreatedAt: orderCreated,
      storeTimezone
    };
  }

  /**
   * Send customer acknowledgment email (Step 2)
   */
  private async sendCustomerAcknowledgment(userId: string, customerEmail: string, orderNumber: string): Promise<boolean> {
    try {
      const subject = "We're on it — your cancellation request";
      const body = `We received your cancellation request and are checking with the warehouse to stop the order before it ships. We'll update you as soon as we hear back.

— Automated by DelightDesk AI for expediency. A human is monitoring.`;

      // CRITICAL: Validate content safety before sending
      const safetyValidation = await contentSafetyService.validateResponse(body, userId, 'customer_communication');
      
      if (!safetyValidation.approved) {
        logger.error(LogCategory.AUTOMATION, 'Customer acknowledgment email blocked by safety validation', { 
          customerEmail, 
          orderNumber,
          blockReason: safetyValidation.blockReason 
        });
        return false;
      }

      const success = await emailRoutingService.sendEmail(userId, {
        to: customerEmail,
        subject,
        text: body,
        html: body.replace(/\n/g, '<br>')
      });

      // CRITICAL: Log customer acknowledgment activity
      if (success) {
        await storage.createActivityLog({
          userId,
          customerEmail,
          action: 'sent_customer_acknowledgment',
          type: 'email_processed',
          details: `Sent cancellation acknowledgment for order #${orderNumber}`,
          metadata: {
            orderNumber,
            emailType: 'customer_acknowledgment',
            automationType: 'order_cancellation'
          },
          executedBy: 'ai'
        });
      }

      return success;
    } catch (error) {
      logger.error(LogCategory.AUTOMATION, 'Failed to send customer acknowledgment', { 
        error: error instanceof Error ? error.message : error,
        customerEmail,
        orderNumber 
      });
      return false;
    }
  }

  /**
   * Send warehouse cancellation request (Step 3)
   */
  private async sendWarehouseEmail(userId: string, warehouseEmail: string, orderNumber: string, isTestMode: boolean = false): Promise<boolean> {
    try {
      const subject = `${isTestMode ? '[TEST] ' : ''}URGENT: Cancel Order #${orderNumber}`;
      const body = `${isTestMode ? '[THIS IS A TEST EMAIL - NO ACTION REQUIRED]\n\n' : ''}Please cancel Order #${orderNumber} if it has not been picked or shipped.

Reply 'Canceled' or 'Cannot cancel'.

— Automated by DelightDesk AI for expediency. A human is monitoring.${isTestMode ? '\n\n[TEST MODE: This email was generated for testing purposes]' : ''}`;

      if (isTestMode) {
        logger.info(LogCategory.AUTOMATION, `Test mode: Sending warehouse email to test address ${warehouseEmail}`);
      }

      // CRITICAL: Validate content safety before sending
      const safetyValidation = await contentSafetyService.validateResponse(body, userId, 'customer_communication');
      
      if (!safetyValidation.approved) {
        logger.error(LogCategory.AUTOMATION, 'Warehouse email blocked by safety validation', { 
          warehouseEmail, 
          orderNumber,
          blockReason: safetyValidation.blockReason 
        });
        return false;
      }

      const success = await emailRoutingService.sendEmail(userId, {
        to: warehouseEmail,
        subject,
        text: body,
        html: body.replace(/\n/g, '<br>')
      });

      // CRITICAL: Log warehouse email activity
      if (success) {
        await storage.createActivityLog({
          userId,
          customerEmail: warehouseEmail,
          action: 'sent_warehouse_cancellation_request',
          type: 'email_processed',
          details: `Sent warehouse cancellation request for order #${orderNumber}${isTestMode ? ' (TEST MODE)' : ''}`,
          metadata: {
            orderNumber,
            warehouseEmail,
            emailType: 'warehouse_request',
            automationType: 'order_cancellation',
            isTestMode
          },
          executedBy: 'ai'
        });
      }

      return success;
    } catch (error) {
      logger.error(LogCategory.AUTOMATION, 'Failed to send warehouse email', { 
        error: error instanceof Error ? error.message : error,
        warehouseEmail,
        orderNumber,
        isTestMode 
      });
      return false;
    }
  }

  private async getUserEmail(userId: string): Promise<string> {
    try {
      const user = await storage.getUser(userId);
      return user?.email || 'test@example.com';
    } catch (error) {
      logger.error(LogCategory.AUTOMATION, 'Failed to get user email for test mode', { error });
      return 'test@example.com';
    }
  }

  /**
   * Process WooCommerce order cancellation and refund (Step 5)
   */
  private async processOrderCancellationAndRefund(userId: string, orderNumber: string): Promise<{ success: boolean; refundId?: string; amount?: number }> {
    try {
      const storeConnections = await storage.getStoreConnections(userId);
      const wooConnection = storeConnections.find(conn => 
        conn.platform === 'woocommerce' && conn.isActive
      );

      if (!wooConnection) {
        throw new Error('No active WooCommerce connection found');
      }

      const wooService = new WooCommerceService({
        storeUrl: wooConnection.storeUrl,
        consumerKey: wooConnection.apiKey || '',
        consumerSecret: wooConnection.apiSecret || ''
      });

      // Update order status to cancelled
      await wooService.updateOrderStatus(orderNumber, 'cancelled');

      // Process full refund
      const refundResult = await wooService.processRefund(orderNumber, userId);

      if (typeof refundResult === 'boolean') {
        return { success: refundResult };
      }
      return {
        success: refundResult.success,
        refundId: refundResult.refundId,
        amount: refundResult.amount
      };
    } catch (error) {
      logger.error(LogCategory.AUTOMATION, 'Failed to process order cancellation and refund', { 
        error: error instanceof Error ? error.message : error,
        orderNumber 
      });
      return { success: false };
    }
  }

  /**
   * Send final customer notification (Steps 5 & 6)
   */
  private async sendFinalCustomerNotification(
    userId: string, 
    customerEmail: string, 
    orderNumber: string, 
    wasCanceled: boolean,
    refundAmount?: number
  ): Promise<boolean> {
    try {
      let subject: string;
      let body: string;

      if (wasCanceled) {
        // Step 5: Order canceled successfully
        subject = `Order #${orderNumber} canceled and refunded`;
        body = `Good news — the warehouse caught your order in time. We've canceled Order #${orderNumber} and issued a refund to your original payment method.

— Automated by DelightDesk AI for expediency. Reply back "human" for help.`;
      } else {
        // Step 6: Order could not be canceled
        subject = `Order #${orderNumber} — cancellation attempt result`;
        body = `We weren't able to retrieve your order before it shipped. If you'd like to initiate a return, reply to this email and we'll help.

— Automated by DelightDesk AI for expediency. Reply back "human" for help.`;
      }

      // CRITICAL: Validate content safety before sending
      const safetyValidation = await contentSafetyService.validateResponse(body, userId, 'customer_communication');
      
      if (!safetyValidation.approved) {
        logger.error(LogCategory.AUTOMATION, 'Final customer notification blocked by safety validation', { 
          customerEmail, 
          orderNumber,
          blockReason: safetyValidation.blockReason 
        });
        return false;
      }

      const success = await emailRoutingService.sendEmail(userId, {
        to: customerEmail,
        subject,
        text: body,
        html: body.replace(/\n/g, '<br>')
      });

      return success;
    } catch (error) {
      logger.error(LogCategory.AUTOMATION, 'Failed to send final customer notification', { 
        error: error instanceof Error ? error.message : error,
        customerEmail,
        orderNumber,
        wasCanceled 
      });
      return false;
    }
  }



  /**
   * Send order cancellation to approval queue
   */
  private async sendToApprovalQueue(
    emailId: string,
    userId: string,
    customerEmail: string,
    subject: string,
    body: string,
    orderNumber: string,
    orderData: OrderData,
    eligibility: OrderEligibilityResult,
    fulfillmentMethod: string
  ): Promise<{ success: boolean; workflowId?: string; error?: string }> {
    try {
      // Generate the proposed customer response based on eligibility
      let proposedResponse: string;
      
      if (eligibility.isEligible) {
        proposedResponse = `Hi there,

We've received your cancellation request for Order #${orderNumber}. We're checking with our fulfillment team to see if we can catch your order before it ships.

We'll update you shortly with the results. If we can't stop the shipment in time, we'll help you set up a return instead.

Best regards,
Customer Service Team`;
      } else {
        proposedResponse = `Hi there,

We received your cancellation request for Order #${orderNumber}. Unfortunately, this order was placed outside our cancellation window and has likely already been processed for shipping.

If you'd like to initiate a return once you receive your order, please reply to this email and we'll help you get that started.

Best regards,
Customer Service Team`;
      }

      // Generate planned actions showing what's COMPLETED vs what's PENDING
      const plannedActions = [];
      
      // Step 1: COMPLETED - Eligibility check already done
      if (eligibility.isEligible) {
        plannedActions.push('✅ COMPLETED: Eligibility check - Order #' + orderNumber + ' is eligible for cancellation (' + eligibility.reason + ')');
        plannedActions.push('✅ COMPLETED: Customer email drafted - "We\'re on it — checking with warehouse" (awaiting your approval)');
        
        // Steps that will happen IF approved
        if (fulfillmentMethod === 'warehouse_email') {
          plannedActions.push('⏳ PENDING: Send drafted customer email (if approved)');
          plannedActions.push('⏳ PENDING: Create cancellation workflow record in database');
          plannedActions.push('⏳ PENDING: Send urgent warehouse email "URGENT: Cancel Order #' + orderNumber + '" to remy@dateid.com');
          plannedActions.push('⏳ PENDING: Update workflow status to "awaiting_warehouse"');
          plannedActions.push('⏳ PENDING: Wait for warehouse response ("Canceled" or "Cannot cancel")');
          plannedActions.push('⏳ PENDING: Process order cancellation and refund in WooCommerce if confirmed');
          plannedActions.push('⏳ PENDING: Send final customer notification with refund details or return instructions');
        } else if (fulfillmentMethod === 'shipbob') {
          plannedActions.push('⏳ PENDING: Send drafted customer email (if approved)');
          plannedActions.push('⏳ PENDING: Create cancellation workflow record in database');
          plannedActions.push('⏳ PENDING: Attempt ShipBob API cancellation');
          plannedActions.push('⏳ PENDING: Process WooCommerce cancellation and refund if successful');
          plannedActions.push('⏳ PENDING: Send success email with refund details OR return instructions if too late');
        } else if (fulfillmentMethod === 'self_fulfillment') {
          plannedActions.push('⏳ PENDING: Send drafted customer email (if approved)');
          plannedActions.push('⏳ PENDING: Create cancellation workflow record in database');
          plannedActions.push('⏳ PENDING: Mark order for manual cancellation processing');
          plannedActions.push('⏳ PENDING: Update status to "awaiting_manual" for human review');
        }
      } else {
        // For ineligible orders
        plannedActions.push('✅ COMPLETED: Eligibility check - Order #' + orderNumber + ' is NOT eligible for cancellation (' + eligibility.reason + ')');
        plannedActions.push('✅ COMPLETED: Rejection email drafted - Explains order outside cancellation window (awaiting your approval)');
        plannedActions.push('⏳ PENDING: Send drafted rejection email (if approved)');
        plannedActions.push('⏳ PENDING: Offer return process instead of cancellation');
      }

      // Create approval queue item
      await storage.createAutomationApprovalItem({
        userId,
        emailId,
        ruleId: 'system-order-cancellation-rule', // System-generated rule for order cancellations
        customerEmail,
        subject,
        body,
        classification: 'order_cancellation',
        proposedResponse,
        confidence: eligibility.isEligible ? 0.9 : 0.95, // High confidence for clear eligibility
        status: 'pending',
        metadata: {
          orderNumber,
          fulfillmentMethod,
          isEligible: eligibility.isEligible,
          eligibilityReason: eligibility.reason,
          orderData: JSON.stringify(orderData),
          automationType: 'order_cancellation',
          plannedActions
        }
      });

      // Log the activity
      await storage.createActivityLog({
        userId,
        customerEmail,
        action: 'sent_to_approval_queue',
        type: 'email_processed',
        details: `Order cancellation for #${orderNumber} sent to approval queue - ${eligibility.isEligible ? 'eligible' : 'not eligible'} for cancellation`,
        metadata: {
          orderNumber,
          fulfillmentMethod,
          isEligible: eligibility.isEligible,
          automationType: 'order_cancellation'
        },
        executedBy: 'ai'
      });

      console.log(`Order cancellation sent to approval queue: Order #${orderNumber} (${eligibility.isEligible ? 'eligible' : 'not eligible'})`);
      
      return {
        success: true,
        error: 'Order cancellation request sent to approval queue for human review'
      };

    } catch (error) {
      console.error('Error sending order cancellation to approval queue:', error);
      return {
        success: false,
        error: 'Failed to send order cancellation to approval queue'
      };
    }
  }

  /**
   * Log workflow event
   */
  private async logWorkflowEvent(
    workflowId: string, 
    eventType: string, 
    description: string, 
    metadata?: any
  ): Promise<void> {
    try {
      await storage.createOrderCancellationEvent({
        workflowId,
        eventType,
        description,
        metadata: metadata ? JSON.stringify(metadata) : null
      });
    } catch (error) {
      logger.error(LogCategory.AUTOMATION, 'Failed to log workflow event', { error, workflowId });
    }
  }

  /**
   * Initialize order cancellation workflow (Step 1)
   */
  async initiateCancellationWorkflow(
    userId: string, 
    emailId: string, 
    customerEmail: string, 
    subject: string, 
    body: string,
    isTestMode: boolean = false,
    warehouseTestEmail?: string
  ): Promise<{ success: boolean; workflowId?: string; error?: string }> {
    try {
      // Get system settings to determine fulfillment method
      const settings = await storage.getSystemSettings(userId);
      const fulfillmentMethod = settings?.fulfillmentMethod || 'warehouse_email';

      // Validate configuration based on fulfillment method
      if (fulfillmentMethod === 'warehouse_email' && !settings?.warehouseEmail) {
        return { 
          success: false, 
          error: 'Warehouse email not configured in settings. Please add warehouse contact email to enable order cancellations.' 
        };
      }

      if (fulfillmentMethod === 'shipbob' && (!settings?.shipbobAccessToken || !settings?.shipbobChannelId)) {
        return { 
          success: false, 
          error: 'ShipBob OAuth not configured. Please connect your ShipBob account via OAuth in settings.' 
        };
      }

      if (fulfillmentMethod === 'shipstation' && (!settings?.shipstationApiKey || !settings?.shipstationApiSecret)) {
        return { 
          success: false, 
          error: 'ShipStation API not configured. Please add your ShipStation API credentials in settings.' 
        };
      }

      // Step 1: Extract order number or find by customer email
      let orderNumber = await this.extractOrderNumber(subject, body);
      let orderData: OrderData | null = null;

      if (!orderNumber) {
        // Try to find most recent order by customer email
        orderData = await this.findOrderByCustomerEmail(userId, customerEmail);
        if (orderData) {
          orderNumber = orderData.number;
        }
      } else {
        // Verify order exists and get order data
        const storeConnections = await storage.getStoreConnections(userId);
        const wooConnection = storeConnections.find(conn => 
          conn.platform === 'woocommerce' && conn.isActive
        );

        if (wooConnection) {
          const wooService = new WooCommerceService({
            storeUrl: wooConnection.storeUrl,
            consumerKey: wooConnection.apiKey || '',
            consumerSecret: wooConnection.apiSecret || ''
          });

          const wooOrderData = await wooService.searchOrderByNumber(orderNumber);
          if (wooOrderData) {
            // Convert WooCommerce OrderData to our OrderData format
            orderData = {
              id: wooOrderData.id,
              number: wooOrderData.orderNumber,
              status: wooOrderData.status,
              date_created: wooOrderData.dateCreated,
              customer: {
                email: wooOrderData.customerEmail,
                first_name: wooOrderData.customerName.split(' ')[0] || '',
                last_name: wooOrderData.customerName.split(' ')[1] || ''
              },
              total: wooOrderData.total,
              billing: {
                first_name: wooOrderData.customerName.split(' ')[0] || '',
                last_name: wooOrderData.customerName.split(' ')[1] || ''
              }
            };
          }
        }
      }

      if (!orderNumber || !orderData) {
        // In test mode, create a mock order to allow workflow testing
        if (isTestMode && orderNumber) {
          orderData = {
            id: 'test-order-id',
            number: orderNumber,
            status: 'processing',
            date_created: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
            customer: {
              email: customerEmail,
              first_name: 'Test',
              last_name: 'Customer'
            },
            total: '99.99',
            billing: {
              first_name: 'Test',
              last_name: 'Customer'
            }
          };
        } else {
          return { 
            success: false, 
            error: 'Could not identify order from email. Email will be escalated for human review.' 
          };
        }
      }

      // Step 2: Validate order data before processing
      const orderValidation = this.validateOrderData(orderData, customerEmail);
      if (!orderValidation.isValid) {
        return { 
          success: false, 
          error: orderValidation.reason 
        };
      }

      // Step 3: Check eligibility FIRST - this determines the response to customer
      const eligibility = this.checkOrderEligibility(new Date(orderData.date_created));

      // Step 2.5: Validate email security and fraud prevention
      const emailSecurity = await this.validateEmailSecurity(userId, customerEmail, orderNumber);
      if (!emailSecurity.isValid) {
        return { 
          success: false, 
          error: emailSecurity.reason 
        };
      }

      // Step 2.6: Validate integration health
      const integrationHealth = await this.validateIntegrationHealth(userId, fulfillmentMethod);
      if (!integrationHealth.isHealthy) {
        return { 
          success: false, 
          error: `Service temporarily unavailable: ${integrationHealth.reason}. Please try again later or contact support.` 
        };
      }

      // Step 2.7: Check if automation approval is required
      const approvalRequired = settings?.automationApprovalRequired ?? false;
      
      if (approvalRequired) {
        // Send to approval queue instead of processing automatically
        return await this.sendToApprovalQueue(
          emailId,
          userId,
          customerEmail,
          subject,
          body,
          orderNumber,
          orderData,
          eligibility,
          fulfillmentMethod
        );
      }

      // Route to appropriate fulfillment method for eligibility check
      if (fulfillmentMethod === 'shipbob') {
        return await this.processShipBobCancellation(userId, emailId, orderNumber, orderData, customerEmail, settings!, eligibility);
      } else if (fulfillmentMethod === 'shipstation') {
        return await this.processShipStationCancellation(userId, emailId, orderNumber, orderData, customerEmail, settings!, eligibility);
      } else if (fulfillmentMethod === 'self_fulfillment') {
        return await this.processSelfFulfillmentCancellation(userId, emailId, orderNumber, orderData, customerEmail, eligibility, isTestMode);
      } else {
        // Default warehouse email coordination
        return await this.processWarehouseEmailCancellation(userId, emailId, orderNumber, orderData, customerEmail, settings!, eligibility, isTestMode, warehouseTestEmail);
      }

    } catch (error) {
      logger.error(LogCategory.AUTOMATION, 'Failed to initiate cancellation workflow', { 
        error: error instanceof Error ? error.message : error,
        userId,
        customerEmail 
      });
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to initiate cancellation workflow' 
      };
    }
  }

  /**
   * Validate email-level security and fraud prevention
   */
  private async validateEmailSecurity(userId: string, customerEmail: string, orderNumber: string): Promise<{ isValid: boolean; reason?: string }> {
    try {
      // Check for duplicate cancellation requests within short timeframe
      const recentWorkflows = await storage.getOrderCancellationWorkflows(userId, {
        customerEmail,
        orderNumber,
        since: new Date(Date.now() - 60 * 60 * 1000) // Last hour
      });

      if (recentWorkflows.length > 0) {
        return {
          isValid: false,
          reason: 'Duplicate cancellation request detected. Previous request is still being processed.'
        };
      }

      // Check for suspicious patterns (e.g., many cancellations from same email)
      const dailyWorkflows = await storage.getOrderCancellationWorkflows(userId, {
        customerEmail,
        since: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
      });

      if (dailyWorkflows.length >= 5) {
        return {
          isValid: false,
          reason: 'Too many cancellation requests from this email address. Please contact customer service.'
        };
      }

      return { isValid: true };
    } catch (error) {
      logger.error(LogCategory.AUTOMATION, 'Email security validation failed', { error, customerEmail, orderNumber });
      // Allow processing to continue if validation fails (don't block legitimate requests)
      return { isValid: true };
    }
  }

  /**
   * Validate integration health before processing
   */
  private async validateIntegrationHealth(userId: string, fulfillmentMethod: string): Promise<{ isHealthy: boolean; reason?: string }> {
    try {
      if (fulfillmentMethod === 'shipbob') {
        const settings = await storage.getSystemSettings(userId);
        if (!settings?.shipbobAccessToken) {
          return { isHealthy: false, reason: 'ShipBob integration disconnected' };
        }
        
        // Perform actual ShipBob health check
        const shipbobService = new ShipBobService({
          accessToken: settings.shipbobAccessToken,
          channelId: settings.shipbobChannelId,
          useSandbox: process.env.NODE_ENV === 'development'
        });
        const healthCheck = await shipbobService.healthCheck();
        if (!healthCheck.isHealthy) {
          return { isHealthy: false, reason: healthCheck.reason || 'ShipBob API unavailable' };
        }
      }

      if (fulfillmentMethod === 'shipstation') {
        const settings = await storage.getSystemSettings(userId);
        if (!settings?.shipstationApiKey || !settings?.shipstationApiSecret) {
          return { isHealthy: false, reason: 'ShipStation API credentials not configured' };
        }
        
        // Perform actual ShipStation health check
        const shipstationService = new ShipStationService({
          apiKey: settings.shipstationApiKey,
          apiSecret: settings.shipstationApiSecret,
          useSandbox: process.env.NODE_ENV === 'development'
        });
        const healthCheck = await shipstationService.healthCheck();
        if (!healthCheck.isHealthy) {
          return { isHealthy: false, reason: healthCheck.message || 'ShipStation API unavailable' };
        }
      }

      if (fulfillmentMethod === 'warehouse_email') {
        const settings = await storage.getSystemSettings(userId);
        if (!settings?.warehouseEmail) {
          return { isHealthy: false, reason: 'Warehouse email not configured' };
        }
        
        // Check email service health
        const emailHealth = await emailRoutingService.healthCheck(userId);
        if (!emailHealth.isHealthy) {
          return { isHealthy: false, reason: emailHealth.reason || 'Email service unavailable' };
        }
      }

      return { isHealthy: true };
    } catch (error) {
      return { isHealthy: false, reason: `Integration health check failed: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
  }

  /**
   * Execute an already-approved order cancellation workflow
   * This is called after human approval in the approval queue
   */
  async executeApprovedCancellationWorkflow(approvalItem: any): Promise<{ success: boolean; workflowId?: string; error?: string }> {
    try {
      const metadata = approvalItem.metadata;
      const orderNumber = metadata.orderNumber;
      const fulfillmentMethod = metadata.fulfillmentMethod || 'warehouse_email';
      const isEligible = metadata.isEligible;
      const orderData = JSON.parse(metadata.orderData);
      
      logger.info(LogCategory.AUTOMATION, `Executing approved order cancellation workflow`, {
        orderNumber,
        fulfillmentMethod,
        isEligible,
        customerEmail: approvalItem.customerEmail
      });

      // Step 1: Send initial customer acknowledgment email first
      await this.sendCustomerAcknowledgment(approvalItem.userId, approvalItem.customerEmail, orderNumber);
      
      if (!isEligible) {
        // For ineligible orders, just send explanatory email (already done above)
        return { success: true };
      }

      // For eligible orders, execute the appropriate fulfillment method
      if (fulfillmentMethod === 'warehouse_email') {
        return await this.executeWarehouseEmailWorkflow(approvalItem.userId, approvalItem.emailId, orderNumber, orderData, approvalItem.customerEmail);
      } else if (fulfillmentMethod === 'shipbob') {
        return await this.executeShipBobWorkflow(approvalItem.userId, approvalItem.emailId, orderNumber, orderData, approvalItem.customerEmail);
      } else if (fulfillmentMethod === 'shipstation') {
        return await this.executeShipStationWorkflow(approvalItem.userId, approvalItem.emailId, orderNumber, orderData, approvalItem.customerEmail);
      } else if (fulfillmentMethod === 'self_fulfillment') {
        return await this.executeSelfFulfillmentWorkflow(approvalItem.userId, approvalItem.emailId, orderNumber, orderData, approvalItem.customerEmail);
      }

      return { success: false, error: 'Unknown fulfillment method' };
    } catch (error) {
      logger.error(LogCategory.AUTOMATION, 'Failed to execute approved cancellation workflow', { 
        error: error instanceof Error ? error.message : error,
        approvalItemId: approvalItem.id
      });
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to execute approved cancellation workflow' 
      };
    }
  }

  /**
   * Execute warehouse email workflow after approval
   */
  private async executeWarehouseEmailWorkflow(
    userId: string,
    emailId: string,
    orderNumber: string,
    orderData: OrderData,
    customerEmail: string
  ): Promise<{ success: boolean; workflowId?: string; error?: string }> {
    try {
      const settings = await storage.getSystemSettings(userId);
      
      // Create workflow record
      const workflow = await storage.createOrderCancellationWorkflow({
        userId,
        emailId,
        orderNumber,
        orderPlatform: 'woocommerce',
        customerEmail,
        warehouseEmail: settings?.warehouseEmail || '',
        fulfillmentMethod: 'warehouse_email',
        orderCreatedAt: new Date(orderData.date_created),
        storeTimezone: 'UTC',
        isEligible: true,
        eligibilityReason: 'Approved by human',
        status: 'processing',
        step: 'email_warehouse',
        timeout: new Date(Date.now() + (8 * 60 * 60 * 1000))
      });

      // Send warehouse email
      const warehouseEmailSent = await this.sendWarehouseEmail(userId, settings?.warehouseEmail || '', orderNumber);
      
      if (warehouseEmailSent) {
        await storage.updateOrderCancellationWorkflow(workflow.id, {
          warehouseEmailSent: true,
          customerAcknowledgmentSent: true,
          step: 'await_warehouse',
          status: 'awaiting_warehouse'
        });
        await this.logWorkflowEvent(workflow.id, 'email_sent', 'Warehouse cancellation request sent after approval');
      }

      return { success: true, workflowId: workflow.id };
    } catch (error) {
      logger.error(LogCategory.AUTOMATION, 'Failed to execute warehouse email workflow', { error });
      return { success: false, error: error instanceof Error ? error.message : 'Failed to execute warehouse workflow' };
    }
  }

  /**
   * Execute ShipStation workflow after approval
   */
  private async executeShipStationWorkflow(
    userId: string,
    emailId: string,
    orderNumber: string,
    orderData: OrderData,
    customerEmail: string
  ): Promise<{ success: boolean; workflowId?: string; error?: string }> {
    try {
      const settings = await storage.getSystemSettings(userId);
      
      // Create workflow record
      const workflow = await storage.createOrderCancellationWorkflow({
        userId,
        emailId,
        orderNumber,
        orderPlatform: 'woocommerce',
        customerEmail,
        warehouseEmail: '',
        fulfillmentMethod: 'shipstation',
        orderCreatedAt: new Date(orderData.date_created),
        storeTimezone: 'UTC',
        isEligible: true,
        eligibilityReason: 'Approved by human',
        status: 'processing',
        step: 'cancel_shipment',
        timeout: new Date(Date.now() + (2 * 60 * 60 * 1000))
      });

      // Attempt ShipStation cancellation
      if (settings?.shipstationApiKey && settings?.shipstationApiSecret) {
        const shipstationService = new ShipStationService({
          apiKey: settings.shipstationApiKey,
          apiSecret: settings.shipstationApiSecret
        });
        
        // Find the order first
        const shipstationOrder = await shipstationService.findOrderByNumber(orderNumber);
        if (!shipstationOrder) {
          await storage.updateOrderCancellationWorkflow(workflow.id, {
            status: 'failed',
            step: 'failed',
            escalationReason: 'Order not found in ShipStation'
          });
          return { success: false, error: 'Order not found in ShipStation' };
        }
        
        const cancelResult = await shipstationService.cancelOrder(shipstationOrder.orderId);
        
        if (cancelResult.success) {
          // Process WooCommerce cancellation and refund
          const refundResult = await this.processOrderCancellationAndRefund(userId, orderNumber);
          
          await storage.updateOrderCancellationWorkflow(workflow.id, {
            wasCanceled: true,
            customerAcknowledgmentSent: true,
            refundProcessed: refundResult.success,
            step: 'completed',
            status: 'completed'
          });
          
          // Send success email
          await this.sendFinalCustomerNotification(userId, customerEmail, orderNumber, true, refundResult.amount);
        } else {
          // ShipStation cancellation failed - send return instructions
          await storage.updateOrderCancellationWorkflow(workflow.id, {
            customerAcknowledgmentSent: true,
            step: 'failed',
            status: 'failed'
          });
          
          await this.sendFinalCustomerNotification(userId, customerEmail, orderNumber, false);
        }
      }

      return { success: true, workflowId: workflow.id };
    } catch (error) {
      logger.error(LogCategory.AUTOMATION, 'Failed to execute ShipStation workflow', { error });
      return { success: false, error: error instanceof Error ? error.message : 'Failed to execute ShipStation workflow' };
    }
  }

  /**
   * Execute ShipBob workflow after approval
   */
  private async executeShipBobWorkflow(
    userId: string,
    emailId: string,
    orderNumber: string,
    orderData: OrderData,
    customerEmail: string
  ): Promise<{ success: boolean; workflowId?: string; error?: string }> {
    try {
      const settings = await storage.getSystemSettings(userId);
      
      // Create workflow record
      const workflow = await storage.createOrderCancellationWorkflow({
        userId,
        emailId,
        orderNumber,
        orderPlatform: 'woocommerce',
        customerEmail,
        warehouseEmail: '',
        fulfillmentMethod: 'shipbob',
        orderCreatedAt: new Date(orderData.date_created),
        storeTimezone: 'UTC',
        isEligible: true,
        eligibilityReason: 'Approved by human',
        status: 'processing',
        step: 'cancel_shipment',
        timeout: new Date(Date.now() + (2 * 60 * 60 * 1000))
      });

      // Attempt ShipBob cancellation
      if (settings?.shipbobAccessToken && settings?.shipbobChannelId) {
        const shipbobService = new ShipBobService({
          accessToken: settings.shipbobAccessToken,
          channelId: settings.shipbobChannelId
        });
        const cancelResult = await shipbobService.cancelOrder(parseInt(orderNumber));
        
        if (cancelResult.success) {
          // Process WooCommerce cancellation and refund
          const refundResult = await this.processOrderCancellationAndRefund(userId, orderNumber);
          
          await storage.updateOrderCancellationWorkflow(workflow.id, {
            wasCanceled: true,
            customerAcknowledgmentSent: true,
            refundProcessed: refundResult.success,
            step: 'completed',
            status: 'completed'
          });
          
          // Send success email
          await this.sendFinalCustomerNotification(userId, customerEmail, orderNumber, true, refundResult.amount);
        } else {
          // ShipBob cancellation failed - send return instructions
          await storage.updateOrderCancellationWorkflow(workflow.id, {
            customerAcknowledgmentSent: true,
            step: 'failed',
            status: 'failed'
          });
          
          await this.sendFinalCustomerNotification(userId, customerEmail, orderNumber, false);
        }
      }

      return { success: true, workflowId: workflow.id };
    } catch (error) {
      logger.error(LogCategory.AUTOMATION, 'Failed to execute ShipBob workflow', { error });
      return { success: false, error: error instanceof Error ? error.message : 'Failed to execute ShipBob workflow' };
    }
  }

  /**
   * Execute self-fulfillment workflow after approval
   */
  private async executeSelfFulfillmentWorkflow(
    userId: string,
    emailId: string,
    orderNumber: string,
    orderData: OrderData,
    customerEmail: string
  ): Promise<{ success: boolean; workflowId?: string; error?: string }> {
    try {
      // Create workflow record
      const workflow = await storage.createOrderCancellationWorkflow({
        userId,
        emailId,
        orderNumber,
        orderPlatform: 'woocommerce',
        customerEmail,
        warehouseEmail: '',
        fulfillmentMethod: 'self_fulfillment',
        orderCreatedAt: new Date(orderData.date_created),
        storeTimezone: 'UTC',
        isEligible: true,
        eligibilityReason: 'Approved by human',
        status: 'processing',
        step: 'manual_processing',
        timeout: new Date(Date.now() + (24 * 60 * 60 * 1000))
      });

      // For self-fulfillment, mark for manual processing
      await storage.updateOrderCancellationWorkflow(workflow.id, {
        customerAcknowledgmentSent: true,
        step: 'awaiting_manual',
        status: 'awaiting_manual'
      });
      
      await this.logWorkflowEvent(workflow.id, 'manual_processing', 'Order marked for manual cancellation processing after approval');

      return { success: true, workflowId: workflow.id };
    } catch (error) {
      logger.error(LogCategory.AUTOMATION, 'Failed to execute self-fulfillment workflow', { error });
      return { success: false, error: error instanceof Error ? error.message : 'Failed to execute self-fulfillment workflow' };
    }
  }

  /**
   * Process warehouse email coordination fulfillment
   */
  private async processWarehouseEmailCancellation(
    userId: string,
    emailId: string,
    orderNumber: string,
    orderData: OrderData,
    customerEmail: string,
    settings: any,
    eligibility: OrderEligibilityResult,
    isTestMode: boolean = false,
    warehouseTestEmail?: string
  ): Promise<{ success: boolean; workflowId?: string; error?: string }> {
    try {
      // Step 2: Check if order is eligible for cancellation
      if (!eligibility.isEligible) {
        // Send "cannot cancel" email immediately (first communication)
        const subject = `Order #${orderNumber} — cancellation not possible`;
        const body = `We received your cancellation request for Order #${orderNumber}. Unfortunately, this order was placed outside our cancellation window and has likely already been processed for shipping.

If you'd like to initiate a return once you receive your order, please reply to this email and we'll help you get that started.

— Automated by DelightDesk AI for expediency. Reply "human" for immediate assistance.`;

        await emailRoutingService.sendEmail(userId, {
          to: customerEmail,
          subject,
          text: body,
          html: body.replace(/\n/g, '<br>')
        });

        return { 
          success: true, 
          error: `Order not eligible for cancellation: ${eligibility.reason}` 
        };
      }

      // Order IS eligible - proceed with warehouse coordination workflow
      const timeoutDate = new Date(Date.now() + (8 * 60 * 60 * 1000));

      // Create workflow record
      const workflow = await storage.createOrderCancellationWorkflow({
        userId,
        emailId,
        orderNumber,
        orderPlatform: 'woocommerce',
        customerEmail,
        warehouseEmail: settings.warehouseEmail || '',
        fulfillmentMethod: 'warehouse_email',
        orderCreatedAt: new Date(orderData.date_created),
        storeTimezone: 'UTC',
        isEligible: eligibility.isEligible,
        eligibilityReason: eligibility.reason,
        status: 'processing',
        step: 'acknowledge_customer',
        timeout: timeoutDate
      });

      await this.logWorkflowEvent(workflow.id, 'workflow_started', 'Warehouse email cancellation workflow initiated', {
        orderNumber,
        customerEmail,
        eligibility
      });

      // Step 3: Send customer acknowledgment (only if eligible)
      const acknowledgmentSent = await this.sendCustomerAcknowledgment(userId, customerEmail, orderNumber);
      if (acknowledgmentSent) {
        await storage.updateOrderCancellationWorkflow(workflow.id, {
          customerAcknowledgmentSent: true,
          step: 'email_warehouse'
        });
        await this.logWorkflowEvent(workflow.id, 'email_sent', 'Customer acknowledgment sent');
      }

      // Step 4: Send warehouse email
      const targetWarehouseEmail = isTestMode && warehouseTestEmail ? warehouseTestEmail : settings.warehouseEmail;
      const warehouseEmailSent = await this.sendWarehouseEmail(
        userId, 
        targetWarehouseEmail, 
        orderNumber,
        isTestMode
      );
      
      if (warehouseEmailSent) {
        await storage.updateOrderCancellationWorkflow(workflow.id, {
          warehouseEmailSent: true,
          step: 'await_warehouse',
          status: 'awaiting_warehouse'
        });
        await this.logWorkflowEvent(workflow.id, 'email_sent', 'Warehouse cancellation request sent');
      }

      return { success: true, workflowId: workflow.id };
    } catch (error) {
      logger.error(LogCategory.AUTOMATION, 'Failed to process warehouse email cancellation', { 
        error: error instanceof Error ? error.message : error,
        orderNumber 
      });
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to process warehouse email cancellation' 
      };
    }
  }

  /**
   * Process ShipStation API fulfillment
   */
  private async processShipStationCancellation(
    userId: string,
    emailId: string,
    orderNumber: string,
    orderData: OrderData,
    customerEmail: string,
    settings: any,
    eligibility: OrderEligibilityResult
  ): Promise<{ success: boolean; workflowId?: string; error?: string }> {
    try {
      // Step 2: Check basic eligibility first (timing rules)
      if (!eligibility.isEligible) {
        // Send "cannot cancel" email immediately (first communication)
        const subject = `Order #${orderNumber} — cancellation not possible`;
        const body = `We received your cancellation request for Order #${orderNumber}. Unfortunately, this order was placed outside our cancellation window and has likely already been processed for shipping.

If you'd like to initiate a return once you receive your order, please reply to this email and we'll help you get that started.

— Automated by DelightDesk AI for expediency. Reply "human" for immediate assistance.`;

        await emailRoutingService.sendEmail(userId, {
          to: customerEmail,
          subject,
          text: body,
          html: body.replace(/\n/g, '<br>')
        });

        return { 
          success: true, 
          error: `Order not eligible for cancellation: ${eligibility.reason}` 
        };
      }

      // Order IS eligible - now check ShipStation system eligibility
      const shipstationService = new ShipStationService({
        apiKey: settings.shipstationApiKey,
        apiSecret: settings.shipstationApiSecret,
      });

      // Check ShipStation-specific cancellation eligibility
      const shipstationEligibilityCheck = await shipstationService.checkCancellationEligibility(orderNumber);
      
      if (!shipstationEligibilityCheck.eligible) {
        // Send "cannot cancel" email immediately (first communication)
        const subject = `Order #${orderNumber} — cancellation not possible`;
        const body = `We received your cancellation request for Order #${orderNumber}. Unfortunately, this order has already been processed by our fulfillment center and cannot be canceled.

If you'd like to initiate a return once you receive your order, please reply to this email and we'll help you get that started.

— Automated by DelightDesk AI for expediency. Reply "human" for immediate assistance.`;

        await emailRoutingService.sendEmail(userId, {
          to: customerEmail,
          subject,
          text: body,
          html: body.replace(/\n/g, '<br>')
        });

        return { 
          success: true, 
          error: `Order not eligible in ShipStation: ${shipstationEligibilityCheck.reason}` 
        };
      }

      // Order IS eligible in both systems - proceed with workflow
      // Create workflow record
      const workflow = await storage.createOrderCancellationWorkflow({
        userId,
        emailId,
        orderNumber,
        orderPlatform: 'woocommerce',
        customerEmail,
        warehouseEmail: '',
        fulfillmentMethod: 'shipstation',
        orderCreatedAt: new Date(orderData.date_created),
        storeTimezone: 'UTC',
        isEligible: eligibility.isEligible,
        eligibilityReason: eligibility.reason,
        status: 'processing',
        step: 'acknowledge_customer',
        timeout: new Date(Date.now() + (1 * 60 * 60 * 1000)) // 1 hour timeout for ShipStation
      });

      await this.logWorkflowEvent(workflow.id, 'workflow_started', 'ShipStation cancellation workflow initiated', {
        orderNumber,
        customerEmail,
        eligibility
      });

      // Step 3: Send customer acknowledgment (only if eligible)
      const acknowledgmentSent = await this.sendCustomerAcknowledgment(userId, customerEmail, orderNumber);
      if (acknowledgmentSent) {
        await storage.updateOrderCancellationWorkflow(workflow.id, {
          customerAcknowledgmentSent: true,
          step: 'process_shipstation'
        });
        await this.logWorkflowEvent(workflow.id, 'email_sent', 'Customer acknowledgment sent');
      }

      // Step 4: Process ShipStation cancellation

      // Update workflow with ShipStation order details
      await storage.updateOrderCancellationWorkflow(workflow.id, {
        shipstationOrderId: shipstationEligibilityCheck.order?.orderId?.toString() || null,
        shipstationShipmentIds: shipstationEligibilityCheck.shipments?.map(s => s.shipmentId.toString()) || [],
        step: 'process_result'
      });

      // Attempt cancellation via ShipStation API
      const cancellationResult = await shipstationService.cancelOrder(shipstationEligibilityCheck.order!.orderId);
      
      if (cancellationResult.success) {
        // Process WooCommerce cancellation and refund
        const refundResult = await this.processOrderCancellationAndRefund(userId, orderNumber);

        await storage.updateOrderCancellationWorkflow(workflow.id, {
          wasCanceled: true,
          refundProcessed: refundResult.success,
          refundAmount: refundResult.amount?.toString() || null,
          refundId: refundResult.refundId || null,
          status: 'canceled',
          step: 'completed',
          completedAt: new Date()
        });

        await this.logWorkflowEvent(workflow.id, 'status_updated', 'Order canceled via ShipStation API', {
          shipstationResult: cancellationResult,
          refundResult
        });

        // Send success notification to customer
        await this.sendFinalCustomerNotification(userId, customerEmail, orderNumber, true, refundResult.amount);

      } else {
        // Cancellation failed
        await storage.updateOrderCancellationWorkflow(workflow.id, {
          status: 'cannot_cancel',
          step: 'completed',
          completedAt: new Date(),
          escalationReason: cancellationResult.message || 'ShipStation cancellation failed'
        });

        await this.logWorkflowEvent(workflow.id, 'status_updated', 'ShipStation cancellation failed', {
          shipstationResult: cancellationResult
        });

        // Send failure notification
        await this.sendFinalCustomerNotification(userId, customerEmail, orderNumber, false);
      }

      return { success: true, workflowId: workflow.id };
    } catch (error) {
      logger.error(LogCategory.AUTOMATION, 'Failed to process ShipStation cancellation', { error });
      return { success: false, error: error instanceof Error ? error.message : 'Failed to process ShipStation cancellation' };
    }
  }

  /**
   * Process ShipBob API fulfillment
   */
  private async processShipBobCancellation(
    userId: string,
    emailId: string,
    orderNumber: string,
    orderData: OrderData,
    customerEmail: string,
    settings: any,
    eligibility: OrderEligibilityResult
  ): Promise<{ success: boolean; workflowId?: string; error?: string }> {
    try {
      // Step 2: Check basic eligibility first (timing rules)
      if (!eligibility.isEligible) {
        // Send "cannot cancel" email immediately (first communication)
        const subject = `Order #${orderNumber} — cancellation not possible`;
        const body = `We received your cancellation request for Order #${orderNumber}. Unfortunately, this order was placed outside our cancellation window and has likely already been processed for shipping.

If you'd like to initiate a return once you receive your order, please reply to this email and we'll help you get that started.

— Automated by DelightDesk AI for expediency. Reply "human" for immediate assistance.`;

        await emailRoutingService.sendEmail(userId, {
          to: customerEmail,
          subject,
          text: body,
          html: body.replace(/\n/g, '<br>')
        });

        return { 
          success: true, 
          error: `Order not eligible for cancellation: ${eligibility.reason}` 
        };
      }

      // Order IS eligible - now check ShipBob system eligibility
      const shipbobService = new ShipBobService({
        accessToken: settings.shipbobAccessToken,
        channelId: settings.shipbobChannelId,
        useSandbox: process.env.NODE_ENV === 'development'
      });

      // Check ShipBob-specific cancellation eligibility
      const shipbobEligibilityCheck = await shipbobService.checkCancellationEligibility(orderNumber);
      
      if (!shipbobEligibilityCheck.eligible) {
        // Send "cannot cancel" email immediately (first communication)
        const subject = `Order #${orderNumber} — cancellation not possible`;
        const body = `We received your cancellation request for Order #${orderNumber}. Unfortunately, this order has already been processed by our fulfillment center and cannot be canceled.

If you'd like to initiate a return once you receive your order, please reply to this email and we'll help you get that started.

— Automated by DelightDesk AI for expediency. Reply "human" for immediate assistance.`;

        await emailRoutingService.sendEmail(userId, {
          to: customerEmail,
          subject,
          text: body,
          html: body.replace(/\n/g, '<br>')
        });

        return { 
          success: true, 
          error: `Order not eligible in ShipBob: ${shipbobEligibilityCheck.reason}` 
        };
      }

      // Order IS eligible in both systems - proceed with workflow
      // Create workflow record
      const workflow = await storage.createOrderCancellationWorkflow({
        userId,
        emailId,
        orderNumber,
        orderPlatform: 'woocommerce',
        customerEmail,
        warehouseEmail: '',
        fulfillmentMethod: 'shipbob',
        orderCreatedAt: new Date(orderData.date_created),
        storeTimezone: 'UTC',
        isEligible: eligibility.isEligible,
        eligibilityReason: eligibility.reason,
        status: 'processing',
        step: 'acknowledge_customer',
        timeout: new Date(Date.now() + (1 * 60 * 60 * 1000)) // 1 hour timeout for ShipBob
      });

      await this.logWorkflowEvent(workflow.id, 'workflow_started', 'ShipBob cancellation workflow initiated', {
        orderNumber,
        customerEmail,
        eligibility
      });

      // Step 3: Send customer acknowledgment (only if eligible)
      const acknowledgmentSent = await this.sendCustomerAcknowledgment(userId, customerEmail, orderNumber);
      if (acknowledgmentSent) {
        await storage.updateOrderCancellationWorkflow(workflow.id, {
          customerAcknowledgmentSent: true,
          step: 'process_shipbob'
        });
        await this.logWorkflowEvent(workflow.id, 'email_sent', 'Customer acknowledgment sent');
      }

      // Step 4: Process ShipBob cancellation

      // Update workflow with ShipBob order details
      await storage.updateOrderCancellationWorkflow(workflow.id, {
        shipbobOrderId: shipbobEligibilityCheck.order?.id?.toString() || null,
        shipbobShipmentIds: (shipbobEligibilityCheck.shipments?.map(s => s.id.toString()) || []).join(','),
        step: 'process_result'
      });

      // Attempt cancellation via ShipBob API
      const cancellationResult = await shipbobService.cancelOrder(shipbobEligibilityCheck.order!.id);
      
      if (cancellationResult.success) {
        // Process WooCommerce cancellation and refund
        const refundResult = await this.processOrderCancellationAndRefund(userId, orderNumber);

        await storage.updateOrderCancellationWorkflow(workflow.id, {
          wasCanceled: true,
          refundProcessed: refundResult.success,
          refundAmount: refundResult.amount?.toString() || null,
          refundId: refundResult.refundId || null,
          status: 'canceled',
          step: 'completed',
          completedAt: new Date()
        });

        await this.logWorkflowEvent(workflow.id, 'status_updated', 'Order canceled via ShipBob API', {
          shipbobResult: cancellationResult,
          refundResult
        });

        // Send success notification to customer
        await this.sendFinalCustomerNotification(userId, customerEmail, orderNumber, true, refundResult.amount);

      } else {
        // Cancellation failed
        await storage.updateOrderCancellationWorkflow(workflow.id, {
          status: 'cannot_cancel',
          step: 'completed',
          completedAt: new Date(),
          escalationReason: cancellationResult.message || 'ShipBob cancellation failed'
        });

        await this.logWorkflowEvent(workflow.id, 'error', 'ShipBob cancellation failed', {
          result: cancellationResult
        });

        // Send failure notification to customer
        await this.sendFinalCustomerNotification(userId, customerEmail, orderNumber, false);
      }

      return { success: true, workflowId: workflow.id };

    } catch (error) {
      logger.error(LogCategory.AUTOMATION, 'Failed to process ShipBob cancellation', { 
        error: error instanceof Error ? error.message : error,
        orderNumber 
      });

      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to process ShipBob cancellation' 
      };
    }
  }

  /**
   * Process self-fulfillment cancellation (direct WooCommerce)
   */
  private async processSelfFulfillmentCancellation(
    userId: string,
    emailId: string,
    orderNumber: string,
    orderData: OrderData,
    customerEmail: string,
    eligibility: OrderEligibilityResult,
    isTestMode: boolean = false
  ): Promise<{ success: boolean; workflowId?: string; error?: string }> {
    try {
      // Step 2: Check if order is eligible for cancellation
      if (!eligibility.isEligible) {
        // Send "cannot cancel" email immediately (first communication)
        const subject = `Order #${orderNumber} — cancellation not possible`;
        const body = `We received your cancellation request for Order #${orderNumber}. Unfortunately, this order was placed outside our cancellation window and has likely already been processed for shipping.

If you'd like to initiate a return once you receive your order, please reply to this email and we'll help you get that started.

— Automated by DelightDesk AI for expediency. Reply "human" for immediate assistance.`;

        await emailRoutingService.sendEmail(userId, {
          to: customerEmail,
          subject,
          text: body,
          html: body.replace(/\n/g, '<br>')
        });

        return { 
          success: true, 
          error: `Order not eligible for cancellation: ${eligibility.reason}` 
        };
      }

      // Order IS eligible - proceed with self-fulfillment workflow
      // Create workflow record
      const workflow = await storage.createOrderCancellationWorkflow({
        userId,
        emailId,
        orderNumber,
        orderPlatform: 'woocommerce',
        customerEmail,
        warehouseEmail: '',
        fulfillmentMethod: 'self_fulfillment',
        orderCreatedAt: new Date(orderData.date_created),
        storeTimezone: 'UTC',
        isEligible: eligibility.isEligible,
        eligibilityReason: eligibility.reason,
        status: 'processing',
        step: 'acknowledge_customer',
        timeout: new Date(Date.now() + (30 * 60 * 1000)) // 30 min timeout for self-fulfillment
      });

      await this.logWorkflowEvent(workflow.id, 'workflow_started', 'Self-fulfillment cancellation workflow initiated', {
        orderNumber,
        customerEmail,
        eligibility
      });

      // Step 3: Send customer acknowledgment (only if eligible)
      if (!isTestMode) {
        const acknowledgmentSent = await this.sendCustomerAcknowledgment(userId, customerEmail, orderNumber);
        if (acknowledgmentSent) {
          await storage.updateOrderCancellationWorkflow(workflow.id, {
            customerAcknowledgmentSent: true,
            step: 'process_cancellation'
          });
          await this.logWorkflowEvent(workflow.id, 'email_sent', 'Customer acknowledgment sent');
        }
      } else {
        // Test mode - skip email sending
        await storage.updateOrderCancellationWorkflow(workflow.id, {
          customerAcknowledgmentSent: true,
          step: 'process_cancellation'
        });
        await this.logWorkflowEvent(workflow.id, 'test_mode', 'Customer acknowledgment skipped in test mode');
      }

      // Step 4: For self-fulfillment, immediately process cancellation and refund
      const refundResult = isTestMode 
        ? { success: true, refundId: 'test-refund-123', amount: 99.99 }
        : await this.processOrderCancellationAndRefund(userId, orderNumber);

      if (refundResult.success) {
        await storage.updateOrderCancellationWorkflow(workflow.id, {
          wasCanceled: true,
          refundProcessed: refundResult.success,
          refundAmount: refundResult.amount?.toString() || null,
          refundId: refundResult.refundId || null,
          status: 'canceled',
          step: 'completed',
          completedAt: new Date()
        });

        await this.logWorkflowEvent(workflow.id, 'status_updated', 'Order canceled via self-fulfillment', {
          refundResult
        });

        // Send success notification to customer
        if (!isTestMode) {
          await this.sendFinalCustomerNotification(userId, customerEmail, orderNumber, true, refundResult.amount);
        } else {
          await this.logWorkflowEvent(workflow.id, 'test_mode', 'Final customer notification skipped in test mode');
        }

      } else {
        // Cancellation failed
        await storage.updateOrderCancellationWorkflow(workflow.id, {
          status: 'escalated',
          step: 'completed',
          completedAt: new Date(),
          escalationReason: 'WooCommerce cancellation failed'
        });

        await this.logWorkflowEvent(workflow.id, 'error', 'Self-fulfillment cancellation failed', {
          refundResult
        });
      }

      return { success: true, workflowId: workflow.id };

    } catch (error) {
      logger.error(LogCategory.AUTOMATION, 'Failed to process self-fulfillment cancellation', { 
        error: error instanceof Error ? error.message : error,
        orderNumber 
      });

      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to process self-fulfillment cancellation' 
      };
    }
  }

  /**
   * Process warehouse reply (Step 4)
   */
  async processWarehouseReply(
    workflowId: string, 
    warehouseReply: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const workflow = await storage.getOrderCancellationWorkflow(workflowId);
      if (!workflow) {
        return { success: false, error: 'Workflow not found' };
      }

      // Update workflow with warehouse reply
      await storage.updateOrderCancellationWorkflow(workflowId, {
        warehouseReply,
        warehouseReplyReceived: true,
        warehouseReplyAt: new Date(),
        step: 'process_result'
      });

      await this.logWorkflowEvent(workflowId, 'email_received', 'Warehouse reply received', {
        reply: warehouseReply
      });

      // Determine if order was canceled
      const wasCanceled = warehouseReply.toLowerCase().includes('canceled');

      if (wasCanceled) {
        // Step 5: Process cancellation and refund
        const refundResult = await this.processOrderCancellationAndRefund(
          workflow.userId, 
          workflow.orderNumber
        );

        await storage.updateOrderCancellationWorkflow(workflowId, {
          wasCanceled: true,
          refundProcessed: refundResult.success,
          refundAmount: refundResult.amount?.toString() || null,
          refundId: refundResult.refundId || null,
          status: 'canceled',
          step: 'completed',
          completedAt: new Date()
        });

        await this.logWorkflowEvent(workflowId, 'status_updated', 'Order canceled and refunded', {
          refundResult
        });
      } else {
        // Step 6: Order could not be canceled
        await storage.updateOrderCancellationWorkflow(workflowId, {
          wasCanceled: false,
          status: 'cannot_cancel',
          step: 'completed',
          completedAt: new Date()
        });

        await this.logWorkflowEvent(workflowId, 'status_updated', 'Order could not be canceled');
      }

      // Send final customer notification - get refundResult from the previous scope
      let refundResult: { success: boolean; amount?: number } | undefined;
      if (wasCanceled) {
        refundResult = await this.processOrderCancellationAndRefund(
          workflow.userId, 
          workflow.orderNumber
        );
      }
      
      const finalNotificationSent = await this.sendFinalCustomerNotification(
        workflow.userId,
        workflow.customerEmail,
        workflow.orderNumber,
        wasCanceled,
        refundResult?.amount
      );

      if (finalNotificationSent) {
        await this.logWorkflowEvent(workflowId, 'email_sent', 'Final customer notification sent');
      }

      return { success: true };

    } catch (error) {
      logger.error(LogCategory.AUTOMATION, 'Failed to process warehouse reply', { 
        error: error instanceof Error ? error.message : error,
        workflowId 
      });
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to process warehouse reply' 
      };
    }
  }

  /**
   * Check for workflow timeouts and escalate if needed
   */
  async checkWorkflowTimeouts(): Promise<void> {
    try {
      const timedOutWorkflows = await storage.getTimedOutOrderCancellationWorkflows();
      
      for (const workflow of timedOutWorkflows) {
        await storage.updateOrderCancellationWorkflow(workflow.id, {
          status: 'escalated',
          escalationReason: 'No warehouse response within timeout period'
        });

        await this.logWorkflowEvent(workflow.id, 'escalated', 'Workflow escalated due to timeout');

        // Create escalation queue entry
        await storage.createEscalationQueue({
          emailId: workflow.emailId,
          userId: workflow.userId,
          priority: 'high',
          reason: `Order cancellation timeout - no warehouse response for order #${workflow.orderNumber}`,
          status: 'pending'
        });

        logger.warn(LogCategory.AUTOMATION, 'Order cancellation workflow timed out', {
          workflowId: workflow.id,
          orderNumber: workflow.orderNumber
        });
      }
    } catch (error) {
      logger.error(LogCategory.AUTOMATION, 'Failed to check workflow timeouts', { error });
    }
  }

  /**
   * Get workflow status for monitoring
   */
  async getWorkflowStatus(workflowId: string): Promise<OrderCancellationWorkflow | null> {
    try {
      return await storage.getOrderCancellationWorkflow(workflowId);
    } catch (error) {
      logger.error(LogCategory.AUTOMATION, 'Failed to get workflow status', { error, workflowId });
      return null;
    }
  }

  /**
   * Get all active workflows for user
   */
  async getUserActiveWorkflows(userId: string): Promise<OrderCancellationWorkflow[]> {
    try {
      return await storage.getUserOrderCancellationWorkflows(userId, ['processing', 'awaiting_warehouse']);
    } catch (error) {
      logger.error(LogCategory.AUTOMATION, 'Failed to get user active workflows', { error, userId });
      return [];
    }
  }
}

export const orderCancellationService = new OrderCancellationService();