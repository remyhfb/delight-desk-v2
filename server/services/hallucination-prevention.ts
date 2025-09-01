import { storage } from "../storage";
import OpenAI from "openai";
import { professionalVectorEmbeddings } from "./professional-vector-embeddings";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface HallucinationCheck {
  isGrounded: boolean;
  confidence: number;
  sources: string[];
  reasoning: string;
  shouldEscalate: boolean;
  fallbackResponse?: string;
}

export interface ClassificationWithGrounding extends HallucinationCheck {
  classification: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  priorityReasoning: string;
}

/**
 * Hallucination Prevention Service
 * Implements enterprise-grade safeguards against AI hallucinations
 * NOW WITH VECTOR EMBEDDINGS for enhanced semantic matching
 */
class HallucinationPreventionService {
  
  // Phase 1: Industry-Standard ML Confidence Thresholds
  // Based on research: 0.5 default, 0.7+ business standard, 0.8+ high-stakes
  private readonly CONFIDENCE_THRESHOLDS = {
    HIGH: 80,           // Industry standard for business applications (0.8)
    MEDIUM: 70,         // Standard business threshold (0.7) 
    LOW: 50            // ML default threshold (0.5) - below this = escalate
  };
  
  /**
   * Phase 1: Apply confidence-based routing with "I don't know" responses
   */
  checkConfidenceThreshold(confidence: number, classification: string): {
    shouldEscalate: boolean;
    fallbackResponse?: string;
    reasoning: string;
  } {
    
    if (confidence >= this.CONFIDENCE_THRESHOLDS.HIGH) {
      return {
        shouldEscalate: false,
        reasoning: `Above business standard threshold (${confidence}% ≥ 80%) - proceeding with automated response`
      };
    }
    
    if (confidence >= this.CONFIDENCE_THRESHOLDS.MEDIUM) {
      return {
        shouldEscalate: true,
        reasoning: `Within acceptable range (${confidence}% ≥ 70%) - requires human review before response`
      };
    }
    
    // Below ML standard threshold - provide "I don't know" response
    return {
      shouldEscalate: true,
      fallbackResponse: this.generateFallbackResponse(classification),
      reasoning: `Below ML threshold (${confidence}% < 50%) - escalating with industry-standard fallback`
    };
  }
  
  /**
   * Generate appropriate "I don't know" responses based on classification attempt
   */
  private generateFallbackResponse(classification: string): string {
    const fallbackResponses = {
      order_status: "I don't have enough information to provide accurate details about your order status. Let me connect you with a human agent who can look up your specific order and provide you with the most current information.",
      
      promo_refund: "I want to make sure I handle your billing concern correctly. Let me connect you with a human agent who can review your account details and provide the most accurate assistance with your refund request.",
      
      order_cancellation: "To ensure your order is cancelled properly and on time, let me connect you with a human agent who can immediately process your cancellation request and confirm the details.",
      
      return_request: "I want to make sure we handle your return correctly. Let me connect you with a human agent who can review your order details and guide you through the return process.",
      
      subscription_changes: "To avoid any issues with your subscription, let me connect you with a human agent who can safely make the changes you need to your account.",
      
      address_change: "To ensure your order is delivered to the correct address, let me connect you with a human agent who can update your shipping information right away.",
      
      payment_issues: "I want to make sure we resolve your payment concern properly. Let me connect you with a human agent who can securely review your account and payment details.",
      
      product: "I don't have enough information to answer your product question accurately. Let me connect you with a human agent who can provide you with detailed product information.",
      
      general: "I want to make sure I understand your request correctly and provide you with the most helpful response. Let me connect you with a human agent who can assist you properly."
    };
    
    return fallbackResponses[classification as keyof typeof fallbackResponses] || fallbackResponses.general;
  }
  
  /**
   * Phase 2: Knowledge Grounding - NOW WITH VECTOR EMBEDDINGS!
   * Retrieve relevant training content using semantic similarity
   */
  async getRelevantKnowledge(userId: string, query: string): Promise<{
    relevantContent: string[];
    sources: string[];
    totalSources: number;
    hasTrainingData: boolean;
    method?: 'vector' | 'text' | 'none';
    avgSimilarity?: number;
  }> {
    try {
      // Industry standard vector embeddings implementation
      console.log('[HALLUCINATION_PREVENTION] Using industry-standard vector embeddings');
      const searchResult = await professionalVectorEmbeddings.getEnhancedRelevantKnowledge(userId, query);
      
      if (searchResult.relevantContent.length > 0) {
        console.log(`[VECTOR_STANDARD] Found ${searchResult.relevantContent.length} pieces of relevant content`);
        
        return {
          relevantContent: searchResult.relevantContent,
          sources: searchResult.sources,
          totalSources: searchResult.totalSources,
          hasTrainingData: searchResult.hasTrainingData,
          method: searchResult.method === 'semantic_chunks' ? 'vector' : 'text',
          avgSimilarity: searchResult.avgSimilarity || 0.75
        };
      }
      
      // Fallback to text matching for comprehensive coverage
      console.log('[HALLUCINATION_PREVENTION] Vector similarity below threshold, using text matching');
      const textResult = await professionalVectorEmbeddings.getEnhancedRelevantKnowledge(userId, query);
      
      return {
        relevantContent: textResult.relevantContent,
        sources: textResult.sources,
        totalSources: textResult.totalSources,
        hasTrainingData: textResult.hasTrainingData,
        method: textResult.method === 'semantic_chunks' ? 'vector' : 'text',
        avgSimilarity: textResult.avgSimilarity
      };
      
    } catch (error) {
      console.error('Error retrieving knowledge:', error);
      return {
        relevantContent: [],
        sources: [],
        totalSources: 0,
        hasTrainingData: false,
        method: 'none'
      };
    }
  }
  
  /**
   * Enhanced classification with knowledge grounding using vector embeddings
   */
  async classifyWithGrounding(
    userId: string,
    emailContent: string,
    subject: string
  ): Promise<ClassificationWithGrounding> {
    
    // Phase 2: Get relevant knowledge for grounding using vector embeddings
    const knowledgeBase = await this.getRelevantKnowledge(userId, `${subject} ${emailContent}`);
    
    // Create grounded prompt
    const groundedPrompt = this.createGroundedPrompt(
      emailContent,
      subject,
      knowledgeBase.relevantContent
    );
    
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: groundedPrompt }],
        temperature: 0.2, // Lower temperature for more consistent results
        max_tokens: 500,
      });

      const responseContent = completion.choices[0]?.message?.content;
      if (!responseContent) {
        throw new Error("No response from OpenAI");
      }

      // Clean the response to handle markdown-wrapped JSON
      const cleanedResponse = responseContent.replace(/```json\s*|\s*```/g, '').trim();
      const result = JSON.parse(cleanedResponse);
      
      // Phase 1: Apply confidence threshold checks
      const confidenceCheck = this.checkConfidenceThreshold(
        result.confidence,
        result.classification
      );
      
      return {
        classification: result.classification,
        confidence: result.confidence,
        reasoning: result.reasoning,
        priority: result.priority,
        priorityReasoning: result.priorityReasoning,
        isGrounded: knowledgeBase.relevantContent.length > 0,
        sources: knowledgeBase.sources,
        shouldEscalate: confidenceCheck.shouldEscalate,
        fallbackResponse: confidenceCheck.fallbackResponse
      };
      
    } catch (error) {
      console.error('Error in grounded classification:', error);
      
      // Fallback to escalation
      return {
        classification: 'general',
        confidence: 0,
        reasoning: 'Classification failed - escalating to human',
        priority: 'medium',
        priorityReasoning: 'System error requires human review',
        isGrounded: false,
        sources: [],
        shouldEscalate: true,
        fallbackResponse: this.generateFallbackResponse('general')
      };
    }
  }
  
  /**
   * Generate knowledge-grounded response using RAG with vector embeddings
   * CRITICAL: If training data exists, MUST generate response from it - never fallback to templates
   */
  async generateGroundedResponse(
    query: string,
    classification: string,
    userId: string
  ): Promise<string | null> {
    
    const knowledgeBase = await this.getRelevantKnowledge(userId, query);
    
    // CRITICAL: If ANY training data exists, we MUST use it
    if (!knowledgeBase.hasTrainingData) {
      console.log('[HALLUCINATION_PREVENTION] No training data available - allowing template fallback');
      return null;
    }
    
    if (knowledgeBase.relevantContent.length === 0) {
      // Training data exists but none relevant - force AI to use whatever training data is available
      console.log('[HALLUCINATION_PREVENTION] Training data exists but low relevance - forcing knowledge grounding');
      const allTrainingUrls = await storage.getTrainingUrls(userId);
      const allTrainingContent = allTrainingUrls
        .filter(url => url.status === 'completed' && url.crawledContent)
        .map(url => url.crawledContent)
        .slice(0, 5); // Use first 5 sources to avoid token limits
      
      if (allTrainingContent.length === 0) {
        return null; // No usable training data
      }
      
      const forceGroundedPrompt = this.createForceGroundedPrompt(query, classification, allTrainingContent);
      
      try {
        const completion = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [{ role: "user", content: forceGroundedPrompt }],
          temperature: 0.2, // Lower temperature for more focused responses
          max_tokens: 400,
        });

        return completion.choices[0]?.message?.content || null;
        
      } catch (error) {
        console.error('Error generating force-grounded response:', error);
        return null;
      }
    }
    
    // Relevant training content found - use it
    const prompt = this.createResponsePrompt(query, classification, knowledgeBase.relevantContent);
    
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 400,
      });

      return completion.choices[0]?.message?.content || null;
      
    } catch (error) {
      console.error('Error generating grounded response:', error);
      return null;
    }
  }
  
  /**
   * Create prompt that forces AI to answer based ONLY on training data
   */
  private createForceGroundedPrompt(
    query: string,
    classification: string,
    trainingContent: string[]
  ): string {
    return `You are a customer service AI assistant. You MUST ONLY use the provided company information to answer questions. Never use general knowledge or make assumptions.

STRICT INSTRUCTION: You can ONLY provide information that is explicitly stated in the company knowledge base below. If the answer is not in the knowledge base, you MUST say "I don't have specific information about this in our current documentation."

COMPANY KNOWLEDGE BASE:
${trainingContent.map((content, index) => `
Source ${index + 1}:
${content.substring(0, 1500)}${content.length > 1500 ? '...' : ''}
`).join('\n')}

CUSTOMER QUESTION (${classification}): ${query}

REQUIREMENTS:
- Answer ONLY based on the knowledge base above
- If you cannot find the answer in the knowledge base, respond: "I don't have specific information about this in our current documentation. Let me connect you with a human agent who can help."
- Use a professional, helpful tone
- Keep response under 200 words
- Be specific and cite relevant details from the knowledge base

Your response:`;
  }
  
  /**
   * Create response prompt using relevant training data
   */
  private createResponsePrompt(
    query: string,
    classification: string,
    relevantContent: string[]
  ): string {
    return `You are a helpful customer service AI assistant. Use the provided company information to give accurate, specific answers.

COMPANY INFORMATION:
${relevantContent.map((content, index) => `
Source ${index + 1}:
${content.substring(0, 1500)}${content.length > 1500 ? '...' : ''}
`).join('\n')}

CUSTOMER QUESTION (${classification}): ${query}

INSTRUCTIONS:
- Use the company information above to provide a helpful, accurate response
- Be specific and reference relevant details from the company information
- If the information doesn't fully answer the question, be honest about what you can and cannot confirm
- Use a professional, friendly tone
- Keep response under 200 words

Your response:`;
  }
  
  /**
   * AI Assistant Integration - Generate suggestions with confidence levels and empathy
   * This ensures AI assistant also uses training data and never falls back to general knowledge
   */
  async generateAIAssistantSuggestion(
    emailContent: string,
    subject: string,
    userId: string,
    classification: string,
    empathyLevel?: number
  ): Promise<{
    suggestion: string;
    confidence: number;
    isGrounded: boolean;
    reasoning: string;
  }> {
    
    const knowledgeBase = await this.getRelevantKnowledge(userId, `${subject} ${emailContent}`);
    
    // Special handling for human escalation requests - HIGHEST PRIORITY
    if (emailContent.toLowerCase().includes('human') || 
        emailContent.toLowerCase().includes('person') ||
        emailContent.toLowerCase().includes('agent') ||
        emailContent.toLowerCase().includes('escalate') ||
        emailContent.toLowerCase().includes('transfer') ||
        emailContent.toLowerCase().includes('speak to') ||
        emailContent.toLowerCase().includes('talk to') ||
        emailContent.toLowerCase().includes('connect me') ||
        subject.toLowerCase().includes('human') ||
        subject.toLowerCase().includes('escalat')) {
      return {
        suggestion: "🚨 HUMAN ESCALATION REQUEST 🚨\n\nThis customer has explicitly requested human assistance. Recommended response:\n\n\"Thank you for contacting us. I understand you'd like to speak with a human agent. I've prioritized your request and a member of our customer service team will respond to you personally within [timeframe]. Your request has been escalated with high priority.\"\n\nAction required: Assign to human agent immediately.",
        confidence: 95,
        isGrounded: true,
        reasoning: "Customer explicitly requested human escalation - immediate human response required"
      };
    }

    // If no training data, provide low-confidence suggestion to escalate
    if (!knowledgeBase.hasTrainingData) {
      return {
        suggestion: "I recommend connecting this customer with a human agent, as I don't have specific company information to provide an accurate response.",
        confidence: 30,
        isGrounded: false,
        reasoning: "No training data available - escalation recommended"
      };
    }
    
    // Get user's empathy level from system settings if not provided
    let userEmpathyLevel = empathyLevel;
    if (userEmpathyLevel === undefined) {
      const { storage } = await import('../storage');
      const settings = await storage.getSystemSettings(userId);
      userEmpathyLevel = settings?.empathyLevel || 3; // Default to level 3
    }

    // Generate grounded suggestion using training data with empathy level
    const suggestionPrompt = this.createAIAssistantPrompt(
      emailContent, 
      subject, 
      classification, 
      knowledgeBase.relevantContent,
      userEmpathyLevel
    );
    
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: suggestionPrompt }],
        temperature: 0.3,
        max_tokens: 300,
      });

      const responseContent = completion.choices[0]?.message?.content;
      if (!responseContent) {
        throw new Error("No response from OpenAI");
      }

      // Clean the response to handle markdown-wrapped JSON
      const cleanedResponse = responseContent.replace(/```json\s*|\s*```/g, '').trim();
      const result = JSON.parse(cleanedResponse);
      
      return {
        suggestion: result.suggestion || "Unable to generate suggestion",
        confidence: Math.max(0, Math.min(100, result.confidence || 50)),
        isGrounded: knowledgeBase.relevantContent.length > 0,
        reasoning: result.reasoning || "AI assistant suggestion based on available data"
      };
      
    } catch (error) {
      console.error('Error generating AI assistant suggestion:', error);
      return {
        suggestion: "I recommend reviewing this email manually due to processing difficulties.",
        confidence: 20,
        isGrounded: false,
        reasoning: "Error in AI processing - manual review recommended"
      };
    }
  }
  
  /**
   * Create AI assistant prompt that uses training data with empathy level
   */
  private createAIAssistantPrompt(
    emailContent: string,
    subject: string,
    classification: string,
    knowledgeBase: string[],
    empathyLevel: number = 3
  ): string {
    
    const hasKnowledge = knowledgeBase.length > 0;
    
    const knowledgeSection = hasKnowledge ? `
COMPANY KNOWLEDGE BASE:
${knowledgeBase.map((content, index) => `
Source ${index + 1}:
${content.substring(0, 1000)}${content.length > 1000 ? '...' : ''}
`).join('\n')}` : "No specific company knowledge available.";

    // Get empathy guidance for the specified level
    const getEmpathyGuidance = (level: number): string => {
      switch(level) {
        case 1:
          return "Professional and direct - use clear, businesslike language without emotional expressions.";
        case 2: 
          return "Courteous and polite - acknowledge the customer's concern with basic politeness.";
        case 3:
          return "Warm and understanding - show genuine care and acknowledge the customer's feelings.";
        case 4:
          return "Compassionate and supportive - express sincere empathy and provide emotional reassurance.";
        case 5:
          return "Maximum empathy and care - deeply acknowledge emotions, provide strong emotional support and understanding.";
        default:
          return "Warm and understanding - show genuine care and acknowledge the customer's feelings.";
      }
    };

    const empathyGuidance = getEmpathyGuidance(empathyLevel);

    return `You are an AI assistant helping a customer service agent respond to emails. Your job is to suggest a helpful response based on the company's knowledge base.

EMPATHY LEVEL: ${empathyLevel}/5 - ${empathyGuidance}

${knowledgeSection}

CUSTOMER EMAIL:
Subject: ${subject}
Body: ${emailContent}
Classification: ${classification}

INSTRUCTIONS:
- ${hasKnowledge ? 'Use the company knowledge base to suggest an accurate, helpful response' : 'Recommend escalating to human agent due to lack of company-specific information'}
- Apply the specified empathy level (${empathyLevel}/5) to match the customer's emotional needs
- Be specific and reference relevant company information when available
- If knowledge base doesn't cover the topic, recommend human review
- Provide confidence level based on how well the knowledge base addresses the question
- Keep suggestion professional and concise (under 150 words)
- Match the emotional tone to the empathy level: ${empathyGuidance}

Respond with valid JSON:
{
  "suggestion": "Your suggested response text here",
  "confidence": 75,
  "reasoning": "Why this suggestion is appropriate and how confidence was determined"
}`;
  }
  
  /**
   * Create knowledge-grounded prompt for classification
   */
  private createGroundedPrompt(
    emailContent: string,
    subject: string,
    knowledgeBase: string[]
  ): string {
    
    const hasKnowledge = knowledgeBase.length > 0;
    
    const knowledgeSection = hasKnowledge ? `
KNOWLEDGE BASE CONTEXT:
Based on the following company information and policies:

${knowledgeBase.map((content, index) => `
Source ${index + 1}:
${content.substring(0, 1000)}${content.length > 1000 ? '...' : ''}
`).join('\n')}

Use this information to improve classification accuracy. If the email relates to topics covered in the knowledge base, increase your confidence. If it asks about topics not covered, be more cautious.` : `
KNOWLEDGE BASE: No specific company knowledge available. Base classification on general customer service patterns only.`;

    return `You are an expert customer service AI that understands customer intent. Analyze this email and classify it accurately.

${knowledgeSection}

CUSTOMER INTENT CATEGORIES:
1. **order_status** (WISMO) - Customer wants order/delivery information
2. **promo_refund** - Billing, payment, or refund concerns  
3. **order_cancellation** - Stop order before shipping
4. **return_request** - Exchange or return received products
5. **subscription_changes** - Modify existing subscription
6. **cancellation_requests** - End subscription/account permanently
7. **payment_issues** - Payment processing problems
8. **address_change** - Update shipping address
9. **product** - Product features or specifications
10. **escalation** - Customer is frustrated, threatening, or has complex issues
11. **human_escalation** - Customer explicitly requests human assistance (ALWAYS URGENT PRIORITY)
12. **general** - Everything else

EMAIL TO CLASSIFY:
Subject: ${subject}
Body: ${emailContent}

INSTRUCTIONS:
- **FIRST CHECK FOR HUMAN ESCALATION**: Look for any requests to speak to a human, real person, agent, or escalation - if found, classify as "human_escalation" with urgent priority
- Understand the customer's underlying intent, not just keywords
- ${hasKnowledge ? 'Use the knowledge base to inform your classification' : 'Rely on general customer service patterns'}
- Be honest about confidence - if uncertain, use lower confidence scores
- Higher confidence (80-100%) only if you're very certain
- Medium confidence (60-79%) if reasonably sure but some ambiguity exists
- Low confidence (0-59%) if unclear or ambiguous

Respond with valid JSON:
{
  "classification": "category_name",
  "confidence": 85,
  "priority": "urgent|high|medium|low",
  "priorityReasoning": "Why this priority level was assigned"
  "reasoning": "Detailed explanation of why this classification was chosen${hasKnowledge ? ' and how knowledge base informed the decision' : ''}"
}`;
  }
}

export const hallucinationPreventionService = new HallucinationPreventionService();