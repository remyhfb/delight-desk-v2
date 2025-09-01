import { google } from 'googleapis';
import { storage } from '../storage';

export interface OrderUpdateEmailData {
  orderNumber: string;
  orderStatus: string;
  trackingNumber?: string;
  shippingCarrier?: string;
  deliveryStatus?: string;
  aiPredictedDelivery?: {
    estimatedDate: string;
    confidence: string;
    source: string;
  };
  trackingUrl?: string;
  checkpointTimeline?: Array<{
    timestamp: string;
    status: string;
    location: string;
    message: string;
    carrier: string;
  }>;
}

export class GmailSenderService {
  /**
   * Send order update email using customer's connected Gmail account
   * CRITICAL: This sends from customer's Gmail, NOT SendGrid
   */
  async sendOrderUpdate(
    userId: string,
    customerEmail: string,
    orderData: OrderUpdateEmailData
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      console.log(`📧 Sending order update email via customer's Gmail | Order: ${orderData.orderNumber} | To: ${customerEmail}`);

      // Get the user's Gmail connection
      const emailAccounts = await storage.getUserEmailAccounts(userId);
      const gmailAccount = emailAccounts.find((account: any) => 
        account.provider === 'gmail' && account.isActive
      );

      if (!gmailAccount) {
        return {
          success: false,
          error: 'No active Gmail account connected'
        };
      }

      // Create OAuth2 client
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

      // Generate minimalist HTML email
      const emailHtml = this.generateOrderUpdateHtml(orderData);
      
      // Create raw email message
      const emailMessage = this.createEmailMessage(
        gmailAccount.email,
        customerEmail,
        `Order Update - #${orderData.orderNumber}`,
        emailHtml
      );

      // Send email
      const result = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: emailMessage,
        },
      });

      console.log(`✅ Order update email sent successfully | MessageId: ${result.data.id}`);
      
      return {
        success: true,
        messageId: result.data.id || undefined
      };

    } catch (error) {
      console.error('❌ Failed to send order update email:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Generate minimalist, grayscale HTML email for order updates
   * Brand-neutral design to not clash with customer branding
   */
  private generateOrderUpdateHtml(orderData: OrderUpdateEmailData): string {
    const hasTracking = orderData.trackingNumber && orderData.shippingCarrier;
    const hasAiPrediction = orderData.aiPredictedDelivery?.estimatedDate;
    const hasTimeline = orderData.checkpointTimeline && orderData.checkpointTimeline.length > 0;

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Order Update</title>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            line-height: 1.6; 
            color: #333333; 
            background-color: #ffffff; 
            margin: 0; 
            padding: 0; 
        }
        .container { 
            max-width: 600px; 
            margin: 0 auto; 
            padding: 20px; 
        }
        .header { 
            border-bottom: 2px solid #e5e7eb; 
            padding-bottom: 20px; 
            margin-bottom: 30px; 
        }
        .order-title { 
            font-size: 24px; 
            font-weight: 600; 
            color: #111827; 
            margin: 0; 
        }
        .order-status { 
            font-size: 16px; 
            color: #6b7280; 
            margin: 5px 0 0 0; 
        }
        .section { 
            margin-bottom: 25px; 
        }
        .section-title { 
            font-size: 18px; 
            font-weight: 500; 
            color: #374151; 
            margin-bottom: 10px; 
        }
        .info-row { 
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
            padding: 8px 0; 
            border-bottom: 1px solid #f3f4f6; 
        }
        .info-label { 
            font-weight: 500; 
            color: #4b5563; 
        }
        .info-value { 
            color: #111827; 
        }
        .ai-prediction { 
            background-color: #f9fafb; 
            border: 1px solid #e5e7eb; 
            border-radius: 6px; 
            padding: 15px; 
            margin: 15px 0; 
        }
        .ai-date { 
            font-size: 16px; 
            font-weight: 600; 
            color: #111827; 
        }
        .ai-confidence { 
            font-size: 14px; 
            color: #6b7280; 
            margin-top: 4px; 
        }
        .track-button { 
            display: inline-block; 
            background-color: #111827; 
            color: #ffffff; 
            text-decoration: none; 
            padding: 12px 24px; 
            border-radius: 6px; 
            font-weight: 500; 
            margin: 15px 0; 
        }
        .timeline { 
            border-left: 2px solid #e5e7eb; 
            padding-left: 20px; 
            margin-left: 10px; 
        }
        .timeline-item { 
            position: relative; 
            padding-bottom: 20px; 
        }
        .timeline-dot { 
            position: absolute; 
            left: -26px; 
            top: 4px; 
            width: 8px; 
            height: 8px; 
            background-color: #6b7280; 
            border-radius: 50%; 
        }
        .timeline-date { 
            font-size: 12px; 
            color: #9ca3af; 
            font-weight: 500; 
        }
        .timeline-status { 
            font-weight: 500; 
            color: #374151; 
            margin: 2px 0; 
        }
        .timeline-location { 
            font-size: 14px; 
            color: #6b7280; 
        }
        .footer { 
            border-top: 1px solid #e5e7eb; 
            padding-top: 20px; 
            margin-top: 40px; 
            text-align: center; 
            color: #9ca3af; 
            font-size: 12px; 
        }
        @media (max-width: 600px) {
            .container { padding: 15px; }
            .info-row { flex-direction: column; align-items: flex-start; }
            .info-value { margin-top: 4px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 class="order-title">Order #${orderData.orderNumber}</h1>
            <p class="order-status">${orderData.orderStatus}</p>
        </div>

        ${hasTracking ? `
        <div class="section">
            <h2 class="section-title">Shipping Information</h2>
            <div class="info-row">
                <span class="info-label">Tracking Number:</span>
                <span class="info-value">${orderData.trackingNumber}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Carrier:</span>
                <span class="info-value">${orderData.shippingCarrier?.toUpperCase()}</span>
            </div>
            ${orderData.deliveryStatus ? `
            <div class="info-row">
                <span class="info-label">Status:</span>
                <span class="info-value">${orderData.deliveryStatus}</span>
            </div>
            ` : ''}
        </div>
        ` : ''}

        ${hasAiPrediction ? `
        <div class="ai-prediction">
            <div class="ai-date">🤖 Estimated Delivery: ${this.formatDate(orderData.aiPredictedDelivery!.estimatedDate)}</div>
            <div class="ai-confidence">${orderData.aiPredictedDelivery!.confidence} • AI-Powered Prediction</div>
        </div>
        ` : ''}

        ${orderData.trackingUrl ? `
        <div style="text-align: center;">
            <a href="${orderData.trackingUrl}" class="track-button">Track Your Package</a>
        </div>
        ` : ''}

        ${hasTimeline ? `
        <div class="section">
            <h2 class="section-title">Tracking Timeline</h2>
            <div class="timeline">
                ${orderData.checkpointTimeline!.map(checkpoint => `
                <div class="timeline-item">
                    <div class="timeline-dot"></div>
                    <div class="timeline-date">${this.formatDateTime(checkpoint.timestamp)}</div>
                    <div class="timeline-status">${checkpoint.message}</div>
                    <div class="timeline-location">${checkpoint.location}</div>
                </div>
                `).join('')}
            </div>
        </div>
        ` : ''}

        <div class="footer">
            <p>Powered by Delight Desk</p>
        </div>
    </div>
</body>
</html>`;
  }

  /**
   * Create base64 encoded email message for Gmail API
   */
  private createEmailMessage(
    fromEmail: string,
    toEmail: string,
    subject: string,
    htmlContent: string
  ): string {
    const emailLines = [
      `From: ${fromEmail}`,
      `To: ${toEmail}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=utf-8',
      '',
      htmlContent
    ];

    const email = emailLines.join('\r\n');
    return Buffer.from(email).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  /**
   * Format date for display
   */
  private formatDate(dateString: string): string {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return dateString;
    }
  }

  /**
   * Format datetime for timeline
   */
  private formatDateTime(dateString: string): string {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return dateString;
    }
  }
}

export const gmailSender = new GmailSenderService();