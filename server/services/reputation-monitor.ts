import { logger } from './logger';
import { storage } from '../storage';

interface BlockedEmailAttempt {
  timestamp: Date;
  recipientEmail: string;
  service: string;
  reason: string;
  subject?: string;
  userId?: string;
}

interface ReputationStats {
  blockedToday: number;
  blockedThisWeek: number;
  blockedThisMonth: number;
  totalBlocked: number;
  lastBlockedAt: Date | null;
  commonPatterns: { pattern: string; count: number }[];
}

export class ReputationMonitorService {
  private static instance: ReputationMonitorService;
  
  public static getInstance(): ReputationMonitorService {
    if (!ReputationMonitorService.instance) {
      ReputationMonitorService.instance = new ReputationMonitorService();
    }
    return ReputationMonitorService.instance;
  }

  /**
   * Log a blocked email attempt for reputation protection
   */
  async logBlockedEmail(
    recipientEmail: string,
    service: string,
    reason: string,
    subject?: string,
    userId?: string
  ): Promise<void> {
    try {
      // Log to system logs for admin visibility
      await logger.log('warn', 'EmailReputation', `BLOCKED: ${service} email to ${recipientEmail}`, userId, undefined, {
        recipientEmail,
        service,
        reason,
        subject,
        category: 'reputation_protection',
        timestamp: new Date().toISOString()
      });

      // Also log to console for immediate visibility
      console.warn(`[REPUTATION PROTECTION] Blocked ${service} email to ${recipientEmail} - ${reason}`);
      
    } catch (error) {
      console.error('Failed to log blocked email attempt:', error);
    }
  }

  /**
   * Get reputation protection statistics
   */
  async getReputationStats(): Promise<ReputationStats> {
    try {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(todayStart.getTime() - (7 * 24 * 60 * 60 * 1000));
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      // Get blocked email logs from system logs
      const logs = await logger.getLogs({
        category: 'EmailReputation',
        limit: 1000
      });

      const blockedLogs = logs.filter(log => 
        log.message.includes('BLOCKED:') && 
        log.metadata?.category === 'reputation_protection'
      );

      const blockedToday = blockedLogs.filter(log => 
        new Date(log.timestamp) >= todayStart
      ).length;

      const blockedThisWeek = blockedLogs.filter(log => 
        new Date(log.timestamp) >= weekStart
      ).length;

      const blockedThisMonth = blockedLogs.filter(log => 
        new Date(log.timestamp) >= monthStart
      ).length;

      const totalBlocked = blockedLogs.length;

      const lastBlockedLog = blockedLogs.length > 0 ? blockedLogs[0] : null;
      const lastBlockedAt = lastBlockedLog ? new Date(lastBlockedLog.timestamp) : null;

      // Analyze common patterns
      const patternCounts = new Map<string, number>();
      
      blockedLogs.forEach(log => {
        const email = log.metadata?.recipientEmail || '';
        if (email.includes('test')) patternCounts.set('test emails', (patternCounts.get('test emails') || 0) + 1);
        if (email.includes('demo')) patternCounts.set('demo emails', (patternCounts.get('demo emails') || 0) + 1);
        if (email.includes('example.com')) patternCounts.set('example.com', (patternCounts.get('example.com') || 0) + 1);
        if (email.includes('+test')) patternCounts.set('test aliases', (patternCounts.get('test aliases') || 0) + 1);
        if (/user\d+/.test(email)) patternCounts.set('numbered users', (patternCounts.get('numbered users') || 0) + 1);
      });

      const commonPatterns = Array.from(patternCounts.entries())
        .map(([pattern, count]) => ({ pattern, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      return {
        blockedToday,
        blockedThisWeek,
        blockedThisMonth,
        totalBlocked,
        lastBlockedAt,
        commonPatterns
      };

    } catch (error) {
      console.error('Failed to get reputation stats:', error);
      return {
        blockedToday: 0,
        blockedThisWeek: 0,
        blockedThisMonth: 0,
        totalBlocked: 0,
        lastBlockedAt: null,
        commonPatterns: []
      };
    }
  }

  /**
   * Get recent blocked email attempts for admin review
   */
  async getRecentBlockedEmails(limit: number = 50): Promise<BlockedEmailAttempt[]> {
    try {
      const logs = await logger.getLogs({
        category: 'EmailReputation',
        limit
      });

      return logs
        .filter(log => 
          log.message.includes('BLOCKED:') && 
          log.metadata?.category === 'reputation_protection'
        )
        .map(log => ({
          timestamp: new Date(log.timestamp),
          recipientEmail: log.metadata?.recipientEmail || 'unknown',
          service: log.metadata?.service || 'unknown',
          reason: log.metadata?.reason || 'unknown',
          subject: log.metadata?.subject,
          userId: log.userId || undefined
        }));

    } catch (error) {
      console.error('Failed to get recent blocked emails:', error);
      return [];
    }
  }
}

export const reputationMonitor = ReputationMonitorService.getInstance();