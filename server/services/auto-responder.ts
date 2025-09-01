import { storage } from "../storage";
import { emailRoutingService } from "./email-routing";
import { promoRefundService } from "./promo-refund";
import { contentSafetyService } from "./content-safety";
import { sentimentAnalysisService } from "./sentiment-analysis";
import { hallucinationPreventionService } from "./hallucination-prevention";
import { empatheticResponseGenerator } from "./empathetic-response-generator";
import { trainingRequirementChecker } from "./training-requirement-checker";
import OpenAI from "openai";
import { aiAgentSignatureService } from "./ai-agent-signature";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface ClassificationResult {
  classification: string;
  confidence: number;
  reasoning: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  priorityReasoning?: string;
}

export interface ProcessedEmail {
  id: string;
  classification: string;
  confidence: number;
  autoResponseSent: boolean;
  escalated: boolean;
  ruleUsed?: string;
  awaitingApproval?: boolean;
}

class AutoResponderService {
  
  /**
   * Classify incoming email using OpenAI with hallucination prevention
   */
  async classifyEmail(emailContent: string, subject: string, userId?: string): Promise<ClassificationResult> {
    try {
      const prompt = `
You are an expert customer service AI that understands customer intent, not just keywords. Analyze the underlying meaning and context of this email.

CUSTOMER INTENT CATEGORIES:

1. **order_status** (WISMO - Where Is My Order)
   - Intent: Customer wants to know where their order is, when it will arrive, or why it hasn't arrived
   - Context: Any concern about order location, delivery timing, shipping progress
   - Examples: "Where is my order?", "Expected yesterday but not here", "Haven't received my package", "Order #123 status?"

2. **promo_refund** 
   - Intent: Customer wants money back or has billing/payment concerns
   - Context: Financial disputes, refund requests, charge issues

3. **discount_inquiries**
   - Intent: Customer is asking about available discounts, promo codes, or special offers
   - Context: General discount requests, first-time customer inquiries, asking "Do you have any sales?", "Any coupons available?", "Can I get a discount?"
   - Examples: "Do you have any promo codes?", "Any discounts for new customers?", "Are there any sales happening?", "Can I get a coupon?"

4. **order_cancellation**
   - Intent: Customer wants to stop an order before it ships
   - Context: Prevent shipment, cancel before processing

5. **return_request**
   - Intent: Customer wants to exchange or return a received product
   - Context: Product exchanges, returns (not necessarily for refund)

6. **subscription_changes**
   - Intent: Customer wants to modify their ongoing subscription
   - Context: Pause, resume, change contents, modify schedule

7. **cancellation_requests**
   - Intent: Customer wants to end their subscription/account permanently
   - Context: Terminate service, close account

8. **payment_issues**
   - Intent: Customer has problems with payment processing
   - Context: Failed payments, payment method issues

9. **address_change**
   - Intent: Customer wants to change shipping address
   - Context: Update delivery location

10. **product**
   - Intent: Customer has questions about product features or specifications
   - Context: Product information, compatibility, usage

11. **escalation**
    - Intent: Customer is frustrated, threatening, or has complex multi-issue problems
    - Context: Complaints, legal threats, multiple failed attempts

12. **human_escalation**
    - Intent: Customer explicitly requests human assistance or escalation
    - Context: Any variation of wanting to speak to a person, human agent, real person
    - Keywords/Phrases: "Human", "speak to someone", "real person", "human agent", "escalate", "transfer me", "I need a person", "connect me to someone", "I want to talk to a human", "get a human on the line"
    - Priority: ALWAYS urgent regardless of other factors

13. **general**
    - Intent: Simple questions, compliments, basic inquiries
    - Context: Only use if no specific intent is clear

PRIORITY ASSESSMENT:
- **urgent**: Human escalation requests, events tomorrow, damaged goods, safety issues
- **high**: Delayed orders, upset customers, payment problems, billing disputes  
- **medium**: Standard requests, general order questions, subscription changes
- **low**: Simple questions, compliments, product info requests

ANALYSIS INSTRUCTIONS:
1. **FIRST CHECK FOR HUMAN ESCALATION**: Look for any requests to speak to a human, real person, agent, or escalation - if found, classify as "human_escalation" with "urgent" priority
2. Read the email content to understand the customer's underlying concern and emotional state
3. Identify the primary intent - what does the customer actually want?
4. Consider context clues like order numbers, timing expressions, emotional language
5. Assign appropriate priority based on urgency and customer sentiment
6. Be confident in your assessment - modern AI should easily understand customer intent

Email Subject: ${subject}
Email Content: ${emailContent}

Respond with JSON:
{
  "classification": "category_name",
  "confidence": 85,
  "reasoning": "Brief explanation of the customer's intent and why this classification matches",
  "priority": "urgent|high|medium|low", 
  "priorityReasoning": "Why this priority level was assigned based on urgency and customer sentiment"
}
      `;

      // SIMPLIFIED: Direct OpenAI classification (hallucination prevention removed)
      console.log('[AUTO_RESPONDER] Using direct OpenAI classification - no hallucination prevention wrapper');

      // Fallback for users without training data
      const response = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.3,
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      
      return {
        classification: result.classification || 'general',
        confidence: Math.max(0, Math.min(100, result.confidence || 50)),
        reasoning: result.reasoning || 'AI classification result',
        priority: result.priority || 'medium',
        priorityReasoning: result.priorityReasoning || 'Standard priority assignment'
      };
    } catch (error) {
      console.error('Email classification error:', error);
      return {
        classification: 'general',
        confidence: 30,
        reasoning: 'Classification failed, defaulting to general',
        priority: 'medium',
        priorityReasoning: 'Default priority due to classification failure'
      };
    }
  }

  /**
   * Find matching auto-responder rule for classification
   */
  async findMatchingRule(userId: string, classification: string, confidence: number) {
    const rules = await storage.getAutoResponderRules(userId);
    
    // Find exact classification match first
    let matchingRule = rules.find((rule: any) => 
      rule.classification === classification && 
      rule.isActive
    );

    // If no exact match and confidence is low, try general fallback
    if (!matchingRule && confidence < 70) {
      matchingRule = rules.find((rule: any) => 
        rule.classification === 'general' && 
        rule.isActive
      );
    }

    return matchingRule;
  }

  /**
   * Process incoming email with auto-responder logic
   */
  async processIncomingEmail(userId: string, emailData: {
    fromEmail: string;
    toEmail: string;
    subject: string;
    body: string;
    messageId?: string;
  }): Promise<ProcessedEmail> {
    
    // Store the email in database
    const email = await storage.createEmail({
      userId,
      fromEmail: emailData.fromEmail,
      toEmail: emailData.toEmail,
      subject: emailData.subject,
      body: emailData.body,
      status: 'processing',
      metadata: {
        messageId: emailData.messageId,
        receivedAt: new Date().toISOString()
      }
    });

    // CRITICAL: Link email to thread for conversation context
    try {
      const { ThreadContextService } = await import('./thread-context');
      await ThreadContextService.linkEmailToThread(
        email.id,
        emailData.subject,
        emailData.fromEmail,
        emailData.toEmail
      );
    } catch (error) {
      console.error('Failed to link email to thread:', error);
      // Continue processing - thread linking is not critical for basic functionality
    }

    // Classify the email with hallucination prevention
    const classification = await this.classifyEmail(emailData.body, emailData.subject, userId);
    
    // SENTIMENT ANALYSIS - Check for negative sentiment that needs immediate escalation
    let sentimentEscalation = false;
    let sentimentReason = '';
    try {
      const { sentimentAnalysisService } = await import('./sentiment-analysis');
      const sentimentResult = await sentimentAnalysisService.analyzeSentiment(emailData.body);
      
      // Escalate highly negative sentiment emails immediately
      if (sentimentResult.sentiment === 'NEGATIVE') {
        const negativeScore = sentimentResult.scores.negative || 0;
        const sentimentConfidence = sentimentResult.confidence || 0;
        
        if (negativeScore > 75 && sentimentConfidence > 90) {
          sentimentEscalation = true;
          sentimentReason = `Very angry customer detected (${negativeScore}% negative sentiment with ${sentimentConfidence}% confidence)`;
        } else if (negativeScore > 85 && sentimentConfidence > 80) {
          sentimentEscalation = true;
          sentimentReason = `Highly frustrated customer detected (${negativeScore}% negative sentiment)`;
        }
      }
      
      console.log(`[AUTO_RESPONDER] Sentiment analysis: ${sentimentResult.sentiment} (${sentimentResult.confidence}% confidence)`);
      if (sentimentEscalation) {
        console.log(`[AUTO_RESPONDER] Sentiment escalation triggered: ${sentimentReason}`);
      }
    } catch (sentimentError) {
      console.warn('[AUTO_RESPONDER] Sentiment analysis failed:', sentimentError);
      // Continue without sentiment analysis if it fails
    }
    
    // Update email with classification
    await storage.updateEmail(email.id, {
      classification: classification.classification,
      confidence: classification.confidence,
      metadata: {
        ...(email.metadata as any || {}),
        classificationReasoning: classification.reasoning
      }
    });

    // Check if should escalate based on confidence, classification, or negative sentiment
    if (classification.confidence < 60 || classification.classification === 'escalation' || sentimentEscalation) {
      const escalationReason = sentimentEscalation 
        ? `Negative sentiment detected - ${sentimentReason}`
        : undefined;
      
      // Override priority for sentiment-based escalations
      let escalationClassification = classification;
      if (sentimentEscalation) {
        escalationClassification = {
          ...classification,
          priority: sentimentReason.includes('Very angry') ? 'urgent' : 'high',
          priorityReasoning: `Escalated due to negative sentiment: ${sentimentReason}`
        };
      }
      
      return await this.escalateEmail(email.id, userId, escalationClassification, escalationReason);
    }

    // Find matching auto-responder rule
    const rule = await this.findMatchingRule(userId, classification.classification, classification.confidence);
    
    if (!rule) {
      // No rule found, escalate
      return await this.escalateEmail(email.id, userId, classification, 'No matching auto-responder rule');
    }

    // Check if approval is required using individual agent controls (no master switch)
    const ruleRequiresApproval = rule.requiresApproval ?? false;
    console.log(`[AUTO_RESPONDER] Individual agent control - Rule requires approval: ${ruleRequiresApproval}`);

    if (ruleRequiresApproval) {
      // Create approval queue item instead of executing immediately
      const responseData = await this.generateProposedResponse(rule, emailData, userId);
      
      await storage.createAutomationApprovalItem({
        userId,
        emailId: email.id,
        ruleId: rule.id,
        customerEmail: emailData.fromEmail,
        subject: emailData.subject,
        body: emailData.body,
        classification: classification.classification,
        confidence: responseData.adjustedConfidence, // Use sentiment-aware confidence
        proposedResponse: responseData.response,
        status: 'pending',
        metadata: {
          originalMessageId: emailData.messageId,
          classificationReasoning: classification.reasoning,
          priority: classification.priority,
          priorityReasoning: classification.priorityReasoning,
          originalConfidence: classification.confidence,
          sentimentAdjustedConfidence: responseData.adjustedConfidence,
          // Include real data for UI display
          orderData: undefined,
          cancellationData: undefined,
          promoRefundData: undefined,
          productData: undefined
        }
      });

      // Update email status to awaiting approval
      await storage.updateEmail(email.id, {
        status: 'awaiting_approval',
        metadata: {
          ...(email.metadata as any || {}),
          awaitingApproval: true,
          ruleId: rule.id
        }
      });

      // Log activity
      await storage.createActivityLog({
        userId,
        action: 'Queued for approval',
        type: 'email_processed',
        executedBy: 'ai',
        customerEmail: emailData.fromEmail,
        details: `AI classified email as ${classification.classification} and queued automation for approval`,
        status: 'pending',
        metadata: {
          ruleId: rule.id,
          ruleName: rule.name,
          classification: classification.classification,
          confidence: classification.confidence
        }
      });

      return {
        id: email.id,
        classification: classification.classification,
        confidence: classification.confidence,
        autoResponseSent: false,
        escalated: false,
        awaitingApproval: true,
        ruleUsed: rule.name
      };
    }

    // Execute automation immediately (approval not required)
    console.log(`[AUTO_RESPONDER] EXECUTING DIRECT AUTOMATION - Classification: ${classification.classification}, RequiresApproval: ${rule.requiresApproval}`);
    let responseSuccess = false;
    if (classification.classification === 'discount_inquiries') {
      // Handle discount inquiries - route to enhanced promo code agent
      const { PromoCodeService } = await import('./promo-code');
      const promoCodeService = new PromoCodeService(storage);
      
      // Check if customer might be first-time customer and has applicable first-time offers
      const customerHistory = await promoCodeService.getCustomerHistory(emailData.fromEmail);
      const isFirstTime = customerHistory.orderCount === 0;
      
      const requestType: 'first_time_customer' | 'general_discount' = isFirstTime ? 'first_time_customer' : 'general_discount';
      const request = {
        customerEmail: emailData.fromEmail,
        requestType: requestType,
        originalMessage: emailData.body,
        emailClassification: 'discount_inquiries'
      };
      
      const eligibility = await promoCodeService.evaluatePromoCodeEligibility(request, userId);
      responseSuccess = eligibility.isEligible;
      
      // Log the discount inquiry processing with customer type information
      await storage.createActivityLog({
        userId,
        action: eligibility.isEligible ? 'discount_offered' : 'discount_declined',
        type: 'promo_code_automation',
        executedBy: 'ai',
        customerEmail: emailData.fromEmail,
        details: isFirstTime 
          ? `First-time customer: ${eligibility.reason}` 
          : `Returning customer: ${eligibility.reason}`,
        status: 'completed',
        metadata: {
          customerType: isFirstTime ? 'first_time' : 'returning',
          requestType,
          promoCode: eligibility.isEligible ? eligibility.promoCode : null
        }
      });
    } else if (classification.classification === 'promo_refund') {
      // First try the enhanced promo refund service for sophisticated code handling
      const { enhancedPromoRefundService } = await import('./enhanced-promo-refund.js');
      const enhancedResult = await enhancedPromoRefundService.processEnhancedPromoRefund(
        email.id,
        emailData.fromEmail,
        emailData.subject,
        emailData.body,
        userId
      );

      if (enhancedResult.success) {
        responseSuccess = true;
      } else if (enhancedResult.shouldEscalate) {
        // Enhanced service recommends escalation, fall back to original service
        responseSuccess = await promoRefundService.processPromoRefund(
          email.id, 
          emailData.fromEmail, 
          userId, 
          rule
        );
      }
    } else if (classification.classification === 'order_cancellation') {
      // Handle order cancellation requests - use the full sophisticated workflow
      const { orderCancellationService } = await import('./order-cancellation');
      const result = await orderCancellationService.initiateCancellationWorkflow(
        userId,
        email.id,
        emailData.fromEmail,
        emailData.subject,
        emailData.body
      );
      responseSuccess = result.success;
    } else if (classification.classification === 'address_change') {
      // Handle address change requests
      const { addressChangeService } = await import('./address-change');
      // Initialize address change workflow directly
      const result = await addressChangeService.initiateAddressChangeWorkflow(
        userId,
        email.id,
        emailData.fromEmail,
        emailData.subject,
        emailData.body
      );
      responseSuccess = result.success;
    } else if (classification.classification === 'subscription_changes') {
      // Handle subscription automation (pause, resume, cancel)
      console.log('[AUTO_RESPONDER] SUBSCRIPTION AUTOMATION BLOCK REACHED - Executing subscription action');
      console.log(`[AUTO_RESPONDER] Email data:`, { subject: emailData.subject, fromEmail: emailData.fromEmail });
      const { subscriptionAutomationService } = await import('./subscription-automation');
      const result = await subscriptionAutomationService.processSubscriptionRequest(
        email,
        userId,
        `${emailData.subject} ${emailData.body}`
      );
      
      if (result.success) {
        // Send confirmation email to customer
        responseSuccess = await this.sendEmpathicAutoResponse(
          userId, 
          emailData.fromEmail, 
          result.message, 
          emailData.subject
        );
        
        // CRITICAL: Create audit trail for subscription action
        await storage.createActivityLog({
          userId,
          customerEmail: emailData.fromEmail,
          action: 'executed_subscription_automation',
          type: 'email_processed',
          executedBy: 'ai',
          details: `AI automatically ${result.actionTaken} subscription #${result.subscriptionId || 'unknown'}`,
          status: 'completed',
          metadata: {
            subscriptionId: result.subscriptionId,
            actionTaken: result.actionTaken,
            classification: classification.classification,
            confidence: classification.confidence,
            automationType: 'subscription_automation',
            customerMessage: result.message
          }
        });
        
        console.log(`[AUTO_RESPONDER] Subscription action executed: ${result.actionTaken}`);
      } else {
        // Failed - route to approval queue for human intervention
        console.log('[AUTO_RESPONDER] Subscription automation failed, routing to approval queue');
        responseSuccess = false;
      }
    } else {
      // Send empathetic auto-response (using revolutionary empathetic generator)
      console.log('[AUTO_RESPONDER] Non-approval flow - using empathetic generator for immediate response');
      const responseData = await this.generateProposedResponse(rule, emailData, userId);
      
      // Send the empathetic response immediately
      responseSuccess = await this.sendEmpathicAutoResponse(userId, emailData.fromEmail, responseData.response, emailData.subject);
    }
    
    if (responseSuccess) {
      // Update rule usage statistics
      await storage.updateAutoResponderRule(rule.id, {
        triggerCount: (rule.triggerCount || 0) + 1,
        lastTriggered: new Date()
      });

      // Update email status
      await storage.updateEmail(email.id, {
        status: 'resolved',
        isResponded: true,
        aiResponse: rule.template,
        processedAt: new Date()
      });

      // Log activity
      await storage.createActivityLog({
        userId,
        action: 'Sent automated reply',
        type: 'email_processed',
        executedBy: 'ai',
        customerEmail: emailData.fromEmail,
        details: `AI automatically sent ${classification.classification} response using rule: ${rule.name}`,
        status: 'completed',
        metadata: {
          ruleId: rule.id,
          ruleName: rule.name,
          classification: classification.classification,
          confidence: classification.confidence
        }
      });

      return {
        id: email.id,
        classification: classification.classification,
        confidence: classification.confidence,
        autoResponseSent: true,
        escalated: false,
        ruleUsed: rule.name
      };
    } else {
      // Failed to send response, escalate
      return await this.escalateEmail(email.id, userId, classification, 'Failed to send auto-response');
    }
  }

  /**
   * Generate empathetic proposed response for approval queue
   * REVOLUTIONARY: Uses dynamic emotional intelligence instead of rigid templates
   */
  async generateProposedResponse(rule: any, emailData: { subject: string; body: string; fromEmail: string }, userId: string): Promise<{ response: string; adjustedConfidence: number }> {
    console.log('[AUTO_RESPONDER] generateProposedResponse called for classification:', rule?.classification);
    
    try {
      // Extract order number if present using the correct function
      const orderNumber = this.extractOrderNumberFromEmail(emailData.subject, emailData.body);
      
      // For order status (WISMO), use the comprehensive WISMO Agent
      if (rule?.classification === 'order_status') {
        console.log('[AUTO_RESPONDER] Order status detected, using WISMO Agent...');
        try {
          const { wismoAgentService } = await import('./wismo-agent');
          
          // Create a real email record first to satisfy foreign key constraints
          const tempEmail = await storage.createEmail({
            userId,
            fromEmail: emailData.fromEmail,
            toEmail: 'support@delightdesk.io',
            subject: emailData.subject,
            body: emailData.body,
            status: 'processing',
            metadata: {
              isWismoProcessing: true,
              messageId: `wismo-${Date.now()}`,
              receivedAt: new Date().toISOString()
            }
          });
          
          const wismoResult = await wismoAgentService.processWismoRequest(
            userId,
            tempEmail.id,
            emailData.fromEmail,
            emailData.subject,
            emailData.body
          );
          
          if (wismoResult.success && wismoResult.response) {
            return {
              response: wismoResult.response,
              adjustedConfidence: 95 // High confidence for WISMO agent processing
            };
          } else {
            console.log('[AUTO_RESPONDER] WISMO Agent escalated:', wismoResult.escalationReason);
            // Fall back to original template-based response
            return {
              response: rule.template || 'Thank you for your order inquiry. We are looking into this and will get back to you shortly.',
              adjustedConfidence: 70 // Lower confidence for fallback
            };
          }
        } catch (error) {
          console.error('[AUTO_RESPONDER] WISMO Agent failed, using fallback:', error);
          // Fall back to original template-based response  
          return {
            response: rule.template || 'Thank you for your order inquiry. We are looking into this and will get back to you shortly.',
            adjustedConfidence: 70 // Lower confidence for fallback
          };
        }
      }
      
      // **SUBSCRIPTION CHANGES**: Use rule template for actual automation
      if (rule?.classification === 'subscription_changes') {
        console.log('[AUTO_RESPONDER] Subscription changes detected - using rule template for automation');
        
        // For subscription changes, execute the actual automation and use template response
        try {
          const { subscriptionAutomationService } = await import('./subscription-automation');
          const automationResult = await subscriptionAutomationService.processSubscriptionRequest(
            { 
              id: `temp-${Date.now()}`, // Temporary ID for this context
              subject: emailData.subject, 
              body: emailData.body, 
              fromEmail: emailData.fromEmail 
            },
            userId,
            `${emailData.subject} ${emailData.body}`
          );
          
          // Return the automation result as the response
          return {
            response: automationResult.message,
            adjustedConfidence: automationResult.success ? 90 : 70
          };
        } catch (error) {
          console.error('[AUTO_RESPONDER] Subscription automation failed, falling back to template');
          // Fallback to rule template if automation fails
          return {
            response: rule.template || 'We will process your subscription request and get back to you shortly.',
            adjustedConfidence: 60
          };
        }
      }
      
      // For all other cases, use empathetic response generator
      console.log('[AUTO_RESPONDER] Using empathetic response generator...');
      
      // Get company name and empathy level from settings
      const settings = await storage.getSystemSettings(userId);
      const companyName = settings?.companyName || 'Our Company';
      const empathyLevel = settings?.empathyLevel || 3; // Default to level 3
      
      // Define context based on classification - now with real order data fetching
      const responseContext = await this.buildResponseContext(rule.classification, {
        orderNumber,
        companyName,
        emailData,
        rule,
        userId
      });
      
      // Check if this is the first reply in the thread for loyal customer greeting
      const { ThreadContextService } = await import('./thread-context');
      const messageId = (emailData as any).messageId || `email-${Date.now()}`;
      const threadContext = await ThreadContextService.getThreadContext(messageId);
      const isFirstReply = !threadContext || threadContext.emails.length <= 1;
      
      // Generate empathetic response using AI emotional intelligence with custom empathy level
      const empatheticResponse = await empatheticResponseGenerator.generateResponse(
        userId,
        emailData.body,
        emailData.subject,
        rule.classification,
        responseContext,
        empathyLevel,
        emailData.fromEmail,
        isFirstReply
      );
      
      // Get AI agent signature with personalized name and title
      const { aiAgentSignatureService } = await import('./ai-agent-signature');
      const aiSignature = await aiAgentSignatureService.generateAIAgentSignature(userId);

      // Format as complete email with personalized AI agent signature
      const fullResponse = `${empatheticResponse.body}

${aiSignature}`;

      return {
        response: fullResponse,
        adjustedConfidence: empatheticResponse.confidenceScore
      };
      
    } catch (error) {
      console.error('[AUTO_RESPONDER] Empathetic response generation failed:', error);
      console.error('[AUTO_RESPONDER] Error details:', {
        message: (error as Error).message,
        stack: (error as Error).stack,
        emailData,
        userId,
        rule: rule?.classification
      });
      
      // Fallback: Generate low confidence escalation response (no more placeholder templates)
      return this.generateLegacyResponse(rule, emailData, userId);
    }
  }
  
  /**
   * Build response context for empathetic generation with real order data
   */
  private async buildResponseContext(classification: string, data: any) {
    const baseContext = {
      classification,
      customerName: data.emailData?.fromEmail ? data.emailData.fromEmail.split('@')[0] : 'Customer', // Extract name from email safely
      orderNumber: data.orderNumber,
      companyName: data.companyName,
      specificIssue: this.identifySpecificIssue(classification, data.emailData?.body || ''),
      availableActions: this.getAvailableActions(classification, data.rule)
    };
    
    // For order status inquiries, fetch real order data instead of using placeholders
    if (classification === 'order_status' && data.orderNumber) {
      try {
        const { orderLookupService } = await import('./order-lookup');
        const orderData = await orderLookupService.lookupOrder(data.orderNumber, data.userId);
        
        if (orderData && orderData.success) {
          (baseContext as any).orderData = {
            status: orderData.status || 'Processing',
            trackingNumber: orderData.tracking_code || 'Not available yet',
            estimatedDelivery: orderData.estimated_delivery ? 
              new Date(orderData.estimated_delivery).toLocaleDateString() : 
              'Will be updated soon',
            trackingUrl: orderData.tracking_url || '#'
          };
        }
      } catch (error) {
        console.warn('[AUTO_RESPONDER] Could not fetch real order data:', error);
        // Keep base context without order data if lookup fails
      }
    }

    // For order cancellation, fetch real order data and workflow details
    if (classification === 'order_cancellation' && data.orderNumber) {
      try {
        const { orderLookupService } = await import('./order-lookup');
        const orderData = await orderLookupService.lookupOrder(data.orderNumber, data.userId);
        
        if (orderData && orderData.success) {
          (baseContext as any).cancellationData = {
            orderNumber: data.orderNumber,
            orderTotal: orderData.total || '0.00',
            orderStatus: orderData.status || 'Unknown',
            orderDate: orderData.date_created ? new Date(orderData.date_created).toLocaleDateString() : 'Unknown',
            refundAmount: orderData.total || '0.00',
            plannedActions: [
              'Send cancellation request to fulfillment center',
              `Process full refund of $${orderData.total || '0.00'}`,
              'Send confirmation email to customer'
            ]
          };
        }
      } catch (error) {
        console.warn('[AUTO_RESPONDER] Could not fetch order cancellation data:', error);
      }
    }

    // For address changes, fetch order data and create comprehensive planned actions
    if (classification === 'address_change' && data.orderNumber) {
      try {
        const { orderLookupService } = await import('./order-lookup');
        const orderData = await orderLookupService.lookupOrder(data.orderNumber, data.userId);
        const settings = await storage.getSystemSettings(data.userId);
        
        if (orderData && orderData.success) {
          const plannedActions = [
            'Send response to customer confirming address change request',
            `Update shipping address in WooCommerce for Order #${data.orderNumber}`,
            'Process address change in order management system'
          ];

          // Add warehouse email action if enabled
          if (settings?.warehouseEmailEnabled && settings?.warehouseEmail) {
            plannedActions.push(`Send address change notification to warehouse (${settings.warehouseEmail})`);
          }

          // Add fulfillment-specific actions based on method
          if (settings?.fulfillmentMethod === 'warehouse_email') {
            plannedActions.push('Coordinate with fulfillment team to update shipping details');
          } else if (settings?.shipbobEnabled) {
            plannedActions.push('Update shipping address in ShipBob system');
          }

          (baseContext as any).addressChangeData = {
            orderNumber: data.orderNumber,
            orderStatus: orderData.status || 'Processing',
            currentAddress: orderData.shipping_address || 'Address on file',
            newAddressRequested: true,
            warehouseNotificationEnabled: settings?.warehouseEmailEnabled || false,
            fulfillmentMethod: settings?.fulfillmentMethod || 'warehouse_email',
            plannedActions
          };
        }
      } catch (error) {
        console.warn('[AUTO_RESPONDER] Could not fetch address change data:', error);
        // Fallback planned actions if order lookup fails
        (baseContext as any).addressChangeData = {
          orderNumber: data.orderNumber,
          newAddressRequested: true,
          plannedActions: [
            'Send response to customer confirming address change request',
            'Update shipping address in order system',
            'Coordinate with fulfillment team for address update'
          ]
        };
      }
    }

    // For discount inquiries, provide available offers
    if (classification === 'discount_inquiries' && data.userId) {
      try {
        const { PromoCodeService } = await import('./promo-code');
        const promoCodeService = new PromoCodeService(storage);
        const applicableConfigs = await promoCodeService.findApplicablePromoCodes(
          data.userId, 
          'general_discount', 
          data.emailData?.fromEmail || ''
        );
        
        if (applicableConfigs.length > 0) {
          const config = applicableConfigs[0];
          (baseContext as any).discountData = {
            hasAvailableDiscounts: true,
            promoCode: config.promoCode,
            discountAmount: config.discountType === 'percentage' 
              ? `${config.discountAmount}%` 
              : `$${config.discountAmount}`,
            description: config.description,
            validUntil: new Date(config.validUntil).toLocaleDateString(),
            minOrderValue: config.minOrderValue || null,
            plannedActions: [
              `Offer promo code ${config.promoCode}`,
              `Provide discount details (${config.discountType === 'percentage' ? config.discountAmount + '%' : '$' + config.discountAmount} off)`,
              'Send personalized discount offer to customer',
              'Log discount offer for future reference'
            ]
          };
        } else {
          (baseContext as any).discountData = {
            hasAvailableDiscounts: false,
            plannedActions: [
              'Explain current promotional status',
              'Suggest signing up for newsletter for future offers',
              'Provide information about loyalty program if available'
            ]
          };
        }
      } catch (error) {
        console.warn('[AUTO_RESPONDER] Could not fetch discount data:', error);
      }
    }

    // For promo refund, calculate actual refund amounts
    if (classification === 'promo_refund' && data.rule) {
      try {
        let refundAmount = '0.00';
        if (data.rule.refundType === 'percentage') {
          // For percentage refunds, we'd need order total to calculate
          const percentage = (data.rule.refundValue * 100).toFixed(0);
          refundAmount = `${percentage}% refund`;
          if (data.rule.refundCap) {
            refundAmount += ` (up to $${data.rule.refundCap})`;
          }
        } else if (data.rule.refundType === 'fixed_amount') {
          refundAmount = `$${data.rule.refundValue}`;
        }

        (baseContext as any).promoRefundData = {
          refundType: data.rule.refundType,
          refundAmount,
          refundValue: data.rule.refundValue,
          refundCap: data.rule.refundCap,
          plannedActions: [
            `Process ${refundAmount} refund`,
            'Apply refund to original payment method',
            'Send confirmation email to customer',
            'Log transaction for accounting'
          ]
        };
      } catch (error) {
        console.warn('[AUTO_RESPONDER] Could not fetch promo refund data:', error);
      }
    }

    // For product questions, fetch real product information from training data
    if (classification === 'product' && data.userId) {
      try {
        const { hallucinationPreventionService } = await import('./hallucination-prevention');
        const emailContent = data.emailData?.body || '';
        const knowledgeBase = await hallucinationPreventionService.getRelevantKnowledge(
          data.userId,
          emailContent
        );
        
        if (knowledgeBase.hasTrainingData && knowledgeBase.relevantContent.length > 0) {
          (baseContext as any).productData = {
            hasRealData: true,
            relevantInfo: knowledgeBase.relevantContent.slice(0, 3), // Top 3 most relevant pieces
            confidence: (knowledgeBase as any).confidence || 0.8,
            plannedActions: [
              'Analyze customer product question',
              'Provide accurate information from knowledge base',
              'Offer additional resources if needed',
              'Ask follow-up questions for clarification'
            ]
          };
        } else {
          (baseContext as any).productData = {
            hasRealData: false,
            message: 'No specific product information available in training data',
            plannedActions: [
              'Acknowledge product inquiry',
              'Escalate to human agent for detailed product information',
              'Provide general contact information'
            ]
          };
        }
      } catch (error) {
        console.warn('[AUTO_RESPONDER] Could not fetch product data:', error);
        (baseContext as any).productData = {
          hasRealData: false,
          error: 'Unable to fetch product information',
          plannedActions: ['Escalate to human agent']
        };
      }
    }
    
    return baseContext;
  }
  
  /**
   * Identify specific customer issue for empathetic response
   */
  private identifySpecificIssue(classification: string, emailBody: string): string {
    const issueMap: { [key: string]: string } = {
      'order_status': 'Order delivery delay or tracking concerns',
      'promo_refund': 'Promotional code or billing issue',
      'return_request': 'Product return or exchange request',
      'subscription_changes': 'Subscription billing or modification concern',
      'order_cancellation': 'Request to cancel pending order',
      'address_change': 'Shipping address update needed',
      'product': 'Product information or compatibility question'
    };
    
    return issueMap[classification] || 'General customer service inquiry';
  }
  
  /**
   * Get available actions for this classification
   */
  private getAvailableActions(classification: string, rule: any): string[] {
    const actionMap: { [key: string]: string[] } = {
      'order_status': ['Check tracking information', 'Provide delivery update', 'Offer expedited shipping'],
      'promo_refund': ['Validate promo code', 'Process refund', 'Apply manual discount'],
      'return_request': ['Generate return label', 'Process exchange', 'Initiate refund'],
      'subscription_changes': ['Modify subscription', 'Update billing', 'Adjust delivery schedule'],
      'order_cancellation': ['Cancel order if possible', 'Process refund', 'Stop shipment'],
      'address_change': ['Update shipping address', 'Confirm new delivery location'],
      'product': ['Provide product information', 'Check compatibility', 'Recommend alternatives']
    };
    
    return actionMap[classification] || ['Provide customer assistance', 'Address customer concern'];
  }
  
  /**
   * Extract order number from email content
   */
  private extractOrderNumber(emailBody: string): string | null {
    const orderPatterns = [
      /order\s*#?\s*(\d+)/i,
      /order\s*number\s*#?\s*(\d+)/i,
      /#(\d{4,})/,
      /\b(\d{4,6})\b/
    ];
    
    for (const pattern of orderPatterns) {
      const match = emailBody.match(pattern);
      if (match) {
        return match[1];
      }
    }
    
    return null;
  }
  
  /**
   * REMOVED: Legacy template system completely deleted per user requirements  
   * Generate low confidence response suggesting escalation to human
   */
  private async generateLegacyResponse(rule: any, emailData: { subject: string; body: string; fromEmail: string }, userId: string): Promise<{ response: string; adjustedConfidence: number }> {
    console.log('[AUTO_RESPONDER] Legacy fallback triggered - generating low confidence escalation response');
    
    // Generate simple escalation notice instead of placeholder templates
    const escalationResponse = `Hello!

Thank you for contacting us. Your inquiry requires specialized assistance that our AI agent cannot provide at this time.

A human team member will review your message and respond within 24 hours to ensure you receive the most accurate and helpful information.

We appreciate your patience.

Best regards,
Customer Support Team

This email was sent by a robot. We use AI to solve your problems as quickly as possible. Reply 'Human' anytime and a human will jump in.`;

    return {
      response: escalationResponse,
      adjustedConfidence: 15 // Very low confidence to ensure human review
    };
  }

  /**
   * Calculate confidence score adjusted for customer sentiment
   * High negative sentiment reduces confidence, indicating need for human review
   */
  private async calculateSentimentAwareConfidence(baseConfidence: number, emailData: { subject: string; body: string; fromEmail: string }, userId: string): Promise<number> {
    try {
      const { sentimentAnalysisService } = await import('./sentiment-analysis');
      const sentimentResult = await sentimentAnalysisService.analyzeSentiment(emailData.body);
      
      let confidenceAdjustment = 0;
      const negativeScore = sentimentResult.scores.negative || 0;
      const sentimentConfidence = sentimentResult.confidence || 0;
      
      // Reduce confidence for high negative sentiment (more human review needed)
      if (sentimentResult.sentiment === 'NEGATIVE') {
        if (negativeScore > 75 && sentimentConfidence > 90) {
          confidenceAdjustment = -25; // Significant reduction for very angry customers
        } else if (negativeScore > 60 && sentimentConfidence > 80) {
          confidenceAdjustment = -15; // Moderate reduction for frustrated customers
        } else if (negativeScore > 45 && sentimentConfidence > 70) {
          confidenceAdjustment = -8; // Small reduction for mildly negative sentiment
        }
      }
      
      // Boost confidence for positive sentiment (AI handles well)
      if (sentimentResult.sentiment === 'POSITIVE' && sentimentConfidence > 80) {
        confidenceAdjustment = 5; // Small boost for happy customers
      }
      
      // Apply adjustment and ensure bounds
      const adjustedConfidence = Math.max(10, Math.min(95, baseConfidence + confidenceAdjustment));
      
      return Math.round(adjustedConfidence);
    } catch (error) {
      console.error('Failed to analyze sentiment for confidence adjustment:', error);
      return baseConfidence; // Return original confidence if sentiment analysis fails
    }
  }

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
   * Send empathetic auto-response immediately (for non-approval flow)
   */
  async sendEmpathicAutoResponse(userId: string, customerEmail: string, responseContent: string, originalSubject: string): Promise<boolean> {
    try {
      // CRITICAL: Validate email before sending to protect sender reputation
      if (!this.isValidEmailForProduction(customerEmail)) {
        console.warn(`AutoResponder: Blocked email send to protect sender reputation - ${customerEmail}`);
        return false;
      }

      // CRITICAL: Validate content safety before sending
      const safetyValidation = await contentSafetyService.validateResponse(responseContent, userId);
      
      if (!safetyValidation.approved) {
        console.warn(`AutoResponder: Blocked response due to safety validation - ${safetyValidation.blockReason}`);
        return false;
      }

      // Create response subject
      let responseSubject = `Re: ${originalSubject}`;
      if (!originalSubject.toLowerCase().startsWith('re:')) {
        responseSubject = `Re: ${originalSubject}`;
      }

      const success = await emailRoutingService.sendEmail(userId, {
        to: customerEmail,
        subject: responseSubject,
        html: responseContent,
      });

      return success;
    } catch (error) {
      console.error('Empathetic auto-response sending error:', error);
      return false;
    }
  }
  
  /**
   * DEPRECATED: Legacy auto-response system (keeping for backward compatibility)
   */
  async sendAutoResponse(userId: string, customerEmail: string, rule: any, originalSubject: string, originalBody?: string): Promise<boolean> {
    try {
      // CRITICAL: Validate email before sending to protect sender reputation
      if (!this.isValidEmailForProduction(customerEmail)) {
        console.warn(`AutoResponder: Blocked email send to protect sender reputation - ${customerEmail}`);
        return false;
      }

      // Generate knowledge-grounded response if original body provided
      let responseTemplate = rule.template;
      if (originalBody) {
        try {
          const groundedResponse = await hallucinationPreventionService.generateGroundedResponse(
            originalBody,
            rule.classification,
            userId
          );
          
          // Use grounded response if available and validated, otherwise fallback to template
          if (groundedResponse && groundedResponse.trim()) {
            responseTemplate = groundedResponse;
          }
        } catch (groundingError) {
          console.warn('Knowledge grounding failed, using template fallback:', groundingError);
          // Continue with template fallback
        }
      }

      // CRITICAL: Validate content safety and brand voice before sending
      const safetyValidation = await contentSafetyService.validateResponse(responseTemplate, userId);
      
      if (!safetyValidation.approved) {
        console.warn(`AutoResponder: Blocked response due to safety validation - ${safetyValidation.blockReason}`);
        return false;
      }

      const settings = await storage.getSystemSettings(userId);
      const fromAddress = settings?.fromEmail || 'support@humanfoodbar.com';
      const replyToAddress = settings?.replyToEmail || fromAddress;

      // Create response subject
      let responseSubject = `Re: ${originalSubject}`;
      if (!originalSubject.toLowerCase().startsWith('re:')) {
        responseSubject = `Re: ${originalSubject}`;
      }

      const success = await emailRoutingService.sendEmail(userId, {
        to: customerEmail,
        subject: responseSubject,
        html: responseTemplate,
      });

      return success;
    } catch (error) {
      console.error('Auto-response sending error:', error);
      return false;
    }
  }

  /**
   * Escalate email to human review
   */
  async escalateEmail(emailId: string, userId: string, classification: ClassificationResult, reason?: string): Promise<ProcessedEmail> {
    const escalationReason = reason || `Low confidence classification (${classification.confidence}%) or complex inquiry requiring human review`;
    
    // Determine priority from AI classification or fallback to confidence-based
    let priority = 'medium';
    if ('priority' in classification && classification.priority) {
      priority = classification.priority;
    } else {
      // Fallback: confidence-based priority
      priority = classification.confidence < 40 ? 'high' : 'medium';
    }
    
    // Create escalation entry
    const { nanoid } = await import('nanoid');
    await storage.createEscalationQueue({
      id: nanoid(),
      emailId,
      userId,
      priority: priority as 'low' | 'medium' | 'high' | 'urgent',
      reason: escalationReason,
      status: 'pending'
    });

    // Update email status
    await storage.updateEmail(emailId, {
      status: 'escalated',
      escalationReason: escalationReason,
      processedAt: new Date()
    });

    // Log escalation activity
    await storage.createActivityLog({
      userId,
      action: 'Escalated to human',
      type: 'escalation',
      executedBy: 'ai',
      customerEmail: 'system', // Will be updated with actual customer email
      details: `Email escalated: ${escalationReason}`,
      status: 'pending',
      metadata: {
        classification: classification.classification,
        confidence: classification.confidence,
        reason: escalationReason
      }
    });

    return {
      id: emailId,
      classification: classification.classification,
      confidence: classification.confidence,
      autoResponseSent: false,
      escalated: true
    };
  }

  /**
   * Process manual response (used by Quick Actions)
   */
  async processManualResponse(userId: string, customerEmail: string, action: string, template: string, metadata: any = {}): Promise<boolean> {
    try {
      const settings = await storage.getSystemSettings(userId);
      const fromAddress = settings?.fromEmail || 'support@humanfoodbar.com';
      const replyToAddress = settings?.replyToEmail || fromAddress;

      // Determine subject based on action type
      let subject = 'Customer Service Update';
      switch (action) {
        case 'sent_order_info':
          subject = metadata.orderNumber ? `Order Update: ${metadata.orderNumber}` : 'Order Information';
          break;
        case 'processed_refund':
          subject = metadata.orderNumber ? `Refund Processed: Order ${metadata.orderNumber}` : 'Refund Confirmation';
          break;
        case 'updated_subscription':
          subject = 'Subscription Update Confirmation';
          break;
        default:
          subject = 'Customer Service Response';
      }

      const success = await emailRoutingService.sendEmail(userId, {
        to: customerEmail,
        subject: subject,
        html: template,
      });

      return success;
    } catch (error) {
      console.error('Manual response sending error:', error);
      return false;
    }
  }

  /**
   * Get processing statistics for dashboard
   */
  async getProcessingStats(userId: string, timeframe: 'today' | 'week' | 'month' = 'today') {
    const timeMap = {
      today: 1,
      week: 7,
      month: 30
    };
    
    const days = timeMap[timeframe];
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    // Get activity logs for the timeframe
    const activities = await storage.getActivityLogs(userId);
    const recentActivities = activities.filter(activity => 
      activity.createdAt && new Date(activity.createdAt) >= startDate
    );

    const autoResponses = recentActivities.filter(a => a.action === 'Sent automated reply').length;
    const manualResponses = recentActivities.filter(a => a.executedBy === 'human').length;
    const escalations = recentActivities.filter(a => a.type === 'escalation').length;
    const total = autoResponses + manualResponses;

    return {
      totalProcessed: total,
      autoResponses,
      manualResponses,
      escalations,
      automationRate: total > 0 ? Math.round((autoResponses / total) * 100) : 0,
      timeframe
    };
  }

  /**
   * Generate enhanced order status response with real tracking data
   */
  private async generateEnhancedOrderStatusResponse(orderNumber: string, emailData: any, userId: string): Promise<{ response: string; adjustedConfidence: number }> {
    try {
      const settings = await storage.getSystemSettings(userId);
      const companyName = settings?.companyName || 'Our Company';
      const agentName = settings?.aiAgentName || 'AI Assistant';
      
      // Try to look up real order data
      let trackingInfo = '';
      let orderStatus = '';
      
      try {
        const { OrderLookupService } = await import('./order-lookup');
        const orderLookupService = new OrderLookupService();
        const orderData = await orderLookupService.searchOrderByNumber(userId, orderNumber);

        if (orderData && orderData.trackingNumber) {
          orderStatus = `Your order #${orderNumber} is currently in transit.`;
          trackingInfo = `\n\nTracking number: ${orderData.trackingNumber}`;
          
          // Try to get enhanced tracking from AfterShip
          try {
            const { aftershipService } = await import('./aftership');
            const enhancedTracking = await aftershipService.getEnhancedTrackingForEmail(orderData.trackingNumber);
            
            if (enhancedTracking?.tracking?.tag) {
              const tracking = enhancedTracking.tracking;
              
              // Get actual delivery dates from AfterShip
              let deliveryDate = '';
              if (tracking.shipment_delivery_date) {
                deliveryDate = new Date(tracking.shipment_delivery_date).toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                });
              } else if (tracking.aftership_estimated_delivery_date?.estimated_delivery_date) {
                deliveryDate = new Date(tracking.aftership_estimated_delivery_date.estimated_delivery_date).toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                });
              } else if (tracking.expected_delivery) {
                deliveryDate = new Date(tracking.expected_delivery).toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                });
              }
              
              switch (tracking.tag) {
                case 'OutForDelivery':
                  orderStatus = deliveryDate 
                    ? `Great news! Your order #${orderNumber} is out for delivery and will arrive by end of day today.`
                    : `Great news! Your order #${orderNumber} is out for delivery and should arrive by end of business day.`;
                  break;
                case 'InTransit':
                  orderStatus = deliveryDate 
                    ? `Your order #${orderNumber} is in transit and estimated to arrive on ${deliveryDate}.`
                    : `Your order #${orderNumber} is in transit and estimated to arrive within 1-2 business days.`;
                  break;
                case 'Delivered':
                  orderStatus = deliveryDate 
                    ? `Your order #${orderNumber} was delivered on ${deliveryDate}. Thank you for your order!`
                    : `Your order #${orderNumber} has been delivered. Thank you for your order!`;
                  break;
                default:
                  orderStatus = deliveryDate 
                    ? `Your order #${orderNumber} is being processed and estimated to arrive on ${deliveryDate}.`
                    : `Your order #${orderNumber} is being processed and should arrive within 3-5 business days.`;
              }
            }
            
            if (enhancedTracking?.trackingUrl) {
              trackingInfo += `\nTrack your package: ${enhancedTracking.trackingUrl}`;
            }
          } catch (trackingError) {
            console.log('Enhanced tracking lookup failed, using basic tracking info');
          }
        } else {
          orderStatus = `I'm looking into your order #${orderNumber} status right now.`;
          trackingInfo = `\n\nI'll provide you with the most current tracking information available.`;
        }
      } catch (lookupError) {
        console.log('Order lookup failed, using fallback response');
        orderStatus = `I'm checking on your order #${orderNumber} status for you.`;
        trackingInfo = `\n\nLet me get the latest information from our fulfillment team.`;
      }

      const response = `Hi there!

${orderStatus}${trackingInfo}

If you have any questions or need further assistance, please let me know. I'm here to help ensure you receive your order as expected.

Thank you,
${agentName}
AI Customer Service Agent
${companyName}

We use AI to solve customer problems faster. Reply 'Human' for immediate escalation.`;

      return {
        response: response,
        adjustedConfidence: 95 // High confidence for order status with order number
      };
    } catch (error) {
      console.error('Enhanced order status response generation failed:', error);
      return {
        response: `Thank you for contacting us about order #${orderNumber}. I'm looking into this for you and will provide an update shortly.`,
        adjustedConfidence: 70
      };
    }
  }

  /**
   * Extract order number from email content using regex patterns
   */
  extractOrderNumberFromEmail(subject: string, body: string): string | null {
    try {
      const content = `${subject} ${body}`;
      
      // Common order number patterns
      const patterns = [
        /#(\d{4,})/i,                    // #12345
        /order\s*#?(\d{4,})/i,          // order 12345, order #12345
        /order\s*number\s*#?(\d{4,})/i, // order number 12345
        /ord[er]*-(\d{4,})/i,           // ORD-12345
        /\b(\d{5,})\b/                  // Any 5+ digit number
      ];
      
      for (const pattern of patterns) {
        const match = content.match(pattern);
        if (match) {
          return match[1];
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error extracting order number:', error);
      return null;
    }
  }
}

export const autoResponderService = new AutoResponderService();