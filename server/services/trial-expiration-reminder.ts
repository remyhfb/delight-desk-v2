import fs from 'fs';
import path from 'path';
import sgMail from '@sendgrid/mail';
import { storage } from '../storage';
import { logger, LogCategory } from './logger';



interface TrialExpirationReminderService {
  sendTrialExpirationReminder(userId: string): Promise<boolean>;
  checkAndSendReminders(): Promise<void>;
  startScheduler(): void;
}

interface UserTrialStatus {
  userId: string;
  email: string;
  firstName: string;
  registeredAt: Date;
  trialEndsAt: Date | null;
  trialDaysRemaining: number;
  needsReminder: boolean;
}

class TrialExpirationReminderServiceImpl implements TrialExpirationReminderService {
  private intervalId: NodeJS.Timeout | null = null;
  private readonly intervalHours = 6; // Check every 6 hours

  constructor() {
    if (!process.env.SENDGRID_API_KEY) {
      logger.warn(LogCategory.TRIAL_REMINDER, 'SendGrid API key not configured');
    } else {
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    }
  }

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

  async sendTrialExpirationReminder(userId: string): Promise<boolean> {
    try {
      logger.info(LogCategory.TRIAL_REMINDER, `Sending trial expiration reminder for user ${userId}`);

      // Get user details
      const user = await storage.getUser(userId);
      if (!user) {
        logger.error(LogCategory.TRIAL_REMINDER, `User ${userId} not found`);
        return false;
      }

      // CRITICAL: Validate email before sending to protect sender reputation
      if (!this.isValidEmailForProduction(user.email)) {
        logger.warn(LogCategory.TRIAL_REMINDER, `Blocked trial reminder send to protect sender reputation - userId: ${userId}, email: ${user.email}, reason: Invalid/test email pattern detected`);
        return false;
      }

      // Get user billing to determine trial status
      const billing = await storage.getUserBilling(userId);
      if (!billing || !billing.trialEndsAt) {
        logger.error(LogCategory.TRIAL_REMINDER, `No trial billing found for user ${userId}`);
        return false;
      }

      // Calculate days remaining
      const now = new Date();
      const trialEnd = new Date(billing.trialEndsAt);
      const daysRemaining = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (daysRemaining <= 0) {
        logger.info(LogCategory.TRIAL_REMINDER, `Trial already expired for user ${userId}`);
        return false;
      }

      // Choose email template based on days remaining
      let templatePath: string;
      let subject: string;
      
      if (daysRemaining === 1) {
        // Day 6 (1 day left) - Urgent email
        templatePath = path.join(process.cwd(), 'server/templates/trial-day-six-urgency-email.html');
        subject = '⚠️ URGENT: Your trial expires tomorrow - Don\'t lose access!';
      } else {
        // Regular trial expiration email for other days
        templatePath = path.join(process.cwd(), 'server/templates/trial-expiration-email.html');
        subject = `⏰ ${daysRemaining} days left in your free trial - Choose your plan`;
      }
      
      let htmlContent = fs.readFileSync(templatePath, 'utf8');

      // Replace placeholders with proper capitalization
      const capitalizedFirstName = user.firstName ? 
        user.firstName.charAt(0).toUpperCase() + user.firstName.slice(1).toLowerCase() : null;
      const greeting = capitalizedFirstName ? `Hi ${capitalizedFirstName},` : 'Hi there,';
      const baseUrl = process.env.NODE_ENV === 'production' 
        ? 'https://delightdesk.io' 
        : 'http://localhost:5000';

      // Generate unsubscribe token and URL
      const { unsubscribeService } = await import('./unsubscribe');
      const unsubscribeToken = await unsubscribeService.generateUnsubscribeToken(userId, user.email);
      const unsubscribeUrl = await unsubscribeService.generateUnsubscribeUrl(user.email, 'trial');
      
      // Replace template variables
      htmlContent = htmlContent.replace(/{{greeting}}/g, greeting);
      htmlContent = htmlContent.replace(/{{firstName}}/g, capitalizedFirstName || '');
      htmlContent = htmlContent.replace(/{{trialDaysRemaining}}/g, daysRemaining.toString());
      htmlContent = htmlContent.replace(/{{planSelectionUrl}}/g, `${baseUrl}/subscribe`);
      htmlContent = htmlContent.replace(/{{dashboardUrl}}/g, `${baseUrl}/dashboard`);
      htmlContent = htmlContent.replace(/{{supportUrl}}/g, `${baseUrl}/help`);
      htmlContent = htmlContent.replace(/{{unsubscribeUrl}}/g, unsubscribeUrl);
      htmlContent = htmlContent.replace(/{{preferencesUrl}}/g, `${baseUrl}/preferences?email=${encodeURIComponent(user.email)}`);

      // Send email
      const msg = {
        to: user.email,
        from: { 
          email: 'remy@delightdesk.io', 
          name: 'Remy at Delight Desk' 
        },
        subject: subject,
        html: htmlContent,
      };

      const response = await sgMail.send(msg);
      
      logger.info(LogCategory.TRIAL_REMINDER, 'Trial expiration reminder sent successfully', {
        userId,
        userEmail: user.email,
        daysRemaining,
        messageId: response[0]?.headers?.['x-message-id'],
        statusCode: response[0]?.statusCode
      });

      // Log the reminder activity
      await storage.createActivityLog({
        userId,
        action: 'trial_expiration_reminder',
        type: 'system',
        executedBy: 'system',
        customerEmail: user.email,
        details: `Trial expiration reminder sent - ${daysRemaining} days remaining`,
        metadata: {
          daysRemaining,
          trialEndsAt: billing.trialEndsAt,
          emailSent: true,
          messageId: response[0]?.headers?.['x-message-id']
        }
      });

      return true;
    } catch (error) {
      logger.error(LogCategory.TRIAL_REMINDER, `Failed to send trial expiration reminder for user ${userId}`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      
      // Log the failed attempt
      try {
        const failedUser = await storage.getUser(userId);
        await storage.createActivityLog({
          userId,
          action: 'trial_expiration_reminder_failed',
          type: 'system',
          executedBy: 'system',
          customerEmail: failedUser?.email || 'unknown',
          details: 'Failed to send trial expiration reminder',
          metadata: {
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        });
      } catch (logError) {
        logger.error(LogCategory.TRIAL_REMINDER, 'Failed to log failed reminder attempt', { logError });
      }

      return false;
    }
  }

  async checkAndSendReminders(): Promise<void> {
    try {
      logger.info(LogCategory.TRIAL_REMINDER, 'Checking for users needing trial expiration reminders');

      // Get all users with active trials - we'll need to query through billing records
      const allBilling = await storage.getAllUserBilling();
      const eligibleUsers: UserTrialStatus[] = [];

      for (const billing of allBilling) {
        try {
          if (!billing || billing.status !== 'trial' || !billing.trialEndsAt) {
            continue;
          }

          // Get user information
          const user = await storage.getUser(billing.userId);
          if (!user) {
            continue;
          }

          const now = new Date();
          const trialEnd = billing.trialEndsAt ? new Date(billing.trialEndsAt) : null;
          const registrationDate = user.createdAt ? new Date(user.createdAt) : new Date();
          
          if (!trialEnd) {
            continue;
          }
          
          // Calculate days remaining and days since registration
          const daysRemaining = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          const daysSinceRegistration = Math.floor((now.getTime() - registrationDate.getTime()) / (1000 * 60 * 60 * 24));

          // Send reminder if:
          // 1. Trial is still active (daysRemaining > 0)
          // 2. User has exactly 1 day left (day 6 urgent email)
          // 3. Haven't sent a trial expiration reminder yet
          
          if (daysRemaining === 1) {
            // Check if we've already sent a trial expiration reminder
            const activityLogs = await storage.getActivityLogs(user.id);
            const hasReceivedTrialReminder = activityLogs.some(log => 
              log.action === 'trial_expiration_reminder' || 
              log.action === 'trial_expiration_reminder_failed'
            );

            if (!hasReceivedTrialReminder) {
              eligibleUsers.push({
                userId: user.id,
                email: user.email,
                firstName: user.firstName || '',
                registeredAt: registrationDate,
                trialEndsAt: trialEnd,
                trialDaysRemaining: daysRemaining,
                needsReminder: true
              });
            }
          }
        } catch (error) {
          logger.error(LogCategory.TRIAL_REMINDER, `Failed to check trial status for user ${billing.userId}`, {
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      logger.info(LogCategory.TRIAL_REMINDER, `Found users needing trial expiration reminders`, {
        count: eligibleUsers.length,
        userIds: eligibleUsers.map(u => u.userId)
      });

      if (eligibleUsers.length === 0) {
        logger.info(LogCategory.TRIAL_REMINDER, 'No users need trial expiration reminders at this time');
        return;
      }

      // Send reminders with rate limiting (1 per second)
      let successCount = 0;
      let failureCount = 0;

      for (const user of eligibleUsers) {
        try {
          const success = await this.sendTrialExpirationReminder(user.userId);
          if (success) {
            successCount++;
          } else {
            failureCount++;
          }
          
          // Rate limiting - wait 1 second between emails
          if (eligibleUsers.indexOf(user) < eligibleUsers.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } catch (error) {
          failureCount++;
          logger.error(LogCategory.TRIAL_REMINDER, `Failed to send trial expiration reminder`, {
            userId: user.userId,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      logger.info(LogCategory.TRIAL_REMINDER, 'Trial expiration reminder processing completed', {
        totalProcessed: eligibleUsers.length,
        successful: successCount,
        failed: failureCount
      });

    } catch (error) {
      logger.error(LogCategory.TRIAL_REMINDER, 'Failed to check and send trial expiration reminders', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  }

  startScheduler(): void {
    if (this.intervalId) {
      logger.warn(LogCategory.TRIAL_REMINDER, 'Scheduler already running');
      return;
    }

    const intervalMs = this.intervalHours * 60 * 60 * 1000;
    
    // Run initial check
    this.checkAndSendReminders();
    
    // Schedule recurring checks
    this.intervalId = setInterval(() => {
      this.checkAndSendReminders();
    }, intervalMs);

    const nextCheckTime = new Date(Date.now() + intervalMs);
    
    logger.info(LogCategory.TRIAL_REMINDER, 'Trial expiration reminder scheduler started', {
      intervalHours: this.intervalHours,
      nextCheckIn: nextCheckTime.toISOString()
    });
  }

  stopScheduler(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info(LogCategory.TRIAL_REMINDER, 'Trial expiration reminder scheduler stopped');
    }
  }
}

export const trialExpirationReminderService = new TrialExpirationReminderServiceImpl();