import { IStorage } from '../storage';

export interface PromoCodeRequest {
  customerEmail: string;
  requestedCode?: string;
  requestType: 'general_discount' | 'first_time_customer' | 'loyalty_discount' | 'complaint_resolution' | 'promo_refund';
  originalMessage: string;
  urgency?: 'low' | 'medium' | 'high';
  emailClassification?: string; // Email classification from AI (discount_inquiries, general, etc.)
}

export interface PromoCodeEligibility {
  isEligible: boolean;
  reason: string;
  discountAmount: string;
  promoCode: string;
  expirationDays: number;
}

export interface PromoCodeWorkflowResult {
  success: boolean;
  message: string;
  promoCodeSent?: string;
  emailSent?: boolean;
}

export class PromoCodeService {
  constructor(private storage: IStorage) {}

  /**
   * Find applicable promo codes for customer inquiries
   */
  async findApplicablePromoCodes(userId: string, requestType: string, customerEmail: string): Promise<any[]> {
    try {
      // Get active promo code configurations that match the request type
      const allConfigs = await this.storage.getPromoCodeConfigs(userId);
      
      const applicableConfigs = allConfigs.filter(config => {
        if (!config.isActive || !config.eligibleForAutomation) {
          return false;
        }
        
        // Check if current time is within validity window
        const now = new Date();
        const validFrom = new Date(config.validFrom);
        const validUntil = new Date(config.validUntil);
        if (now < validFrom || now > validUntil) {
          return false;
        }
        
        // Check usage type compatibility
        const usageType = config.usageType || 'refund_only';
        if (requestType === 'first_time_customer') {
          return (usageType === 'first_time_customer' || usageType === 'both') && config.enableFirstTimeCustomerOffers;
        } else if (requestType === 'general_discount') {
          return (usageType === 'general_inquiry' || usageType === 'both') && config.enableGeneralInquiryOffers;
        } else if (requestType === 'promo_refund') {
          return usageType === 'refund_only' || usageType === 'both';
        }
        
        return false;
      });
      
      return applicableConfigs;
    } catch (error) {
      console.error('Error finding applicable promo codes:', error);
      return [];
    }
  }

  /**
   * Evaluates customer eligibility for promo codes based on request type and customer history
   */
  async evaluatePromoCodeEligibility(request: PromoCodeRequest, userId?: string): Promise<PromoCodeEligibility> {
    const { customerEmail, requestType, requestedCode } = request;
    
    try {
      if (!userId) {
        return {
          isEligible: false,
          reason: 'User ID required for promo code evaluation',
          discountAmount: '5%',
          promoCode: 'SAVE5',
          expirationDays: 30
        };
      }

      // Check customer history and order patterns
      const customerHistory = await this.getCustomerHistory(customerEmail);
      
      // Find applicable promo code configurations
      const applicableConfigs = await this.findApplicablePromoCodes(userId, requestType, customerEmail);
      
      if (applicableConfigs.length === 0) {
        return {
          isEligible: false,
          reason: `No active promo code configurations available for ${requestType}`,
          discountAmount: '5%',
          promoCode: 'SAVE5',
          expirationDays: 30
        };
      }
      
      // Take the first applicable config (could be enhanced with priority logic)
      const selectedConfig = applicableConfigs[0];
      
      // Evaluate eligibility based on the selected configuration and request type
      let isEligible = false;
      let reason = '';
      
      switch (requestType) {
        case 'first_time_customer':
          isEligible = customerHistory.orderCount === 0;
          reason = isEligible 
            ? selectedConfig.firstTimeCustomerMessage || 'Welcome! As a first-time customer, you qualify for this special discount'
            : 'Customer already has previous orders';
          break;

        case 'general_discount':
          // Check frequency and offer limits
          const recentOffers = await this.getRecentPromoOffers(customerEmail, selectedConfig.id);
          const maxOffers = selectedConfig.maxOffersPerCustomer || 1;
          const frequencyDays = selectedConfig.offerFrequencyDays || 90;
          
          const recentOfferCount = recentOffers.filter(offer => {
            const daysSinceOffer = Math.floor((Date.now() - new Date(offer.createdAt).getTime()) / (1000 * 60 * 60 * 24));
            return daysSinceOffer <= frequencyDays;
          }).length;
          
          isEligible = recentOfferCount < maxOffers;
          reason = isEligible 
            ? 'Customer eligible for discount offer'
            : `Customer has reached maximum offers (${maxOffers}) within ${frequencyDays} days`;
          break;

        case 'loyalty_discount':
          isEligible = customerHistory.orderCount >= 3;
          reason = isEligible 
            ? `Loyal customer with ${customerHistory.orderCount} orders eligible for loyalty discount`
            : 'Customer needs minimum 3 orders for loyalty discount';
          break;

        case 'complaint_resolution':
          isEligible = true; // Always approve for complaint resolution
          reason = 'Goodwill gesture for customer service issue';
          break;

        case 'promo_refund':
        default:
          // For refund cases, evaluate based on the original refund logic
          const recentRequests = await this.getRecentPromoRequests(customerEmail);
          isEligible = recentRequests.length < 2; // Max 2 requests per 90 days
          reason = isEligible 
            ? 'Customer eligible for promo code refund'
            : 'Customer has exceeded promo code request frequency (2 per 90 days)';
          break;
      }

      return {
        isEligible,
        reason,
        discountAmount: selectedConfig.discountType === 'percentage' 
          ? `${selectedConfig.discountAmount}%` 
          : `$${selectedConfig.discountAmount}`,
        promoCode: selectedConfig.promoCode,
        expirationDays: Math.ceil((new Date(selectedConfig.validUntil).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      };

    } catch (error) {
      console.error('Error evaluating promo code eligibility:', error);
      return {
        isEligible: false,
        reason: 'Unable to evaluate eligibility due to system error',
        discountAmount: '5%',
        promoCode: 'SAVE5',
        expirationDays: 30
      };
    }
  }

  /**
   * Sends promo code request to approval queue
   */
  async sendToApprovalQueue(
    userId: string,
    emailId: string,
    request: PromoCodeRequest,
    eligibility: PromoCodeEligibility,
    proposedResponse: string
  ): Promise<void> {
    try {
      // Create approval queue item with promo code metadata
      await this.storage.createAutomationApprovalItem({
        userId,
        emailId,
        ruleId: null as any, // Promo codes don't use traditional rules
        customerEmail: request.customerEmail,
        subject: `Promo Code Request - ${request.requestType.replace('_', ' ')}`,
        body: request.originalMessage,
        classification: 'promo_code',
        proposedResponse,
        confidence: eligibility.isEligible ? 0.85 : 0.75,
        status: 'pending',
        metadata: {
          requestedCode: request.requestedCode,
          requestType: request.requestType,
          isEligible: eligibility.isEligible,
          eligibilityReason: eligibility.reason,
          discountAmount: eligibility.discountAmount,
          promoCode: eligibility.promoCode,
          expirationDays: eligibility.expirationDays,
          urgency: request.urgency || 'medium',
          automationType: 'promo_code'
        }
      });

      // Log the activity
      await this.storage.createActivityLog({
        userId,
        customerEmail: request.customerEmail,
        action: 'sent_to_approval_queue',
        type: 'email_processed',
        details: `Promo code request for ${request.requestType} sent to approval queue - ${eligibility.isEligible ? 'eligible' : 'not eligible'}`,
        metadata: {
          requestType: request.requestType,
          isEligible: eligibility.isEligible,
          promoCode: eligibility.promoCode,
          automationType: 'promo_code'
        },
        executedBy: 'ai'
      });

      console.log(`Promo code request sent to approval queue: ${request.requestType} for ${request.customerEmail} (${eligibility.isEligible ? 'eligible' : 'not eligible'})`);
      
    } catch (error) {
      console.error('Error sending promo code request to approval queue:', error);
      throw new Error('Failed to send promo code request to approval queue');
    }
  }

  /**
   * Executes approved promo code workflow
   */
  async executeApprovedPromoCodeWorkflow(
    userId: string,
    customerEmail: string,
    metadata: any
  ): Promise<PromoCodeWorkflowResult> {
    try {
      const { isEligible, promoCode, discountAmount, expirationDays, requestType } = metadata;

      if (isEligible) {
        // Send promo code email to customer
        const emailSent = await this.sendPromoCodeEmail(
          customerEmail,
          promoCode,
          discountAmount,
          expirationDays,
          requestType
        );

        // Log promo code usage
        await this.logPromoCodeUsage(userId, customerEmail, promoCode, requestType);

        // Update activity log
        await this.storage.createActivityLog({
          userId,
          customerEmail,
          action: 'promo_code_sent',
          type: 'automation_executed',
          details: `Promo code ${promoCode} (${discountAmount}) sent to customer for ${requestType}`,
          metadata: {
            promoCode,
            discountAmount,
            expirationDays,
            requestType,
            automationType: 'promo_code'
          },
          executedBy: 'ai'
        });

        return {
          success: true,
          message: `Promo code ${promoCode} sent successfully`,
          promoCodeSent: promoCode,
          emailSent
        };

      } else {
        // Send declining email
        const emailSent = await this.sendDecliningEmail(customerEmail, metadata.eligibilityReason);

        // Log the declining
        await this.storage.createActivityLog({
          userId,
          customerEmail,
          action: 'promo_code_declined',
          type: 'automation_executed',
          details: `Promo code request declined: ${metadata.eligibilityReason}`,
          metadata: {
            requestType: metadata.requestType,
            reason: metadata.eligibilityReason,
            automationType: 'promo_code'
          },
          executedBy: 'ai'
        });

        return {
          success: true,
          message: 'Declining email sent to customer',
          emailSent
        };
      }

    } catch (error) {
      console.error('Error executing promo code workflow:', error);
      return {
        success: false,
        message: 'Failed to execute promo code workflow'
      };
    }
  }

  /**
   * Gets customer order history (placeholder for WooCommerce integration)
   */
  async getCustomerHistory(customerEmail: string): Promise<{ orderCount: number; totalSpent: number; lastOrderDate?: Date }> {
    // In production, this would query WooCommerce API
    // For now, return mock data
    return {
      orderCount: Math.floor(Math.random() * 10),
      totalSpent: Math.floor(Math.random() * 1000),
      lastOrderDate: new Date()
    };
  }

  /**
   * Gets recent promo code requests for rate limiting
   */
  private async getRecentPromoRequests(customerEmail: string): Promise<any[]> {
    try {
      // Check activity logs for recent promo code requests in last 90 days
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      // In production, this would query the activity logs
      // For now, return empty array (no previous requests)
      return [];
    } catch (error) {
      console.error('Error getting recent promo requests:', error);
      return [];
    }
  }

  /**
   * Gets recent promo code offers for frequency limiting
   */
  private async getRecentPromoOffers(customerEmail: string, configId: string): Promise<any[]> {
    try {
      // Check activity logs for recent promo code offers
      // In production, this would query the activity logs for offers sent to this customer
      // with the specific promo code configuration ID
      
      // For now, return empty array (no previous offers)
      return [];
    } catch (error) {
      console.error('Error getting recent promo offers:', error);
      return [];
    }
  }

  /**
   * Sends promo code email to customer
   */
  private async sendPromoCodeEmail(
    customerEmail: string,
    promoCode: string,
    discountAmount: string,
    expirationDays: number,
    requestType: string
  ): Promise<boolean> {
    try {
      // In production, this would use the email service (OAuth Gmail/Outlook)
      console.log(`Sending promo code email to ${customerEmail}:`);
      console.log(`Code: ${promoCode}, Discount: ${discountAmount}, Expires in: ${expirationDays} days`);
      
      // For demo purposes, simulate email sending
      return true;
    } catch (error) {
      console.error('Error sending promo code email:', error);
      return false;
    }
  }

  /**
   * Sends declining email to customer
   */
  private async sendDecliningEmail(customerEmail: string, reason: string): Promise<boolean> {
    try {
      // In production, this would use the email service (OAuth Gmail/Outlook)
      console.log(`Sending declining email to ${customerEmail}: ${reason}`);
      
      // For demo purposes, simulate email sending
      return true;
    } catch (error) {
      console.error('Error sending declining email:', error);
      return false;
    }
  }

  /**
   * Logs promo code usage for analytics
   */
  private async logPromoCodeUsage(
    userId: string,
    customerEmail: string,
    promoCode: string,
    requestType: string
  ): Promise<void> {
    try {
      // In production, this would integrate with analytics and WooCommerce
      console.log(`Promo code usage logged: ${promoCode} for ${customerEmail} (${requestType})`);
    } catch (error) {
      console.error('Error logging promo code usage:', error);
    }
  }
}