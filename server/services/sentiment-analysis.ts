import { ComprehendClient, DetectSentimentCommand, DetectSentimentCommandInput } from "@aws-sdk/client-comprehend";

export interface SentimentResult {
  sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' | 'MIXED';
  confidence: number;
  scores: {
    positive: number;
    negative: number;
    neutral: number;
    mixed: number;
  };
  reasoning?: string;
}

export interface GuardRailResult {
  approved: boolean;
  blockReason?: string;
  sentiment: SentimentResult;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
}

export class SentimentAnalysisService {
  private comprehendClient: ComprehendClient;

  constructor() {
    // Initialize AWS Comprehend client with credentials from environment
    this.comprehendClient = new ComprehendClient({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
      }
    });
  }

  /**
   * Analyze sentiment using Amazon Comprehend
   */
  async analyzeSentiment(text: string, languageCode: 'en' | 'es' | 'fr' | 'de' | 'it' | 'pt' | 'ar' | 'hi' | 'ja' | 'ko' | 'zh' | 'zh-TW' = 'en'): Promise<SentimentResult> {
    try {
      // Validate input
      if (!text || text.trim().length === 0) {
        throw new Error('Text input is required for sentiment analysis');
      }

      // Truncate text if too long (Comprehend has a 5000 byte limit)
      const truncatedText = text.length > 5000 ? text.substring(0, 5000) : text;

      const input: DetectSentimentCommandInput = {
        Text: truncatedText,
        LanguageCode: languageCode
      };

      const command = new DetectSentimentCommand(input);
      const response = await this.comprehendClient.send(command);

      if (!response.Sentiment || !response.SentimentScore) {
        throw new Error('Invalid response from Amazon Comprehend');
      }

      // Get the highest confidence score
      const scores = response.SentimentScore;
      const confidence = Math.max(
        scores.Positive || 0,
        scores.Negative || 0,
        scores.Neutral || 0,
        scores.Mixed || 0
      ) * 100;

      return {
        sentiment: response.Sentiment as 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' | 'MIXED',
        confidence: Math.round(confidence),
        scores: {
          positive: Math.round((scores.Positive || 0) * 100),
          negative: Math.round((scores.Negative || 0) * 100),
          neutral: Math.round((scores.Neutral || 0) * 100),
          mixed: Math.round((scores.Mixed || 0) * 100)
        },
        reasoning: this.generateSentimentReasoning(response.Sentiment, confidence)
      };

    } catch (error) {
      console.error('Amazon Comprehend sentiment analysis failed:', error);
      
      // Fallback to basic sentiment analysis if AWS fails
      return this.getFallbackSentiment(text);
    }
  }

  /**
   * Apply guard rails based on sentiment analysis
   */
  async applyGuardRails(text: string, context: 'email_response' | 'auto_reply' | 'customer_communication'): Promise<GuardRailResult> {
    const sentiment = await this.analyzeSentiment(text);
    
    let approved = true;
    let blockReason: string | undefined;
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';

    // Define guard rail rules based on sentiment
    if (sentiment.sentiment === 'NEGATIVE' && sentiment.confidence > 80) {
      riskLevel = 'HIGH';
      approved = false;
      blockReason = `High-confidence negative sentiment detected (${sentiment.confidence}%). This response may harm customer relationships.`;
    } else if (sentiment.sentiment === 'NEGATIVE' && sentiment.confidence > 60) {
      riskLevel = 'MEDIUM';
      // For medium risk, we might want human review but not automatic blocking
      if (context === 'auto_reply') {
        approved = false;
        blockReason = `Moderate negative sentiment detected (${sentiment.confidence}%). Auto-reply blocked for human review.`;
      }
    } else if (sentiment.sentiment === 'MIXED' && sentiment.confidence > 70) {
      riskLevel = 'MEDIUM';
      // Mixed sentiment with high confidence might indicate confusion or ambiguity
      if (context === 'customer_communication') {
        approved = false;
        blockReason = `Mixed sentiment with high confidence (${sentiment.confidence}%). Response may be confusing to customers.`;
      }
    }

    // Additional context-specific rules
    if (context === 'email_response' && sentiment.scores.negative > 30) {
      if (riskLevel === 'LOW') {
        riskLevel = 'MEDIUM';
      }
    }

    return {
      approved,
      blockReason,
      sentiment,
      riskLevel
    };
  }

  /**
   * Generate human-readable reasoning for sentiment analysis
   */
  private generateSentimentReasoning(sentiment: string, confidence: number): string {
    const confidenceLevel = confidence > 80 ? 'high' : confidence > 60 ? 'moderate' : 'low';
    
    switch (sentiment) {
      case 'POSITIVE':
        return `The text expresses positive sentiment with ${confidenceLevel} confidence (${Math.round(confidence)}%). This suggests a favorable, upbeat, or supportive tone.`;
      case 'NEGATIVE':
        return `The text expresses negative sentiment with ${confidenceLevel} confidence (${Math.round(confidence)}%). This may indicate dissatisfaction, frustration, or critical tone.`;
      case 'NEUTRAL':
        return `The text has neutral sentiment with ${confidenceLevel} confidence (${Math.round(confidence)}%). This suggests a balanced, factual, or objective tone.`;
      case 'MIXED':
        return `The text has mixed sentiment with ${confidenceLevel} confidence (${Math.round(confidence)}%). This indicates both positive and negative elements are present.`;
      default:
        return `Sentiment analysis completed with ${confidenceLevel} confidence (${Math.round(confidence)}%).`;
    }
  }

  /**
   * Fallback sentiment analysis when AWS is unavailable
   */
  private getFallbackSentiment(text: string): SentimentResult {
    // Simple keyword-based fallback
    const positiveKeywords = ['good', 'great', 'excellent', 'happy', 'satisfied', 'love', 'awesome', 'perfect', 'wonderful', 'amazing'];
    const negativeKeywords = ['bad', 'terrible', 'awful', 'hate', 'disappointed', 'frustrated', 'angry', 'horrible', 'worst', 'broken'];
    
    const lowerText = text.toLowerCase();
    const positiveScore = positiveKeywords.filter(word => lowerText.includes(word)).length;
    const negativeScore = negativeKeywords.filter(word => lowerText.includes(word)).length;
    
    let sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' | 'MIXED';
    let confidence: number;
    
    if (positiveScore > negativeScore && positiveScore > 0) {
      sentiment = 'POSITIVE';
      confidence = Math.min(80, positiveScore * 20);
    } else if (negativeScore > positiveScore && negativeScore > 0) {
      sentiment = 'NEGATIVE';
      confidence = Math.min(80, negativeScore * 20);
    } else if (positiveScore > 0 && negativeScore > 0) {
      sentiment = 'MIXED';
      confidence = Math.min(70, (positiveScore + negativeScore) * 15);
    } else {
      sentiment = 'NEUTRAL';
      confidence = 50;
    }

    return {
      sentiment,
      confidence,
      scores: {
        positive: sentiment === 'POSITIVE' ? confidence : 0,
        negative: sentiment === 'NEGATIVE' ? confidence : 0,
        neutral: sentiment === 'NEUTRAL' ? confidence : 0,
        mixed: sentiment === 'MIXED' ? confidence : 0
      },
      reasoning: `Fallback analysis: ${sentiment} sentiment detected using keyword matching (confidence: ${confidence}%). AWS Comprehend was unavailable.`
    };
  }

  /**
   * Validate AWS credentials and connection
   */
  async validateConnection(): Promise<boolean> {
    try {
      // Test with a simple sentiment analysis
      const testInput: DetectSentimentCommandInput = {
        Text: 'This is a test message.',
        LanguageCode: 'en'
      };

      const command = new DetectSentimentCommand(testInput);
      await this.comprehendClient.send(command);
      
      console.log('[SENTIMENT] Amazon Comprehend connection validated successfully');
      return true;
    } catch (error) {
      console.error('[SENTIMENT] Amazon Comprehend connection validation failed:', error);
      return false;
    }
  }

  /**
   * Get service status and configuration info
   */
  getServiceInfo(): { 
    service: string;
    region: string;
    hasCredentials: boolean;
    fallbackEnabled: boolean;
  } {
    return {
      service: 'Amazon Comprehend',
      region: process.env.AWS_REGION || 'us-east-1',
      hasCredentials: !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY),
      fallbackEnabled: true
    };
  }
}

// Export singleton instance
export const sentimentAnalysisService = new SentimentAnalysisService();