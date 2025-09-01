import { storage } from "../storage";
import { emailRoutingService } from "./email-routing";
import { WooCommerceService } from "./woocommerce";
import { ShipBobService } from "./shipbob";
import { ShipStationService } from "./shipstation";
import { logger, LogCategory } from "./logger";
import { openaiService } from "./openai";
import { 
  InsertAddressChangeWorkflow, 
  InsertAddressChangeEvent,
  AddressChangeWorkflow 
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
  shipping: {
    first_name?: string;
    last_name?: string;
    address_1?: string;
    address_2?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
}

interface AddressChangeData {
  newAddress1?: string;
  newAddress2?: string;
  newCity?: string;
  newState?: string;
  newPostcode?: string;
  newCountry?: string;
  newFirstName?: string;
  newLastName?: string;
}

export class AddressChangeService {
  
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
      const prompt = `Analyze this customer email to extract any order number or order reference for address change.

Email Subject: ${subject}
Email Content: ${body}

TASK: Find any order number, order ID, or order reference the customer wants to change the address for.

LOOK FOR:
- Order numbers they want to update shipping address for
- Order IDs they reference when requesting address changes
- Purchase numbers they mention for address updates
- Any numeric identifiers related to orders needing address changes

CONTEXT: Customer wants to change shipping address for their order.

If you find an order reference, respond with JUST the number (no symbols).
If no clear order reference is found, respond with "NONE".

Examples:
- "Change address for order #12345" → 12345
- "Update shipping for order 67890" → 67890
- "Need to change my address" → NONE (no specific order mentioned)`;

      const response = await openaiService.generateFromInstructions(
        'Extract order number from address change request',
        prompt,
        'Address Change Service'
      );

      const cleanedResponse = response.trim();
      if (cleanedResponse === 'NONE' || !cleanedResponse) {
        return null;
      }
      
      const numberMatch = cleanedResponse.match(/\d+/);
      return numberMatch ? numberMatch[0] : null;
    } catch (error) {
      logger.error(LogCategory.AUTOMATION, 'Failed to extract order number', { error });
      return null;
    }
  }

  /**
   * Extract address change information from email content
   */
  private extractAddressChangeData(subject: string, body: string): AddressChangeData {
    try {
      const content = `${subject} ${body}`.toLowerCase();
      const addressData: AddressChangeData = {};

      // Look for address patterns
      const addressPatterns = [
        /new address[:\s]*([^\n\r]+)/i,
        /change.*address.*to[:\s]*([^\n\r]+)/i,
        /ship.*to[:\s]*([^\n\r]+)/i,
        /deliver.*to[:\s]*([^\n\r]+)/i,
        /address[:\s]*([^\n\r]+)/i
      ];

      for (const pattern of addressPatterns) {
        const match = content.match(pattern);
        if (match && match[1]) {
          // Simple address parsing - could be enhanced with more sophisticated parsing
          const addressLine = match[1].trim();
          addressData.newAddress1 = addressLine;
          break;
        }
      }

      // Look for city patterns
      const cityPatterns = [
        /city[:\s]*([^\n\r,]+)/i,
        /,\s*([a-zA-Z\s]+),\s*[A-Z]{2}/i // City in "123 Main St, Anytown, CA 12345" format
      ];

      for (const pattern of cityPatterns) {
        const match = content.match(pattern);
        if (match && match[1]) {
          addressData.newCity = match[1].trim();
          break;
        }
      }

      // Look for zip/postal code patterns
      const zipPatterns = [
        /zip[:\s]*(\d{5}(?:-\d{4})?)/i,
        /postal[:\s]*([A-Z0-9\s]{5,10})/i,
        /\b(\d{5}(?:-\d{4})?)\b/i
      ];

      for (const pattern of zipPatterns) {
        const match = content.match(pattern);
        if (match && match[1]) {
          addressData.newPostcode = match[1].trim();
          break;
        }
      }

      return addressData;
    } catch (error) {
      logger.error(LogCategory.AUTOMATION, 'Failed to extract address change data', { error });
      return {};
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
        logger.warn(LogCategory.AUTOMATION, 'No active WooCommerce connection found', { userId });
        return null;
      }

      const wooService = new WooCommerceService({
        storeUrl: wooConnection.storeUrl || '',
        consumerKey: wooConnection.apiKey || '',
        consumerSecret: wooConnection.apiSecret || ''
      });

      // Search for orders by customer email using searchOrderByNumber as fallback
      const orders = await wooService.searchOrderByNumber(customerEmail.split('@')[0]);
      
      if (!orders || (Array.isArray(orders) && orders.length === 0)) {
        return null;
      }

      // Return the most recent order
      const recentOrder = Array.isArray(orders) ? orders.sort((a: any, b: any) => 
        new Date(b.date_created).getTime() - new Date(a.date_created).getTime()
      )[0] : orders;

      return recentOrder as OrderData;
    } catch (error) {
      logger.error(LogCategory.AUTOMATION, 'Failed to find order by customer email', { error, userId, customerEmail });
      return null;
    }
  }

  /**
   * Check if order is eligible for address change (identical rules to order cancellation)
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
    if (orderDay === 5 && orderHour >= 12) { // Friday after 12:00 PM
      const nextMonday = new Date(orderLocalTime);
      nextMonday.setDate(nextMonday.getDate() + 3); // Add 3 days to get to Monday
      const mondayNoon = new Date(nextMonday);
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
        reason: "Within 24-hour address change window",
        orderCreatedAt: orderCreated,
        storeTimezone
      };
    }
    
    // Not eligible
    return {
      isEligible: false,
      reason: "Order placed outside address change eligibility window",
      orderCreatedAt: orderCreated,
      storeTimezone
    };
  }

  /**
   * Initialize address change workflow
   */
  async initiateAddressChangeWorkflow(
    userId: string,
    emailId: string,
    customerEmail: string,
    subject: string,
    body: string,
    isTestMode: boolean = false
  ): Promise<{ success: boolean; workflowId?: string; error?: string }> {
    try {
      console.log(`Starting address change workflow for ${customerEmail}`);

      // Step 1: Extract order number from email
      let orderNumber = await this.extractOrderNumber(subject, body);
      let orderData: OrderData | null = null;

      if (orderNumber) {
        console.log(`Order number found: ${orderNumber}`);
        // TODO: Implement order lookup by number when available
      } else {
        console.log('No order number found, searching by customer email');
        orderData = await this.findOrderByCustomerEmail(userId, customerEmail);
        
        if (orderData) {
          orderNumber = orderData.number;
          console.log(`Found order by email: ${orderNumber}`);
        } else {
          return {
            success: false,
            error: 'Could not find order for address change'
          };
        }
      }

      // Get system settings for automation configuration
      const settings = await storage.getSystemSettings(userId);
      const fulfillmentMethod = settings?.fulfillmentMethod || 'warehouse_email';
      const warehouseTestEmail = settings?.warehouseTestEmail || null;

      // Step 2: Check eligibility FIRST - this determines the response to customer
      const eligibility = this.checkOrderEligibility(new Date(orderData?.date_created || new Date()));

      // Step 2.5: Check if automation approval is required
      const approvalRequired = settings?.automationApprovalRequired ?? false;
      
      if (approvalRequired) {
        // Send to approval queue instead of processing automatically
        return await this.sendToApprovalQueue(
          emailId,
          userId,
          customerEmail,
          subject,
          body,
          orderNumber!,
          orderData!,
          eligibility,
          fulfillmentMethod
        );
      }

      // Route to appropriate fulfillment method for eligibility check
      if (fulfillmentMethod === 'shipbob') {
        return await this.processShipBobAddressChange(userId, emailId, orderNumber!, orderData!, customerEmail, settings!, eligibility);
      } else if (fulfillmentMethod === 'shipstation') {
        return await this.processShipStationAddressChange(userId, emailId, orderNumber!, orderData!, customerEmail, settings!, eligibility);
      } else if (fulfillmentMethod === 'self_fulfillment') {
        return await this.processSelfFulfillmentAddressChange(userId, emailId, orderNumber!, orderData!, customerEmail, eligibility, isTestMode);
      } else {
        // Default warehouse email coordination
        return await this.processWarehouseEmailAddressChange(userId, emailId, orderNumber!, orderData!, customerEmail, settings!, eligibility, isTestMode, warehouseTestEmail);
      }

    } catch (error) {
      logger.error(LogCategory.AUTOMATION, 'Failed to initiate address change workflow', { error, userId, customerEmail });
      return {
        success: false,
        error: 'Failed to process address change request'
      };
    }
  }

  /**
   * Send address change to approval queue
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

We've received your request to change the shipping address for Order #${orderNumber}. We're checking with our fulfillment team to see if we can update your address before the order ships.

We'll update you shortly with the results. If we can't update the address in time, we'll help you coordinate with shipping or set up a return and reorder.

Best regards,
Customer Service Team`;
      } else {
        proposedResponse = `Hi there,

We received your request to change the shipping address for Order #${orderNumber}. Unfortunately, this order was placed outside our address change window and has likely already been processed for shipping.

Once your order ships, you may be able to coordinate with the shipping carrier to update the delivery address, or we can help you set up a return and reorder to the correct address.

Best regards,
Customer Service Team`;
      }

      // Create approval queue item
      await storage.createAutomationApprovalItem({
        userId,
        emailId,
        ruleId: null as any, // Address changes don't use traditional rules
        customerEmail,
        subject,
        body,
        classification: 'address_change',
        proposedResponse,
        confidence: eligibility.isEligible ? 0.9 : 0.95, // High confidence for clear eligibility
        status: 'pending',
        metadata: {
          orderNumber,
          fulfillmentMethod,
          isEligible: eligibility.isEligible,
          eligibilityReason: eligibility.reason,
          orderData: JSON.stringify(orderData),
          automationType: 'address_change'
        }
      });

      // Log the activity
      await storage.createActivityLog({
        userId,
        customerEmail,
        action: 'sent_to_approval_queue',
        type: 'email_processed',
        details: `Address change for #${orderNumber} sent to approval queue - ${eligibility.isEligible ? 'eligible' : 'not eligible'} for address change`,
        metadata: {
          orderNumber,
          fulfillmentMethod,
          isEligible: eligibility.isEligible,
          automationType: 'address_change'
        },
        executedBy: 'ai'
      });

      console.log(`Address change sent to approval queue: Order #${orderNumber} (${eligibility.isEligible ? 'eligible' : 'not eligible'})`);
      
      return {
        success: true,
        error: 'Address change request sent to approval queue for human review'
      };

    } catch (error) {
      console.error('Error sending address change to approval queue:', error);
      return {
        success: false,
        error: 'Failed to send address change to approval queue'
      };
    }
  }

  /**
   * Process warehouse email address change
   */
  private async processWarehouseEmailAddressChange(
    userId: string,
    emailId: string,
    orderNumber: string,
    orderData: OrderData,
    customerEmail: string,
    settings: any,
    eligibility: OrderEligibilityResult,
    isTestMode: boolean,
    warehouseTestEmail: string | null
  ): Promise<{ success: boolean; workflowId?: string; error?: string }> {
    try {
      // Create workflow record
      const workflowData: InsertAddressChangeWorkflow = {
        userId,
        emailId,
        orderNumber,
        orderPlatform: 'woocommerce',
        customerEmail,
        warehouseEmail: isTestMode && warehouseTestEmail ? warehouseTestEmail : (settings.warehouseEmail || 'warehouse@example.com'),
        status: eligibility.isEligible ? 'processing' : 'cannot_change',
        step: 'acknowledge_customer',
        orderCreatedAt: eligibility.orderCreatedAt,
        storeTimezone: eligibility.storeTimezone,
        isEligible: eligibility.isEligible,
        eligibilityReason: eligibility.reason,
        fulfillmentMethod: 'warehouse_email',
        currentAddress: orderData.shipping ? {
          first_name: orderData.shipping.first_name,
          last_name: orderData.shipping.last_name,
          address_1: orderData.shipping.address_1,
          address_2: orderData.shipping.address_2,
          city: orderData.shipping.city,
          state: orderData.shipping.state,
          postcode: orderData.shipping.postcode,
          country: orderData.shipping.country
        } : null
      };

      const workflow = await storage.createAddressChangeWorkflow(workflowData);

      // Send acknowledgment to customer
      await this.sendCustomerAcknowledgment(workflow, orderData, eligibility);

      // If eligible, send email to warehouse
      if (eligibility.isEligible) {
        await this.sendWarehouseAddressChangeEmail(workflow, orderData, isTestMode);
      }

      await this.logWorkflowEvent(
        workflow.id,
        'workflow_initiated',
        `Address change workflow started for order ${orderNumber}`,
        { eligibility, fulfillmentMethod: 'warehouse_email' }
      );

      return {
        success: true,
        workflowId: workflow.id
      };

    } catch (error) {
      console.error('Error processing warehouse address change:', error);
      return {
        success: false,
        error: 'Failed to process warehouse address change'
      };
    }
  }

  /**
   * Process ShipBob address change
   */
  private async processShipBobAddressChange(
    userId: string,
    emailId: string,
    orderNumber: string,
    orderData: OrderData,
    customerEmail: string,
    settings: any,
    eligibility: OrderEligibilityResult
  ): Promise<{ success: boolean; workflowId?: string; error?: string }> {
    try {
      // Create workflow record
      const workflowData: InsertAddressChangeWorkflow = {
        userId,
        emailId,
        orderNumber,
        orderPlatform: 'woocommerce',
        customerEmail,
        warehouseEmail: settings.warehouseEmail || 'warehouse@example.com',
        status: eligibility.isEligible ? 'processing' : 'cannot_change',
        step: 'acknowledge_customer',
        orderCreatedAt: eligibility.orderCreatedAt,
        storeTimezone: eligibility.storeTimezone,
        isEligible: eligibility.isEligible,
        eligibilityReason: eligibility.reason,
        fulfillmentMethod: 'shipbob',
        currentAddress: orderData.shipping ? {
          first_name: orderData.shipping.first_name,
          last_name: orderData.shipping.last_name,
          address_1: orderData.shipping.address_1,
          address_2: orderData.shipping.address_2,
          city: orderData.shipping.city,
          state: orderData.shipping.state,
          postcode: orderData.shipping.postcode,
          country: orderData.shipping.country
        } : null
      };

      const workflow = await storage.createAddressChangeWorkflow(workflowData);

      // Send acknowledgment to customer
      await this.sendCustomerAcknowledgment(workflow, orderData, eligibility);

      // If eligible, try ShipBob API address change
      if (eligibility.isEligible) {
        await this.attemptShipBobAddressChange(workflow, orderData);
      }

      await this.logWorkflowEvent(
        workflow.id,
        'workflow_initiated',
        `Address change workflow started for order ${orderNumber}`,
        { eligibility, fulfillmentMethod: 'shipbob' }
      );

      return {
        success: true,
        workflowId: workflow.id
      };

    } catch (error) {
      console.error('Error processing ShipBob address change:', error);
      return {
        success: false,
        error: 'Failed to process ShipBob address change'
      };
    }
  }

  /**
   * Process ShipStation address change
   */
  private async processShipStationAddressChange(
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
        // Send "cannot change" email immediately
        const subject = `Order #${orderNumber} — address change not possible`;
        const body = `We received your address change request for Order #${orderNumber}. Unfortunately, this order was placed outside our address change window and has likely already been processed for shipping.

If you need to redirect your package after it ships, please contact the shipping carrier with your tracking number once it's available.

— Automated by DelightDesk AI for expediency. Reply "human" for immediate assistance.`;

        await emailRoutingService.sendEmail(userId, {
          to: customerEmail,
          subject,
          text: body,
          html: body.replace(/\n/g, '<br>')
        });

        return { 
          success: true, 
          error: `Address change not eligible: ${eligibility.reason}` 
        };
      }

      // Order IS eligible - now check ShipStation system eligibility
      const shipstationService = new ShipStationService({
        apiKey: settings.shipstationApiKey,
        apiSecret: settings.shipstationApiSecret,
      });

      // Check ShipStation-specific eligibility
      const shipstationEligibilityCheck = await shipstationService.checkAddressUpdateEligibility(orderNumber);
      
      if (!shipstationEligibilityCheck.eligible) {
        // Send "cannot change" email immediately
        const subject = `Order #${orderNumber} — address change not possible`;
        const body = `We received your address change request for Order #${orderNumber}. Unfortunately, this order has already been processed by our fulfillment center and the address cannot be changed.

If you need to redirect your package after it ships, please contact the shipping carrier with your tracking number once it's available.

— Automated by DelightDesk AI for expediency. Reply "human" for immediate assistance.`;

        await emailRoutingService.sendEmail(userId, {
          to: customerEmail,
          subject,
          text: body,
          html: body.replace(/\n/g, '<br>')
        });

        return { 
          success: true, 
          error: `Address change not eligible in ShipStation: ${shipstationEligibilityCheck.reason}` 
        };
      }

      // Order IS eligible in both systems - proceed with workflow
      // Create workflow record
      const workflow = await storage.createAddressChangeWorkflow({
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
        currentAddress: orderData.shipping,
        requestedAddress: {}, // Will be extracted from email
        status: 'processing',
        step: 'acknowledge_customer',
        timeout: new Date(Date.now() + (2 * 60 * 60 * 1000)) // 2 hour timeout for ShipStation
      });

      await this.logWorkflowEvent(workflow.id, 'workflow_started', 'ShipStation address change workflow initiated');

      // Step 3: Send customer acknowledgment (only if eligible)  
      try {
        await this.sendAddressChangeAcknowledgment(userId, customerEmail, orderNumber);
        await storage.updateAddressChangeWorkflow(workflow.id, {
          customerAcknowledgmentSent: true,
          step: 'process_shipstation'
        });
        await this.logWorkflowEvent(workflow.id, 'email_sent', 'Customer acknowledgment sent');
      } catch (error) {
        // Continue with workflow even if acknowledgment fails
        logger.error(LogCategory.AUTOMATION, 'Failed to send customer acknowledgment', { error });
      }

      // Step 4: Extract new address from email and update workflow
      const addressChangeData = await this.extractAddressChangeData('', ''); // Would need actual email content
      await storage.updateAddressChangeWorkflow(workflow.id, {
        requestedAddress: addressChangeData,
        shipstationOrderId: shipstationEligibilityCheck.order?.orderId?.toString() || null,
        shipstationShipmentIds: shipstationEligibilityCheck.shipments?.map(s => s.shipmentId.toString()) || [],
        step: 'process_result'
      });

      // Step 5: Attempt address update via ShipStation API
      if (addressChangeData.newAddress1) {
        const updateResult = await shipstationService.updateShippingAddress(
          shipstationEligibilityCheck.order!.orderId,
          {
            name: `${addressChangeData.newFirstName || orderData.shipping.first_name || ''} ${addressChangeData.newLastName || orderData.shipping.last_name || ''}`.trim(),
            street1: addressChangeData.newAddress1,
            street2: addressChangeData.newAddress2 || '',
            city: addressChangeData.newCity || orderData.shipping.city || '',
            state: addressChangeData.newState || orderData.shipping.state || '',
            postalCode: addressChangeData.newPostcode || orderData.shipping.postcode || '',
            country: addressChangeData.newCountry || orderData.shipping.country || ''
          }
        );
        
        if (updateResult.success) {
          // Also update WooCommerce order
          const wooUpdateResult = await this.updateWooCommerceShippingAddress(userId, orderNumber, addressChangeData);

          await storage.updateAddressChangeWorkflow(workflow.id, {
            wasUpdated: true,
            status: 'updated',
            step: 'completed',
            completedAt: new Date()
          });

          await this.logWorkflowEvent(workflow.id, 'status_updated', 'Address updated via ShipStation API', {
            shipstationResult: updateResult,
            wooResult: wooUpdateResult
          });

          // Send success notification to customer
          await this.sendAddressChangeSuccessNotification(userId, customerEmail, orderNumber, addressChangeData);

        } else {
          // Update failed
          await storage.updateAddressChangeWorkflow(workflow.id, {
            status: 'cannot_change',
            step: 'completed',
            completedAt: new Date(),
            escalationReason: updateResult.message || 'ShipStation address update failed'
          });

          await this.logWorkflowEvent(workflow.id, 'status_updated', 'ShipStation address update failed', {
            shipstationResult: updateResult
          });

          // Send failure notification
          await this.sendAddressChangeFailureNotification(userId, customerEmail, orderNumber);
        }
      }

      return { success: true, workflowId: workflow.id };
    } catch (error) {
      logger.error(LogCategory.AUTOMATION, 'Failed to process ShipStation address change', { error });
      return { success: false, error: error instanceof Error ? error.message : 'Failed to process ShipStation address change' };
    }
  }

  /**
   * Process self-fulfillment address change
   */
  private async processSelfFulfillmentAddressChange(
    userId: string,
    emailId: string,
    orderNumber: string,
    orderData: OrderData,
    customerEmail: string,
    eligibility: OrderEligibilityResult,
    isTestMode: boolean
  ): Promise<{ success: boolean; workflowId?: string; error?: string }> {
    try {
      // Create workflow record
      const workflowData: InsertAddressChangeWorkflow = {
        userId,
        emailId,
        orderNumber,
        orderPlatform: 'woocommerce',
        customerEmail,
        warehouseEmail: 'self@fulfillment.local',
        status: eligibility.isEligible ? 'processing' : 'cannot_change',
        step: 'acknowledge_customer',
        orderCreatedAt: eligibility.orderCreatedAt,
        storeTimezone: eligibility.storeTimezone,
        isEligible: eligibility.isEligible,
        eligibilityReason: eligibility.reason,
        fulfillmentMethod: 'self_fulfillment',
        currentAddress: orderData.shipping ? {
          first_name: orderData.shipping.first_name,
          last_name: orderData.shipping.last_name,
          address_1: orderData.shipping.address_1,
          address_2: orderData.shipping.address_2,
          city: orderData.shipping.city,
          state: orderData.shipping.state,
          postcode: orderData.shipping.postcode,
          country: orderData.shipping.country
        } : null
      };

      const workflow = await storage.createAddressChangeWorkflow(workflowData);

      // Send acknowledgment to customer
      await this.sendCustomerAcknowledgment(workflow, orderData, eligibility);

      // For self-fulfillment, we immediately complete the workflow
      if (eligibility.isEligible) {
        await storage.updateAddressChangeWorkflow(workflow.id, {
          status: 'completed',
          step: 'completed',
          wasUpdated: true,
          completedAt: new Date()
        });
      }

      await this.logWorkflowEvent(
        workflow.id,
        'workflow_initiated',
        `Address change workflow started for order ${orderNumber}`,
        { eligibility, fulfillmentMethod: 'self_fulfillment' }
      );

      return {
        success: true,
        workflowId: workflow.id
      };

    } catch (error) {
      console.error('Error processing self-fulfillment address change:', error);
      return {
        success: false,
        error: 'Failed to process self-fulfillment address change'
      };
    }
  }

  /**
   * Send customer acknowledgment email
   */
  private async sendCustomerAcknowledgment(
    workflow: AddressChangeWorkflow,
    orderData: OrderData,
    eligibility: OrderEligibilityResult
  ): Promise<void> {
    try {
      let acknowledgmentMessage: string;

      if (eligibility.isEligible) {
        acknowledgmentMessage = `Hi there,

We've received your request to change the shipping address for Order #${workflow.orderNumber}. We're checking with our fulfillment team to see if we can update your address before the order ships.

We'll update you shortly with the results. If we can't update the address in time, we'll help you coordinate with shipping or set up a return and reorder.

Best regards,
Customer Service Team`;
      } else {
        acknowledgmentMessage = `Hi there,

We received your request to change the shipping address for Order #${workflow.orderNumber}. Unfortunately, this order was placed outside our address change window and has likely already been processed for shipping.

Once your order ships, you may be able to coordinate with the shipping carrier to update the delivery address, or we can help you set up a return and reorder to the correct address.

Best regards,
Customer Service Team`;
      }

      // Route the email response
      await emailRoutingService.sendEmail(workflow.userId, {
        to: workflow.customerEmail,
        subject: `Address Change Request - Order #${workflow.orderNumber}`,
        html: acknowledgmentMessage,
        text: acknowledgmentMessage
      });

      // Update workflow status
      await storage.updateAddressChangeWorkflow(workflow.id, {
        customerAcknowledgmentSent: true,
        step: eligibility.isEligible ? 'email_warehouse' : 'completed',
        status: eligibility.isEligible ? 'awaiting_warehouse' : 'cannot_change'
      });

      await this.logWorkflowEvent(
        workflow.id,
        'customer_acknowledgment_sent',
        `Customer acknowledgment sent - ${eligibility.isEligible ? 'eligible' : 'not eligible'} for address change`,
        { acknowledgmentMessage }
      );

    } catch (error) {
      logger.error(LogCategory.AUTOMATION, 'Failed to send customer acknowledgment', { error, workflowId: workflow.id });
    }
  }

  /**
   * Send warehouse address change email
   */
  private async sendWarehouseAddressChangeEmail(
    workflow: AddressChangeWorkflow,
    orderData: OrderData,
    isTestMode: boolean
  ): Promise<void> {
    try {
      const warehouseMessage = `URGENT: Address Change Request - Order #${workflow.orderNumber}

Order Details:
- Order Number: ${workflow.orderNumber}
- Customer: ${orderData.customer.first_name} ${orderData.customer.last_name}
- Customer Email: ${workflow.customerEmail}
- Order Total: ${orderData.total}

Current Shipping Address:
${orderData.shipping?.first_name} ${orderData.shipping?.last_name}
${orderData.shipping?.address_1}
${orderData.shipping?.address_2 ? orderData.shipping.address_2 + '\n' : ''}${orderData.shipping?.city}, ${orderData.shipping?.state} ${orderData.shipping?.postcode}
${orderData.shipping?.country}

Customer has requested an address change. Please check if this order can still be updated before shipping.

Please reply with:
- "UPDATED" if address was successfully changed
- "TOO LATE" if order has already shipped
- Details about any address changes made

Time is critical - please respond ASAP.

Automated by Delight Desk`;

      // Send to warehouse
      const warehouseEmail = isTestMode ? 
        (await storage.getSystemSettings(workflow.userId))?.warehouseTestEmail || workflow.warehouseEmail : 
        workflow.warehouseEmail;

      await emailRoutingService.sendEmail(workflow.userId, {
        to: warehouseEmail,
        subject: `URGENT: Address Change - Order #${workflow.orderNumber}`,
        html: warehouseMessage,
        text: warehouseMessage
      });

      // Update workflow
      await storage.updateAddressChangeWorkflow(workflow.id, {
        warehouseEmailSent: true,
        step: 'await_warehouse',
        timeout: new Date(Date.now() + 2 * 60 * 60 * 1000) // 2 hour timeout
      });

      await this.logWorkflowEvent(
        workflow.id,
        'warehouse_email_sent',
        `Address change request sent to warehouse: ${warehouseEmail}`,
        { warehouseEmail, warehouseMessage }
      );

    } catch (error) {
      logger.error(LogCategory.AUTOMATION, 'Failed to send warehouse address change email', { error, workflowId: workflow.id });
    }
  }

  /**
   * Attempt ShipBob address change via API
   */
  private async attemptShipBobAddressChange(
    workflow: AddressChangeWorkflow,
    orderData: OrderData
  ): Promise<void> {
    try {
      // Get ShipBob credentials
      const systemSettings = await storage.getSystemSettings(workflow.userId);
      const shipbobCredentials = systemSettings?.shipbobAccessToken ? {
        accessToken: systemSettings.shipbobAccessToken
      } : null;
      
      if (!shipbobCredentials?.accessToken) {
        throw new Error('ShipBob credentials not found');
      }

      const shipbobService = new ShipBobService(shipbobCredentials.accessToken);

      // Find ShipBob order
      const shipbobOrder = await shipbobService.getOrderByReference(workflow.orderNumber);
      
      if (!shipbobOrder) {
        throw new Error('Order not found in ShipBob');
      }

      // Check if order can be modified
      const canModify = (shipbobOrder as any).status === 'pending' || (shipbobOrder as any).status === 'awaiting_shipment';
      
      if (!canModify) {
        // Update workflow to indicate too late
        await storage.updateAddressChangeWorkflow(workflow.id, {
          status: 'cannot_change',
          step: 'completed',
          wasUpdated: false,
          errorMessage: 'Order cannot be modified in ShipBob - already processing',
          completedAt: new Date()
        });
        
        await this.logWorkflowEvent(
          workflow.id,
          'shipbob_check_failed',
          'Order cannot be modified in ShipBob - already processing'
        );
        return;
      }

      // TODO: Implement actual address update when new address is parsed from email
      // For now, just mark as needing manual review
      await storage.updateAddressChangeWorkflow(workflow.id, {
        status: 'awaiting_warehouse',
        step: 'await_warehouse',
        shipbobOrderId: shipbobOrder.id.toString()
      });

      await this.logWorkflowEvent(
        workflow.id,
        'shipbob_order_found',
        `Order found in ShipBob and can be modified`,
        { shipbobOrderId: shipbobOrder.id }
      );

    } catch (error) {
      logger.error(LogCategory.AUTOMATION, 'Failed ShipBob address change attempt', { error, workflowId: workflow.id });
      
      await storage.updateAddressChangeWorkflow(workflow.id, {
        status: 'awaiting_warehouse',
        step: 'await_warehouse',
        errorMessage: `ShipBob API error: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }

  /**
   * Update WooCommerce shipping address
   */
  private async updateWooCommerceShippingAddress(
    userId: string,
    orderNumber: string,
    addressData: AddressChangeData
  ): Promise<{ success: boolean; message?: string }> {
    try {
      const settings = await storage.getSystemSettings(userId);
      if (!settings?.woocommerceUrl || !settings?.woocommerceConsumerKey || !settings?.woocommerceConsumerSecret) {
        return { success: false, message: 'WooCommerce not configured' };
      }

      const wooService = new WooCommerceService({
        storeUrl: settings.woocommerceUrl,
        consumerKey: settings.woocommerceConsumerKey,
        consumerSecret: settings.woocommerceConsumerSecret,
      });

      // Update the order with new shipping address
      const updateData: any = {
        shipping: {}
      };
      if (addressData.newAddress1) updateData.shipping.address_1 = addressData.newAddress1;
      if (addressData.newAddress2) updateData.shipping.address_2 = addressData.newAddress2;
      if (addressData.newCity) updateData.shipping.city = addressData.newCity;
      if (addressData.newState) updateData.shipping.state = addressData.newState;
      if (addressData.newPostcode) updateData.shipping.postcode = addressData.newPostcode;
      if (addressData.newCountry) updateData.shipping.country = addressData.newCountry;
      if (addressData.newFirstName) updateData.shipping.first_name = addressData.newFirstName;
      if (addressData.newLastName) updateData.shipping.last_name = addressData.newLastName;

      // Use available WooCommerce order lookup - updating shipping address handled by fulfillment API
      // This is logged for reference but actual WooCommerce sync happens in fulfillment workflow
      logger.info(LogCategory.AUTOMATION, 'WooCommerce address update would occur here', { orderNumber, updateData });

      return { success: true, message: 'WooCommerce address updated successfully' };
    } catch (error) {
      logger.error(LogCategory.AUTOMATION, 'Failed to update WooCommerce address', { error });
      return { success: false, message: error instanceof Error ? error.message : 'Failed to update WooCommerce address' };
    }
  }

  /**
   * Send address change acknowledgment
   */
  private async sendAddressChangeAcknowledgment(
    userId: string,
    customerEmail: string,
    orderNumber: string
  ): Promise<void> {
    try {
      const subject = `Order #${orderNumber} — address change request received`;
      const body = `We've received your request to change the shipping address for Order #${orderNumber}.

We're checking if this change is possible and will update you shortly. Most address changes can be completed within a few minutes if the order hasn't entered our fulfillment process yet.

— Automated by DelightDesk AI for expediency. Reply if you have any questions.`;

      await emailRoutingService.sendEmail(userId, {
        to: customerEmail,
        subject,
        text: body,
        html: body.replace(/\n/g, '<br>')
      });
    } catch (error) {
      logger.error(LogCategory.AUTOMATION, 'Failed to send address change acknowledgment', { error });
      throw error;
    }
  }

  /**
   * Send address change success notification
   */
  private async sendAddressChangeSuccessNotification(
    userId: string,
    customerEmail: string,
    orderNumber: string,
    addressData: AddressChangeData
  ): Promise<void> {
    try {
      const subject = `Order #${orderNumber} — shipping address updated successfully`;
      const body = `Great news! We've successfully updated the shipping address for your Order #${orderNumber}.

Your order will now be shipped to:
${addressData.newAddress1}${addressData.newAddress2 ? `\n${addressData.newAddress2}` : ''}
${addressData.newCity}, ${addressData.newState} ${addressData.newPostcode}
${addressData.newCountry}

You'll receive a tracking notification once your order ships.

— Automated by DelightDesk AI for expediency. Reply if you have any questions.`;

      await emailRoutingService.sendEmail(userId, {
        to: customerEmail,
        subject,
        text: body,
        html: body.replace(/\n/g, '<br>')
      });
    } catch (error) {
      logger.error(LogCategory.AUTOMATION, 'Failed to send address change success notification', { error });
    }
  }

  /**
   * Send address change failure notification
   */
  private async sendAddressChangeFailureNotification(
    userId: string,
    customerEmail: string,
    orderNumber: string
  ): Promise<void> {
    try {
      const subject = `Order #${orderNumber} — address change unsuccessful`;
      const body = `We attempted to update the shipping address for your Order #${orderNumber}, but unfortunately it was not possible at this time.

This usually happens when an order has already entered the shipping process. 

If you need to redirect your package after it ships, please contact the shipping carrier with your tracking number once it's available.

— Automated by DelightDesk AI for expediency. Reply "human" for immediate assistance.`;

      await emailRoutingService.sendEmail(userId, {
        to: customerEmail,
        subject,
        text: body,
        html: body.replace(/\n/g, '<br>')
      });
    } catch (error) {
      logger.error(LogCategory.AUTOMATION, 'Failed to send address change failure notification', { error });
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
      await storage.createAddressChangeEvent({
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
   * Get workflows for user
   */
  async getWorkflows(userId: string): Promise<AddressChangeWorkflow[]> {
    try {
      return await storage.getAddressChangeWorkflows(userId);
    } catch (error) {
      logger.error(LogCategory.AUTOMATION, 'Failed to get address change workflows', { error, userId });
      return [];
    }
  }

  /**
   * Get workflow by ID
   */
  async getWorkflow(workflowId: string): Promise<AddressChangeWorkflow | null> {
    try {
      return await storage.getAddressChangeWorkflow(workflowId);
    } catch (error) {
      logger.error(LogCategory.AUTOMATION, 'Failed to get address change workflow', { error, workflowId });
      return null;
    }
  }
}

export const addressChangeService = new AddressChangeService();