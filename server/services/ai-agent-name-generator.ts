import OpenAI from "openai";
import { logger, LogCategory } from "./logger";
import { aiTrainingService } from "./ai-training";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface AgentNameSuggestion {
  name: string;
  reasoning: string;
  brandAlignment: string;
  personality: string;
}

export class AIAgentNameGenerator {
  
  /**
   * Check if user has sufficient training content for quality AI suggestions
   */
  async hasAdequateTrainingContent(userId: string): Promise<{
    hasEnoughContent: boolean;
    contentQuality: 'insufficient' | 'basic' | 'good' | 'excellent';
    suggestions: string[];
    totalWords: number;
  }> {
    const trainingContent = await aiTrainingService.getTrainingContent(userId);
    const trainingConfig = await aiTrainingService.getTrainingConfig(userId);
    
    if (!trainingContent || trainingContent.length === 0) {
      return {
        hasEnoughContent: false,
        contentQuality: 'insufficient',
        suggestions: [
          'Add your company "About Us" page',
          'Include product or service descriptions', 
          'Add your company values or mission statement'
        ],
        totalWords: 0
      };
    }

    // Calculate content quality metrics
    const totalWords = trainingContent.reduce((total, item) => {
      return total + item.content.split(/\s+/).length;
    }, 0);

    const hasCompanyInfo = trainingContent.some(item => 
      item.title.toLowerCase().includes('about') || 
      item.content.toLowerCase().includes('company') ||
      item.content.toLowerCase().includes('mission') ||
      item.content.toLowerCase().includes('values')
    );

    const hasProductInfo = trainingContent.some(item =>
      item.content.toLowerCase().includes('product') ||
      item.content.toLowerCase().includes('service') ||
      item.content.toLowerCase().includes('offer')
    );

    // Quality thresholds
    let contentQuality: 'insufficient' | 'basic' | 'good' | 'excellent';
    let suggestions: string[] = [];

    if (totalWords < 200) {
      contentQuality = 'insufficient';
      suggestions = [
        'Add at least 200 words of company content',
        'Include your "About Us" or company story page',
        'Add product descriptions or service details'
      ];
    } else if (totalWords < 500 || (!hasCompanyInfo && !hasProductInfo)) {
      contentQuality = 'basic';
      suggestions = [
        !hasCompanyInfo ? 'Add your company "About Us" page for brand personality' : '',
        !hasProductInfo ? 'Include product or service descriptions' : '',
        'Add more content about your brand values or mission'
      ].filter(Boolean);
    } else if (totalWords < 1000 || !hasCompanyInfo || !hasProductInfo) {
      contentQuality = 'good';
      suggestions = [
        !hasCompanyInfo ? 'Consider adding company background for better personalization' : '',
        !hasProductInfo ? 'Add more product details for industry-specific suggestions' : ''
      ].filter(Boolean);
    } else {
      contentQuality = 'excellent';
      suggestions = [];
    }

    return {
      hasEnoughContent: contentQuality === 'good' || contentQuality === 'excellent',
      contentQuality,
      suggestions,
      totalWords
    };
  }

  /**
   * Generate personalized AI agent name suggestions based on training data
   */
  async generateNameSuggestions(userId: string): Promise<AgentNameSuggestion[]> {
    try {
      // Check content quality first
      const contentCheck = await this.hasAdequateTrainingContent(userId);
      
      if (!contentCheck.hasEnoughContent) {
        throw new Error(`Insufficient training content. Need at least 500 words with company and product information. Current: ${contentCheck.totalWords} words.`);
      }

      // Get the user's training content to understand their brand
      const trainingContent = await aiTrainingService.getTrainingContent(userId);
      const trainingConfig = await aiTrainingService.getTrainingConfig(userId);
      
      // Analyze brand content to extract key characteristics
      const brandAnalysis = await this.analyzeBrandCharacteristics(trainingContent, trainingConfig.brandVoice || 'Professional');
      
      // Generate personalized name suggestions
      const suggestions = await this.generatePersonalizedNames(brandAnalysis, trainingConfig.brandVoice || 'Professional');
      
      logger.info(LogCategory.SYSTEM, 'AI agent name suggestions generated', { 
        userId, 
        suggestionCount: suggestions.length,
        contentQuality: contentCheck.contentQuality,
        totalWords: contentCheck.totalWords
      });
      
      return suggestions;
      
    } catch (error) {
      logger.error(LogCategory.SYSTEM, 'Failed to generate agent name suggestions', { userId, error });
      throw error; // Don't fallback to generic - let frontend handle the error properly
    }
  }
  
  /**
   * Analyze brand characteristics from training content
   */
  private async analyzeBrandCharacteristics(trainingContent: { title: string; content: string }[], brandVoice: string): Promise<any> {
    try {
      // Combine training content into analysis-ready format
      const contentSample = trainingContent
        .map(item => `${item.title}: ${item.content.substring(0, 1000)}`) // Limit content for analysis
        .join('\n\n')
        .substring(0, 8000); // Keep within reasonable token limits
      
      const analysisPrompt = `Analyze this company's brand characteristics based on their website content and brand voice to suggest AI agent names.

BRAND VOICE: ${brandVoice}

WEBSITE CONTENT:
${contentSample}

Based on this content, analyze:
1. Industry/sector (e.g., food, tech, fashion, healthcare)
2. Brand personality (e.g., friendly, professional, innovative, caring, fun)
3. Target audience (e.g., businesses, consumers, specific demographics)
4. Key brand values and mission
5. Tone and communication style
6. Any unique brand elements or themes

Provide your analysis in JSON format with these exact keys:
{
  "industry": "string",
  "personality": "string", 
  "audience": "string",
  "values": "string",
  "tone": "string",
  "uniqueElements": "string"
}`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: analysisPrompt }],
        response_format: { type: "json_object" },
        temperature: 0.3 // Lower temperature for consistent analysis
      });

      return JSON.parse(response.choices[0].message.content || '{}');
      
    } catch (error) {
      logger.error(LogCategory.SYSTEM, 'Brand analysis failed', { error });
      // Return safe fallback analysis
      return {
        industry: "general business",
        personality: "professional",
        audience: "customers",
        values: "quality service",
        tone: brandVoice.toLowerCase(),
        uniqueElements: "customer focused"
      };
    }
  }
  
  /**
   * Generate personalized agent names based on brand analysis
   */
  private async generatePersonalizedNames(brandAnalysis: any, brandVoice: string): Promise<AgentNameSuggestion[]> {
    try {
      const namePrompt = `You are an expert AI agent naming consultant. Generate 4-5 creative and fitting AI agent names for a customer service bot based on this brand analysis:

BRAND ANALYSIS:
- Industry: ${brandAnalysis.industry}
- Personality: ${brandAnalysis.personality}
- Target Audience: ${brandAnalysis.audience}
- Values: ${brandAnalysis.values}
- Tone: ${brandAnalysis.tone}
- Unique Elements: ${brandAnalysis.uniqueElements}
- Brand Voice: ${brandVoice}

NAMING REQUIREMENTS:
1. Names should feel appropriate for customer service interactions
2. Consider the brand's industry and personality
3. Mix of culturally diverse naming approaches:
   - Western: Alex, Sam, Sage, Nova
   - Asian: Kai, Aria, Yuki, Jin
   - Latin/Hispanic: Maya, Rio, Luna, Diego  
   - Middle Eastern: Zara, Noor, Layla, Omar
   - African: Kaia, Nia, Amara, Kofi
   - European: Luca, Enzo, Finn, Elsa

4. Each name needs clear reasoning about why it fits this specific brand
5. Avoid trademark conflicts - no branded robot names from movies/TV
6. Consider cultural appropriateness - match names to brand's target market
7. Make names memorable and brand-aligned while maintaining professionalism

Respond with a JSON array of exactly this format:
[
  {
    "name": "Agent Name",
    "reasoning": "Why this name specifically fits this brand and industry",
    "brandAlignment": "How it aligns with their brand personality and values", 
    "personality": "The personality this name would convey to customers"
  }
]`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: namePrompt }],
        response_format: { type: "json_object" },
        // GPT-5 uses default temperature only
      });

      const result = JSON.parse(response.choices[0].message.content || '[]');
      
      // Ensure we return the expected array format
      if (Array.isArray(result)) {
        return result;
      } else if (result.suggestions && Array.isArray(result.suggestions)) {
        return result.suggestions;
      } else {
        // Fallback if JSON structure is unexpected
        return this.getGenericSuggestions();
      }
      
    } catch (error) {
      logger.error(LogCategory.SYSTEM, 'Personalized name generation failed', { error });
      return this.getGenericSuggestions();
    }
  }
  
  /**
   * Fallback generic suggestions when personalized generation fails
   */
  private getGenericSuggestions(): AgentNameSuggestion[] {
    return [
      {
        name: "Kai",
        reasoning: "Globally recognized name with Asian origins, professional yet approachable",
        brandAlignment: "Conveys cultural awareness and modern, inclusive customer service",
        personality: "Friendly, culturally aware, and professional"
      },
      {
        name: "Maya", 
        reasoning: "Beautiful name with Latin/Sanskrit origins, warm and reliable",
        brandAlignment: "Represents global reach and multicultural sensitivity",
        personality: "Warm, reliable, and culturally inclusive"
      },
      {
        name: "Zara",
        reasoning: "Arabic origin name meaning 'blooming flower,' suggests growth and care",
        brandAlignment: "Shows commitment to helping customers flourish and succeed", 
        personality: "Caring, growth-oriented, and nurturing"
      },
      {
        name: "Nova",
        reasoning: "Latin origin meaning 'new,' perfect for innovative, forward-thinking brands",
        brandAlignment: "Suggests fresh ideas and cutting-edge customer solutions",
        personality: "Innovative, energetic, and forward-thinking"
      }
    ];
  }
}

export const aiAgentNameGenerator = new AIAgentNameGenerator();