import { OpenAI } from 'openai';
import { sentimentAnalysisService } from './sentiment-analysis';

interface EscalationAnalysis {
  shouldEscalate: boolean;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  reason: string;
  suggestedActions: string[];
  initialNotes: string;
  sentimentData?: {
    sentiment: string;
    confidence: number;
    scores: {
      positive: number;
      negative: number;
      neutral: number;
      mixed: number;
    };
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  };
}

export class AIEscalationAnalyzer {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async analyzeEmailForEscalation(
    subject: string,
    body: string,
    customerEmail: string,
    classification: string
  ): Promise<EscalationAnalysis> {
    // First, get sentiment analysis for the customer email
    let sentimentData;
    try {
      const sentimentResult = await sentimentAnalysisService.analyzeSentiment(body);
      
      // Extract email context for better risk assessment
      const emailContext = this.extractEmailContext(subject, body, customerEmail, sentimentResult.confidence);
      
      sentimentData = {
        sentiment: sentimentResult.sentiment,
        confidence: sentimentResult.confidence,
        scores: sentimentResult.scores,
        riskLevel: this.getSentimentRiskLevel(sentimentResult.sentiment, sentimentResult.scores, emailContext)
      };
    } catch (error) {
      console.error('Failed to analyze sentiment for escalation:', error);
      // Continue without sentiment data if service fails
    }

    // Enhanced prompt with sentiment context
    const sentimentContext = sentimentData ? `
Sentiment Analysis Results:
- Overall Sentiment: ${sentimentData.sentiment} (${sentimentData.confidence}% confidence)
- Negative Score: ${sentimentData.scores.negative}%
- Positive Score: ${sentimentData.scores.positive}%
- Risk Level: ${sentimentData.riskLevel}
` : '';

    const prompt = `
Analyze this customer email to determine if it requires human escalation:

Subject: ${subject}
Body: ${body}
Customer: ${customerEmail}
Classification: ${classification}
${sentimentContext}

Determine:
1. Should this email be escalated to a human agent? (yes/no)
2. Priority level (low/medium/high/urgent)
3. Specific reason for escalation (be concise but descriptive)
4. Suggested actions for the human agent
5. Initial notes with key context for the human agent

Consider escalating if:
- Complex technical issues requiring expertise
- Billing disputes or refund requests
- High-value customers with urgent needs
- Multiple failed automated responses
- HIGH NEGATIVE SENTIMENT (>70% negative + >85% confidence)
- HIGH EMOTIONAL DISTRESS (detected through sentiment analysis)
- Legal or compliance concerns
- Security-related issues
- VIP customer requests

EMAIL-OPTIMIZED PRIORITY ESCALATION RULES:
- URGENT: Negative sentiment >75% + confidence >90% + billing/legal keywords
- HIGH: Negative sentiment >70% + confidence >85% (email-specific thresholds)
- MEDIUM: Negative sentiment >60% + confidence >75% OR mixed sentiment >60% negative
- LOW: Neutral/positive sentiment with standard confidence

EMAIL CONTEXT MODIFIERS:
- Thread length >3 emails: Lowers thresholds by 10%
- VIP customers: Lowers thresholds by 15%
- Billing/refund keywords: Lowers thresholds by 10%
- High confidence requirements: 85%+ for HIGH risk, 75%+ for MEDIUM risk

Respond in JSON format:
{
  "shouldEscalate": boolean,
  "priority": "low|medium|high|urgent",
  "reason": "specific reason description",
  "suggestedActions": ["action1", "action2", ...],
  "initialNotes": "Contextual notes with key details for human agent - include customer info, business context, financial details, urgency indicators, sentiment analysis insights"
}
`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are an AI customer service specialist that determines when emails need human intervention. Use sentiment analysis data to make more accurate escalation decisions. High negative sentiment should significantly increase escalation likelihood.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1, // Low temperature for consistent analysis
        max_tokens: 500
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      const analysis = JSON.parse(content) as EscalationAnalysis;
      
      // Attach sentiment data to the response for downstream use
      analysis.sentimentData = sentimentData;
      
      return analysis;
    } catch (error) {
      console.error('AI escalation analysis failed:', error);
      
      // Fallback analysis based on classification
      return await this.getFallbackAnalysis(classification, subject, body);
    }
  }

  private getSentimentRiskLevel(
    sentiment: string, 
    scores: any, 
    emailContext?: {
      threadLength?: number;
      isVIPCustomer?: boolean;
      hasBillingKeywords?: boolean;
      confidence: number;
    }
  ): 'LOW' | 'MEDIUM' | 'HIGH' {
    const negativeScore = scores.negative || 0;
    const confidence = emailContext?.confidence || 0;
    
    // Industry standard thresholds based on customer service best practices
    // Conservative approach: Higher thresholds to minimize false positives
    // Based on Microsoft Dynamics 365 and customer service industry standards
    let highRiskThreshold = 75;      // Microsoft "Slightly negative" standard
    let mediumRiskThreshold = 60;    // Balanced detection threshold
    let highConfidenceRequired = 80; // Industry standard for high-stakes decisions
    let mediumConfidenceRequired = 70; // Reasonable confidence for medium risk
    
    // Context-based threshold adjustments following industry best practices
    if (emailContext) {
      // Research shows: Longer interactions indicate higher customer effort/frustration
      if (emailContext.threadLength && emailContext.threadLength > 3) {
        highRiskThreshold -= 10; // Longer threads = escalated frustration pattern
        mediumRiskThreshold -= 8;
      }
      
      // VIP customer prioritization is standard across customer service platforms
      if (emailContext.isVIPCustomer) {
        highRiskThreshold -= 15; // VIP customers require immediate attention
        mediumRiskThreshold -= 12; // Lower bar for VIP escalation
      }
      
      // Financial/billing issues follow industry standards for sensitive escalation
      if (emailContext.hasBillingKeywords) {
        highRiskThreshold -= 10; // Financial complaints require immediate attention
        mediumRiskThreshold -= 8;  // Lower threshold for billing issues
      }
    }
    
    // Risk assessment using industry-calibrated thresholds
    // HIGH RISK: Strong negative sentiment with good confidence
    if (sentiment === 'NEGATIVE' && 
        negativeScore > highRiskThreshold && 
        confidence > highConfidenceRequired) {
      return 'HIGH';
    }
    
    // MEDIUM RISK: Moderate negative with acceptable confidence OR mixed with strong negative
    // Industry standard: Balance between catching issues and avoiding false positives
    if ((sentiment === 'NEGATIVE' && negativeScore > mediumRiskThreshold && confidence > mediumConfidenceRequired) || 
        (sentiment === 'MIXED' && negativeScore > 65 && confidence > 70)) { // Raised from 60 to 65 for better precision
      return 'MEDIUM';
    }
    
    // LOW RISK: Below industry thresholds for escalation
    return 'LOW';
  }

  private extractEmailContext(
    subject: string, 
    body: string, 
    customerEmail: string, 
    confidence: number
  ): {
    threadLength?: number;
    isVIPCustomer?: boolean;
    hasBillingKeywords?: boolean;
    confidence: number;
  } {
    // Extract thread indicators from subject (Re:, Fwd:, etc.)
    const threadIndicators = (subject.match(/(?:re:|fwd:|fw:)/gi) || []).length;
    const threadLength = threadIndicators > 0 ? threadIndicators + 1 : 1;
    
    // Check for billing/refund keywords
    const billingKeywords = ['refund', 'billing', 'charge', 'payment', 'invoice', 'subscription', 'cancel', 'money', 'price', 'cost'];
    const hasBillingKeywords = billingKeywords.some(keyword => 
      body.toLowerCase().includes(keyword) || subject.toLowerCase().includes(keyword)
    );
    
    // VIP customer detection (simplified - could be enhanced with database lookup)
    const vipDomains = ['@enterprise.com', '@premium.com']; // This would typically come from database
    const isVIPCustomer = vipDomains.some(domain => customerEmail.toLowerCase().includes(domain));
    
    return {
      threadLength,
      isVIPCustomer,
      hasBillingKeywords,
      confidence
    };
  }

  private async getFallbackAnalysis(classification: string, subject: string, body: string): Promise<EscalationAnalysis> {
    const urgentKeywords = ['urgent', 'asap', 'immediately', 'emergency', 'critical'];
    const frustrated = body.toLowerCase().includes('frustrated') || 
                     body.toLowerCase().includes('angry') ||
                     subject.toLowerCase().includes('complaint');

    const hasUrgentKeywords = urgentKeywords.some(keyword => 
      subject.toLowerCase().includes(keyword) || body.toLowerCase().includes(keyword)
    );

    // Try to get sentiment data for smarter fallback prioritization
    let sentimentPriorityBoost = false;
    try {
      const sentimentResult = await sentimentAnalysisService.analyzeSentiment(body);
      const negativeScore = sentimentResult.scores.negative || 0;
      const confidence = sentimentResult.confidence || 0;
      
      // High negative sentiment should boost priority
      if (sentimentResult.sentiment === 'NEGATIVE' && negativeScore > 70 && confidence > 80) {
        sentimentPriorityBoost = true;
      }
    } catch (error) {
      console.error('Failed to analyze sentiment in fallback:', error);
    }

    // Determine escalation based on classification
    const shouldEscalate = [
      'promo_refund',
      'subscription_management', 
      'billing_dispute',
      'technical_issue'
    ].includes(classification) || frustrated || hasUrgentKeywords || sentimentPriorityBoost;

    let priority: 'low' | 'medium' | 'high' | 'urgent' = 'medium';
    if (hasUrgentKeywords || frustrated) priority = 'high';
    if (classification === 'billing_dispute') priority = 'urgent';
    if (sentimentPriorityBoost) {
      // Sentiment-based priority elevation
      if (priority === 'medium') priority = 'high';
      // Priority elevation completed above
    }

    const reason = this.generateFallbackReason(classification, hasUrgentKeywords, frustrated, sentimentPriorityBoost);

    return {
      shouldEscalate,
      priority,
      reason,
      suggestedActions: this.getSuggestedActions(classification),
      initialNotes: this.generateFallbackNotes(classification, subject)
    };
  }

  private generateFallbackReason(classification: string, urgent: boolean, frustrated: boolean, sentimentEscalated: boolean = false): string {
    let reason = `${classification.replace('_', ' ')} requiring human review`;
    
    if (urgent) reason += ' - customer indicates urgency';
    if (frustrated) reason += ' - customer expressing frustration';
    if (sentimentEscalated) reason += ' - high negative sentiment detected';
    
    return reason.charAt(0).toUpperCase() + reason.slice(1);
  }

  private getSuggestedActions(classification: string): string[] {
    const actionMap: { [key: string]: string[] } = {
      'promo_refund': ['Process refund request', 'Verify promo code validity', 'Apply discount retroactively'],
      'subscription_management': ['Review subscription details', 'Process plan change', 'Check billing status'],
      'billing_dispute': ['Review billing history', 'Contact billing team', 'Investigate charge'],
      'order_status': ['Check order tracking', 'Contact fulfillment', 'Provide status update'],
      'technical_issue': ['Escalate to technical support', 'Gather more details', 'Test functionality']
    };

    return actionMap[classification] || ['Review customer request', 'Provide personalized response'];
  }

  private generateFallbackNotes(classification: string, subject: string): string {
    const contextInfo = [
      `Issue: ${classification.replace('_', ' ')}`,
      `Subject: ${subject}`
    ];

    // Add classification-specific context
    switch (classification) {
      case 'billing_dispute':
        contextInfo.push('Requires billing team review and potential refund processing');
        break;
      case 'subscription_management':
        contextInfo.push('Account modification required - verify current plan and billing status');
        break;
      case 'promo_refund':
        contextInfo.push('Discount code issue - verify promotion validity and process refund if applicable');
        break;
      case 'order_status':
        contextInfo.push('Delivery inquiry - check tracking and fulfillment status');
        break;
      default:
        contextInfo.push('Requires human review and personalized response');
    }

    return contextInfo.join(' - ');
  }
}

export const aiEscalationAnalyzer = new AIEscalationAnalyzer();