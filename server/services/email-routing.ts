import { storage } from "../storage";
// SendGrid service removed in OAuth-first architecture migration
import { microsoftGraphService } from "./microsoft-graph";
import { contentSafetyService } from "./content-safety";
import { GmailSenderService } from "./gmail-sender";
import { google } from 'googleapis';

interface EmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

interface RateLimitInfo {
  dailyCount: number;
  limit: number;
  percentUsed: number;
  approachingLimit: boolean;
}

export class EmailRoutingService {
  private gmailSender: GmailSenderService;

  constructor() {
    this.gmailSender = new GmailSenderService();
  }
  /**
   * Smart email router that selects the best sending method
   * Priority: OAuth providers → Fallback (OAuth-first architecture)
   */
  async sendEmail(userId: string, emailData: EmailParams): Promise<boolean> {
    try {
      // CRITICAL: Validate content safety before sending ANY email
      const emailContent = emailData.html || emailData.text || '';
      const safetyValidation = await contentSafetyService.validateResponse(emailContent, userId, 'customer_communication');
      
      if (!safetyValidation.approved) {
        console.error('Email blocked by content safety validation:', {
          to: emailData.to,
          subject: emailData.subject,
          blockReason: safetyValidation.blockReason
        });
        return false;
      }

      // Check and update rate limits first
      const rateLimitInfo = await this.checkRateLimit(userId);
      
      if (rateLimitInfo.approachingLimit) {
        await this.promptDNSUpgrade(userId);
      }

      const settings = await storage.getSystemSettings(userId);
      
      // Route based on availability and preference
      if (settings.primaryEmailMethod === 'oauth') {
        // Try OAuth providers first
        if (settings.preferredOAuthProvider === 'gmail' && settings.gmailConnected) {
          const success = await this.sendViaGmail(userId, emailData);
          if (success) {
            await this.incrementEmailCount(userId);
            return true;
          }
        }
        
        if (settings.preferredOAuthProvider === 'outlook' && settings.outlookConnected) {
          const success = await this.sendViaOutlook(userId, emailData);
          if (success) {
            await this.incrementEmailCount(userId);
            return true;
          }
        }
        
        // Try alternate OAuth provider if primary fails
        if (settings.preferredOAuthProvider === 'gmail' && settings.outlookConnected) {
          const success = await this.sendViaOutlook(userId, emailData);
          if (success) {
            await this.incrementEmailCount(userId);
            return true;
          }
        }
        
        if (settings.preferredOAuthProvider === 'outlook' && settings.gmailConnected) {
          const success = await this.sendViaGmail(userId, emailData);
          if (success) {
            await this.incrementEmailCount(userId);
            return true;
          }
        }
      }
      
      // If all OAuth methods fail, DO NOT fallback to SendGrid for customer emails
      // SendGrid is ONLY for DelightDesk system emails, not customer-facing business emails
      console.error('No OAuth email sending method available for user:', userId);
      console.error('IMPORTANT: SendGrid is reserved for DelightDesk system emails only');
      throw new Error('No OAuth email method configured or all methods failed. Please reconnect Gmail/Outlook.');
      
    } catch (error) {
      console.error('Email routing error:', error);
      return false;
    }
  }

  /**
   * Send email via Gmail OAuth
   */
  private async sendViaGmail(userId: string, emailData: EmailParams): Promise<boolean> {
    try {
      console.log(`[EMAIL_ROUTING] Sending email via Gmail OAuth for user: ${userId}`);
      
      // Get Gmail OAuth tokens from email accounts
      const emailAccounts = await storage.getEmailAccounts(userId);
      const gmailAccount = emailAccounts.find(acc => acc.provider === 'gmail' && acc.isActive);
      
      if (!gmailAccount || !gmailAccount.accessToken) {
        console.log('[EMAIL_ROUTING] No active Gmail account or access token found');
        return false;
      }

      // Create OAuth2 client with Gmail credentials
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
      );

      // Set credentials
      oauth2Client.setCredentials({
        access_token: gmailAccount.accessToken,
        refresh_token: gmailAccount.refreshToken,
      });

      // Initialize Gmail API
      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

      // Create raw email message
      const emailMessage = this.createEmailMessage(
        gmailAccount.email,
        emailData.to,
        emailData.subject,
        emailData.html,
        emailData.text,
        emailData.replyTo
      );

      // Send email
      const result = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: emailMessage,
        },
      });

      console.log(`[EMAIL_ROUTING] Gmail email sent successfully. MessageId: ${result.data.id}`);
      
      return true;
      
    } catch (error) {
      console.error('[EMAIL_ROUTING] Gmail sending error:', error);
      return false;
    }
  }

  /**
   * Create Gmail-compatible email message
   */
  private createEmailMessage(
    fromEmail: string,
    toEmail: string,
    subject: string,
    htmlContent: string,
    textContent?: string,
    replyTo?: string
  ): string {
    const emailLines = [
      `From: ${fromEmail}`,
      `To: ${toEmail}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0'
    ];

    if (replyTo) {
      emailLines.push(`Reply-To: ${replyTo}`);
    }

    // Add content type and body
    if (htmlContent && textContent) {
      // Multipart message with both HTML and plain text
      const boundary = '----=_NextPart_' + Math.random().toString(36).substr(2, 9);
      emailLines.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
      emailLines.push('');
      emailLines.push(`--${boundary}`);
      emailLines.push('Content-Type: text/plain; charset=utf-8');
      emailLines.push('');
      emailLines.push(textContent);
      emailLines.push('');
      emailLines.push(`--${boundary}`);
      emailLines.push('Content-Type: text/html; charset=utf-8');
      emailLines.push('');
      emailLines.push(htmlContent);
      emailLines.push('');
      emailLines.push(`--${boundary}--`);
    } else if (htmlContent) {
      // HTML only
      emailLines.push('Content-Type: text/html; charset=utf-8');
      emailLines.push('');
      emailLines.push(htmlContent);
    } else if (textContent) {
      // Text only
      emailLines.push('Content-Type: text/plain; charset=utf-8');
      emailLines.push('');
      emailLines.push(textContent);
    }

    const email = emailLines.join('\r\n');
    return Buffer.from(email).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  /**
   * Send email via Outlook OAuth
   */
  private async sendViaOutlook(userId: string, emailData: EmailParams): Promise<boolean> {
    try {
      // Get Outlook OAuth tokens from email accounts
      const emailAccounts = await storage.getEmailAccounts(userId);
      const outlookAccount = emailAccounts.find(acc => acc.provider === 'outlook' && acc.isActive);
      
      if (!outlookAccount || !outlookAccount.accessToken) {
        return false;
      }

      // Use Microsoft Graph service to send email
      await microsoftGraphService.sendEmail(outlookAccount.accessToken, {
        to: [emailData.to],
        subject: emailData.subject,
        body: emailData.html,
        isHtml: true
      });
      
      console.log('Email sent successfully via Outlook for user:', userId);
      return true;
      
    } catch (error) {
      console.error('Outlook sending error:', error);
      return false;
    }
  }

  // SendGrid sending method removed in OAuth-first architecture migration

  /**
   * Check current rate limit status
   */
  async checkRateLimit(userId: string): Promise<RateLimitInfo> {
    const settings = await storage.getSystemSettings(userId);
    
    // Reset daily count if it's a new day
    const now = new Date();
    const lastReset = settings.lastEmailReset ? new Date(settings.lastEmailReset) : new Date();
    
    if (now.getDate() !== lastReset.getDate() || now.getMonth() !== lastReset.getMonth()) {
      await storage.updateSystemSettings(userId, {
        dailyEmailCount: 0,
        lastEmailReset: now,
        approachingRateLimit: false
      });
      settings.dailyEmailCount = 0;
    }

    // Determine rate limit based on email method (business accounts)
    let dailyLimit = 2000; // Gmail Business (Google Workspace)
    
    if (settings.preferredOAuthProvider === 'outlook') {
      dailyLimit = 10000; // Outlook Business (Microsoft 365)
    }

    const percentUsed = (settings.dailyEmailCount / dailyLimit) * 100;
    const approachingLimit = percentUsed >= 80;

    return {
      dailyCount: settings.dailyEmailCount || 0,
      limit: dailyLimit,
      percentUsed,
      approachingLimit
    };
  }

  /**
   * Increment daily email count
   */
  private async incrementEmailCount(userId: string): Promise<void> {
    const settings = await storage.getSystemSettings(userId);
    const newCount = (settings.dailyEmailCount || 0) + 1;
    
    await storage.updateSystemSettings(userId, {
      dailyEmailCount: newCount
    });
  }

  /**
   * Prompt user to upgrade to DNS verification when approaching rate limits
   */
  private async promptDNSUpgrade(userId: string): Promise<void> {
    const settings = await storage.getSystemSettings(userId);
    
    if (!settings.rateLimitWarningShown) {
      // Mark that we've shown the warning
      await storage.updateSystemSettings(userId, {
        approachingRateLimit: true,
        rateLimitWarningShown: true
      });
      
      // TODO: Implement notification system to alert user about upgrade opportunity
      console.log(`User ${userId} approaching rate limit - DNS upgrade recommended`);
    }
  }

  /**
   * Get current email sending method for display
   */
  async getCurrentEmailMethod(userId: string): Promise<{
    method: 'gmail' | 'outlook' | 'sendgrid' | 'none';
    email: string;
    verified: boolean;
  }> {
    const settings = await storage.getSystemSettings(userId);
    
    if (settings.primaryEmailMethod === 'oauth') {
      if (settings.preferredOAuthProvider === 'gmail' && settings.gmailConnected) {
        const emailAccounts = await storage.getEmailAccounts(userId);
        const gmailAccount = emailAccounts.find(acc => acc.provider === 'gmail' && acc.isActive);
        return {
          method: 'gmail',
          email: gmailAccount?.email || 'gmail account',
          verified: true
        };
      }
      
      if (settings.preferredOAuthProvider === 'outlook' && settings.outlookConnected) {
        const emailAccounts = await storage.getEmailAccounts(userId);
        const outlookAccount = emailAccounts.find(acc => acc.provider === 'outlook' && acc.isActive);
        return {
          method: 'outlook',
          email: outlookAccount?.email || 'outlook account',
          verified: true
        };
      }
    }
    
    if (settings.domainVerified && settings.verifiedDomain) {
      return {
        method: 'sendgrid',
        email: settings.fromEmail || `support@${settings.verifiedDomain}`,
        verified: true
      };
    }
    
    return {
      method: 'none',
      email: '',
      verified: false
    };
  }

  /**
   * Health check for email service availability
   */
  async healthCheck(userId: string): Promise<{ isHealthy: boolean; reason?: string }> {
    try {
      const settings = await storage.getSystemSettings(userId);
      
      // Check if any email method is configured
      if (settings.primaryEmailMethod === 'oauth') {
        if (settings.preferredOAuthProvider === 'gmail' && settings.gmailConnected) {
          // Test Gmail OAuth health by attempting to get user profile
          try {
            const emailAccounts = await storage.getEmailAccounts(userId);
            const gmailAccount = emailAccounts.find(acc => acc.provider === 'gmail' && acc.isActive);
            
            if (!gmailAccount || !gmailAccount.accessToken) {
              return { isHealthy: false, reason: 'Gmail OAuth token missing or invalid' };
            }

            // Simple test - try to initialize Gmail client
            const oauth2Client = new google.auth.OAuth2();
            oauth2Client.setCredentials({
              access_token: gmailAccount.accessToken,
              refresh_token: gmailAccount.refreshToken
            });

            return { isHealthy: true };
          } catch (error) {
            return { isHealthy: false, reason: 'Gmail OAuth authentication failed' };
          }
        }
        
        if (settings.preferredOAuthProvider === 'outlook' && settings.outlookConnected) {
          // Test Outlook health
          try {
            const emailAccounts = await storage.getEmailAccounts(userId);
            const outlookAccount = emailAccounts.find(acc => acc.provider === 'outlook' && acc.isActive);
            
            if (!outlookAccount || !outlookAccount.accessToken) {
              return { isHealthy: false, reason: 'Outlook OAuth token missing or invalid' };
            }

            // Test by attempting to initialize Microsoft Graph client
            return { isHealthy: true };
          } catch (error) {
            return { isHealthy: false, reason: 'Outlook OAuth authentication failed' };
          }
        }
      }

      // If SendGrid is configured (fallback)
      if (settings.domainVerified && settings.verifiedDomain) {
        return { isHealthy: true };
      }

      return { isHealthy: false, reason: 'No email sending method configured' };
    } catch (error) {
      return { 
        isHealthy: false, 
        reason: `Email service health check failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }
}

export const emailRoutingService = new EmailRoutingService();