import { format } from 'date-fns';
import { SendGridService } from './sendgrid';
import { IStorage } from '../storage';
import { logger, LogCategory } from './logger';

interface WeeklyMetrics {
  emailsProcessed: number;
  automationsTriggered: number;
  timeSavedMinutes: number;
  estimatedCostSavings: number;
  averageResponseTime: number;
  topAutomationType: string;
  industryBenchmarkRank: number;
  customerSatisfactionScore: number;
  milestonesAchieved: string[];
  comparisonToPrevious: {
    emailsGrowth: number;
    automationsGrowth: number;
    timeSavedGrowth: number;
    costSavingsGrowth: number;
  };
  weekStart?: Date;
  weekEnd?: Date;
}

interface ViralContent {
  shareableMetrics: {
    title: string;
    subtitle: string;
    primaryMetric: string;
    secondaryMetric: string;
    backgroundColor: string;
  };
  socialMediaPosts: {
    twitter: string;
    linkedin: string;
  };
  referralMessage: string;
  challengeMessage: string;
}

export class WeeklyReportService {
  constructor(
    private emailService: SendGridService,
    private storage: IStorage
  ) {}

  async generateTestReport(userId: string, adminEmail: string): Promise<void> {
    logger.info(LogCategory.EMAIL, 'Generating test weekly report', {
      userId,
      adminEmail
    });

    try {
      const user = await this.storage.getUserById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - 7);
      const weekEnd = new Date();

      const metrics = await this.calculateWeeklyMetrics(userId, weekStart, weekEnd);
      const viralContent = this.generateViralContent(metrics);

      await this.sendWeeklyReportEmail(adminEmail, { ...metrics, weekStart, weekEnd }, viralContent);

      logger.info(LogCategory.EMAIL, 'Test weekly report generated and sent to admin', {
        userId,
        userEmail: user.email,
        adminEmail,
        timeSavedMinutes: metrics.timeSavedMinutes,
        costSavings: Math.round(metrics.estimatedCostSavings / 100)
      });
    } catch (error) {
      logger.error(LogCategory.EMAIL, 'Failed to send test weekly report', {
        userId,
        adminEmail,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
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

  async scheduleWeeklyReports(): Promise<void> {
    logger.info(LogCategory.EMAIL, 'Starting weekly report generation for all users');
    
    try {
      const users = await this.storage.getAllUsers ? await this.storage.getAllUsers() : [];
      const eligibleUsers = users.filter((user: any) => user.weeklyReportsEnabled);
      
      logger.info(LogCategory.EMAIL, `Found ${eligibleUsers.length} users with weekly reports enabled`);
      
      const weekEnd = new Date();
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - 7);
      
      // Get the current week identifier (e.g., "2025-W32")
      const currentWeek = this.getWeekIdentifier(weekEnd);
      
      for (const user of eligibleUsers) {
        try {
          // CRITICAL: Validate email before sending to protect sender reputation
          if (!this.isValidEmailForProduction(user.email)) {
            const { reputationMonitor } = await import('./reputation-monitor');
            await reputationMonitor.logBlockedEmail(
              user.email,
              'WeeklyReport',
              'Invalid/test email pattern detected',
              'Weekly automation report',
              user.id
            );
            continue;
          }

          // Check if we already sent a report this week
          if (user.lastWeeklyReportSent === currentWeek) {
            logger.info(LogCategory.EMAIL, 'Weekly report already sent this week - skipping', {
              userId: user.id,
              userEmail: user.email,
              currentWeek,
              lastSent: user.lastWeeklyReportSent
            });
            continue;
          }
          
          const metrics = await this.calculateWeeklyMetrics(user.id, weekStart, weekEnd);
          const viralContent = this.generateViralContent(metrics);
          
          await this.sendWeeklyReportEmail(user.email, { ...metrics, weekStart, weekEnd }, viralContent);
          
          // Update the user's last weekly report sent timestamp
          await this.storage.updateUserProfile(user.id, { lastWeeklyReportSent: currentWeek });
          
          logger.info(LogCategory.EMAIL, 'Weekly report sent successfully', {
            userId: user.id,
            userEmail: user.email
          });
        } catch (error) {
          logger.error(LogCategory.EMAIL, 'Failed to send weekly report for user', {
            userId: user.id,
            userEmail: user.email,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
      
      logger.info(LogCategory.EMAIL, 'Weekly report generation completed');
    } catch (error) {
      logger.error(LogCategory.EMAIL, 'Failed to generate weekly reports', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  private getWeekIdentifier(date: Date): string {
    const year = date.getFullYear();
    const startOfYear = new Date(year, 0, 1);
    const days = Math.floor((date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
    const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);
    return `${year}-W${weekNumber.toString().padStart(2, '0')}`;
  }

  private async calculateWeeklyMetrics(userId: string, weekStart: Date, weekEnd: Date): Promise<WeeklyMetrics> {
    // Get real metrics from database
    const emails = await this.storage.getEmailsInDateRange ? await this.storage.getEmailsInDateRange(userId, weekStart, weekEnd) : [];
    
    const emailsProcessed = emails.length;
    const automationsTriggered = emails.filter((email: any) => email.automationTriggered).length;
    
    // Calculate time saved based on automation types using industry standards
    let timeSavedMinutes = 0;
    const automationTypeCounts = {
      'order_status': 0,
      'promo_refund': 0, 
      'return_request': 0,
      'shipping_info': 0,
      'general_inquiry': 0
    };

    emails.forEach((email: any) => {
      if (email.automationTriggered && email.category) {
        const category = email.category.toLowerCase().replace(' ', '_');
        if (category in automationTypeCounts) {
          automationTypeCounts[category as keyof typeof automationTypeCounts]++;
        }
      }
    });

    // Apply industry-standard time estimates per automation type
    timeSavedMinutes += automationTypeCounts.order_status * 3;      // 3 min per order status
    timeSavedMinutes += automationTypeCounts.promo_refund * 5;      // 5 min per promo refund  
    timeSavedMinutes += automationTypeCounts.return_request * 4;    // 4 min per return
    timeSavedMinutes += automationTypeCounts.shipping_info * 2;     // 2 min per shipping
    timeSavedMinutes += automationTypeCounts.general_inquiry * 1;   // 1 min per general

    const estimatedCostSavings = Math.round((timeSavedMinutes / 60) * 25 * 100); // $25/hour * 100 for cents
    const averageResponseTime = automationsTriggered > 0 ? 1 : 0; // 1 min for automated responses
    
    const topAutomationType = Object.entries(automationTypeCounts)
      .sort(([,a], [,b]) => b - a)[0][0].replace('_', ' ');
    
    const industryBenchmarkRank = automationsTriggered > 0 ? 
      Math.min(95, Math.max(60, Math.round(65 + (automationsTriggered / 10) * 5))) : 0;

    return {
      emailsProcessed,
      automationsTriggered,
      timeSavedMinutes,
      estimatedCostSavings,
      averageResponseTime,
      topAutomationType,
      milestonesAchieved: [],
      comparisonToPrevious: { emailsGrowth: 0, automationsGrowth: 0, timeSavedGrowth: 0, costSavingsGrowth: 0 },
      industryBenchmarkRank,
      customerSatisfactionScore: 0, // Removed fake metrics
    };
  }

  private generateViralContent(metrics: WeeklyMetrics): ViralContent {
    const timeSavedHours = Math.round(metrics.timeSavedMinutes / 60 * 10) / 10;
    const costSavings = Math.round(metrics.estimatedCostSavings / 100);
    
    return {
      shareableMetrics: {
        title: `This week I automated ${metrics.automationsTriggered} customer service emails`,
        subtitle: `Saved ${timeSavedHours} hours and $${costSavings} with Delight Desk`,
        primaryMetric: `${timeSavedHours}h saved`,
        secondaryMetric: `$${costSavings} saved`,
        backgroundColor: '#16a34a',
      },
      socialMediaPosts: {
        twitter: `🚀 This week my @DelightDesk automation saved me ${timeSavedHours} hours of customer service work! That's $${costSavings} back in my pocket. 

Who else is tired of copy-pasting order status emails? Try it free: delightdesk.io`,
        linkedin: `📊 Weekly automation win: My e-commerce customer service just got ${timeSavedHours} hours back thanks to Delight Desk.

${metrics.automationsTriggered} emails automatically handled
$${costSavings} in labor costs saved
Top ${metrics.industryBenchmarkRank}% industry performance

For fellow e-commerce operators drowning in "where's my order" emails - this is a game changer. Worth checking out: delightdesk.io`,
      },
      referralMessage: `Hey! I've been using Delight Desk to automate my customer service emails and it's incredible. This week alone I saved ${timeSavedHours} hours and $${costSavings}. 

Thought you might be interested since you mentioned being swamped with customer emails. They have a free trial: [referral link]`,
      challengeMessage: `I just saved ${timeSavedHours} hours this week automating customer emails with Delight Desk. Bet I can help you save even more time with your customer service setup! 

Want to compare our automation stats next week? 😉`,
    };
  }

  private async sendWeeklyReportEmail(
    userEmail: string,
    metrics: WeeklyMetrics & { weekStart: Date; weekEnd: Date },
    viralContent: ViralContent
  ): Promise<void> {
    // Get user information for unsubscribe generation
    const user = await this.storage.getUserByEmail ? await this.storage.getUserByEmail(userEmail) : null;
    if (!user) {
      throw new Error('User not found for weekly report');
    }

    // Generate unsubscribe URLs - CRITICAL: Marketing emails must have working unsubscribe links
    const { unsubscribeService } = await import('./unsubscribe');
    const unsubscribeToken = await unsubscribeService.generateUnsubscribeToken(user.id, userEmail);
    const unsubscribeUrl = await unsubscribeService.generateUnsubscribeUrl(userEmail, 'weekly');
    
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? 'https://delightdesk.io' 
      : 'http://localhost:5000';
    
    const timeSavedHours = Math.round(metrics.timeSavedMinutes / 60 * 10) / 10;
    const costSavings = Math.round(metrics.estimatedCostSavings / 100);
    const dateRange = `${format(metrics.weekStart, 'MMM d')} - ${format(metrics.weekEnd, 'MMM d, yyyy')}`;

    const subject = `✨ Your weekly automation wins: ${timeSavedHours}h saved, $${costSavings} earned back!`;

    // Mobile-optimized HTML table email template
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Weekly Automation Wins</title>
  <style>
    @media only screen and (max-width: 600px) {
      .mobile-stack { display: block !important; width: 100% !important; }
      .mobile-center { text-align: center !important; }
      .mobile-padding { padding: 16px !important; }
      .mobile-hide { display: none !important; }
      .big-number { font-size: 36px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #000;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #581c87 100%); min-height: 100vh;">
    <tr>
      <td align="center" style="padding: 20px;">
        
        <!-- Container -->
        <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%;">
          
          <!-- Logo Header - Clean Text Only -->
          <tr>
            <td style="padding: 20px 24px; text-align: center; vertical-align: middle;">
              <div style="color: white; font-size: 20px; font-weight: 700; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif;">
                Delight Desk
              </div>
            </td>
          </tr>

          <!-- Spacer -->
          <tr><td style="height: 16px;"></td></tr>
          
          <!-- Header -->
          <tr>
            <td style="background: rgba(255,255,255,0.04); border-radius: 20px; padding: 32px 24px; text-align: center;">
              <h1 style="margin: 0 0 12px 0; font-size: 28px; font-weight: 800; color: white;">
                ✨ Your Weekly Automation Wins
              </h1>
              <p style="margin: 0; font-size: 16px; color: white;">
                ${dateRange}
              </p>
            </td>
          </tr>

          <!-- Spacer -->
          <tr><td style="height: 30px;"></td></tr>

          <!-- Big Numbers Row -->
          <tr>
            <td>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <!-- Time Saved -->
                  <td width="48%" style="background: rgba(255,255,255,0.08); border-radius: 16px; padding: 24px; text-align: center; vertical-align: top;">
                    <div style="font-size: 42px; font-weight: 900; color: #3b82f6; margin-bottom: 6px;" class="big-number">
                      ${timeSavedHours}h
                    </div>
                    <div style="color: white; font-size: 16px; font-weight: 600; letter-spacing: 0.5px;">
                      TIME SAVED
                    </div>
                  </td>
                  
                  <!-- Spacer -->
                  <td width="4%"></td>
                  
                  <!-- Cost Savings -->
                  <td width="48%" style="background: rgba(255,255,255,0.08); border-radius: 16px; padding: 24px; text-align: center; vertical-align: top;">
                    <div style="font-size: 42px; font-weight: 900; color: #ec4899; margin-bottom: 6px;" class="big-number">
                      $${costSavings}
                    </div>
                    <div style="color: white; font-size: 16px; font-weight: 600; letter-spacing: 0.5px;">
                      COST SAVINGS
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Spacer -->
          <tr><td style="height: 30px;"></td></tr>

          <!-- Performance Stats -->
          <tr>
            <td style="background: rgba(255,255,255,0.04); border-radius: 16px; padding: 24px;">
              
              <table width="100%" cellpadding="0" cellspacing="0">
                <!-- Section Title -->
                <tr>
                  <td colspan="2" style="text-align: center; padding-bottom: 20px;">
                    <h3 style="margin: 0; font-size: 20px; font-weight: 700; color: white;">
                      📊 This Week's Performance
                    </h3>
                  </td>
                </tr>
                
                <!-- Metric Rows -->
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.1); color: white; font-size: 16px; font-weight: 600;">
                    Emails processed
                  </td>
                  <td style="padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.1); text-align: right; color: white; font-size: 16px; font-weight: 800;">
                    ${metrics.emailsProcessed}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.1); color: white; font-size: 16px; font-weight: 600;">
                    Automations triggered
                  </td>
                  <td style="padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.1); text-align: right; color: white; font-size: 16px; font-weight: 800;">
                    ${metrics.automationsTriggered}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; color: white; font-size: 16px; font-weight: 600;">
                    Avg response time
                  </td>
                  <td style="padding: 12px 0; text-align: right; color: white; font-size: 16px; font-weight: 800;">
                    ${metrics.averageResponseTime}min
                  </td>
                </tr>
              </table>
              
            </td>
          </tr>

          <!-- Spacer -->
          <tr><td style="height: 30px;"></td></tr>

          <!-- Social Share CTA -->
          <tr>
            <td style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%); border-radius: 16px; padding: 28px 24px; text-align: center;">
              
              <h3 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 800; color: white;">
                🚀 Share Your Success
              </h3>
              <p style="margin: 0 0 20px 0; font-size: 16px; color: white;">
                Show your network how automation is transforming your business
              </p>
              
              <!-- Social Buttons -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding-right: 6px;">
                          <a href="https://twitter.com/intent/tweet?text=${encodeURIComponent(viralContent.socialMediaPosts.twitter)}" style="display: inline-block; background: #1da1f2; color: white; padding: 10px 18px; border-radius: 6px; text-decoration: none; font-weight: 700; font-size: 13px;">
                            Share on Twitter
                          </a>
                        </td>
                        <td style="padding-left: 6px;">
                          <a href="https://linkedin.com/sharing/share-offsite/?url=${encodeURIComponent('https://delightdesk.io')}&text=${encodeURIComponent(viralContent.socialMediaPosts.linkedin)}" style="display: inline-block; background: #0077b5; color: white; padding: 10px 18px; border-radius: 6px; text-decoration: none; font-weight: 700; font-size: 13px;">
                            Share on LinkedIn
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
            </td>
          </tr>

          <!-- Spacer -->
          <tr><td style="height: 30px;"></td></tr>

          <!-- Footer -->
          <tr>
            <td style="text-align: center; padding: 24px 24px 40px 24px;">
              <p style="margin: 0 0 16px 0; color: rgba(255,255,255,0.8); font-size: 14px;">
                <strong>Delight Desk</strong>
              </p>
              <p style="margin: 0 0 16px 0; color: rgba(255,255,255,0.6); font-size: 14px;">
                <a href="https://delightdesk.io/support" style="color: rgba(255,255,255,0.8); text-decoration: none;">Help Center</a>
              </p>
              <p style="margin: 0 0 8px 0; color: rgba(255,255,255,0.4); font-size: 12px;">
                You're receiving weekly reports because you enabled them in your account settings.<br>
                <a href="${unsubscribeUrl}" style="color: rgba(255,255,255,0.6);">Unsubscribe</a> | 
                <a href="${baseUrl}/preferences?email=${encodeURIComponent(userEmail)}" style="color: rgba(255,255,255,0.6);">Email Preferences</a>
              </p>
            </td>
          </tr>

        </table>
        
      </td>
    </tr>
  </table>

</body>
</html>`;

    const success = await this.emailService.sendEmail(
      userEmail,
      subject,
      htmlContent,
      'remy@delightdesk.io',
      'Remy at Delight Desk'
    );

    if (!success) {
      throw new Error('Failed to send weekly report email');
    }
  }
}

// Create and export service instance
import { sendGridService } from './sendgrid';
import { db } from '../db';
import { storage } from '../storage';

export const weeklyReportService = new WeeklyReportService(sendGridService, storage);