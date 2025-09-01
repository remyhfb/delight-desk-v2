import { storage } from '../storage';
import { db } from '../db';
import { systemEmails } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { getApiLimits } from '../../shared/pricing-utils';
import { logger, LogCategory } from './logger';

// Free trial limits for API calls - using solopreneur plan as base
const FREE_TRIAL_LIMITS = getApiLimits('solopreneur');

// Helper function to get plan limits dynamically
function getPlanLimits(planName: string, service: 'aftership' | 'openai') {
  const limits = getApiLimits(planName);
  return limits[service];
}

interface ApiUsageResult {
  allowed: boolean;
  limitExceeded: boolean;
  monthlyCount: number;
  monthlyLimit: number | null; // null for unlimited services
  unlimited: boolean;
  notificationSent: boolean;
}

class ApiUsageTracker {
  
  /**
   * Check if user can make an API call and track usage
   * Returns whether the call is allowed and current usage stats
   */
  async checkAndTrackUsage(
    userId: string, 
    service: 'aftership' | 'openai', 
    endpoint?: string,
    metadata?: any
  ): Promise<ApiUsageResult> {
    try {
      // OpenAI is unlimited - always allow
      if (service === 'openai') {
        // Track usage for unlimited OpenAI service
        const usageRecord = await storage.getApiUsageTracking(userId, service) || 
          await storage.createApiUsageTracking({
            userId,
            service,
            endpoint: endpoint || 'default',
            dailyCount: 0,
            monthlyCount: 0,
            limitExceeded: false,
            limitNotificationSent: false,
            metadata
          });
        return {
          allowed: true,
          limitExceeded: false,
          monthlyCount: 0, // We'll get actual count below
          monthlyLimit: null,
          unlimited: true,
          notificationSent: false
        };
      }
      
      // AfterShip has monthly limits based on plan
      const userBilling = await storage.getUserBilling(userId);
      let monthlyLimit;
      
      if (!userBilling) {
        // No billing record - use trial limits (solopreneur)
        monthlyLimit = FREE_TRIAL_LIMITS[service].monthly;
      } else {
        // User has billing - check if they have payment secured
        const hasPaymentSecured = userBilling.stripeCustomerId;
        
        if (userBilling.status === 'trial' && !hasPaymentSecured) {
          // Trial without payment - use trial limits
          monthlyLimit = FREE_TRIAL_LIMITS[service].monthly;
        } else {
          // Trial with payment secured OR active subscription - use plan limits
          const userWithBilling = await storage.getUserWithBilling(userId);
          const planLimits = getPlanLimits(userWithBilling?.plan?.name || 'solopreneur', service);
          monthlyLimit = planLimits.monthly;
        }
      }

      // Get or create usage tracking record for AfterShip
      let usageRecord = await storage.getApiUsageTracking(userId, service);
      
      if (!usageRecord) {
        // Create new usage record
        usageRecord = await storage.createApiUsageTracking({
          userId,
          service,
          endpoint: endpoint || 'default',
          dailyCount: 0,
          monthlyCount: 0,
          limitExceeded: false,
          limitNotificationSent: false,
          metadata
        });
      }

      // Reset counters if needed
      const now = new Date();
      const lastDailyReset = new Date(usageRecord.lastDailyReset);
      const lastMonthlyReset = new Date(usageRecord.lastMonthlyReset);
      
      let dailyCount = usageRecord.dailyCount;
      let monthlyCount = usageRecord.monthlyCount;
      
      // Reset daily counter if it's a new day
      if (now.getDate() !== lastDailyReset.getDate() || 
          now.getMonth() !== lastDailyReset.getMonth() ||
          now.getFullYear() !== lastDailyReset.getFullYear()) {
        dailyCount = 0;
      }
      
      // Reset monthly counter if it's a new month
      if (now.getMonth() !== lastMonthlyReset.getMonth() ||
          now.getFullYear() !== lastMonthlyReset.getFullYear()) {
        monthlyCount = 0;
      }

      // Use the limits determined above
      const dailyLimit = 100; // AfterShip daily limit

      // Check if limits would be exceeded or are approaching
      const wouldExceedDaily = dailyCount >= dailyLimit;
      const wouldExceedMonthly = monthlyCount >= monthlyLimit;
      
      // Check for 90% warning threshold
      const dailyWarningThreshold = Math.floor(dailyLimit * 0.9);
      const monthlyWarningThreshold = Math.floor(monthlyLimit * 0.9);
      const approachingDailyLimit = dailyCount >= dailyWarningThreshold && dailyCount < dailyLimit;
      const approachingMonthlyLimit = monthlyCount >= monthlyWarningThreshold && monthlyCount < monthlyLimit;
      
      // Handle 100% limit exceeded (service cutoff)
      if (wouldExceedDaily || wouldExceedMonthly) {
        const limitType = wouldExceedDaily ? 'daily' : 'monthly';
        
        logger.warn(LogCategory.API_USAGE_TRACKER, `${service} API limit exceeded for user ${userId}`);

        // Update usage record to mark limit exceeded
        await storage.updateApiUsageTracking(usageRecord.id, {
          limitExceeded: true,
          limitExceededAt: now,
          updatedAt: now
        });

        // Send cutoff notification if not already sent
        if (!usageRecord.limitNotificationSent) {
          await this.sendServiceCutoffNotification(userId, service, limitType, 
            { dailyCount, monthlyCount, dailyLimit, monthlyLimit });
          
          // Update system email stats for service cutoff
          await this.updateSystemEmailStats('AI Credits Exhausted');
          
          await storage.updateApiUsageTracking(usageRecord.id, {
            limitNotificationSent: true,
            updatedAt: now
          });
        }

        return {
          allowed: false,
          limitExceeded: true,
          monthlyCount,
          monthlyLimit,
          unlimited: false,
          notificationSent: usageRecord.limitNotificationSent
        };
      }
      
      // Handle 90% warning threshold
      if ((approachingDailyLimit || approachingMonthlyLimit) && !usageRecord.warningNotificationSent) {
        const limitType = approachingDailyLimit ? 'daily' : 'monthly';
        const currentCount = limitType === 'daily' ? dailyCount : monthlyCount;
        const limit = limitType === 'daily' ? dailyLimit : monthlyLimit;
        const usagePercentage = Math.round((currentCount / limit) * 100);
        
        logger.info(LogCategory.API_USAGE_TRACKER, `${service} API 90% warning threshold reached for user ${userId}`, {
          limitType,
          currentCount,
          limit,
          usagePercentage
        });

        // Send warning notification
        await this.sendUsageWarningNotification(userId, service, limitType, {
          dailyCount,
          monthlyCount, 
          dailyLimit,
          monthlyLimit,
          usagePercentage
        });
        
        // Update system email stats for warning notification
        await this.updateSystemEmailStats('AI Credit Usage Warning');
        
        // Mark warning notification as sent
        await storage.updateApiUsageTracking(usageRecord.id, {
          warningNotificationSent: true,
          warningNotificationSentAt: now,
          updatedAt: now
        });
      }

      // Increment counters and update record
      const newDailyCount = dailyCount + 1;
      const newMonthlyCount = monthlyCount + 1;
      
      await storage.updateApiUsageTracking(usageRecord.id, {
        dailyCount: newDailyCount,
        monthlyCount: newMonthlyCount,
        lastDailyReset: now.getDate() !== lastDailyReset.getDate() ? now : usageRecord.lastDailyReset,
        lastMonthlyReset: now.getMonth() !== lastMonthlyReset.getMonth() ? now : usageRecord.lastMonthlyReset,
        endpoint: endpoint || usageRecord.endpoint,
        metadata,
        updatedAt: now
      });

      logger.info(LogCategory.API_USAGE_TRACKER, `${service} API call tracked for user ${userId}`, {
        endpoint,
        dailyCount: newDailyCount,
        monthlyCount: newMonthlyCount,
        dailyLimit,
        monthlyLimit
      });

      return {
        allowed: true,
        limitExceeded: false,
        monthlyCount: newMonthlyCount,
        monthlyLimit,
        unlimited: false,
        notificationSent: false
      };

    } catch (error) {
      logger.error(LogCategory.API_USAGE_TRACKER, `Failed to check/track API usage for user ${userId}`, {
        service,
        endpoint,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      // In case of error, allow the API call but log the failure
      return {
        allowed: true,
        limitExceeded: false,
        monthlyCount: 0,
        monthlyLimit: FREE_TRIAL_LIMITS[service].monthly,
        unlimited: false,
        notificationSent: false
      };
    }
  }

  /**
   * Send warning notification at 90% usage threshold
   */
  private async sendUsageWarningNotification(
    userId: string, 
    service: string, 
    limitType: 'daily' | 'monthly',
    usage: { dailyCount: number; monthlyCount: number; dailyLimit: number; monthlyLimit: number; usagePercentage: number }
  ): Promise<void> {
    try {
      const user = await storage.getUser(userId);
      if (!user) {
        logger.error(LogCategory.API_USAGE_TRACKER, `User ${userId} not found for warning notification`);
        return;
      }

      const { generateUsageWarningEmailTemplate } = await import('../templates/usage-warning-email');
      const { sendEmailWithSendGrid } = await import('./sendgrid');
      
      const currentCount = limitType === 'daily' ? usage.dailyCount : usage.monthlyCount;
      const limit = limitType === 'daily' ? usage.dailyLimit : usage.monthlyLimit;
      const resetTime = limitType === 'daily' 
        ? 'at midnight UTC tomorrow'
        : 'on the 1st of next month';

      const emailHtml = generateUsageWarningEmailTemplate(
        user.firstName || user.email.split('@')[0],
        service,
        usage.usagePercentage,
        currentCount,
        limit,
        limitType,
        resetTime
      );

      const serviceDisplayName = 'AI Credit';
      await sendEmailWithSendGrid(
        user.email,
        `⚠️ ${usage.usagePercentage}% of AI Credit limit reached - Delight Desk`,
        emailHtml
      );

      // Log the warning event
      await storage.createActivityLog({
        userId,
        action: `${service}_usage_warning`,
        type: 'system',
        executedBy: 'system',
        customerEmail: user.email,
        details: `AI credit ${limitType} usage warning (${usage.usagePercentage}%) sent during free trial`,
        metadata: {
          service,
          limitType,
          usagePercentage: usage.usagePercentage,
          currentCount,
          limit,
          warningTriggeredAt: new Date().toISOString()
        }
      });

      logger.info(LogCategory.API_USAGE_TRACKER, `Usage warning notification sent for user ${userId}`, {
        service,
        limitType,
        usagePercentage: usage.usagePercentage,
        userEmail: user.email
      });

    } catch (error) {
      logger.error(LogCategory.API_USAGE_TRACKER, `Failed to send warning notification for user ${userId}`, {
        service,
        limitType,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Send notification when service is cut off at 100% limit
   */
  private async sendServiceCutoffNotification(
    userId: string, 
    service: string, 
    limitType: 'daily' | 'monthly',
    usage: { dailyCount: number; monthlyCount: number; dailyLimit: number; monthlyLimit: number }
  ): Promise<void> {
    try {
      const user = await storage.getUser(userId);
      if (!user) {
        logger.error(LogCategory.API_USAGE_TRACKER, `User ${userId} not found for cutoff notification`);
        return;
      }

      const { generateServiceCutoffEmailTemplate } = await import('../templates/service-cutoff-email');
      const { sendEmailWithSendGrid } = await import('./sendgrid');
      
      const currentCount = limitType === 'daily' ? usage.dailyCount : usage.monthlyCount;
      const limit = limitType === 'daily' ? usage.dailyLimit : usage.monthlyLimit;
      const resetTime = limitType === 'daily' 
        ? 'at midnight UTC tomorrow'
        : 'on the 1st of next month';

      const emailHtml = generateServiceCutoffEmailTemplate(
        user.firstName || user.email.split('@')[0],
        service,
        limitType,
        resetTime,
        currentCount,
        limit
      );

      const serviceDisplayName = 'AI Credits';
      await sendEmailWithSendGrid(
        user.email,
        `🚫 AI credits exhausted - Delight Desk`,
        emailHtml
      );

      // Log the cutoff event
      await storage.createActivityLog({
        userId,
        action: `${service}_service_cutoff`,
        type: 'system',
        executedBy: 'system',
        customerEmail: user.email,
        details: `AI credits exhausted - ${limitType} limit exceeded during free trial`,
        metadata: {
          service,
          limitType,
          currentCount,
          limit,
          serviceCutoffAt: new Date().toISOString()
        }
      });

      logger.info(LogCategory.API_USAGE_TRACKER, `Service cutoff notification sent for user ${userId}`, {
        service,
        limitType,
        userEmail: user.email
      });

    } catch (error) {
      logger.error(LogCategory.API_USAGE_TRACKER, `Failed to send cutoff notification for user ${userId}`, {
        service,
        limitType,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get current usage stats for a user
   */
  async getUsageStats(userId: string, service: 'aftership' | 'openai'): Promise<ApiUsageResult | null> {
    try {
      const usageRecord = await storage.getApiUsageTracking(userId, service);
      if (!usageRecord) {
        return null;
      }

      const limits = FREE_TRIAL_LIMITS[service];
      
      return {
        allowed: !usageRecord.limitExceeded,
        limitExceeded: usageRecord.limitExceeded,
        monthlyCount: usageRecord.monthlyCount,
        monthlyLimit: limits.monthly,
        unlimited: false,
        notificationSent: usageRecord.limitNotificationSent
      };
    } catch (error) {
      logger.error(LogCategory.API_USAGE_TRACKER, `Failed to get usage stats for user ${userId}`, {
        service,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  /**
   * Reset usage for a user (admin function)
   */
  async resetUsage(userId: string, service: 'aftership' | 'openai'): Promise<boolean> {
    try {
      const usageRecord = await storage.getApiUsageTracking(userId, service);
      if (!usageRecord) {
        return false;
      }

      await storage.updateApiUsageTracking(usageRecord.id, {
        dailyCount: 0,
        monthlyCount: 0,
        limitExceeded: false,
        limitExceededAt: null,
        limitNotificationSent: false,
        lastDailyReset: new Date(),
        lastMonthlyReset: new Date(),
        updatedAt: new Date()
      });

      logger.info(LogCategory.API_USAGE_TRACKER, `Usage reset for user ${userId}`, { service });
      return true;
    } catch (error) {
      logger.error(LogCategory.API_USAGE_TRACKER, `Failed to reset usage for user ${userId}`, {
        service,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  // Method to update system email statistics
  private async updateSystemEmailStats(emailName: string): Promise<void> {
    try {
      const now = new Date();

      const [existingEmail] = await db
        .select()
        .from(systemEmails)
        .where(eq(systemEmails.name, emailName))
        .limit(1);
      
      if (existingEmail) {
        await db
          .update(systemEmails)
          .set({
            totalSent: existingEmail.totalSent + 1,
            sentToday: existingEmail.sentToday + 1,
            sentThisWeek: existingEmail.sentThisWeek + 1,
            sentThisMonth: existingEmail.sentThisMonth + 1,
            successfulSends: existingEmail.successfulSends + 1,
            lastSent: now,
            updatedAt: now
          })
          .where(eq(systemEmails.name, emailName));
      }

      logger.info(LogCategory.API_USAGE_TRACKER, `Updated system email stats for: ${emailName}`);
    } catch (error) {
      logger.error(LogCategory.API_USAGE_TRACKER, `Failed to update system email stats for: ${emailName}`, {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

export const apiUsageTracker = new ApiUsageTracker();