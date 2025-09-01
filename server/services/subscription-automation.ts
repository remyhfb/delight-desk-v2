import { storage } from "../storage";
import { emailRoutingService } from "./email-routing";
import { contentSafetyService } from "./content-safety";
import { WooCommerceService } from "./woocommerce";
import { logger, LogCategory } from "./logger";
import { openaiService } from "./openai";
import { createHash } from "crypto";

interface SubscriptionActionResult {
  success: boolean;
  actionTaken: string;
  subscriptionId?: string;
  message: string;
}

export class SubscriptionAutomationService {
  
  /**
   * Extract subscription ID from email using AI-powered content understanding
   */
  private async extractSubscriptionId(subject: string, body: string): Promise<string | null> {
    try {
      // First try quick pattern matching for performance
      const content = `${subject} ${body}`;
      const quickPatterns = [
        /subscription\s*#?(\d{4,})/i,           // subscription #12345
        /sub\s*#?(\d{4,})/i,                    // sub #12345
        /membership\s*#?(\d{4,})/i,             // membership #12345
        /#(\d{4,})/i,                           // #12345 (fallback)
      ];
      
      for (const pattern of quickPatterns) {
        const match = content.match(pattern);
        if (match && match[1]) {
          return match[1];
        }
      }

      // If no clear match, use AI to understand subscription reference intent
      const prompt = `Analyze this customer email to extract any subscription number or subscription reference they mention.

Email Subject: ${subject}
Email Content: ${body}

TASK: Find any subscription number, subscription ID, or subscription reference the customer is mentioning.

LOOK FOR:
- Explicit subscription numbers (like #12345, Subscription 67890)
- Subscription IDs they reference when asking about subscription changes
- Membership numbers or account numbers
- Any numeric identifiers related to their subscription

CONTEXT: Customer wants to modify their subscription, so they would typically mention their subscription number.

RESPONSE FORMAT: Return ONLY the number if found, or "none" if no subscription number is mentioned.

Examples:
- "Please pause subscription #12345" → "12345"
- "Can you pause my sub 67890?" → "67890"
- "I want to pause my subscription but can't remember the number" → "none"`;

      const completion = await openaiService.generateFromInstructions(
        'Extract subscription number from customer request',
        prompt,
        'Subscription Service'
      );
      const result = completion.trim().toLowerCase();
      
      return (result === 'none' || result === 'null' || result === '') ? null : result;
      
    } catch (error) {
      console.error('Error extracting subscription ID:', error);
      return null;
    }
  }

  /**
   * Process subscription automation request
   */
  async processSubscriptionRequest(
    email: any, 
    userId: string, 
    customerRequest: string
  ): Promise<SubscriptionActionResult> {
    try {
      console.log(`[SUBSCRIPTION_AUTOMATION] Processing subscription request for user ${userId}`);
      
      // Extract subscription ID from email content
      const subscriptionId = await this.extractSubscriptionId(email.subject, email.body);
      console.log(`[SUBSCRIPTION_AUTOMATION] Extracted subscription ID: ${subscriptionId || 'none'}`);
      
      // Get WooCommerce configuration
      const storeConnections = await storage.getStoreConnections(userId);
      const wooConnection = storeConnections.find(conn => 
        conn.platform === 'woocommerce' && conn.isActive
      );
      if (!wooConnection) {
        throw new Error('WooCommerce not configured');
      }
      
      const wooService = new WooCommerceService({
        storeUrl: wooConnection.storeUrl,
        consumerKey: wooConnection.apiKey || '',
        consumerSecret: wooConnection.apiSecret || ''
      });
      
      // Determine the action requested
      const requestLower = customerRequest.toLowerCase();
      let actionTaken = '';
      let success = false;
      
      let finalSubscriptionId = subscriptionId;
      
      if (!subscriptionId) {
        // Customer didn't provide subscription ID - look up by email address
        console.log(`[SUBSCRIPTION_AUTOMATION] No subscription ID provided, looking up by customer email: ${email.fromEmail}`);
        
        try {
          // Get customer's active subscriptions by email
          const customerSubscriptions = await wooService.getCustomerSubscriptions(email.fromEmail);
          
          if (customerSubscriptions && customerSubscriptions.length > 0) {
            // Find the most recent active subscription
            const activeSubscriptions = customerSubscriptions.filter((sub: any) => 
              sub.status === 'active' || sub.status === 'on-hold'
            );
            
            if (activeSubscriptions.length > 0) {
              // Use the most recent active subscription
              const mostRecent = activeSubscriptions.sort((a: any, b: any) => 
                new Date(b.date_created).getTime() - new Date(a.date_created).getTime()
              )[0];
              
              finalSubscriptionId = mostRecent.id.toString();
              console.log(`[SUBSCRIPTION_AUTOMATION] Found active subscription ${finalSubscriptionId} for ${email.fromEmail}`);
            } else {
              console.log(`[SUBSCRIPTION_AUTOMATION] No active subscriptions found for ${email.fromEmail}`);
              return {
                success: false,
                actionTaken: 'no_active_subscription',
                message: 'I checked your account but couldn\'t find any active subscriptions associated with this email address. If you have an active subscription under a different email, please contact us from that email address.'
              };
            }
          } else {
            console.log(`[SUBSCRIPTION_AUTOMATION] No subscriptions found for ${email.fromEmail}`);
            return {
              success: false,
              actionTaken: 'no_subscriptions_found',
              message: 'I couldn\'t find any subscriptions associated with this email address. Please ensure you\'re contacting us from the email address used for your subscription, or contact our support team for assistance.'
            };
          }
        } catch (lookupError) {
          console.error('[SUBSCRIPTION_AUTOMATION] Error looking up customer subscriptions:', lookupError);
          return {
            success: false,
            actionTaken: 'customer_lookup_failed',
            message: 'I encountered an issue looking up your subscription information. Please provide your subscription number, or contact our support team for immediate assistance.'
          };
        }
      }
      
      // Execute the appropriate subscription action with finalSubscriptionId
      if (requestLower.includes('pause')) {
        success = await wooService.pauseSubscription(finalSubscriptionId!);
        actionTaken = 'paused_subscription';
        
        if (success) {
          console.log(`[SUBSCRIPTION_AUTOMATION] Successfully paused subscription ${finalSubscriptionId}`);
          
          // Create activity log for audit trail
          await storage.createActivityLog({
            userId,
            action: 'paused_subscription',
            type: 'subscription_automation',
            executedBy: 'ai',
            customerEmail: email.fromEmail,
            details: `AI successfully paused subscription #${finalSubscriptionId} for customer ${email.fromEmail}`,
            status: 'completed',
            metadata: {
              subscriptionId: finalSubscriptionId,
              automationType: 'pause',
              subject: email.subject
            }
          });
          
          return {
            success: true,
            actionTaken,
            subscriptionId: finalSubscriptionId || undefined,
            message: `Perfect! I've successfully paused your subscription #${finalSubscriptionId}. You won't be charged for future deliveries until you choose to resume it. You can reactivate anytime through your account dashboard or by contacting us.`
          };
        }
        
      } else if (requestLower.includes('resume') || requestLower.includes('restart') || requestLower.includes('reactivate')) {
        success = await wooService.reactivateSubscription(finalSubscriptionId!);
        actionTaken = 'resumed_subscription';
        
        if (success) {
          console.log(`[SUBSCRIPTION_AUTOMATION] Successfully resumed subscription ${finalSubscriptionId}`);
          
          // Create activity log for audit trail
          await storage.createActivityLog({
            userId,
            action: 'resumed_subscription',
            type: 'subscription_automation',
            executedBy: 'ai',
            customerEmail: email.fromEmail,
            details: `AI successfully resumed subscription #${finalSubscriptionId} for customer ${email.fromEmail}`,
            status: 'completed',
            metadata: {
              subscriptionId: finalSubscriptionId,
              automationType: 'resume',
              subject: email.subject
            }
          });
          
          return {
            success: true,
            actionTaken,
            subscriptionId: finalSubscriptionId || undefined,
            message: `Great news! Your subscription #${finalSubscriptionId} has been reactivated. Your next delivery will be scheduled according to your original plan, and billing will resume as normal.`
          };
        }
        
      } else if (requestLower.includes('cancel')) {
        success = await wooService.cancelSubscription(finalSubscriptionId!);
        actionTaken = 'cancelled_subscription';
        
        if (success) {
          console.log(`[SUBSCRIPTION_AUTOMATION] Successfully cancelled subscription ${finalSubscriptionId}`);
          
          // Create activity log for audit trail
          await storage.createActivityLog({
            userId,
            action: 'cancelled_subscription',
            type: 'subscription_automation',
            executedBy: 'ai',
            customerEmail: email.fromEmail,
            details: `AI successfully cancelled subscription #${finalSubscriptionId} for customer ${email.fromEmail}`,
            status: 'completed',
            metadata: {
              subscriptionId: finalSubscriptionId,
              automationType: 'cancel',
              subject: email.subject
            }
          });
          
          return {
            success: true,
            actionTaken,
            subscriptionId: finalSubscriptionId || undefined,
            message: `I've processed the cancellation of your subscription #${finalSubscriptionId}. Your subscription has been cancelled and you won't receive any future deliveries. If you change your mind, feel free to start a new subscription anytime.`
          };
        }
      }
      
      // If we get here, the action failed
      console.error(`[SUBSCRIPTION_AUTOMATION] Failed to ${actionTaken} subscription ${finalSubscriptionId}`);
      return {
        success: false,
        actionTaken: 'api_error',
        subscriptionId: finalSubscriptionId || undefined,
        message: `I encountered an issue processing your subscription request. Please try again, or contact our support team if the problem persists.`
      };
      
    } catch (error) {
      console.error(`[SUBSCRIPTION_AUTOMATION] Error processing subscription request:`, error);
      return {
        success: false,
        actionTaken: 'system_error',
        message: 'I encountered a technical issue while processing your subscription request. Please contact our support team for immediate assistance.'
      };
    }
  }
}

export const subscriptionAutomationService = new SubscriptionAutomationService();