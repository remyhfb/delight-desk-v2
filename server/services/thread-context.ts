import { db } from '../db';
import { emails } from '../../shared/schema';
import { eq, and, or } from 'drizzle-orm';

interface EmailInThread {
  id: string;
  fromEmail: string;
  toEmail: string;
  subject: string;
  body: string;
  classification?: string;
  confidence?: number;
  threadPosition: number;
  isThreadStart: boolean;
  createdAt: Date;
  isResponse?: boolean; // Whether this is a response email vs customer email
}

interface ThreadContext {
  threadId: string;
  emails: EmailInThread[];
  totalEmails: number;
  customerEmail: string;
  businessEmail: string;
  conversationSummary: string;
}

export class ThreadContextService {
  /**
   * Get the full thread context for an email
   * This includes all emails in the conversation thread, properly ordered
   */
  static async getThreadContext(emailId: string): Promise<ThreadContext | null> {
    try {
      // First, get the current email to find its thread
      const currentEmail = await db
        .select()
        .from(emails)
        .where(eq(emails.id, emailId))
        .limit(1);

      if (!currentEmail.length) {
        return null;
      }

      const email = currentEmail[0];
      
      // If no thread ID, create one based on subject and participants
      let threadId = email.threadId;
      if (!threadId) {
        threadId = await this.generateThreadId(email);
        
        // Update the email with the thread ID
        await db
          .update(emails)
          .set({ 
            threadId,
            isThreadStart: true,
            threadPosition: 1
          })
          .where(eq(emails.id, emailId));
      }

      // Get all emails in this thread, ordered by creation date
      const threadEmails = await db
        .select()
        .from(emails)
        .where(eq(emails.threadId, threadId))
        .orderBy(emails.createdAt);

      // Convert to thread format
      const emailsInThread: EmailInThread[] = threadEmails.map((e, index) => ({
        id: e.id,
        fromEmail: e.fromEmail,
        toEmail: e.toEmail,
        subject: e.subject,
        body: e.body,
        classification: e.classification || undefined,
        confidence: e.confidence || undefined,
        threadPosition: e.threadPosition || index + 1,
        isThreadStart: e.isThreadStart || false,
        createdAt: e.createdAt || new Date(),
        isResponse: this.isResponseEmail(e.fromEmail, threadEmails[0].fromEmail)
      }));

      // Determine customer and business emails
      const firstEmail = emailsInThread[0];
      const customerEmail = firstEmail.fromEmail;
      const businessEmail = firstEmail.toEmail;

      // Generate conversation summary
      const conversationSummary = this.generateConversationSummary(emailsInThread);

      return {
        threadId,
        emails: emailsInThread,
        totalEmails: emailsInThread.length,
        customerEmail,
        businessEmail,
        conversationSummary
      };

    } catch (error) {
      console.error('Error getting thread context:', error);
      return null;
    }
  }

  /**
   * Generate a formatted thread context for AI consumption
   */
  static async getAIThreadContext(emailId: string): Promise<string> {
    const threadContext = await this.getThreadContext(emailId);
    
    if (!threadContext || threadContext.emails.length <= 1) {
      // Single email - just return the email content
      const email = threadContext?.emails[0];
      if (!email) return '';
      
      return `Customer Email: ${email.body}`;
    }

    // Multi-email thread - provide full context
    let context = `CONVERSATION THREAD (${threadContext.totalEmails} emails)\n`;
    context += `Customer: ${threadContext.customerEmail}\n`;
    context += `Business: ${threadContext.businessEmail}\n\n`;
    context += `CONVERSATION SUMMARY:\n${threadContext.conversationSummary}\n\n`;
    context += `FULL CONVERSATION HISTORY:\n\n`;

    // Add each email in chronological order
    threadContext.emails.forEach((email, index) => {
      const sender = email.isResponse ? 'BUSINESS' : 'CUSTOMER';
      const timestamp = email.createdAt.toLocaleDateString();
      
      context += `[${index + 1}] ${sender} (${timestamp}):\n`;
      context += `Subject: ${email.subject}\n`;
      context += `Message: ${email.body}\n`;
      
      if (email.classification && email.confidence) {
        context += `AI Classification: ${email.classification} (${email.confidence}% confidence)\n`;
      }
      
      context += `\n---\n\n`;
    });

    context += `CONTEXT FOR AI RESPONSE:\n`;
    context += `- This is an ongoing conversation with ${threadContext.totalEmails} exchanges\n`;
    context += `- Latest message from customer requires response\n`;
    context += `- Consider the full conversation history when crafting response\n`;
    context += `- Reference previous exchanges if relevant\n`;

    return context;
  }

  /**
   * Link a new email to an existing thread or create a new thread
   */
  static async linkEmailToThread(
    newEmailId: string, 
    subject: string, 
    fromEmail: string, 
    toEmail: string
  ): Promise<void> {
    try {
      // Look for existing thread based on subject and participants
      const cleanSubject = this.cleanSubjectForThreading(subject);
      
      // Search for existing emails with similar subject and same participants
      const existingThreads = await db
        .select()
        .from(emails)
        .where(
          and(
            or(
              and(eq(emails.fromEmail, fromEmail), eq(emails.toEmail, toEmail)),
              and(eq(emails.fromEmail, toEmail), eq(emails.toEmail, fromEmail))
            )
          )
        )
        .orderBy(emails.createdAt);

      let threadId: string | null = null;
      let threadPosition = 1;

      // Check if any existing email has a similar subject
      for (const existingEmail of existingThreads) {
        const existingCleanSubject = this.cleanSubjectForThreading(existingEmail.subject);
        
        if (this.subjectsMatch(cleanSubject, existingCleanSubject)) {
          threadId = existingEmail.threadId;
          break;
        }
      }

      // If found a matching thread, get the next position
      if (threadId) {
        const threadEmails = await db
          .select()
          .from(emails)
          .where(eq(emails.threadId, threadId));
        
        threadPosition = threadEmails.length + 1;
      } else {
        // Create new thread ID
        threadId = await this.generateThreadId({ subject, fromEmail, toEmail });
      }

      // Update the email with thread information
      await db
        .update(emails)
        .set({
          threadId,
          threadPosition,
          isThreadStart: threadPosition === 1
        })
        .where(eq(emails.id, newEmailId));

    } catch (error) {
      console.error('Error linking email to thread:', error);
    }
  }

  /**
   * Generate a thread ID based on email characteristics
   */
  private static async generateThreadId(email: any): Promise<string> {
    const participants = [email.fromEmail, email.toEmail].sort().join('|');
    const subjectHash = this.cleanSubjectForThreading(email.subject);
    const timestamp = Date.now();
    
    return `thread_${Buffer.from(participants + '|' + subjectHash).toString('base64').substring(0, 16)}_${timestamp}`;
  }

  /**
   * Clean subject line for thread matching
   */
  private static cleanSubjectForThreading(subject: string): string {
    return subject
      .toLowerCase()
      .replace(/^(re:|fwd:|fw:)\s*/gi, '') // Remove reply/forward prefixes
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  /**
   * Check if two subjects match for threading purposes
   */
  private static subjectsMatch(subject1: string, subject2: string): boolean {
    // Exact match after cleaning
    if (subject1 === subject2) return true;
    
    // Check if one contains the other (for truncated subjects)
    if (subject1.length > 10 && subject2.length > 10) {
      return subject1.includes(subject2) || subject2.includes(subject1);
    }
    
    return false;
  }

  /**
   * Determine if an email is a response (from business) vs customer email
   */
  private static isResponseEmail(fromEmail: string, originalFromEmail: string): boolean {
    // If the from email is different from the original sender, it's likely a response
    return fromEmail !== originalFromEmail;
  }

  /**
   * Generate a conversation summary for AI context
   */
  private static generateConversationSummary(emails: EmailInThread[]): string {
    if (emails.length <= 1) {
      return 'Single email conversation';
    }

    const customerEmails = emails.filter(e => !e.isResponse);
    const responseEmails = emails.filter(e => e.isResponse);

    let summary = `Conversation with ${customerEmails.length} customer messages and ${responseEmails.length} business responses. `;
    
    // Add classification context if available
    const classifications = emails
      .map(e => e.classification)
      .filter(c => c)
      .filter((c, i, arr) => arr.indexOf(c) === i); // unique

    if (classifications.length > 0) {
      summary += `Topics discussed: ${classifications.join(', ')}. `;
    }

    // Determine conversation pattern
    if (emails.length > 3) {
      summary += 'Extended conversation with multiple exchanges.';
    } else {
      summary += 'Brief exchange.';
    }

    return summary;
  }
}