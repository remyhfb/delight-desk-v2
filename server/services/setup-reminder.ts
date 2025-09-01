import { logger } from './logger';
import { sendGridService } from './sendgrid';
import { storage } from '../storage';
import { sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

interface UserSetupStatus {
  userId: string;
  email: string;
  firstName?: string;
  registeredAt: Date;
  hasEmailConnection: boolean;
  hasStoreConnection: boolean;
  hasAITraining: boolean;
  hasActiveAutomations: boolean;
  isSetupComplete: boolean;
  remindersSent: number;
}

export class SetupReminderService {
  private static instance: SetupReminderService;
  
  public static getInstance(): SetupReminderService {
    if (!SetupReminderService.instance) {
      SetupReminderService.instance = new SetupReminderService();
    }
    return SetupReminderService.instance;
  }

  async checkUserSetupStatus(userId: string): Promise<UserSetupStatus | null> {
    try {
      const user = await storage.getUserById(userId);
      if (!user) return null;

      // Check email connections
      const emailAccounts = await storage.getEmailAccounts(userId);
      const hasEmailConnection = emailAccounts.length > 0;

      // Check store connections
      const storeConnections = await storage.getStoreConnections(userId);
      const hasStoreConnection = storeConnections.some(conn => conn.isActive);

      // Check AI training (check if user has uploaded any training data)
      const trainingConfigs = await storage.getAITrainingConfigs(userId);
      const hasAITraining = trainingConfigs.length > 0;

      // Check active automations
      const automationRules = await storage.getAutoResponderRules(userId);
      const hasActiveAutomations = automationRules.some(rule => rule.isActive);

      // Setup is complete if user has email + store + (AI training OR automations)
      const isSetupComplete = hasEmailConnection && hasStoreConnection && (hasAITraining || hasActiveAutomations);

      return {
        userId: user.id,
        email: user.email,
        firstName: user.firstName || undefined,
        registeredAt: user.createdAt || new Date(),
        hasEmailConnection,
        hasStoreConnection,
        hasAITraining,
        hasActiveAutomations,
        isSetupComplete,
        remindersSent: 0 // Will be tracked separately
      };
    } catch (error) {
      logger.error('SetupReminder', 'Failed to check user setup status', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  async getUsersNeedingReminders(): Promise<UserSetupStatus[]> {
    try {
      // Get all active users registered more than 2 days ago
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

      // Get all users (we'll filter in memory for now, can optimize with SQL later)
      const allUsers = await storage.getAllUsers();
      const eligibleUsers = allUsers.filter(user => {
        const registeredAt = user.createdAt || new Date();
        return registeredAt <= twoDaysAgo && user.isActive;
      });

      logger.info('SetupReminder', 'Checking eligible users for reminders', {
        totalUsers: allUsers.length,
        eligibleUsers: eligibleUsers.length,
        cutoffDate: twoDaysAgo.toISOString()
      });

      const usersNeedingReminders: UserSetupStatus[] = [];

      for (const user of eligibleUsers) {
        const setupStatus = await this.checkUserSetupStatus(user.id);
        if (setupStatus && !setupStatus.isSetupComplete) {
          // Check if we've already sent reminders (track in activity logs)
          const reminderCount = await this.getReminderCount(user.id);
          
          // Send max 2 reminders: one at 2 days, another at 7 days
          if (reminderCount < 2) {
            const daysSinceRegistration = Math.floor(
              (new Date().getTime() - setupStatus.registeredAt.getTime()) / (1000 * 60 * 60 * 24)
            );
            
            // Send first reminder at 2+ days, second at 7+ days
            if ((reminderCount === 0 && daysSinceRegistration >= 2) ||
                (reminderCount === 1 && daysSinceRegistration >= 7)) {
              setupStatus.remindersSent = reminderCount;
              usersNeedingReminders.push(setupStatus);
            }
          }
        }
      }

      logger.info('SetupReminder', 'Found users needing setup reminders', {
        count: usersNeedingReminders.length,
        userIds: usersNeedingReminders.map(u => u.userId)
      });

      return usersNeedingReminders;
    } catch (error) {
      logger.error('SetupReminder', 'Failed to get users needing reminders', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return [];
    }
  }

  private async getReminderCount(userId: string): Promise<number> {
    try {
      const logs = await storage.getActivityLogs(userId);
      return logs.filter(log => 
        log.action === 'setup_reminder_sent' && 
        log.metadata?.type === 'setup_reminder'
      ).length;
    } catch (error) {
      logger.error('SETUPREMINDER', 'Failed to get reminder count', { userId, error });
      return 0;
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

  async sendSetupReminder(userStatus: UserSetupStatus): Promise<boolean> {
    try {
      // CRITICAL: Validate email before sending to protect sender reputation
      if (!this.isValidEmailForProduction(userStatus.email)) {
        logger.warn('SetupReminder', 'Blocked email send to protect sender reputation', {
          userId: userStatus.userId,
          email: userStatus.email,
          reason: 'Invalid/test email pattern detected'
        });
        return false;
      }

      const reminderType = userStatus.remindersSent === 0 ? 'first' : 'final';
      
      // Read the setup reminder template
      const templatePath = path.join(process.cwd(), 'server/templates/setup-reminder-email.html');
      let htmlContent = fs.readFileSync(templatePath, 'utf8');
      
      // Personalize the email
      if (userStatus.firstName) {
        htmlContent = htmlContent.replace('{{firstName}}', userStatus.firstName);
        htmlContent = htmlContent.replace('{{greeting}}', `Hi ${userStatus.firstName},`);
      } else {
        htmlContent = htmlContent.replace('{{firstName}}', '');
        htmlContent = htmlContent.replace('{{greeting}}', 'Hi there,');
      }

      // Customize content based on what's missing
      let missingSteps: string[] = [];
      if (!userStatus.hasEmailConnection) missingSteps.push('Connect your email account');
      if (!userStatus.hasStoreConnection) missingSteps.push('Connect your store');
      if (!userStatus.hasAITraining && !userStatus.hasActiveAutomations) {
        missingSteps.push('Train your AI or enable automations');
      }

      htmlContent = htmlContent.replace('{{missingSteps}}', missingSteps.join(', '));
      htmlContent = htmlContent.replace('{{reminderType}}', reminderType);

      // Generate unsubscribe URLs - CRITICAL: Marketing emails must have working unsubscribe links
      const { unsubscribeService } = await import('./unsubscribe');
      const unsubscribeToken = await unsubscribeService.generateUnsubscribeToken(userStatus.userId, userStatus.email);
      const unsubscribeUrl = await unsubscribeService.generateUnsubscribeUrl(userStatus.email, 'marketing');
      
      const baseUrl = process.env.NODE_ENV === 'production' 
        ? 'https://delightdesk.io' 
        : 'http://localhost:5000';
      
      // Replace unsubscribe URLs in template
      htmlContent = htmlContent.replace(/{{unsubscribeUrl}}/g, unsubscribeUrl);
      htmlContent = htmlContent.replace(/{{preferencesUrl}}/g, `${baseUrl}/preferences?email=${encodeURIComponent(userStatus.email)}`);

      // Send the email
      const subject = reminderType === 'first' 
        ? 'Complete your Delight Desk setup in 5 minutes' 
        : 'Final reminder: Your AI customer service is waiting';

      const success = await sendGridService.sendEmail(
        userStatus.email,
        subject,
        htmlContent,
        'remy@delightdesk.io',
        'Remy at Delight Desk'
      );

      if (success) {
        // Log the reminder
        await storage.createActivityLog({
          userId: userStatus.userId,
          type: 'system_notification',
          action: 'setup_reminder_sent',
          details: `Setup reminder ${reminderType} sent`,
          executedBy: 'ai',
          customerEmail: userStatus.email,
          status: 'completed',
          metadata: {
            type: 'setup_reminder',
            reminderNumber: userStatus.remindersSent + 1,
            missingSteps,
            isSetupComplete: userStatus.isSetupComplete
          }
        });

        logger.info('SETUPREMINDER', 'Setup reminder sent successfully', {
          userId: userStatus.userId,
          email: userStatus.email,
          reminderType,
          missingSteps
        });
      }

      return success;
    } catch (error) {
      logger.error('SetupReminder', 'Failed to send setup reminder', {
        userId: userStatus.userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  async processSetupReminders(): Promise<void> {
    try {
      logger.info('SetupReminder', 'Starting setup reminder processing');

      const usersNeedingReminders = await this.getUsersNeedingReminders();
      
      if (usersNeedingReminders.length === 0) {
        logger.info('SetupReminder', 'No users need setup reminders at this time');
        return;
      }

      let successCount = 0;
      let failureCount = 0;

      for (const userStatus of usersNeedingReminders) {
        const success = await this.sendSetupReminder(userStatus);
        if (success) {
          successCount++;
        } else {
          failureCount++;
        }
        
        // Small delay between emails to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      logger.info('SetupReminder', 'Setup reminder processing completed', {
        totalProcessed: usersNeedingReminders.length,
        successful: successCount,
        failed: failureCount
      });
    } catch (error) {
      logger.error('SetupReminder', 'Setup reminder processing failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  startScheduler(): void {
    // REDUCED FREQUENCY: Run every 24 hours instead of 6 hours to prevent spam
    const REMINDER_CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

    setInterval(async () => {
      await this.processSetupReminders();
    }, REMINDER_CHECK_INTERVAL);

    // Don't run immediately on startup in development to avoid restart spam
    if (process.env.NODE_ENV === 'development') {
      // In development, don't run on startup to prevent restart spam
      logger.info('SETUPREMINDER', 'Development mode: skipping immediate startup check to prevent restart spam');
    } else {
      // In production, run after 5 minutes
      setTimeout(async () => {
        await this.processSetupReminders();
      }, 5 * 60 * 1000); // 5 minute delay after startup
    }

    logger.info('SetupReminder', 'Setup reminder scheduler started', {
      intervalHours: 24,
      nextCheckIn: new Date(Date.now() + REMINDER_CHECK_INTERVAL).toISOString()
    });
  }
}

export const setupReminderService = SetupReminderService.getInstance();