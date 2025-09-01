import OpenAI from "openai";
import { sentimentAnalysisService } from "./sentiment-analysis";
import { hallucinationPreventionService } from "./hallucination-prevention";
import { aiAgentSignatureService } from "./ai-agent-signature";
import { businessSafetyGuard } from "./business-safety-guard";
import { businessIntelligenceLayer } from "./business-intelligence-layer";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface EmpathyContext {
  sentiment: string;
  negativeScore: number;
  confidence: number;
  customerEmotion: 'calm' | 'disappointed' | 'frustrated' | 'angry' | 'desperate';
  urgencyLevel: 'low' | 'medium' | 'high' | 'critical';
}

interface ResponseContext {
  classification: string;
  customerName?: string;
  orderNumber?: string;
  companyName?: string;
  specificIssue: string;
  availableActions: string[];
  orderData?: any;
  productData?: any;
  cancellationData?: any;
}

export interface EmpatheticResponse {
  subject: string;
  body: string;
  bodyWithSignature: string;
  tone: 'professional' | 'empathetic' | 'apologetic' | 'urgent';
  confidenceScore: number;
  emotionalAcknowledgment: string;
}

class EmpatheticResponseGenerator {
  
  /**
   * Generate dynamic empathetic response based on customer emotion and issue context
   */
  async generateResponse(
    userId: string,
    emailContent: string,
    emailSubject: string,
    classification: string,
    responseContext: ResponseContext,
    empathyLevel: number = 3,
    customerEmail?: string,
    isFirstReply?: boolean
  ): Promise<EmpatheticResponse> {
    
    console.log('[EMPATHETIC_GENERATOR] Starting response generation:', {
      classification,
      responseContext,
      empathyLevel
    });
    
    // Step 1: Analyze customer emotional state
    const empathyContext = await this.analyzeCustomerEmotion(emailContent);
    
    // Step 2: Get grounded knowledge for accurate problem-solving using professional RAG
    let groundedContext = {};
    try {
      console.log('[EMPATHETIC_GENERATOR] Fetching grounded context using professional RAG...');
      
      // CRITICAL FIX: Use the same professional RAG system as the playground
      const { professionalVectorEmbeddings } = await import('./professional-vector-embeddings');
      const knowledgeBase = await professionalVectorEmbeddings.getEnhancedRelevantKnowledge(
        userId,
        `${emailSubject} ${emailContent}`
      );
      
      groundedContext = { 
        relevantContent: knowledgeBase.relevantContent, // Use ALL relevant content, not just 3 pieces
        hasTrainingData: knowledgeBase.hasTrainingData,
        totalSources: knowledgeBase.totalSources,
        avgSimilarity: knowledgeBase.avgSimilarity,
        method: knowledgeBase.method
      };
      console.log('[EMPATHETIC_GENERATOR] Professional RAG context received:', {
        hasRelevantContent: !!((groundedContext as any)?.relevantContent?.length > 0),
        contentCount: (groundedContext as any)?.relevantContent?.length || 0,
        hasTrainingData: (groundedContext as any)?.hasTrainingData,
        avgSimilarity: (groundedContext as any)?.avgSimilarity,
        method: (groundedContext as any)?.method
      });
    } catch (error) {
      console.error('[EMPATHETIC_GENERATOR] Failed to retrieve professional RAG context:', error);
      groundedContext = { relevantContent: [], hasTrainingData: false };
    }
    
    // Step 2.5: Check loyal customer status and settings if this is the first reply
    let loyalCustomerGreeting = '';
    if (isFirstReply && customerEmail) {
      const { storage } = await import('../storage');
      let settings = null;
      try {
        settings = await storage.getSystemSettings(userId);
      } catch (error) {
        console.log('[EMPATHETIC_GENERATOR] Using default settings due to missing column');
        settings = null;
      }
      
      if (settings?.loyalCustomerGreeting) {
        const { orderLookupService } = await import('./order-lookup');
        const isRepeat = await orderLookupService.isRepeatCustomer(customerEmail, userId);
        
        if (isRepeat) {
          const companyName = settings?.companyName || 'our company';
          loyalCustomerGreeting = `Thank you for being a loyal ${companyName} customer, we appreciate your business! `;
        }
      }
    }

    // Step 3: Generate contextual empathetic response
    const response = await this.craftEmpatheticResponse(
      empathyContext,
      responseContext,
      groundedContext,
      emailContent,
      emailSubject,
      empathyLevel,
      loyalCustomerGreeting,
      userId
    );
    
    // Internal processing - log to console for debugging but not to user activity feed
    console.log(`[EMPATHETIC_RESPONSE] Generated ${responseContext.classification} response:`, {
      userId,
      customerEmail: customerEmail || 'unknown',
      classification: responseContext.classification,
      confidence: empathyContext.confidence,
      empathyLevel,
      customerEmotion: empathyContext.customerEmotion,
      urgencyLevel: empathyContext.urgencyLevel,
      confidenceScore: response.confidenceScore
    });
    
    return response;
  }
  
  /**
   * Analyze customer emotional state for empathy calibration
   */
  private async analyzeCustomerEmotion(emailContent: string): Promise<EmpathyContext> {
    // Get sentiment analysis from Amazon Comprehend
    const sentiment = await sentimentAnalysisService.analyzeSentiment(emailContent);
    
    // Map sentiment to customer emotion levels
    let customerEmotion: EmpathyContext['customerEmotion'] = 'calm';
    let urgencyLevel: EmpathyContext['urgencyLevel'] = 'low';
    
    const negativeScore = sentiment.scores.negative || 0;
    
    if (negativeScore > 80) {
      customerEmotion = 'angry';
      urgencyLevel = 'critical';
    } else if (negativeScore > 60) {
      customerEmotion = 'frustrated';
      urgencyLevel = 'high';
    } else if (negativeScore > 40) {
      customerEmotion = 'disappointed';
      urgencyLevel = 'medium';
    } else {
      customerEmotion = 'calm';
      urgencyLevel = 'low';
    }
    
    // Override for specific urgent keywords
    const urgentIndicators = ['emergency', 'urgent', 'asap', 'immediately', 'critical', 'lawsuit', 'lawyer'];
    const hasUrgentKeywords = urgentIndicators.some(keyword => 
      emailContent.toLowerCase().includes(keyword)
    );
    
    if (hasUrgentKeywords) {
      urgencyLevel = 'critical';
      if (customerEmotion === 'calm') {
        customerEmotion = 'desperate';
      }
    }
    
    return {
      sentiment: sentiment.sentiment,
      negativeScore,
      confidence: sentiment.confidence,
      customerEmotion,
      urgencyLevel
    };
  }
  
  /**
   * Craft empathetic response using GPT-4o with streamlined business intelligence
   */
  private async craftEmpatheticResponse(
    empathy: EmpathyContext,
    context: ResponseContext,
    groundedContext: any,
    originalEmail: string,
    originalSubject: string,
    empathyLevel: number = 3,
    loyalCustomerGreeting: string = '',
    userId: string = ''
  ): Promise<EmpatheticResponse> {
    
    // Get business context for vertical-specific prompting
    const { storage } = await import('../storage');
    const { aiTrainingService } = await import('./ai-training');
    let businessVertical = 'general_ecommerce';
    let useBusinessVerticalGuidance = true;
    try {
      const settings = await storage.getSystemSettings(userId);
      businessVertical = settings?.businessVertical || 'general_ecommerce';
      
      // Check if business vertical guidance is enabled
      const trainingConfig = await aiTrainingService.getTrainingConfig(userId);
      useBusinessVerticalGuidance = trainingConfig?.useBusinessVerticalGuidance ?? true;
    } catch (error) {
      // Fallback for when businessVertical column doesn't exist yet
      console.log('[EMPATHETIC_GENERATOR] Using default business vertical due to missing column');
    }

    // Use the EXACT same prompt logic as the playground
    let contextContent = '';
    if ((groundedContext as any).relevantContent && (groundedContext as any).relevantContent.length > 0) {
      contextContent = (groundedContext as any).relevantContent.join('\n\n');
      
      // Same intelligent token management as playground
      if (contextContent.length > 80000) {
        const chunks = (groundedContext as any).relevantContent;
        let truncatedContent = '';
        
        for (const chunk of chunks) {
          if ((truncatedContent + chunk).length > 80000) break;
          truncatedContent += chunk + '\n\n';
        }
        
        contextContent = truncatedContent;
      }
    }

    // EXACT same prompt as playground, just adapted for email response
    const businessContext = useBusinessVerticalGuidance ? `Business Type: ${businessVertical} business\n\n` : '';
    const verticalGuidance = useBusinessVerticalGuidance ? `\n${this.getVerticalSpecificGuidance(businessVertical)}\n` : '';
    
    const prompt = `Customer inquiry: ${originalEmail}

Context: ${contextContent}

${businessContext}Response requirements:
- Professional communication style
- Professional tone without emojis
- CRITICAL: Use double line breaks (\\n\\n) between paragraphs for proper spacing
- Keep paragraphs concise (2-3 sentences each)
- Separate different ideas/topics into distinct paragraphs with double line breaks
- DO NOT include any signature, closing, or "Best regards" - the system will add this automatically
${verticalGuidance}
Provide a helpful customer service response with proper paragraph formatting using double line breaks between paragraphs:`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: "Answer customer service inquiries naturally and helpfully based on the provided company context."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 500,
    });
    
    let aiResponse = response.choices[0].message.content?.trim() || '';
    
    return {
      subject: `Re: ${originalSubject}`,
      body: aiResponse,
      bodyWithSignature: aiResponse, // Will add signature later in the pipeline
      tone: 'professional',
      confidenceScore: 85,
      emotionalAcknowledgment: ''
    };
  }
  
  /**
   * Get emotional response guidance based on customer state
   */
  private getEmotionalGuidance(emotion: EmpathyContext['customerEmotion']): string {
    switch (emotion) {
      case 'angry':
        return "Start with sincere apology, acknowledge their frustration is completely understandable, emphasize immediate action";
      case 'frustrated':
        return "Acknowledge their frustration, show understanding of their situation, focus on quick resolution";
      case 'disappointed':
        return "Validate their disappointment, show you understand their expectations weren't met, provide hopeful solution";
      case 'desperate':
        return "Recognize the urgency, acknowledge their stress, provide immediate reassurance and action";
      case 'calm':
        return "Be professional and helpful, focus on efficient problem-solving";
      default:
        return "Match their tone and energy level appropriately";
    }
  }

  /**
   * Get specific instructions for different issue types
   */
  private getSpecificInstructions(classification: string, customerEmail: string): string {
    const emailLower = customerEmail.toLowerCase();
    
    switch (classification) {
      case 'subscription_changes':
        if (emailLower.includes('pause')) {
          return `If they want to pause: Offer pause options (don't mention cancellation).`;
        }
        if (emailLower.includes('cancel')) {
          return `If they want to cancel: Confirm the cancellation directly.`;
        }
        return `Help with their subscription request directly.`;
        
      case 'product':
        return `Answer only their specific product question.`;
        
      case 'order_status':
        return `Provide tracking info and next steps.`;
        
      case 'general':
        if (emailLower.includes('promo') || emailLower.includes('discount') || emailLower.includes('code')) {
          return `Share any promo codes from company info if available.`;
        }
        return `Answer their question helpfully.`;
        
      default:
        return `Be helpful and direct.`;
    }
  }

  /**
   * Generate empathy guidance based on configured empathy level
   */
  private getEmpathyGuidance(level: number): string {
    switch(level) {
      case 1: 
        return "- Use minimal emotional language, focus on facts and solutions\n   - Be professional and direct\n   - Avoid emotional validation phrases";
      case 2:
        return "- Show some understanding without being overly emotional\n   - Use phrases like 'I understand' sparingly\n   - Maintain professional tone";
      case 3:
        return "- Acknowledge customer feelings appropriately\n   - Use moderate empathy: 'I understand this is frustrating'\n   - Balance emotion with solution-focus";
      case 4:
        return "- Actively validate emotions and show strong empathy\n   - Use phrases like 'I completely understand how upsetting this must be'\n   - Show genuine concern for their experience";
      case 5:
        return "- Provide maximum emotional support and validation\n   - Use deeply empathetic language: 'I sincerely apologize for how this has affected you'\n   - Make the customer feel truly heard and supported";
      default:
        return "- Use moderate empathy and professional understanding";
    }
  }



  /**
   * Get vertical-specific guidance for prompting
   */
  private getVerticalSpecificGuidance(businessVertical: string): string {
    const guidanceMap: Record<string, string[]> = {
      'general_ecommerce': [
        'Focus on product quality and satisfaction',
        'Provide clear shipping information',
        'Emphasize customer service excellence'
      ],
      'fashion_apparel': [
        'Provide sizing guidance and fit recommendations',
        'Mention return/exchange policies for fit issues',
        'Be specific about materials and care instructions'
      ],
      'electronics_tech': [
        'Provide technical specifications clearly',
        'Mention warranty coverage and support options',
        'Include troubleshooting guidance when relevant'
      ],
      'food_beverage': [
        'Include FDA-required disclaimers for health claims',
        'Be precise about allergen information',
        'Consider dietary restrictions and food safety'
      ],
      'beauty_personal_care': [
        'Consider skin sensitivity and allergies',
        'Mention patch testing for new products',
        'Include ingredient transparency and safety info'
      ],
      'home_garden': [
        'Provide care instructions for plants and tools',
        'Consider seasonal and climate factors',
        'Include safety guidelines for chemicals/tools'
      ],
      'sports_outdoors': [
        'Focus on equipment specifications and safety',
        'Provide sizing guidance for gear and equipment',
        'Consider skill level and activity requirements'
      ],
      'automotive': [
        'Be specific about vehicle compatibility',
        'Include installation guidance and safety warnings',
        'Reference warranty and return policies clearly'
      ],
      'health_wellness': [
        'Include appropriate health disclaimers',
        'Suggest consulting healthcare professionals',
        'Be careful with medical claims and provide safety info'
      ],
      'jewelry_accessories': [
        'Be specific about materials and metal types',
        'Address care and cleaning instructions',
        'Help with sizing and authenticity questions'
      ],
      'books_media': [
        'Provide content descriptions and age ratings',
        'Address format compatibility issues',
        'Help with educational or entertainment value'
      ],
      'pet_supplies': [
        'Consider pet safety and age-appropriate products',
        'Be specific about ingredients in food and treats',
        'Provide usage instructions and safety guidelines'
      ],
      'toys_games': [
        'Include age recommendations and safety warnings',
        'Address educational value and skill development',
        'Consider choking hazards and safety requirements'
      ],
      'crafts_hobbies': [
        'Provide skill level requirements',
        'Be specific about materials and tools needed',
        'Include safety instructions for crafting materials'
      ],
      'baby_kids': [
        'Prioritize safety features and age appropriateness',
        'Include detailed safety warnings',
        'Be specific about developmental benefits'
      ],
      'office_supplies': [
        'Focus on functionality and business applications',
        'Be specific about compatibility requirements',
        'Address bulk ordering and business accounts'
      ],
      'furniture': [
        'Provide dimensions and weight capacity',
        'Be specific about materials and assembly',
        'Address shipping and delivery considerations'
      ],
      'tools_hardware': [
        'Focus on specifications and compatibility',
        'Include safety warnings and proper usage',
        'Be specific about project applications'
      ],
      'musical_instruments': [
        'Consider skill level and experience',
        'Be specific about sound quality and features',
        'Provide care and maintenance instructions'
      ],
      'collectibles': [
        'Be specific about authenticity and condition',
        'Address storage and preservation needs',
        'Include information about rarity and value'
      ],
      'subscription_boxes': [
        'Be clear about subscription terms and billing',
        'Address customization options',
        'Provide cancellation and modification policies'
      ],
      'digital_products': [
        'Focus on compatibility and system requirements',
        'Be clear about licensing and usage terms',
        'Address download and access instructions'
      ],
      'b2b_wholesale': [
        'Focus on bulk pricing and minimum orders',
        'Address business terms and payment options',
        'Be specific about delivery timelines'
      ]
    };

    const guidance = guidanceMap[businessVertical] || guidanceMap['general_ecommerce'];
    const guidanceText = guidance.map(g => `• ${g}`).join('\n');
    
    return `
INDUSTRY-SPECIFIC GUIDANCE:
${guidanceText}`;
  }
}

export const empatheticResponseGenerator = new EmpatheticResponseGenerator();