import OpenAI from "openai";
import { nanoid } from "nanoid";
import { logger, LogCategory } from "./logger";
import { db } from "../db";
import { eq, and, sql } from "drizzle-orm";
import { 
  aiTrainingConfig, 
  trainingUrls, 
  aiResponseSuggestions,
  escalationQueue,
  emails,
  systemSettings,
  type TrainingUrl,
  type AITrainingConfig,
  type InsertAITrainingConfig,
  type InsertTrainingUrl
} from "@shared/schema";
import { AdvancedWebScraper } from './advanced-web-scraper';
import { removeEmojis } from '../utils/emoji-filter';
import { professionalVectorEmbeddings } from './professional-vector-embeddings';
import { semanticChunking } from './semantic-chunking';

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export class AITrainingService {
  
  /**
   * Get training content for AI context
   */
  async getTrainingContent(userId: string): Promise<{ title: string; content: string }[]> {
    try {
      const trainingContent = await db
        .select({ 
          url: trainingUrls.url,
          crawledContent: trainingUrls.crawledContent 
        })
        .from(trainingUrls)
        .where(
          and(
            eq(trainingUrls.userId, userId),
            eq(trainingUrls.status, 'completed')
          )
        );

      return trainingContent
        .filter(item => item.crawledContent && item.crawledContent.trim())
        .map(item => ({
          title: new URL(item.url).hostname,
          content: item.crawledContent || ''
        }));
    } catch (error) {
      logger.error(LogCategory.SYSTEM, 'Failed to get training content', { userId, error });
      return [];
    }
  }

  /**
   * Get or create AI training configuration for a user
   */
  async getTrainingConfig(userId: string): Promise<AITrainingConfig & { trainingUrls: TrainingUrl[]; manualContent?: any[]; aiAgentName?: string }> {
    try {
      // Get or create config
      let config = await db.select().from(aiTrainingConfig).where(eq(aiTrainingConfig.userId, userId)).limit(1);
      
      if (config.length === 0) {
        // Create default config
        const newConfig = await db.insert(aiTrainingConfig).values({
          userId,
          allowEmojis: false,
          brandVoice: 'Professional',
          isActive: true
        }).returning();
        config = newConfig;
      }

      // Get system settings (AI agent name, empathy level, etc.)
      const settings = await db.select({
        aiAgentName: systemSettings.aiAgentName,
        aiAgentTitle: systemSettings.aiAgentTitle,
        salutation: systemSettings.salutation,
        customSalutation: systemSettings.customSalutation,
        signatureCompanyName: systemSettings.companyName,
        signatureFooter: systemSettings.signatureFooter,
        loyalCustomerGreeting: systemSettings.loyalCustomerGreeting,
        businessVertical: systemSettings.businessVertical
      })
        .from(systemSettings)
        .where(eq(systemSettings.userId, userId))
        .limit(1);

      // Get training URLs (exclude manual content URLs) and map to frontend format
      const urls = await db.select().from(trainingUrls).where(
        and(
          eq(trainingUrls.userId, userId),
          sql`${trainingUrls.url} NOT LIKE 'manual-content://%'`
        )
      );
      
      const formattedUrls = urls.map(url => ({
        id: url.id,
        url: url.url,
        status: url.status,
        pageCount: url.pageCount,
        lastCrawled: url.lastCrawled?.toISOString() || null,
        errorMessage: url.errorMessage
      }));

      // Get manual content from training URLs with manual-content:// prefix
      const manualContentUrls = await db.select().from(trainingUrls).where(
        and(
          eq(trainingUrls.userId, userId),
          sql`${trainingUrls.url} LIKE 'manual-content://%'`
        )
      );

      const formattedManualContent = manualContentUrls.map(item => ({
        id: item.id,
        title: item.url.replace('manual-content://', ''),
        content: item.crawledContent?.replace(item.url.replace('manual-content://', '') + '\n\n', '') || '',
        category: 'manual',
        tags: [],
        isActive: true,
        createdAt: item.createdAt?.toISOString() || new Date().toISOString(),
        updatedAt: item.updatedAt?.toISOString() || new Date().toISOString()
      }));

      return {
        ...config[0],
        trainingUrls: formattedUrls as any,
        manualContent: formattedManualContent,
        aiAgentName: settings[0]?.aiAgentName || 'Kai',
        aiAgentTitle: settings[0]?.aiAgentTitle || 'AI Customer Service Agent',
        salutation: settings[0]?.salutation || 'Thank you',
        customSalutation: settings[0]?.customSalutation || '',
        signatureCompanyName: settings[0]?.signatureCompanyName || '',
        signatureFooter: settings[0]?.signatureFooter || "We use AI to solve customer problems faster. Reply 'Human' for immediate escalation.",
        loyalCustomerGreeting: settings[0]?.loyalCustomerGreeting || false,
        businessVertical: settings[0]?.businessVertical || 'general_ecommerce'
      };
    } catch (error) {
      logger.error(LogCategory.SYSTEM, 'Failed to get training config', { userId, error });
      throw error;
    }
  }

  /**
   * Update AI training configuration and agent name
   */
  async updateTrainingConfig(userId: string, configData: Partial<InsertAITrainingConfig & { aiAgentName?: string; aiAgentTitle?: string; salutation?: string; signatureCompanyName?: string; signatureFooter?: string; loyalCustomerGreeting?: boolean; businessVertical?: string }>): Promise<AITrainingConfig> {
    try {
      // Separate system settings fields from training config data
      const { aiAgentName, aiAgentTitle, salutation, signatureCompanyName, signatureFooter, loyalCustomerGreeting, businessVertical, ...trainingConfigData } = configData;
      
      // Update training configuration
      const [updatedConfig] = await db
        .update(aiTrainingConfig)
        .set({
          ...trainingConfigData,
          updatedAt: new Date()
        })
        .where(eq(aiTrainingConfig.userId, userId))
        .returning();

      if (!updatedConfig) {
        throw new Error('Config not found');
      }

      // Update system settings fields if provided
      const systemSettingsUpdate: any = {};
      if (aiAgentName !== undefined) {
        systemSettingsUpdate.aiAgentName = aiAgentName;
      }
      if (aiAgentTitle !== undefined) {
        systemSettingsUpdate.aiAgentTitle = aiAgentTitle;
      }
      if (salutation !== undefined) {
        systemSettingsUpdate.salutation = salutation;
      }
      if (signatureCompanyName !== undefined) {
        systemSettingsUpdate.companyName = signatureCompanyName;
      }
      if (signatureFooter !== undefined) {
        systemSettingsUpdate.signatureFooter = signatureFooter;
      }
      if (loyalCustomerGreeting !== undefined) {
        systemSettingsUpdate.loyalCustomerGreeting = loyalCustomerGreeting;
      }
      if (businessVertical !== undefined) {
        systemSettingsUpdate.businessVertical = businessVertical;
      }
      
      if (Object.keys(systemSettingsUpdate).length > 0) {
        await db
          .update(systemSettings)
          .set(systemSettingsUpdate)
          .where(eq(systemSettings.userId, userId));
        
        logger.info(LogCategory.SYSTEM, 'System settings updated', { userId, updates: systemSettingsUpdate });
      }

      logger.info(LogCategory.SYSTEM, 'Training config updated', { userId, configData });
      return updatedConfig;
    } catch (error) {
      logger.error(LogCategory.SYSTEM, 'Failed to update training config', { userId, error });
      throw error;
    }
  }

  /**
   * Add a URL for training content
   */
  async addTrainingUrl(userId: string, url: string): Promise<TrainingUrl> {
    try {
      // Simply try to insert - database constraint prevents exact URL duplicates
      const [newUrl] = await db.insert(trainingUrls).values({
        userId,
        url: url.trim(),
        status: 'pending'
      }).returning();

      logger.info(LogCategory.SYSTEM, 'Training URL added', { userId, url: url.trim() });
      
      // Start crawling asynchronously (don't wait for completion)
      this.crawlUrl(newUrl.id).catch(error => {
        logger.error(LogCategory.SYSTEM, 'URL crawling failed', { 
          urlId: newUrl.id, 
          url: url.trim(), 
          error: error.message 
        });
      });

      return newUrl;
    } catch (error) {
      // Check if it's a unique constraint violation (duplicate URL)
      if ((error as any).code === '23505' || (error as Error).message?.includes('duplicate key value')) {
        logger.info(LogCategory.SYSTEM, 'Duplicate URL rejected by database constraint', { userId, url });
        throw new Error('This exact URL has already been added to your training sources');
      }
      
      logger.error(LogCategory.SYSTEM, 'Failed to add training URL', { userId, url, error });
      throw error;
    }
  }

  /**
   * Remove a training URL
   */
  async removeTrainingUrl(urlId: string): Promise<void> {
    try {
      await db.delete(trainingUrls).where(eq(trainingUrls.id, urlId));
      logger.info(LogCategory.SYSTEM, 'Training URL removed', { urlId });
    } catch (error) {
      logger.error(LogCategory.SYSTEM, 'Failed to remove training URL', { urlId, error });
      throw error;
    }
  }

  /**
   * Crawl a URL and extract content for training using professional web scraper
   */
  private async crawlUrl(urlId: string): Promise<void> {
    try {
      // Update status to crawling
      await db.update(trainingUrls)
        .set({ status: 'crawling', updatedAt: new Date() })
        .where(eq(trainingUrls.id, urlId));

      const urlRecord = await db.select().from(trainingUrls).where(eq(trainingUrls.id, urlId)).limit(1);
      if (!urlRecord.length) return;

      const { url } = urlRecord[0];

      // Use professional web scraper that handles accordion FAQs and JavaScript
      const scraper = new AdvancedWebScraper();
      const scrapedContent = await scraper.scrapeContent(url);

      // Format content for AI training
      let trainingContent = `${scrapedContent.title}\n\n`;
      
      // Add FAQ content in structured format
      if (scrapedContent.faqItems.length > 0) {
        trainingContent += "Frequently Asked Questions:\n\n";
        
        scrapedContent.faqItems.forEach((faq, index) => {
          trainingContent += `Q: ${faq.question}\n`;
          trainingContent += `A: ${faq.answer}\n\n`;
        });
      }
      
      // Add general content if available
      if (scrapedContent.mainContent) {
        trainingContent += `Additional Information:\n${scrapedContent.mainContent}\n`;
      }

      // Validate we extracted meaningful content
      if (scrapedContent.faqItems.length === 0 && scrapedContent.mainContent.length < 200) {
        throw new Error(`Insufficient content extracted from ${url}. This may be a page that requires JavaScript or has blocked crawling.`);
      }

      // Update with professionally scraped content
      await db.update(trainingUrls).set({
        status: 'completed',
        pageCount: 1, // Always 1 page - we only crawl the exact URL provided
        crawledContent: trainingContent.slice(0, 50000), // Limit content to 50KB for performance
        lastCrawled: new Date(),
        updatedAt: new Date()
      }).where(eq(trainingUrls.id, urlId));

      logger.info(LogCategory.SYSTEM, 'URL crawled successfully', { 
        urlId, 
        url, 
        contentLength: trainingContent.length 
      });

      // Automatically process for semantic chunking after successful crawl
      const [updatedUrl] = await db.select().from(trainingUrls).where(eq(trainingUrls.id, urlId)).limit(1);
      if (updatedUrl) {
        // Process in background to avoid blocking the crawl response
        setImmediate(async () => {
          try {
            await this.processCompletedUrlForChunking(updatedUrl.userId, urlId);
            console.log(`[AI_TRAINING] Auto-chunking completed for ${url}`);
          } catch (chunkingError) {
            console.error(`[AI_TRAINING] Auto-chunking failed for ${url}:`, chunkingError);
          }
        });
      }

    } catch (error) {
      // Update status to failed
      await db.update(trainingUrls).set({
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        updatedAt: new Date()
      }).where(eq(trainingUrls.id, urlId));

      logger.error(LogCategory.SYSTEM, 'URL crawling failed', { urlId, error });
    }
  }

  /**
   * Process completed URLs for semantic chunking
   */
  async processCompletedUrlForChunking(userId: string, urlId: string): Promise<void> {
    try {
      const [trainingUrl] = await db
        .select()
        .from(trainingUrls)
        .where(eq(trainingUrls.id, urlId))
        .limit(1);

      if (trainingUrl && trainingUrl.status === 'completed' && trainingUrl.crawledContent) {
        console.log(`[AI_TRAINING] Processing URL for semantic chunking: ${trainingUrl.url}`);
        
        // Process the content into semantic chunks with embeddings
        await semanticChunking.processTrainingUrlContent(userId, trainingUrl);
        
        console.log(`[AI_TRAINING] Completed semantic chunking for URL: ${trainingUrl.url}`);
      }
    } catch (error) {
      console.error('[AI_TRAINING] Error processing URL for chunking:', error);
    }
  }

  /**
   * Reprocess all user content for semantic chunking (useful for upgrades)
   */
  async reprocessUserContentForChunking(userId: string): Promise<void> {
    try {
      console.log(`[AI_TRAINING] Reprocessing all content for user: ${userId}`);
      await semanticChunking.reprocessAllUserContent(userId);
      console.log(`[AI_TRAINING] Completed reprocessing for user: ${userId}`);
    } catch (error) {
      console.error('[AI_TRAINING] Error reprocessing user content:', error);
      throw error;
    }
  }

  /**
   * Test AI response in playground mode
   */
  async generatePlaygroundResponse(userId: string, query: string): Promise<{ response: string; confidence: number }> {
    try {
      // Get user's training configuration
      const config = await this.getTrainingConfig(userId);
      
      if (!config.trainingUrls?.length) {
        return {
          response: "To provide accurate responses, please add some training URLs first. The AI needs to learn about your products and policies from your website content.",
          confidence: 0.9
        };
      }

      // Get training content from completed URLs
      const completedUrls = config.trainingUrls.filter(url => url.status === 'completed');
      
      if (!completedUrls.length) {
        return {
          response: "Your training URLs are still being processed. Please wait for the crawling to complete, then try again.",
          confidence: 0.9
        };
      }

      // Use professional RAG with semantic chunking for intelligent content retrieval
      // Finds relevant content across ALL sources (URLs + manual content) using proper embeddings
      const relevantKnowledge = await professionalVectorEmbeddings.getEnhancedRelevantKnowledge(userId, query);
      
      let contextContent: string;
      let debugInfo = '';
      
      if (relevantKnowledge.hasTrainingData && relevantKnowledge.relevantContent.length > 0) {
        // Professional RAG found semantically relevant chunks
        contextContent = relevantKnowledge.relevantContent.join('\n\n');
        
        debugInfo = `Found ${relevantKnowledge.totalSources} relevant chunks using ${relevantKnowledge.method} (${relevantKnowledge.sourceTypes.join(', ')}) with avg similarity: ${relevantKnowledge.avgSimilarity || 'N/A'}`;
        
        // Intelligent token management - keep most relevant content
        if (contextContent.length > 80000) {
          // Keep the highest quality content (first chunks have highest similarity)
          const chunks = relevantKnowledge.relevantContent;
          let truncatedContent = '';
          
          for (const chunk of chunks) {
            if ((truncatedContent + chunk).length > 80000) break;
            truncatedContent += chunk + '\n\n';
          }
          
          contextContent = truncatedContent;
        }
        
        console.log(`[AI_TRAINING] ${debugInfo}`);
      } else {
        return {
          response: `I don't have enough specific information to answer that question accurately. Please add more training content about your products and policies, or try asking about something more general.\n\nDebug: ${relevantKnowledge.method === 'none' ? 'No training data found' : 'No relevant matches found'}`,
          confidence: 0.3
        };
      }

      if (!contextContent.trim()) {
        return {
          response: "Unable to generate response - no training content available. Please check that your URLs have been successfully crawled.",
          confidence: 0.8
        };
      }

      // Research-backed knowledge injection prompt
      const prompt = `Customer inquiry: ${query}

Context: ${contextContent}

Response requirements:
- ${config.brandVoice} communication style
- ${config.allowEmojis ? 'Emojis enabled' : 'Professional tone without emojis'}
- CRITICAL: Use double line breaks (\\n\\n) between paragraphs for proper spacing
- Keep paragraphs concise (2-3 sentences each)
- Separate different ideas/topics into distinct paragraphs with double line breaks
${config.customInstructions ? `- ${config.customInstructions}` : ''}

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

      // Apply emoji filtering if disabled in configuration
      if (!config.allowEmojis) {
        aiResponse = removeEmojis(aiResponse);
      }

      logger.info(LogCategory.SYSTEM, 'Playground response generated', { 
        userId, 
        queryLength: query.length,
        responseLength: aiResponse.length,
        brandVoice: config.brandVoice,
        emojiFiltering: !config.allowEmojis
      });

      return {
        response: aiResponse,
        confidence: 0.85
      };

    } catch (error) {
      logger.error(LogCategory.SYSTEM, 'Playground response failed', { userId, error });
      throw error;
    }
  }

  /**
   * Generate AI response suggestion for an escalated email
   */
  async generateResponseSuggestion(escalationId: string): Promise<{ 
    suggestion: string; 
    confidence: number; 
    reasoning: string; 
  } | null> {
    try {
      // Get escalation details with email info
      const escalation = await db
        .select({
          id: escalationQueue.id,
          userId: escalationQueue.userId,
          reason: escalationQueue.reason,
          subject: emails.subject,
          content: emails.body,
          customerEmail: emails.fromEmail
        })
        .from(escalationQueue)
        .innerJoin(emails, eq(escalationQueue.emailId, emails.id))
        .where(eq(escalationQueue.id, escalationId))
        .limit(1);

      if (!escalation.length) {
        throw new Error('Escalation not found');
      }

      const escalationData = escalation[0];

      // Get user's training config and content
      const trainingConfig = await this.getTrainingConfig(escalationData.userId);
      
      // Get training content from crawled URLs
      const trainingContent = trainingConfig.trainingUrls
        .filter(url => url.status === 'completed' && url.crawledContent)
        .map(url => url.crawledContent)
        .join('\n\n');

      if (!trainingContent) {
        logger.info(LogCategory.SYSTEM, 'No training content available', { escalationId });
        return null; // No training content available
      }

      // Build AI prompt
      const systemPrompt = `You are a customer service AI trained on the company's specific content and policies. 

BRAND VOICE: ${trainingConfig.brandVoice}
ALLOW EMOJIS: ${trainingConfig.allowEmojis ? 'Yes' : 'No'}
CUSTOM INSTRUCTIONS: ${trainingConfig.customInstructions || 'None'}

COMPANY KNOWLEDGE BASE:
${trainingContent}

Your task is to suggest an appropriate response to the customer email. Only provide a suggestion if you have HIGH CONFIDENCE (80%+) that your response is accurate and helpful based on the company's knowledge base.

Respond with JSON in this format:
{
  "hasHighConfidence": boolean,
  "suggestedResponse": string (only if hasHighConfidence is true),
  "confidence": number (0-100),
  "reasoning": string
}`;

      const userPrompt = `CUSTOMER EMAIL DETAILS:
Subject: ${escalationData.subject}
From: ${escalationData.customerEmail}
Escalation Reason: ${escalationData.reason}

EMAIL CONTENT:
${escalationData.content}

Please analyze this email and provide a suggested response if you have high confidence.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3 // Lower temperature for more consistent responses
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');

      if (!result.hasHighConfidence) {
        logger.info(LogCategory.SYSTEM, 'AI has low confidence, not suggesting response', { 
          escalationId, 
          confidence: result.confidence 
        });
        return null;
      }

      return {
        suggestion: result.suggestedResponse,
        confidence: result.confidence,
        reasoning: result.reasoning
      };

    } catch (error) {
      logger.error(LogCategory.SYSTEM, 'Failed to generate response suggestion', { escalationId, error });
      return null;
    }
  }

  /**
   * Add manual training content when web scraping fails
   */
  async addManualContent(userId: string, title: string, content: string): Promise<TrainingUrl> {
    try {
      const urlId = nanoid();
      
      // Create a training URL record for the manual content
      const trainingUrl = await db.insert(trainingUrls).values({
        id: urlId,
        userId,
        url: `manual-content://${title}`,
        status: 'completed',
        pageCount: 1,
        crawledContent: `${title}\n\n${content}`,
        lastCrawled: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning();

      logger.info(LogCategory.SYSTEM, 'Manual content added successfully', {
        userId,
        title,
        contentLength: content.length,
        urlId
      });

      return trainingUrl[0];
    } catch (error) {
      logger.error(LogCategory.SYSTEM, 'Failed to add manual content', { 
        error: error instanceof Error ? error.message : error,
        userId,
        title
      });
      throw error;
    }
  }

  /**
   * Save an AI response suggestion to the database
   */
  async saveResponseSuggestion(
    escalationId: string, 
    suggestion: string, 
    confidence: number, 
    reasoning: string
  ): Promise<void> {
    try {
      await db.insert(aiResponseSuggestions).values({
        escalationId,
        suggestedResponse: suggestion,
        confidence,
        reasoning
      });

      logger.info(LogCategory.SYSTEM, 'Response suggestion saved', { escalationId, confidence });
    } catch (error) {
      logger.error(LogCategory.SYSTEM, 'Failed to save response suggestion', { escalationId, error });
      throw error;
    }
  }
}

export const aiTrainingService = new AITrainingService();