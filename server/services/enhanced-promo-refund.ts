import { storage } from "../storage";
import { orderLookupService } from "./order-lookup";
import { sharedEmailService } from "./shared-email";
import { logger, LogCategory } from './logger';
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface EnhancedProcessingResult {
  success: boolean;
  shouldEscalate?: boolean;
  response?: string;
  escalationReason?: string;
}

interface PromoCodeRequest {
  type: 'explicit_discount' | 'vague_issue' | 'specific_code_problem' | 'unknown';
  promoCodes: string[];
  customerIntent: string;
  confidence: number;
}

/**
 * Enhanced Promo Refund Service
 * Provides sophisticated AI-driven processing for promo code issues with advanced pattern recognition
 */
class EnhancedPromoRefundService {

  /**
   * Extract promo codes from email content using multiple patterns
   */
  private extractPromoCodes(text: string): string[] {
    const codes: string[] = [];
    
    // Multiple regex patterns for various code formats
    const patterns = [
      /(?:code[:\s]+)([A-Z0-9]{3,15})/gi,
      /(?:promo[:\s]+)([A-Z0-9]{3,15})/gi,
      /(?:coupon[:\s]+)([A-Z0-9]{3,15})/gi,
      /(?:discount[:\s]+)([A-Z0-9]{3,15})/gi,
      /(?:#)([A-Z0-9]{3,15})/gi,
      /\b([A-Z]{2,}[0-9]{2,}|[A-Z0-9]{4,12})\b/g
    ];

    // Common words to exclude from code detection
    const excludeWords = [
      'EMAIL', 'ORDER', 'TOTAL', 'PRICE', 'THANK', 'HELLO', 'CUSTOMER', 
      'SERVICE', 'SUPPORT', 'REFUND', 'RETURN', 'SHIPPING', 'DELIVERY'
    ];

    patterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const cleanCode = match.replace(/^(code|promo|coupon|discount|#)[:\s]+/i, '').trim();
          if (cleanCode.length >= 3 && cleanCode.length <= 15 && 
              !excludeWords.includes(cleanCode.toUpperCase()) &&
              !codes.includes(cleanCode.toUpperCase())) {
            codes.push(cleanCode.toUpperCase());
          }
        });
      }
    });

    return codes;
  }

  /**
   * Classify the type of promo code request using AI
   */
  private async classifyPromoRequest(subject: string, body: string, promoCodes: string[]): Promise<PromoCodeRequest> {
    try {
      const prompt = `
Analyze this customer email about promo codes and classify the request type:

CLASSIFICATION TYPES:
1. "explicit_discount" - Customer asking for discount codes (new customer, student, military, etc.)
2. "vague_issue" - Customer has promo code problems but unclear what specific issue
3. "specific_code_problem" - Customer mentions specific promo codes that aren't working
4. "unknown" - Cannot determine clear intent

Subject: ${subject}
Body: ${body}
Extracted Codes: ${promoCodes.join(', ') || 'None'}

Respond with JSON:
{
  "type": "classification_type",
  "customerIntent": "brief description of what customer wants",
  "confidence": 85
}
      `;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.3,
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      
      return {
        type: result.type || 'unknown',
        promoCodes,
        customerIntent: result.customerIntent || 'Customer inquiry about promo codes',
        confidence: Math.max(0, Math.min(100, result.confidence || 50))
      };
    } catch (error) {
      logger.error(LogCategory.SYSTEM, 'Error classifying promo request', { error });
      return {
        type: 'unknown',
        promoCodes,
        customerIntent: 'Unable to classify request',
        confidence: 30
      };
    }
  }

  /**
   * Look up promo code configuration from database
   */
  private async lookupPromoCodeConfig(userId: string, promoCode: string) {
    try {
      // Check if we have promo code configurations stored
      const promoConfigs = await storage.getPromoCodeConfigs?.(userId);
      if (promoConfigs) {
        return promoConfigs.find((config: any) => 
          config.code?.toUpperCase() === promoCode.toUpperCase() && config.isActive
        );
      }
      return null;
    } catch (error) {
      logger.warn(LogCategory.SYSTEM, 'Error looking up promo code config', { error });
      return null;
    }
  }

  /**
   * Generate intelligent response based on request type and context
   */
  private async generateIntelligentResponse(
    request: PromoCodeRequest, 
    userId: string, 
    customerEmail: string,
    subject: string,
    body: string
  ): Promise<string> {
    try {
      const prompt = `
Generate a helpful, empathetic response for this promo code customer inquiry:

REQUEST TYPE: ${request.type}
CUSTOMER INTENT: ${request.customerIntent}
PROMO CODES MENTIONED: ${request.promoCodes.join(', ') || 'None'}
ORIGINAL SUBJECT: ${subject}
ORIGINAL BODY: ${body}

RESPONSE GUIDELINES:
- Be empathetic and understanding
- Address their specific concern
- Provide actionable solutions
- Keep professional but friendly tone
- If specific codes mentioned, acknowledge them
- For discount requests, explain available options
- For code issues, provide troubleshooting steps

Generate a helpful customer service response (2-3 paragraphs):
      `;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
      });

      return response.choices[0].message.content || 'Thank you for contacting us about your promo code inquiry. We are looking into this and will get back to you shortly.';
    } catch (error) {
      logger.error(LogCategory.SYSTEM, 'Error generating intelligent response', { error });
      return 'Thank you for your promo code inquiry. Our team is reviewing your request and will respond soon.';
    }
  }

  /**
   * Process enhanced promo refund with sophisticated AI analysis
   */
  async processEnhancedPromoRefund(
    emailId: string,
    fromEmail: string,
    subject: string,
    body: string,
    userId: string
  ): Promise<EnhancedProcessingResult> {
    try {
      logger.info(LogCategory.SYSTEM, 'Enhanced promo refund processing started', { 
        emailId, 
        customerEmail: fromEmail 
      });

      // Step 1: Extract promo codes using sophisticated pattern recognition
      const promoCodes = this.extractPromoCodes(`${subject} ${body}`);
      logger.info(LogCategory.SYSTEM, 'Promo codes extracted', { codes: promoCodes });

      // Step 2: Classify the request type using AI
      const request = await this.classifyPromoRequest(subject, body, promoCodes);
      logger.info(LogCategory.SYSTEM, 'Request classified', { 
        type: request.type, 
        confidence: request.confidence 
      });

      // Step 3: Handle based on request type
      switch (request.type) {
        case 'explicit_discount':
          // Customer asking for discount codes - provide available options
          const discountResponse = await this.generateIntelligentResponse(
            request, userId, fromEmail, subject, body
          );
          
          await sharedEmailService.sendCustomEmail(
            userId,
            fromEmail,
            'Available Discount Codes - New Customer Offer',
            discountResponse,
            'sent_promo_codes'
          );

          await this.logPromoActivity(userId, fromEmail, 'provided_discount_codes', {
            requestType: request.type,
            confidence: request.confidence
          });

          return { success: true };

        case 'specific_code_problem':
          // Customer has specific code issues - look up and resolve
          if (promoCodes.length > 0) {
            // Check if we can resolve specific code issues
            for (const code of promoCodes) {
              const config = await this.lookupPromoCodeConfig(userId, code);
              if (config) {
                // Found configuration, can provide specific help
                const specificResponse = await this.generateIntelligentResponse(
                  request, userId, fromEmail, subject, body
                );
                
                await sharedEmailService.sendCustomEmail(
                  userId,
                  fromEmail,
                  `Promo Code ${code} - Resolution`,
                  specificResponse,
                  'resolved_promo_issue'
                );

                await this.logPromoActivity(userId, fromEmail, 'resolved_specific_code', {
                  promoCode: code,
                  requestType: request.type
                });

                return { success: true };
              }
            }
          }
          
          // Escalate if we can't resolve specific codes
          return {
            success: false,
            shouldEscalate: true,
            escalationReason: `Specific promo code issue requires manual review: ${promoCodes.join(', ')}`
          };

        case 'vague_issue':
          // Vague promo issues - ask clarifying questions or escalate
          if (request.confidence < 70) {
            return {
              success: false,
              shouldEscalate: true,
              escalationReason: 'Vague promo code issue requires human clarification'
            };
          }

          const clarifyingResponse = await this.generateIntelligentResponse(
            request, userId, fromEmail, subject, body
          );
          
          await sharedEmailService.sendCustomEmail(
            userId,
            fromEmail,
            'Promo Code Assistance - Additional Information Needed',
            clarifyingResponse,
            'promo_clarification_request'
          );

          await this.logPromoActivity(userId, fromEmail, 'requested_clarification', {
            requestType: request.type,
            confidence: request.confidence
          });

          return { success: true };

        default:
          // Unknown request type - escalate for human review
          return {
            success: false,
            shouldEscalate: true,
            escalationReason: `Unable to classify promo code request (confidence: ${request.confidence}%)`
          };
      }

    } catch (error) {
      logger.error(LogCategory.SYSTEM, 'Enhanced promo refund processing failed', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        emailId 
      });
      
      return {
        success: false,
        shouldEscalate: true,
        escalationReason: `Enhanced processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Log promo code related activity for audit trail
   */
  private async logPromoActivity(
    userId: string, 
    customerEmail: string, 
    action: string, 
    metadata: any
  ): Promise<void> {
    try {
      await storage.createActivityLog({
        userId,
        customerEmail,
        action,
        type: 'promo_code_processing',
        executedBy: 'ai',
        details: `Enhanced promo service: ${action}`,
        status: 'completed',
        metadata: {
          service: 'enhanced_promo_refund',
          ...metadata
        }
      });
    } catch (error) {
      logger.error(LogCategory.SYSTEM, 'Failed to log promo activity', { error });
    }
  }

  /**
   * Get enhanced promo processing statistics
   */
  async getEnhancedPromoStats(userId: string, timeframe: 'today' | 'week' | 'month' = 'today') {
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
        activity.type === 'promo_code_processing'
      );

      const resolvedIssues = recentActivities.filter(a => a.action === 'resolved_specific_code').length;
      const providedCodes = recentActivities.filter(a => a.action === 'provided_discount_codes').length;
      const clarificationsRequested = recentActivities.filter(a => a.action === 'requested_clarification').length;

      return {
        totalProcessed: recentActivities.length,
        resolvedIssues,
        providedCodes,
        clarificationsRequested,
        successRate: recentActivities.length > 0 ? 
          Math.round(((resolvedIssues + providedCodes) / recentActivities.length) * 100) : 0
      };
    } catch (error) {
      logger.error(LogCategory.SYSTEM, 'Error getting enhanced promo stats', { error });
      return {
        totalProcessed: 0,
        resolvedIssues: 0,
        providedCodes: 0,
        clarificationsRequested: 0,
        successRate: 0
      };
    }
  }
}

export const enhancedPromoRefundService = new EnhancedPromoRefundService();