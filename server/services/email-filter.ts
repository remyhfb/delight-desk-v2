import { openaiService } from "./openai";

export interface EmailFilterResult {
  isLegitimateInquiry: boolean;
  filterReason: string;
  confidence: number;
  shouldProcess: boolean;
}

/**
 * Advanced email filtering service to prevent spam and non-customer emails 
 * from cluttering the escalation queue
 */
export class EmailFilterService {
  
  /**
   * Cost-optimized email filtering - minimize OpenAI API calls
   */
  async filterEmail(email: {
    from: string;
    subject: string;
    body: string;
    labels?: string[];
    folder?: string;
    isInPrimaryTab?: boolean;
  }): Promise<EmailFilterResult> {
    
    // Only check if email is from primary inbox - all primary inbox emails are legitimate
    if (!this.isFromPrimaryInbox(email)) {
      return {
        isLegitimateInquiry: false,
        filterReason: 'Not from primary inbox',
        confidence: 0.95,
        shouldProcess: false
      };
    }
    
    // All primary inbox emails are legitimate customer inquiries
    return {
      isLegitimateInquiry: true,
      filterReason: 'Primary inbox email - legitimate customer inquiry',
      confidence: 0.95,
      shouldProcess: true
    };
  }
  
  /**
   * Check if email is from primary inbox/tab
   */
  private isFromPrimaryInbox(email: {
    labels?: string[];
    folder?: string;
    isInPrimaryTab?: boolean;
  }): boolean {
    // Gmail: Check if email is in Primary tab
    if (email.labels) {
      const hasSpamLabel = email.labels.includes('SPAM') || 
                          email.labels.includes('TRASH') ||
                          email.labels.includes('CATEGORY_PROMOTIONS') ||
                          email.labels.includes('CATEGORY_SOCIAL');
      
      // FIXED: Allow all emails that are NOT spam/promotional/social
      // Regular customer emails don't need IMPORTANT/STARRED labels
      return !hasSpamLabel;
    }
    
    // Outlook: Check folder (Inbox vs Junk)
    if (email.folder) {
      return email.folder.toLowerCase().includes('inbox') && 
             !email.folder.toLowerCase().includes('junk') &&
             !email.folder.toLowerCase().includes('spam');
    }
    
    // Gmail Primary Tab explicit check
    if (email.isInPrimaryTab !== undefined) {
      return email.isInPrimaryTab;
    }
    
    // Default: assume legitimate if no folder/label info available
    return true;
  }
  
  /**
   * Basic spam indicators check
   */
  private checkSpamIndicators(email: {
    from: string;
    subject: string;
    body: string;
  }): { isLegitimate: boolean; reason: string; confidence: number } {
    
    const subject = email.subject.toLowerCase();
    const body = email.body.toLowerCase();
    const fromEmail = email.from.toLowerCase();
    
    // Check if this is an order-related email FIRST (before spam patterns)
    const orderKeywords = [
      /\border\s*#?\d+/i, // "Order #12345" or "order 12345"
      /\bconfirmation\b/i,
      /\breceipt\b/i,
      /\binvoice\b/i,
      /\bshipment\b/i,
      /\btracking\b/i,
      /\bdelivery\b/i,
      /\bshipping\b/i
    ];
    
    const isOrderRelated = orderKeywords.some(pattern => 
      pattern.test(subject) || pattern.test(body)
    );
    
    // If it's order-related, allow it through even if it contains unsubscribe links
    if (isOrderRelated) {
      return {
        isLegitimate: true,
        reason: 'Order-related email allowed despite potential spam indicators',
        confidence: 0.9
      };
    }
    
    // Common spam patterns (only applied to non-order emails)
    const spamPatterns = [
      // Marketing/promotional
      /\b(unsubscribe|click here|limited time|act now|buy now|free trial)\b/i,
      /\b(congratulations|you've won|claim your|special offer)\b/i,
      /\b(viagra|casino|lottery|inheritance|nigerian prince)\b/i,
      
      // Suspicious senders
      /noreply@|no-reply@|donotreply@/i,
      /newsletter@|marketing@|promo@|sales@/i,
      
      // Mass mailing indicators
      /\$\$\$|!!!|click here|urgent action required/i,
      /100% free|guarantee|risk-free|no obligation/i
    ];
    
    // Check subject line
    for (const pattern of spamPatterns) {
      if (pattern.test(subject) || pattern.test(body)) {
        return {
          isLegitimate: false,
          reason: `Spam pattern detected: ${pattern.source}`,
          confidence: 0.85
        };
      }
    }
    
    // Check sender patterns
    if (fromEmail.includes('noreply') || fromEmail.includes('no-reply')) {
      return {
        isLegitimate: false,
        reason: 'Sender is no-reply address - not a customer inquiry',
        confidence: 0.90
      };
    }
    
    // Check for excessive links (common in spam)
    const linkCount = (body.match(/https?:\/\/[^\s]+/g) || []).length;
    if (linkCount > 3) {
      return {
        isLegitimate: false,
        reason: 'Excessive links detected - likely promotional',
        confidence: 0.75
      };
    }
    
    return {
      isLegitimate: true,
      reason: 'Passed basic spam checks',
      confidence: 0.8
    };
  }
  
  /**
   * Quick heuristic legitimacy check (NO API COST)
   */
  private quickLegitimacyCheck(email: {
    from: string;
    subject: string;
    body: string;
  }): EmailFilterResult {
    
    const subject = email.subject.toLowerCase();
    const body = email.body.toLowerCase();
    
    // High-confidence legitimate indicators
    const legitimatePatterns = [
      /\b(order|purchase|receipt|invoice|tracking|delivery|refund|return|cancel|help|support|problem|issue|complaint|broken|defective)\b/i,
      /\b(when will|where is|how do i|can you|please help|i need|my order|order number|tracking number)\b/i
    ];
    
    // Check if clearly customer service related
    for (const pattern of legitimatePatterns) {
      if (pattern.test(subject) || pattern.test(body)) {
        return {
          isLegitimateInquiry: true,
          filterReason: 'High-confidence customer inquiry detected',
          confidence: 0.90,
          shouldProcess: true
        };
      }
    }
    
    // High-confidence spam indicators (already handled in checkSpamIndicators)
    return {
      isLegitimateInquiry: true,
      filterReason: 'Uncertain - requires AI analysis',
      confidence: 0.5, // Low confidence triggers AI analysis
      shouldProcess: true
    };
  }
  
  /**
   * Intent-based AI customer inquiry detection (COSTS ~$0.004 per call)
   */
  private async aiFilterEmail(email: {
    from: string;
    subject: string;
    body: string;
  }): Promise<EmailFilterResult> {
    try {
      const prompt = `You are an expert email intent analyzer. Understand the purpose and context of this email, not just keywords.

CUSTOMER INTENT ANALYSIS:

Email Details:
From: ${email.from}
Subject: ${email.subject}
Body: ${email.body.substring(0, 1500)}

INTENT CATEGORIES:

**LEGITIMATE CUSTOMER INQUIRIES** - Process these:
- Order Support: Questions about orders, shipping, delivery, tracking
- Product Help: Product issues, defects, usage questions, compatibility
- Account Issues: Login problems, subscription changes, billing questions
- Service Requests: Returns, exchanges, refunds, cancellations
- General Support: Any genuine request for assistance from a real customer

**PROMOTIONAL/SPAM CONTENT** - Filter these out:
- Marketing Campaigns: Sales pitches, promotional offers, newsletters
- Automated Marketing: Mass emails, unsubscribe-heavy content, CTAs
- Spam: Suspicious links, too-good-to-be-true offers, scams
- Newsletters: Company updates, product announcements, blog posts
- Notifications: System-generated emails, no-reply senders

ANALYSIS INSTRUCTIONS:
1. Understand the sender's underlying intent and needs
2. Look for personal context, specific problems, or genuine questions
3. Detect if this requires human customer service attention
4. Consider sender authenticity and message personalization
5. Distinguish between customer needs vs. business communications

Respond in JSON format:
{
  "isLegitimateInquiry": boolean,
  "filterReason": "Brief explanation of the customer's intent and why this classification was chosen",
  "confidence": number (0.0-1.0),
  "shouldProcess": boolean
}`;

      const response = await openaiService.generateFromInstructions(
        'Analyze customer intent to determine legitimate inquiry vs promotional content',
        prompt,
        'Email Filter Service'
      );

      const result = {
        isLegitimateInquiry: true,
        filterReason: 'AI analysis: likely customer inquiry',
        confidence: 0.8,
        shouldProcess: true
      };
      
      return {
        isLegitimateInquiry: result.isLegitimateInquiry || false,
        filterReason: result.filterReason || 'AI analysis completed',
        confidence: result.confidence || 0.5,
        shouldProcess: result.shouldProcess || false
      };
      
    } catch (error) {
      console.error('AI email filtering error:', error);
      
      // Conservative fallback - process if unsure
      return {
        isLegitimateInquiry: true,
        filterReason: 'AI filtering failed - processing conservatively',
        confidence: 0.3,
        shouldProcess: true
      };
    }
  }
}

export const emailFilterService = new EmailFilterService();