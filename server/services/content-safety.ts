import OpenAI from 'openai';
import { storage } from '../storage';
import { sentimentAnalysisService, GuardRailResult, SentimentResult } from './sentiment-analysis';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface ContentSafetyResult {
  safe: boolean;
  blocked: boolean;
  categories: string[];
  reasoning?: string;
}

interface BrandVoiceResult {
  consistent: boolean;
  score: number;
  issues?: string[];
}

class ContentSafetyService {
  
  /**
   * Check content safety using OpenAI moderation API
   */
  async checkContentSafety(content: string): Promise<ContentSafetyResult> {
    try {
      const response = await openai.moderations.create({
        input: content,
      });

      const result = response.results[0];
      const flaggedCategories = Object.entries(result.categories)
        .filter(([_, flagged]) => flagged)
        .map(([category, _]) => category);

      return {
        safe: !result.flagged,
        blocked: result.flagged,
        categories: flaggedCategories,
        reasoning: flaggedCategories.length > 0 ? `Flagged for: ${flaggedCategories.join(', ')}` : undefined
      };

    } catch (error) {
      console.error('Content safety check failed:', error);
      // Fail safe - allow content if safety check fails
      return {
        safe: true,
        blocked: false,
        categories: [],
        reasoning: 'Safety check failed, allowing content'
      };
    }
  }

  /**
   * Check brand voice consistency based on AI training configuration
   */
  async checkBrandVoice(content: string, userId: string): Promise<BrandVoiceResult> {
    try {
      // Get user's AI training configuration
      const aiConfigs = await storage.getAITrainingConfigs(userId);
      const aiConfig = aiConfigs[0]; // Get the first/current config
      
      if (!aiConfig || !aiConfig.brandVoiceGuidelines) {
        // No brand voice guidelines configured, skip check
        return {
          consistent: true,
          score: 100
        };
      }

      const prompt = `
        Analyze this customer service response for brand voice consistency.
        
        Brand Voice Guidelines:
        ${aiConfig.brandVoiceGuidelines}
        
        Response to analyze:
        ${content}
        
        Rate the consistency from 0-100 and identify any issues.
        
        Respond with JSON:
        {
          "score": 85,
          "consistent": true,
          "issues": ["Optional array of specific issues"]
        }
      `;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.3,
      });

      const result = JSON.parse(response.choices[0].message.content || '{"score": 100, "consistent": true}');
      
      return {
        consistent: result.score >= 70, // Threshold for brand consistency
        score: result.score,
        issues: result.issues
      };

    } catch (error) {
      console.error('Brand voice check failed:', error);
      // Fail safe - assume consistent if check fails
      return {
        consistent: true,
        score: 100
      };
    }
  }

  /**
   * Comprehensive safety check combining content safety, brand voice, and sentiment analysis
   */
  async validateResponse(content: string, userId: string, context: 'email_response' | 'auto_reply' | 'customer_communication' = 'email_response'): Promise<{
    approved: boolean;
    contentSafety: ContentSafetyResult;
    brandVoice: BrandVoiceResult;
    sentimentGuardRails: GuardRailResult;
    blockReason?: string;
  }> {
    const [contentSafety, brandVoice, sentimentGuardRails] = await Promise.all([
      this.checkContentSafety(content),
      this.checkBrandVoice(content, userId),
      sentimentAnalysisService.applyGuardRails(content, context)
    ]);

    let approved = true;
    let blockReason: string | undefined;

    // Check content safety first (highest priority)
    if (!contentSafety.safe) {
      approved = false;
      blockReason = `Content safety violation: ${contentSafety.reasoning}`;
    } 
    // Check sentiment guard rails (medium priority)
    else if (!sentimentGuardRails.approved) {
      approved = false;
      blockReason = `Sentiment guard rail violation: ${sentimentGuardRails.blockReason}`;
    }
    // Check brand voice consistency (lowest priority)
    else if (!brandVoice.consistent) {
      approved = false;
      blockReason = `Brand voice inconsistency (score: ${brandVoice.score}/100)`;
    }

    // Log the validation for admin monitoring
    await this.logValidationWithSentiment(userId, content, contentSafety, brandVoice, sentimentGuardRails, approved, blockReason);

    return {
      approved,
      contentSafety,
      brandVoice,
      sentimentGuardRails,
      blockReason
    };
  }

  /**
   * Log validation results for admin monitoring (legacy method - kept for backward compatibility)
   * NOTE: Only logs blocked content - successful validations are internal processes
   */
  private async logValidation(
    userId: string,
    content: string,
    contentSafety: ContentSafetyResult,
    brandVoice: BrandVoiceResult,
    approved: boolean,
    blockReason?: string
  ) {
    // Only log safety violations that require admin attention
    // Don't log successful validations as these are internal processes, not customer-facing actions
    if (!approved && blockReason) {
      try {
        console.log('[CONTENT_SAFETY] Content blocked for safety violation:', {
          userId,
          blockReason,
          contentLength: content.length,
          contentSafetyScore: contentSafety.safe,
          brandVoiceScore: brandVoice.score
        });
        
        await storage.createActivityLog({
          userId,
          action: 'content_safety_violation_blocked',
          type: 'ai_safety',
          executedBy: 'ai',
          customerEmail: 'system@delightdesk.io',
          details: `AI response blocked for safety: ${blockReason}`,
          status: 'blocked',
          metadata: {
            contentLength: content.length,
            contentSafetyScore: contentSafety.safe,
            brandVoiceScore: brandVoice.score,
            flaggedCategories: contentSafety.categories,
            brandVoiceIssues: brandVoice.issues,
            blockReason
          }
        });
      } catch (error) {
        console.error('Failed to log validation result:', error);
      }
    }
    // Successful validations are logged to console only, not to user activity feed
    else if (approved) {
      console.log('[CONTENT_SAFETY] Content validation passed:', {
        userId,
        contentLength: content.length,
        contentSafetyScore: contentSafety.safe,
        brandVoiceScore: brandVoice.score
      });
    }
  }

  /**
   * Log validation results with sentiment analysis for admin monitoring
   * NOTE: Only logs blocked content - successful validations are internal processes
   */
  private async logValidationWithSentiment(
    userId: string,
    content: string,
    contentSafety: ContentSafetyResult,
    brandVoice: BrandVoiceResult,
    sentimentGuardRails: GuardRailResult,
    approved: boolean,
    blockReason?: string
  ) {
    // Only log safety violations that require admin attention
    // Don't log successful validations as these are internal processes, not customer-facing actions
    if (!approved && blockReason) {
      try {
        console.log('[CONTENT_SAFETY] Content blocked for comprehensive safety violation:', {
          userId,
          blockReason,
          contentLength: content.length,
          riskLevel: sentimentGuardRails.riskLevel
        });
        
        await storage.createActivityLog({
          userId,
          action: 'content_safety_violation_blocked',
          type: 'ai_safety',
          executedBy: 'ai',
          customerEmail: 'system@delightdesk.io',
          details: `AI response blocked for safety: ${blockReason}`,
          status: 'blocked',
          metadata: {
            contentLength: content.length,
            contentSafetyScore: contentSafety.safe,
            brandVoiceScore: brandVoice.score,
            sentimentAnalysis: {
              sentiment: sentimentGuardRails.sentiment.sentiment,
              confidence: sentimentGuardRails.sentiment.confidence,
              riskLevel: sentimentGuardRails.riskLevel,
              approved: sentimentGuardRails.approved
            },
            flaggedCategories: contentSafety.categories,
            brandVoiceIssues: brandVoice.issues,
            blockReason
          }
        });
      } catch (error) {
        console.error('Failed to log validation result with sentiment:', error);
      }
    }
    // Successful validations are logged to console only, not to user activity feed
    else if (approved) {
      console.log('[CONTENT_SAFETY] Comprehensive content validation passed:', {
        userId,
        contentLength: content.length,
        contentSafetyScore: contentSafety.safe,
        brandVoiceScore: brandVoice.score,
        sentimentRisk: sentimentGuardRails.riskLevel
      });
    }
  }
}

export const contentSafetyService = new ContentSafetyService();