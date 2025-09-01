import sgMail from '@sendgrid/mail';
import { logger, LogCategory } from './logger';
import { storage } from '../storage';

class SendGridService {
  private initialized = false;

  constructor() {
    this.initialize();
  }

  private initialize() {
    if (!process.env.SENDGRID_API_KEY) {
      logger.warn(LogCategory.EMAIL, 'SENDGRID_API_KEY not configured - email sending disabled');
      return;
    }

    try {
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
      this.initialized = true;
      logger.info(LogCategory.EMAIL, 'SendGrid service initialized successfully');
    } catch (error) {
      logger.error(LogCategory.EMAIL, 'Failed to initialize SendGrid service', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async sendEmailDisconnectionAlert(
    to: string,
    provider: string,
    userFirstName?: string,
    userId?: string
  ): Promise<boolean> {
    try {
      const providerDisplayName = provider === 'gmail' ? 'Gmail' : provider === 'outlook' ? 'Outlook' : provider;
      
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>⚠️ Email Account Disconnected - Action Required</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #dc2626; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">⚠️ Email Account Disconnected</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px;">Immediate Action Required</p>
          </div>
          
          <div style="background: #f8f8f8; padding: 30px; border-radius: 0 0 8px 8px; border: 2px solid #dc2626; border-top: none;">
            <p><strong>Hi ${userFirstName || 'there'},</strong></p>
            
            <p><strong style="color: #dc2626;">Your ${providerDisplayName} account has been disconnected from Delight Desk, and email processing has stopped.</strong></p>
            
            <div style="background: #fef2f2; padding: 15px; border-left: 4px solid #dc2626; margin: 20px 0;">
              <p style="margin: 0; font-weight: bold;">⚠️ This means:</p>
              <ul style="margin: 10px 0 0 0; padding-left: 20px;">
                <li>New customer emails are <strong>not being processed</strong></li>
                <li>AI responses are <strong>not being generated</strong></li>
                <li>You may be <strong>missing important customer inquiries</strong></li>
              </ul>
            </div>
            
            <h3 style="color: #dc2626;">Why did this happen?</h3>
            <ul>
              <li><strong>Token expired:</strong> ${providerDisplayName} requires periodic re-authorization</li>
              <li><strong>Account changes:</strong> Password changes or security settings updates</li>
              <li><strong>Permissions revoked:</strong> Access was manually revoked in ${providerDisplayName} settings</li>
            </ul>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="https://delightdesk.io" style="background: #059669; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">🔗 Reconnect ${providerDisplayName} Now</a>
            </div>
            
            <h3>How to fix this:</h3>
            <ol>
              <li>Log into your Delight Desk account</li>
              <li>Go to <strong>Email Integration</strong> settings</li>
              <li>Click <strong>"Connect ${providerDisplayName}"</strong></li>
              <li>Complete the OAuth authorization process</li>
            </ol>
            
            <div style="background: #e0f2fe; padding: 15px; border-left: 4px solid #0369a1; margin: 20px 0;">
              <p style="margin: 0;"><strong>💡 Tip:</strong> Once reconnected, all future emails will be processed automatically. You may want to check your ${providerDisplayName} inbox for any emails that arrived while disconnected.</p>
            </div>
            
            <p style="margin-top: 30px;">Need help? Reply to this email or contact us at <a href="mailto:support@delightdesk.io">support@delightdesk.io</a></p>
            
            <p style="margin-top: 20px; color: #666; font-size: 14px;">Best regards,<br>The Delight Desk Team</p>
          </div>
          
          <div style="text-align: center; margin-top: 20px; color: #666; font-size: 12px;">
            <p>This is a critical system alert. You received this because your email processing has stopped.</p>
          </div>
        </body>
        </html>
      `;
      
      return await this.sendEmail(
        to,
        `⚠️ URGENT: ${providerDisplayName} Disconnected - Email Processing Stopped`,
        htmlContent,
        'alerts@delightdesk.io',
        'Delight Desk Alerts',
        'email_disconnection_alert',
        userId
      );
    } catch (error) {
      logger.error(LogCategory.EMAIL, 'Failed to send email disconnection alert', {
        to,
        provider,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  async sendWelcomeEmail(
    to: string,
    firstName?: string,
    userId?: string
  ): Promise<boolean> {
    const fs = require('fs');
    const path = require('path');
    
    try {
      // Read the welcome email template
      const templatePath = path.join(__dirname, '../templates/welcome-email.html');
      let htmlContent = fs.readFileSync(templatePath, 'utf8');
      
      // Personalize with first name if provided
      if (firstName) {
        htmlContent = htmlContent.replace('Welcome to Delight Desk!', `Welcome to Delight Desk, ${firstName}!`);
      }
      
      return await this.sendEmail(
        to,
        'Welcome to Delight Desk - Get started in 3 simple steps',
        htmlContent,
        'remy@delightdesk.io',
        'Remy at Delight Desk',
        'welcome',
        userId
      );
    } catch (error) {
      logger.error(LogCategory.EMAIL, 'Failed to send welcome email', {
        to,
        firstName,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  private isValidEmailForProduction(email: string): boolean {
    // Allow delightdesk.io domain emails for admin testing
    if (email.endsWith('@delightdesk.io')) {
      return true;
    }
    
    // Block test/demo/invalid email patterns that damage sender reputation
    const blockedPatterns = [
      /^test/i,
      /^demo/i,
      /example\.com$/i,
      /test\.com$/i,
      /\.test$/i,
      /user\d+/i,
      /demo_/i,
      /\+test/i,
      /noreply/i,
      /donotreply/i
    ];
    
    return !blockedPatterns.some(pattern => pattern.test(email));
  }

  async sendEmail(
    to: string,
    subject: string,
    htmlContent: string,
    fromEmail: string = 'remy@delightdesk.io',
    fromName: string = 'Remy at Delight Desk',
    emailType: string = 'system_notification',
    userId?: string
  ): Promise<boolean> {
    if (!this.initialized) {
      logger.error(LogCategory.EMAIL, 'SendGrid service not initialized');
      return false;
    }

    // CRITICAL: Validate email before sending to protect sender reputation
    if (!this.isValidEmailForProduction(to)) {
      const { reputationMonitor } = await import('./reputation-monitor');
      await reputationMonitor.logBlockedEmail(
        to,
        'SendGrid',
        'Invalid/test email pattern detected',
        subject
      );
      return false;
    }

    try {
      const msg = {
        to,
        from: {
          email: fromEmail,
          name: fromName,
        },
        replyTo: {
          email: fromEmail,
          name: fromName,
        },
        subject,
        html: htmlContent,
      };

      const response = await sgMail.send(msg);
      const messageId = response[0]?.headers?.['x-message-id'] || 'unknown';
      
      // Log to database
      try {
        await storage.createSendgridEmailLog({
          userId: userId || null,
          messageId,
          fromEmail,
          fromName,
          toEmail: to,
          subject,
          htmlContent,
          emailType,
          status: 'sent',
          sendgridResponse: {
            statusCode: response[0]?.statusCode,
            headers: response[0]?.headers,
            body: response[0]?.body
          }
        });
      } catch (dbError) {
        logger.error(LogCategory.EMAIL, 'Failed to log email to database', {
          messageId,
          error: dbError instanceof Error ? dbError.message : 'Unknown error'
        });
      }
      
      logger.info(LogCategory.EMAIL, 'Email sent successfully', {
        to,
        subject,
        fromEmail,
        messageId,
        statusCode: response[0]?.statusCode || 'unknown',
      });
      
      return true;
    } catch (error) {
      // Log failed email to database
      try {
        await storage.createSendgridEmailLog({
          userId: userId || null,
          messageId: null,
          fromEmail,
          fromName,
          toEmail: to,
          subject,
          htmlContent,
          emailType,
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          sendgridResponse: null
        });
      } catch (dbError) {
        logger.error(LogCategory.EMAIL, 'Failed to log failed email to database', {
          error: dbError instanceof Error ? dbError.message : 'Unknown error'
        });
      }
      
      logger.error(LogCategory.EMAIL, 'Failed to send email', {
        to,
        subject,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorDetails: error instanceof Error ? JSON.stringify(error) : 'No details',
      });
      
      return false;
    }
  }

  async sendEmailWithTemplate(config: {
    to: string;
    subject: string;
    templateId?: string;
    templateData?: Record<string, any>;
    htmlContent?: string;
    fromEmail?: string;
    fromName?: string;
  }): Promise<boolean> {
    if (!this.initialized) {
      logger.error(LogCategory.EMAIL, 'SendGrid service not initialized');
      return false;
    }

    try {
      const fromEmail = config.fromEmail || 'remy@delightdesk.io';
      const fromName = config.fromName || 'Remy at Delight Desk';
      
      const msg: any = {
        to: config.to,
        from: {
          email: fromEmail,
          name: fromName,
        },
        replyTo: {
          email: fromEmail,
          name: fromName,
        },
        subject: config.subject,
      };

      if (config.templateId && config.templateData) {
        msg.templateId = config.templateId;
        msg.dynamicTemplateData = config.templateData;
      } else if (config.htmlContent) {
        msg.html = config.htmlContent;
      } else {
        throw new Error('Either templateId with templateData or htmlContent must be provided');
      }

      await sgMail.send(msg);
      
      logger.info(LogCategory.EMAIL, 'Template email sent successfully', {
        to: config.to,
        subject: config.subject,
        templateId: config.templateId,
      });
      
      return true;
    } catch (error) {
      logger.error(LogCategory.EMAIL, 'Failed to send template email', {
        to: config.to,
        subject: config.subject,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      return false;
    }
  }

  async sendWismoEmbedCode(
    to: string,
    fromEmail: string = 'team@delightdesk.io',
    fromName: string = 'Delight Desk Team'
  ): Promise<boolean> {
    const embedCode = `<iframe src="https://delightdesk.io/widget" width="100%" height="350" frameborder="0" style="border: none; border-radius: 8px; max-width: 100%; min-height: 350px;" loading="lazy" title="Order Tracking Widget"></iframe>`;
    
    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>WISMO Widget Embed Code</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #1f2937; margin: 0; font-size: 24px; font-weight: 600;">WISMO Widget Embed Code</h1>
      </div>
      
      <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
        <p style="margin: 0 0 15px 0; color: #4b5563;">Hi there,</p>
        <p style="margin: 0 0 15px 0; color: #4b5563;">Here's the embed code for the WISMO (Where Is My Order) widget. This self-service widget allows your customers to track their orders without contacting support.</p>
      </div>

      <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 25px;">
        <h3 style="color: #1f2937; margin: 0 0 15px 0; font-size: 16px;">Embed Code:</h3>
        <div style="background: #f3f4f6; padding: 15px; border-radius: 6px; font-family: 'Monaco', 'Consolas', monospace; font-size: 12px; line-height: 1.4; overflow-x: auto; word-break: break-all;">
${embedCode}
        </div>
      </div>

      <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; margin-bottom: 25px;">
        <h4 style="color: #1e40af; margin: 0 0 10px 0; font-size: 14px;">Key Benefits:</h4>
        <ul style="margin: 0; padding-left: 20px; color: #1e40af; font-size: 14px;">
          <li>Reduces "where is my order" support tickets by 70%</li>
          <li>Provides instant order status to customers</li>
          <li>Works 24/7 without human intervention</li>
          <li>Improves customer experience with self-service</li>
        </ul>
      </div>

      <div style="text-align: center; padding: 20px 0; border-top: 1px solid #e5e7eb;">
        <p style="color: #6b7280; font-size: 14px; margin: 0;">
          Need help? Contact us at <a href="mailto:support@delightdesk.io" style="color: #3b82f6; text-decoration: none;">support@delightdesk.io</a>
        </p>
      </div>
    </body>
    </html>`;

    const textContent = `WISMO Widget Embed Code

Hi there,

Here's the embed code for the WISMO (Where Is My Order) widget. This self-service widget allows your customers to track their orders without contacting support.

Embed Code:
${embedCode}

Key Benefits:
• Reduces "where is my order" support tickets by 70%
• Provides instant order status to customers  
• Works 24/7 without human intervention
• Improves customer experience with self-service

Need help? Contact us at support@delightdesk.io

Best regards,
Delight Desk Team`;

    return await this.sendEmail(
      to,
      'WISMO Widget - Embed Code for Your Website',
      htmlContent,
      fromEmail,
      fromName,
      'wismo_embed'
    );
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}

export { SendGridService };

export const sendGridService = new SendGridService();

// Convenience function for API usage tracker
export const sendEmailWithSendGrid = async (
  to: string,
  subject: string,
  htmlContent: string,
  fromEmail: string = 'remy@delightdesk.io',
  fromName: string = 'Remy at Delight Desk',
  emailType: string = 'system_notification',
  userId?: string
): Promise<boolean> => {
  return await sendGridService.sendEmail(to, subject, htmlContent, fromEmail, fromName, emailType, userId);
};