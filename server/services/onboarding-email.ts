import { storage } from '../storage';
// SendGrid service removed in OAuth-first architecture migration
import { logger, LogCategory } from './logger';

// SendGrid service instantiation removed - using OAuth-first email routing

export class OnboardingEmailService {
  
  private isValidEmailForProduction(email: string): boolean {
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

  // Send onboarding emails to a new user
  async sendOnboardingEmails(userId: string, userEmail: string): Promise<void> {
    try {
      // CRITICAL: Validate email before sending to protect sender reputation
      if (!this.isValidEmailForProduction(userEmail)) {
        const { reputationMonitor } = await import('./reputation-monitor');
        await reputationMonitor.logBlockedEmail(
          userEmail,
          'OnboardingEmail',
          'Invalid/test email pattern detected',
          'Onboarding email sequence',
          userId
        );
        return;
      }

      // Get all active onboarding emails
      const emails = await storage.getOnboardingEmails();
      const activeEmails = emails.filter(email => email.isActive);
      
      if (activeEmails.length === 0) {
        logger.info(LogCategory.EMAIL, 'No active onboarding emails found', { userId });
        return;
      }

      // Schedule emails based on delay
      for (const email of activeEmails) {
        setTimeout(async () => {
          try {
            const { sendGridService } = await import('./sendgrid');
            const success = await sendGridService.sendEmailWithTemplate({
              to: userEmail,
              subject: email.subject,
              htmlContent: email.htmlContent || `<p>${email.name}</p><p>${email.subject}</p>`,
            });

            if (success) {
              // Record that the email was sent - simplified for now
              // await storage.createOnboardingEmailSent({
              //   userId: userId,
              //   emailId: email.id,
              // });

              logger.info(LogCategory.EMAIL, 'Onboarding email sent successfully', {
                userId,
                emailId: email.id,
                subject: email.subject,
                delayHours: email.delayHours
              });
            } else {
              logger.error(LogCategory.EMAIL, 'Failed to send onboarding email', {
                userId,
                emailId: email.id,
                subject: email.subject
              });
            }
          } catch (error) {
            logger.error(LogCategory.EMAIL, 'Error sending onboarding email', {
              userId,
              emailId: email.id,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        }, email.delayHours * 60 * 60 * 1000); // Convert hours to milliseconds
      }

      logger.info(LogCategory.EMAIL, 'Onboarding email sequence initiated', {
        userId,
        userEmail,
        emailCount: activeEmails.length
      });

    } catch (error) {
      logger.error(LogCategory.EMAIL, 'Failed to initialize onboarding emails', {
        userId,
        userEmail,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Test sending a specific onboarding email (for admin testing)
  async sendTestOnboardingEmail(emailId: string, testRecipient: string): Promise<boolean> {
    try {
      const emails = await storage.getOnboardingEmails();
      const email = emails.find(e => e.id === emailId);
      
      if (!email) {
        logger.error(LogCategory.EMAIL, 'Test email not found', { emailId });
        return false;
      }

      const { sendGridService } = await import('./sendgrid');
      const success = await sendGridService.sendEmailWithTemplate({
        to: testRecipient,
        subject: `[TEST] ${email.subject}`,
        htmlContent: email.htmlContent || `<p>Test email: ${email.name}</p><p>${email.subject}</p>`,
      });

      logger.info(LogCategory.EMAIL, 'Test onboarding email sent', {
        emailId,
        testRecipient,
        success
      });

      return success;
    } catch (error) {
      logger.error(LogCategory.EMAIL, 'Failed to send test onboarding email', {
        emailId,
        testRecipient,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  // Get onboarding email statistics for a user
  async getUserOnboardingStats(userId: string): Promise<{
    totalEmails: number;
    sentEmails: number;
    remainingEmails: number;
  }> {
    try {
      const allEmails = await storage.getOnboardingEmails();
      const activeEmails = allEmails.filter(email => email.isActive);
      const sentEmails = []; // Simplified for now: await storage.getOnboardingEmailSents(userId);

      return {
        totalEmails: activeEmails.length,
        sentEmails: sentEmails.length,
        remainingEmails: activeEmails.length - sentEmails.length,
      };
    } catch (error) {
      logger.error(LogCategory.EMAIL, 'Failed to get user onboarding stats', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return { totalEmails: 0, sentEmails: 0, remainingEmails: 0 };
    }
  }
}

export const onboardingEmailService = new OnboardingEmailService();