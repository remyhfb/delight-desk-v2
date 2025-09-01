import { db } from "../db";
import { 
  automatedOrderCampaigns, 
  orderSyncQueue, 
  scheduledOrderEmails,
  orderTrackingData,
  storeConnections,
  type InsertAutomatedOrderCampaign,
  type AutomatedOrderCampaign,
  type InsertOrderSyncQueue,
  type OrderSyncQueue,
  type InsertScheduledOrderEmail,
  type ScheduledOrderEmail
} from "../../shared/schema";
import { eq, and, desc, lte, gte } from "drizzle-orm";
import { orderLookupService } from "./order-lookup";
import { aftershipService } from "./aftership";
import { sharedEmailService } from "./shared-email";
import { logger, LogCategory } from "./logger";
import { storage } from "../storage";

export class AutomatedOrderCampaignService {
  // Campaign Management
  async createCampaign(userId: string, campaign: InsertAutomatedOrderCampaign): Promise<AutomatedOrderCampaign> {
    const [created] = await db
      .insert(automatedOrderCampaigns)
      .values({ ...campaign, userId })
      .returning();
    
    logger.info(LogCategory.SYSTEM, 'Created automated order campaign', { 
      userId, 
      campaignId: created.id, 
      campaignName: created.name 
    });
    
    return created;
  }

  async getCampaigns(userId: string): Promise<AutomatedOrderCampaign[]> {
    return await db
      .select()
      .from(automatedOrderCampaigns)
      .where(eq(automatedOrderCampaigns.userId, userId))
      .orderBy(desc(automatedOrderCampaigns.createdAt));
  }

  async getCampaign(userId: string, campaignId: string): Promise<AutomatedOrderCampaign | null> {
    const [campaign] = await db
      .select()
      .from(automatedOrderCampaigns)
      .where(and(
        eq(automatedOrderCampaigns.id, campaignId),
        eq(automatedOrderCampaigns.userId, userId)
      ));
    
    return campaign || null;
  }

  async updateCampaign(userId: string, campaignId: string, updates: Partial<AutomatedOrderCampaign>): Promise<AutomatedOrderCampaign | null> {
    const [updated] = await db
      .update(automatedOrderCampaigns)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(
        eq(automatedOrderCampaigns.id, campaignId),
        eq(automatedOrderCampaigns.userId, userId)
      ))
      .returning();
    
    if (updated) {
      logger.info(LogCategory.SYSTEM, 'Updated automated order campaign', { 
        userId, 
        campaignId, 
        updates: Object.keys(updates)
      });
    }
    
    return updated || null;
  }

  async toggleCampaign(userId: string, campaignId: string, isActive: boolean): Promise<boolean> {
    const updated = await this.updateCampaign(userId, campaignId, { isActive });
    
    if (updated) {
      logger.info(LogCategory.SYSTEM, `${isActive ? 'Activated' : 'Deactivated'} automated order campaign`, {
        userId,
        campaignId,
        campaignName: updated.name
      });
    }
    
    return !!updated;
  }

  async deleteCampaign(userId: string, campaignId: string): Promise<boolean> {
    // First cancel all scheduled emails for this campaign
    await db
      .update(scheduledOrderEmails)
      .set({ status: 'cancelled' })
      .where(eq(scheduledOrderEmails.campaignId, campaignId));

    // Delete the campaign
    const result = await db
      .delete(automatedOrderCampaigns)
      .where(and(
        eq(automatedOrderCampaigns.id, campaignId),
        eq(automatedOrderCampaigns.userId, userId)
      ));

    logger.info(LogCategory.SYSTEM, 'Deleted automated order campaign', { userId, campaignId });
    return result.rowCount! > 0;
  }

  // Order Processing
  async processNewOrder(userId: string, storeConnectionId: string, orderData: any): Promise<void> {
    try {
      // Find active campaigns for this store
      const activeCampaigns = await db
        .select()
        .from(automatedOrderCampaigns)
        .where(and(
          eq(automatedOrderCampaigns.userId, userId),
          eq(automatedOrderCampaigns.storeConnectionId, storeConnectionId),
          eq(automatedOrderCampaigns.isActive, true)
        ));

      if (activeCampaigns.length === 0) {
        logger.debug(LogCategory.SYSTEM, 'No active campaigns found for store', { userId, storeConnectionId });
        return;
      }

      // Extract order details
      const orderNumber = orderData.number || orderData.order_number;
      const customerEmail = orderData.billing?.email || orderData.customer?.email || orderData.email;
      const customerName = orderData.billing?.first_name + ' ' + orderData.billing?.last_name || 
                          orderData.customer?.first_name + ' ' + orderData.customer?.last_name ||
                          orderData.customer_name;

      if (!orderNumber || !customerEmail) {
        logger.warn(LogCategory.SYSTEM, 'Missing required order data', { orderNumber, customerEmail });
        return;
      }

      // Add order to sync queue
      const orderSync: InsertOrderSyncQueue = {
        userId,
        storeConnectionId,
        campaignId: activeCampaigns[0].id, // Use first active campaign
        externalOrderId: String(orderData.id),
        orderNumber,
        customerEmail,
        customerName,
        orderTotal: String(parseFloat(orderData.total || '0')),
        orderStatus: orderData.status,
        orderDate: new Date(orderData.date_created || orderData.created_at || new Date()),
        orderData: orderData,
        processStatus: 'pending'
      };

      const [syncRecord] = await db
        .insert(orderSyncQueue)
        .values(orderSync)
        .returning();

      logger.info(LogCategory.SYSTEM, 'Added order to sync queue', { 
        userId, 
        orderNumber, 
        customerEmail,
        syncId: syncRecord.id 
      });

      // Schedule emails for all active campaigns
      for (const campaign of activeCampaigns) {
        await this.scheduleEmailsForOrder(campaign, syncRecord);
      }

    } catch (error) {
      logger.error(LogCategory.SYSTEM, 'Error processing new order', { error, userId, orderData: orderData?.number });
    }
  }

  private async scheduleEmailsForOrder(campaign: AutomatedOrderCampaign, orderSync: OrderSyncQueue): Promise<void> {
    try {
      const intervals = campaign.emailIntervals as any[];
      
      for (const interval of intervals) {
        const scheduledFor = new Date();
        scheduledFor.setDate(scheduledFor.getDate() + interval.days);

        const scheduledEmail: InsertScheduledOrderEmail = {
          userId: campaign.userId,
          campaignId: campaign.id,
          orderSyncId: orderSync.id,
          customerEmail: orderSync.customerEmail,
          customerName: orderSync.customerName,
          orderNumber: orderSync.orderNumber,
          scheduledFor,
          intervalDays: interval.days,
          emailTemplate: interval.template || campaign.emailTemplate,
          status: 'scheduled'
        };

        await db
          .insert(scheduledOrderEmails)
          .values(scheduledEmail);

        logger.info(LogCategory.EMAIL, 'Scheduled order email', {
          userId: campaign.userId,
          campaignId: campaign.id,
          orderNumber: orderSync.orderNumber,
          scheduledFor,
          intervalDays: interval.days
        });
      }
    } catch (error) {
      logger.error(LogCategory.EMAIL, 'Error scheduling emails for order', { error, campaignId: campaign.id, orderSyncId: orderSync.id });
    }
  }

  // Email Processing
  async processScheduledEmails(): Promise<void> {
    try {
      // Find emails scheduled for sending (current time or past)
      const now = new Date();
      const emailsToSend = await db
        .select()
        .from(scheduledOrderEmails)
        .where(and(
          eq(scheduledOrderEmails.status, 'scheduled'),
          lte(scheduledOrderEmails.scheduledFor, now)
        ))
        .limit(50); // Process in batches

      logger.info(LogCategory.EMAIL, `Processing ${emailsToSend.length} scheduled order emails`);

      for (const email of emailsToSend) {
        await this.sendScheduledEmail(email);
      }
    } catch (error) {
      logger.error(LogCategory.EMAIL, 'Error processing scheduled emails', { error });
    }
  }

  private async sendScheduledEmail(scheduledEmail: ScheduledOrderEmail): Promise<void> {
    try {
      // Get order sync data
      const [orderSync] = await db
        .select()
        .from(orderSyncQueue)
        .where(eq(orderSyncQueue.id, scheduledEmail.orderSyncId));

      if (!orderSync) {
        logger.warn(LogCategory.EMAIL, 'Order sync record not found', { orderSyncId: scheduledEmail.orderSyncId });
        return;
      }

      // Get campaign data
      const [campaign] = await db
        .select()
        .from(automatedOrderCampaigns)
        .where(eq(automatedOrderCampaigns.id, scheduledEmail.campaignId));

      if (!campaign || !campaign.isActive) {
        logger.info(LogCategory.EMAIL, 'Campaign not active, cancelling email', { campaignId: scheduledEmail.campaignId });
        await this.updateScheduledEmail(scheduledEmail.id, { status: 'cancelled' });
        return;
      }

      // Get latest order tracking data
      let trackingData = null;
      let aiPrediction = null;

      if (campaign.includeAiPredictions) {
        try {
          // Try to get fresh tracking data
          const orderInfo = await orderLookupService.searchOrderByNumber(
            scheduledEmail.userId,
            scheduledEmail.orderNumber
          );

          if (orderInfo?.trackingNumber) {
            // Get AI prediction
            const prediction = await aftershipService.getEnhancedTrackingForEmail(
              orderInfo.trackingNumber,
              orderInfo.shippingCarrier || 'USPS',
              scheduledEmail.userId
            );
            
            if (prediction) {
              aiPrediction = prediction;
              trackingData = {
                trackingNumber: orderInfo.trackingNumber,
                carrier: orderInfo.shippingCarrier,
                trackingUrl: orderInfo.trackingUrl,
                status: prediction.formattedStatus,
                prediction: prediction.aiPrediction
              };
            }
          }
        } catch (error) {
          logger.warn(LogCategory.EMAIL, 'Could not get tracking data for scheduled email', { 
            error, 
            orderNumber: scheduledEmail.orderNumber 
          });
        }
      }

      // Generate email content
      const emailContent = await this.generateOrderStatusEmail(
        scheduledEmail,
        orderSync,
        campaign,
        trackingData
      );

      // Send email with campaign tracking
      const emailSent = await sharedEmailService.sendOrderInformation(
        scheduledEmail.userId,
        scheduledEmail.customerEmail,
        {
          orderNumber: scheduledEmail.orderNumber,
          customerName: scheduledEmail.customerName,
          emailContent,
          status: orderSync.orderStatus,
          tracking: trackingData?.trackingNumber,
          estimatedDelivery: aiPrediction?.aiPrediction,
          total: orderSync.orderTotal
        },
        campaign.id // Pass campaign ID for tracking
      );

      if (emailSent) {
        // Update scheduled email as sent
        await this.updateScheduledEmail(scheduledEmail.id, {
          status: 'sent',
          sentAt: new Date(),
          emailContent,
          trackingData: trackingData || undefined
        });

        // Update campaign statistics
        await db
          .update(automatedOrderCampaigns)
          .set({ 
            totalEmailsSent: (campaign.totalEmailsSent || 0) + 1,
            lastProcessedAt: new Date()
          })
          .where(eq(automatedOrderCampaigns.id, campaign.id));

        // Log automation activity for monitoring
        await storage.createActivityLog({
          userId: scheduledEmail.userId,
          action: `Automation campaign sent email for order ${scheduledEmail.orderNumber}`,
          type: 'automation',
          executedBy: 'ai',
          customerEmail: scheduledEmail.customerEmail,
          details: `Campaign "${campaign.name}" sent order status email with AI delivery predictions`,
          status: 'completed',
          metadata: { 
            campaignId: campaign.id, 
            orderNumber: scheduledEmail.orderNumber,
            trackingNumber: trackingData?.trackingNumber 
          }
        });

        logger.info(LogCategory.EMAIL, 'Successfully sent scheduled order email', {
          userId: scheduledEmail.userId,
          orderNumber: scheduledEmail.orderNumber,
          customerEmail: scheduledEmail.customerEmail,
          campaignId: campaign.id
        });
      } else {
        await this.updateScheduledEmail(scheduledEmail.id, {
          status: 'failed',
          errorMessage: 'Failed to send email'
        });
      }

    } catch (error) {
      logger.error(LogCategory.EMAIL, 'Error sending scheduled email', { 
        error, 
        scheduledEmailId: scheduledEmail.id,
        orderNumber: scheduledEmail.orderNumber
      });

      await this.updateScheduledEmail(scheduledEmail.id, {
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async updateScheduledEmail(emailId: string, updates: Partial<ScheduledOrderEmail>): Promise<void> {
    await db
      .update(scheduledOrderEmails)
      .set(updates)
      .where(eq(scheduledOrderEmails.id, emailId));
  }

  private async generateOrderStatusEmail(
    scheduledEmail: ScheduledOrderEmail,
    orderSync: OrderSyncQueue,
    campaign: AutomatedOrderCampaign,
    trackingData: any
  ): Promise<string> {
    // Get user's system settings for company name
    const settings = await storage.getSystemSettings(scheduledEmail.userId);
    const companyName = settings?.companyName || 'Human Food Bar';
    
    // Use professional email template
    const { EmailTemplates } = await import('./email-templates');
    const emailContent = EmailTemplates.generateOrderStatusEmail({
      customerName: scheduledEmail.customerName,
      orderNumber: scheduledEmail.orderNumber,
      status: orderSync.orderStatus,
      companyName,
      trackingNumber: trackingData?.trackingNumber,
      trackingUrl: trackingData?.trackingUrl,
      carrier: trackingData?.carrier,
      aiPrediction: trackingData?.prediction
    });

    return emailContent.html;
  }

  // Statistics and Monitoring
  async getCampaignStats(userId: string, campaignId: string): Promise<any> {
    const campaign = await this.getCampaign(userId, campaignId);
    if (!campaign) return null;

    // Get email statistics
    const emailStats = await db
      .select()
      .from(scheduledOrderEmails)
      .where(eq(scheduledOrderEmails.campaignId, campaignId));

    const stats = {
      totalEmails: emailStats.length,
      sentEmails: emailStats.filter(e => e.status === 'sent').length,
      scheduledEmails: emailStats.filter(e => e.status === 'scheduled').length,
      failedEmails: emailStats.filter(e => e.status === 'failed').length,
      cancelledEmails: emailStats.filter(e => e.status === 'cancelled').length,
      lastProcessed: campaign.lastProcessedAt,
      totalSent: campaign.totalEmailsSent
    };

    return stats;
  }

  async getAllUserCampaignStats(userId: string): Promise<any> {
    const campaigns = await this.getCampaigns(userId);
    
    let totalStats = {
      totalCampaigns: campaigns.length,
      activeCampaigns: campaigns.filter(c => c.isActive).length,
      totalEmailsSent: campaigns.reduce((sum, c) => sum + (c.totalEmailsSent || 0), 0),
      campaignDetails: []
    };

    for (const campaign of campaigns) {
      const stats = await this.getCampaignStats(userId, campaign.id);
      (totalStats.campaignDetails as any[]).push({
        id: campaign.id,
        name: campaign.name,
        isActive: campaign.isActive,
        ...stats
      });
    }

    return totalStats;
  }
}

export const automatedOrderCampaignService = new AutomatedOrderCampaignService();