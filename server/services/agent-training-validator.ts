import { db } from "../db";
import { eq, and, sql } from "drizzle-orm";
import { trainingUrls, manualTrainingContent, contentChunks } from "@shared/schema";
import { logger, LogCategory } from "./logger";

export interface AgentTrainingRequirement {
  agentType: 'product' | 'wismo' | 'subscription' | 'returns' | 'general';
  hasMinimumContent: boolean;
  hasRelevantContent: boolean;
  urlCount: number;
  manualContentCount: number;
  relevantChunks: number;
  totalSources: number;
  contentQuality: 'insufficient' | 'basic' | 'good' | 'excellent';
  recommendations: string[];
  warning?: string;
}

export class AgentTrainingValidator {
  
  /**
   * Check if user has sufficient and relevant training content for a specific agent
   */
  async validateAgentTraining(userId: string, agentType: string): Promise<AgentTrainingRequirement> {
    try {
      // Get basic content counts
      const { urlCount, manualContentCount, totalSources } = await this.getContentCounts(userId);
      
      // Get semantic content analysis
      const contentAnalysis = await this.analyzeContentRelevance(userId, agentType);
      
      // Generate requirements assessment
      const assessment = this.assessRequirements(agentType, {
        urlCount,
        manualContentCount, 
        totalSources,
        ...contentAnalysis
      });

      logger.info(LogCategory.SYSTEM, 'Agent training validation completed', {
        userId,
        agentType,
        assessment
      });

      return {
        agentType: agentType as any,
        hasMinimumContent: totalSources >= 1,
        hasRelevantContent: contentAnalysis.relevantChunks >= this.getMinimumChunks(agentType),
        urlCount,
        manualContentCount,
        relevantChunks: contentAnalysis.relevantChunks,
        totalSources,
        contentQuality: assessment.quality,
        recommendations: assessment.recommendations,
        warning: assessment.warning
      };

    } catch (error) {
      logger.error(LogCategory.SYSTEM, 'Failed to validate agent training', { userId, agentType, error });
      
      return {
        agentType: agentType as any,
        hasMinimumContent: false,
        hasRelevantContent: false,
        urlCount: 0,
        manualContentCount: 0,
        relevantChunks: 0,
        totalSources: 0,
        contentQuality: 'insufficient',
        recommendations: ['Add relevant training content for this agent type'],
        warning: 'Unable to validate training content. Please add relevant information.',
      };
    }
  }

  private async getContentCounts(userId: string) {
    // Count completed training URLs
    const completedUrls = await db
      .select({ count: sql<number>`count(*)`.as('count') })
      .from(trainingUrls)
      .where(
        and(
          eq(trainingUrls.userId, userId),
          eq(trainingUrls.status, 'completed')
        )
      );

    // Count manual training content
    const manualContent = await db
      .select({ count: sql<number>`count(*)`.as('count') })
      .from(manualTrainingContent)
      .where(eq(manualTrainingContent.userId, userId));

    const urlCount = completedUrls[0]?.count || 0;
    const manualContentCount = manualContent[0]?.count || 0;
    const totalSources = urlCount + manualContentCount;

    return { urlCount, manualContentCount, totalSources };
  }

  private async analyzeContentRelevance(userId: string, agentType: string) {
    // Get semantic chunks and analyze for relevance
    // Note: Using empty array if content_chunks table doesn't exist yet
    let chunks: any[] = [];
    try {
      chunks = await db
        .select({
          id: contentChunks.id,
          content: contentChunks.chunkText
        })
        .from(contentChunks)
        .where(eq(contentChunks.userId, userId));
    } catch (error) {
      // Table might not exist yet, return empty analysis
      chunks = [];
    }

    const keywords = this.getAgentKeywords(agentType);
    const requiredTopics = this.getRequiredTopics(agentType);
    
    let relevantChunks = 0;
    const foundTopics: string[] = [];

    // Analyze each chunk for relevance
    for (const chunk of chunks) {
      const content = chunk.content.toLowerCase();
      const isRelevant = keywords.some(keyword => content.includes(keyword.toLowerCase()));
      
      if (isRelevant) {
        relevantChunks++;
        
        // Check which topics are covered
        requiredTopics.forEach(topic => {
          const topicKeywords = this.getTopicKeywords(agentType, topic);
          if (topicKeywords.some(kw => content.includes(kw.toLowerCase()))) {
            if (!foundTopics.includes(topic)) {
              foundTopics.push(topic);
            }
          }
        });
      }
    }

    return {
      relevantChunks,
      foundTopics,
      totalChunks: chunks.length
    };
  }

  private assessRequirements(agentType: string, data: any) {
    const { totalSources, relevantChunks, foundTopics } = data;
    const requiredTopics = this.getRequiredTopics(agentType);
    const missingTopics = requiredTopics.filter(topic => !foundTopics.includes(topic));
    
    let quality: 'insufficient' | 'basic' | 'good' | 'excellent';
    let recommendations: string[] = [];
    let warning: string | undefined;

    // Determine content quality
    if (totalSources === 0) {
      quality = 'insufficient';
      warning = `${this.getAgentDisplayName(agentType)} requires training content to function properly.`;
      recommendations.push(`Add at least 3 relevant sources about ${this.getAgentFocus(agentType)}`);
    } else if (relevantChunks < this.getMinimumChunks(agentType)) {
      quality = 'insufficient';
      warning = `Insufficient relevant content for ${this.getAgentDisplayName(agentType)}.`;
      recommendations.push(`Add more content specifically about ${this.getAgentFocus(agentType)}`);
    } else if (relevantChunks < this.getGoodChunks(agentType) || missingTopics.length > 2) {
      quality = 'basic';
      recommendations.push('Add more detailed content to improve response quality');
      if (missingTopics.length > 0) {
        recommendations.push(`Consider adding information about: ${missingTopics.slice(0, 3).join(', ')}`);
      }
    } else if (relevantChunks < this.getExcellentChunks(agentType) || missingTopics.length > 0) {
      quality = 'good';
      if (missingTopics.length > 0) {
        recommendations.push(`To improve further, add content about: ${missingTopics.join(', ')}`);
      }
    } else {
      quality = 'excellent';
      recommendations.push('Great! Your training content covers all essential topics.');
    }

    return { quality, recommendations, warning, missingTopics };
  }

  private getAgentKeywords(agentType: string): string[] {
    const keywords: Record<string, string[]> = {
      product: [
        'product', 'item', 'features', 'specifications', 'benefits', 'ingredients', 
        'materials', 'size', 'color', 'model', 'brand', 'collection', 'catalog',
        'description', 'details', 'quality', 'reviews', 'comparison', 'recommended'
      ],
      wismo: [
        'order', 'shipping', 'delivery', 'tracking', 'status', 'when', 'where',
        'carrier', 'shipped', 'transit', 'delayed', 'arrived', 'package'
      ],
      subscription: [
        'subscription', 'recurring', 'monthly', 'plan', 'billing', 'cycle',
        'cancel', 'pause', 'renew', 'auto-ship', 'delivery frequency'
      ],
      returns: [
        'return', 'refund', 'exchange', 'policy', 'warranty', 'damaged',
        'defective', 'satisfaction', 'money back', 'replacement'
      ]
    };
    
    return keywords[agentType] || keywords.product;
  }

  private getRequiredTopics(agentType: string): string[] {
    const topics: Record<string, string[]> = {
      product: [
        'Product Features', 'Product Benefits', 'Specifications', 'Usage Instructions',
        'Compatibility', 'Sizing Guide', 'Care Instructions', 'Ingredients/Materials'
      ],
      wismo: [
        'Shipping Times', 'Delivery Options', 'Tracking Information', 'Carrier Details',
        'Order Processing', 'Shipping Policies', 'International Shipping'
      ],
      subscription: [
        'Subscription Plans', 'Billing Cycles', 'Cancellation Policy', 'Pause Options',
        'Delivery Frequency', 'Plan Changes', 'Payment Methods'
      ],
      returns: [
        'Return Policy', 'Return Process', 'Return Timeframe', 'Refund Policy',
        'Exchange Options', 'Return Shipping', 'Condition Requirements'
      ]
    };
    
    return topics[agentType] || topics.product;
  }

  private getTopicKeywords(agentType: string, topic: string): string[] {
    const topicKeywords: Record<string, Record<string, string[]>> = {
      product: {
        'Product Features': ['features', 'functionality', 'capabilities', 'includes'],
        'Product Benefits': ['benefits', 'advantages', 'helps', 'improves', 'solves'],
        'Specifications': ['specs', 'dimensions', 'weight', 'technical', 'requirements'],
        'Usage Instructions': ['how to', 'instructions', 'steps', 'guide', 'tutorial'],
        'Compatibility': ['compatible', 'works with', 'fits', 'suitable for'],
        'Sizing Guide': ['size', 'measurement', 'fit', 'dimensions', 'chart'],
        'Care Instructions': ['care', 'maintenance', 'cleaning', 'storage', 'wash'],
        'Ingredients/Materials': ['ingredients', 'materials', 'made from', 'contains']
      }
    };
    
    return topicKeywords[agentType]?.[topic] || [];
  }

  private getMinimumChunks(agentType: string): number {
    const minimums: Record<string, number> = {
      product: 5,
      wismo: 3,
      subscription: 3,
      returns: 3
    };
    return minimums[agentType] || 3;
  }

  private getGoodChunks(agentType: string): number {
    return this.getMinimumChunks(agentType) * 2;
  }

  private getExcellentChunks(agentType: string): number {
    return this.getMinimumChunks(agentType) * 4;
  }

  private getAgentDisplayName(agentType: string): string {
    const names: Record<string, string> = {
      product: 'Product Agent',
      wismo: 'WISMO Agent', 
      subscription: 'Subscription Agent',
      returns: 'Returns Agent'
    };
    return names[agentType] || 'Agent';
  }

  private getAgentFocus(agentType: string): string {
    const focus: Record<string, string> = {
      product: 'your products, features, and benefits',
      wismo: 'shipping, tracking, and order status',
      subscription: 'subscription plans and billing',
      returns: 'return policies and procedures'
    };
    return focus[agentType] || 'relevant topics';
  }
}

export const agentTrainingValidator = new AgentTrainingValidator();