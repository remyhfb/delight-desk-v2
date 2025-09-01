/**
 * BUSINESS INTELLIGENCE LAYER
 * Overarching intelligence system that prevents obviously bad business decisions
 * This layer applies fundamental business logic that should NEVER be violated
 */

import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface BusinessIntelligenceResult {
  isBusinessSmart: boolean;
  businessLogicViolations: string[];
  correctedStrategy?: string;
  businessReasoning: string;
  riskAssessment: 'beneficial' | 'neutral' | 'risky' | 'damaging';
}

interface BusinessContext {
  customerRequest: string;
  proposedResponse: string;
  classification: string;
  companyType: 'ecommerce' | 'saas' | 'service' | 'generic';
  businessVertical?: 'food_beverage' | 'fashion' | 'electronics' | 'beauty' | 'supplements' | 'general_ecommerce';
}

class BusinessIntelligenceLayer {
  
  /**
   * Apply fundamental business intelligence to any AI response
   * This layer checks if the response makes basic business sense
   */
  async validateBusinessLogic(context: BusinessContext): Promise<BusinessIntelligenceResult> {
    
    console.log('[BUSINESS_INTELLIGENCE] Validating business logic for response...');
    
    const prompt = `You are a senior business strategist analyzing a customer service response. The AI agent's mission is to provide a first-class customer experience while intelligently acquiring, retaining, and engaging customers - without being sleazy or transparently agenda-driven.

CUSTOMER REQUEST: "${context.customerRequest}"
PROPOSED AI RESPONSE: "${context.proposedResponse}"
BUSINESS TYPE: ${context.companyType}
ISSUE CLASSIFICATION: ${context.classification}

Analyze this response against our sophisticated business mandate:

1. FIRST-CLASS CUSTOMER EXPERIENCE: Does this response genuinely solve their problem?
   - Addresses their actual need completely
   - Provides helpful, professional service
   - Creates positive customer experience

2. INTELLIGENT CUSTOMER ACQUISITION: Does this response help acquire new customers?
   - Demonstrates company competence and reliability
   - Shows value proposition through excellent service
   - Creates positive word-of-mouth potential

3. SMART CUSTOMER RETENTION: Does this response retain existing customers?
   - Solves problems that prevent churn
   - Builds customer loyalty through excellent service
   - Avoids unnecessary friction or frustration

4. CUSTOMER ENGAGEMENT: Does this response engage customers appropriately?
   - Encourages continued relationship with company
   - Provides value that keeps customers interested
   - Maintains professional, helpful relationship

5. NON-SLEAZY APPROACH: Does this response avoid transparent sales agenda?
   - Genuinely helpful vs obviously self-serving
   - Solves customer problems vs pushing company agenda
   - Professional service vs sleazy sales tactics

CRITICAL VIOLATIONS TO DETECT:
- Offering downgrades/cancellations when customer wants upgrades/retention
- Volunteering refunds/returns when customer just needs help
- Creating problems instead of solving them
- Being transparently self-serving vs genuinely helpful
- Damaging customer experience to protect revenue
- GENERIC LAZY RESPONSES: Asking "provide more details" when customer asked specific questions
- IGNORING OBVIOUS QUESTIONS: Not addressing clear, specific questions in subject line or email
- TEMPLATE RESPONSES: Using lazy templates instead of answering actual customer needs
- UNHELPFUL DEFLECTION: Asking for clarification on questions that are already clear

Respond with JSON:
{
  "isBusinessSmart": boolean,
  "businessLogicViolations": ["specific violation 1", "specific violation 2"],
  "correctedStrategy": "brief business-smart approach if violations found",
  "businessReasoning": "clear explanation of the business logic",
  "riskAssessment": "beneficial|neutral|risky|damaging"
}`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are a senior business strategist. Analyze customer service responses for sophisticated business intelligence: first-class customer experience + intelligent customer acquisition/retention/engagement - without sleazy sales tactics. Focus on genuinely helpful service that builds long-term business success."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.1 // Very low temperature for consistent business logic
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      
      console.log('[BUSINESS_INTELLIGENCE] Validation complete:', {
        isBusinessSmart: result.isBusinessSmart,
        violationCount: result.businessLogicViolations?.length || 0,
        riskAssessment: result.riskAssessment
      });

      return {
        isBusinessSmart: result.isBusinessSmart || false,
        businessLogicViolations: result.businessLogicViolations || [],
        correctedStrategy: result.correctedStrategy,
        businessReasoning: result.businessReasoning || 'Business logic analysis completed',
        riskAssessment: result.riskAssessment || 'neutral'
      };

    } catch (error) {
      console.error('[BUSINESS_INTELLIGENCE] Validation failed:', error);
      
      // Fallback: Apply basic heuristics
      return this.applyBasicBusinessHeuristics(context);
    }
  }

  /**
   * Detect if response is generically unhelpful (asking for details when question is clear)
   */
  private isGenericUnhelpfulResponse(customerRequest: string, proposedResponse: string): boolean {
    const customerLower = customerRequest.toLowerCase();
    const responseLower = proposedResponse.toLowerCase();
    
    // Check if customer asked specific questions
    const hasSpecificQuestion = /\b(is|are|what|how|when|where|which|can|will|do|does)\b.*\?/.test(customerLower) ||
                               /\b(gluten free|kosher|organic|vegan|ingredients|allergen|nutrition|contain)\b/.test(customerLower);
    
    // Check if response is generically asking for more details
    const isGenericResponse = /provide more detail|more information|more specific|clarify|elaborate|additional information/i.test(responseLower);
    
    return hasSpecificQuestion && isGenericResponse;
  }

  /**
   * Fallback business heuristics when AI analysis fails
   */
  private applyBasicBusinessHeuristics(context: BusinessContext): BusinessIntelligenceResult {
    const violations: string[] = [];
    const response = context.proposedResponse.toLowerCase();
    const request = context.customerRequest.toLowerCase();

    // Basic business logic checks
    if (request.includes('pause') && response.includes('cancel') && response.includes('permanent')) {
      violations.push('Offering cancellation when customer only wants to pause');
    }

    if (response.includes('refund') && !request.includes('refund')) {
      violations.push('Volunteering refunds when customer did not request them');
    }

    if (response.includes('competitor') || response.includes('alternative') || response.includes('other option')) {
      violations.push('Mentioning competitors or alternatives unprompted');
    }

    // CRITICAL: Detect generic unhelpful responses
    if (this.isGenericUnhelpfulResponse(context.customerRequest, context.proposedResponse)) {
      violations.push('Generic unhelpful response - asking for details when customer question is already clear');
    }

    const isBusinessSmart = violations.length === 0;
    const riskAssessment = violations.length > 0 ? 'damaging' : 'neutral';

    return {
      isBusinessSmart,
      businessLogicViolations: violations,
      businessReasoning: 'Applied basic business heuristics',
      riskAssessment: riskAssessment as any
    };
  }

  /**
   * Generate business-intelligent response that provides first-class customer experience while building business value
   */
  async generateBusinessSmartResponse(
    customerRequest: string,
    classification: string,
    originalViolations: string[]
  ): Promise<string> {
    
    // For product questions, provide direct answers based on common customer needs
    if (classification === 'product' && 
        (customerRequest.toLowerCase().includes('gluten') || 
         customerRequest.toLowerCase().includes('kosher') ||
         customerRequest.toLowerCase().includes('lectin'))) {
      
      return `I'd be happy to help with your dietary questions. Let me get you the specific ingredient and certification information for our bars so I can give you accurate details about gluten-free, kosher, and lectin-free status.`;
    }
    
    const prompt = `Generate a sophisticated customer service response that provides first-class customer experience while intelligently building business value.

CUSTOMER REQUEST: "${customerRequest}"
CLASSIFICATION: ${classification}
BUSINESS VIOLATIONS TO AVOID: ${originalViolations.join(', ')}

CRITICAL: If the customer asked a specific question (especially in subject line), answer it directly. DO NOT ask for "more details" when the question is already clear.

Create a response that demonstrates your sophisticated business mandate:

1. FIRST-CLASS EXPERIENCE: Genuinely solve their problem completely and professionally
2. INTELLIGENT ACQUISITION: Show competence that creates positive word-of-mouth
3. SMART RETENTION: Build loyalty by solving problems that prevent churn
4. CUSTOMER ENGAGEMENT: Maintain valuable, professional relationship
5. NON-SLEAZY APPROACH: Be genuinely helpful vs obviously self-serving

Keep it concise (2-3 sentences max), natural, and authentically helpful. Focus on creating customer delight that naturally drives business success.

Response:`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system", 
            content: "You are a customer service expert who understands both customer needs and business interests. Generate responses that serve both effectively."
          },
          {
            role: "user",
            content: prompt
          }
        ],
      });

      return response.choices[0].message.content?.trim() || '';

    } catch (error) {
      console.error('[BUSINESS_INTELLIGENCE] Failed to generate smart response:', error);
      return this.generateFallbackResponse(customerRequest, classification);
    }
  }

  /**
   * Fallback response generator
   */
  private generateFallbackResponse(customerRequest: string, classification: string): string {
    if (customerRequest.toLowerCase().includes('pause')) {
      return "I can help you pause your subscription. What timeframe works best for you?";
    }
    
    if (classification === 'order_status') {
      return "Let me check on your order status and get you the latest information.";
    }
    
    return "I'd be happy to help with your request. Let me assist you with what you need.";
  }

  /**
   * Log business intelligence violations for continuous improvement
   */
  async logBusinessIntelligenceViolation(
    userId: string,
    violation: string,
    originalResponse: string,
    customerRequest: string,
    correctedResponse: string
  ): Promise<void> {
    try {
      const { storage } = await import('../storage');
      
      await storage.createActivityLog({
        userId,
        action: 'business_intelligence_violation_corrected',
        type: 'ai_safety',
        executedBy: 'ai',
        customerEmail: 'system@delightdesk.io',
        details: `BUSINESS INTELLIGENCE: ${violation}`,
        status: 'corrected',
        metadata: {
          violation,
          originalResponse,
          customerRequest,
          correctedResponse,
          system: 'business_intelligence_layer'
        }
      });

    } catch (error) {
      console.error('[BUSINESS_INTELLIGENCE] Failed to log violation:', error);
    }
  }
}

export const businessIntelligenceLayer = new BusinessIntelligenceLayer();