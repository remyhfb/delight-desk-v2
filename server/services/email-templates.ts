// Minimalist email templates focused on essential information only

export interface OrderStatusEmailParams {
  customerName: string;
  orderNumber: string;
  status: string;
  companyName?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  carrier?: string;
  aiPrediction?: string | {
    estimatedDeliveryDate: string;
    confidence: string;
    source: string;
  };
}

export interface RefundEmailParams {
  customerName: string;
  orderNumber: string;
  refundAmount: string;
  companyName?: string;
}

export class EmailTemplates {
  static generateOrderStatusEmail(params: OrderStatusEmailParams): { html: string; text: string } {
    const { customerName, orderNumber, status, companyName, trackingNumber, trackingUrl, carrier, aiPrediction } = params;
    
    const statusDisplay = {
      'processing': 'Being Processed',
      'shipped': 'Shipped',
      'delivered': 'Delivered', 
      'completed': 'Completed',
      'cancelled': 'Cancelled'
    }[status] || status.charAt(0).toUpperCase() + status.slice(1);

    // Extract first name only from full name and ensure proper capitalization
    const rawFirstName = customerName.split(' ')[0];
    const firstName = rawFirstName ? rawFirstName.charAt(0).toUpperCase() + rawFirstName.slice(1).toLowerCase() : 'Customer';
    
    // Create status line with company name if provided (for email body content)
    const statusLine = companyName 
      ? `Here's the latest on your ${companyName} order:`
      : `Here's the latest on your order:`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background-color: #f8f9fa; }
    .container { max-width: 500px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); overflow: hidden; }
    .content { padding: 30px; }
    .header-text { font-size: 16px; margin: 0 0 25px 0; }
    .status-card { margin: 20px 0; padding: 20px; background: #f1f5f9; border-radius: 8px; border-left: 4px solid #2563eb; }
    .status-title { font-weight: 600; font-size: 18px; color: #2563eb; margin: 0 0 5px 0; }
    .order-number { font-size: 14px; color: #64748b; margin: 0; }
    .tracking { margin: 20px 0; padding: 15px; background: #f1f5f9; border-radius: 6px; border-left: 4px solid #2563eb; }
    .tracking-link { color: #2563eb; text-decoration: none; font-weight: 500; padding: 8px 16px; background: #eff6ff; border-radius: 4px; display: inline-block; margin-top: 8px; transition: background 0.2s; }
    .tracking-link:hover { background: #dbeafe; }
    .ai-prediction { background: linear-gradient(135deg, #eff6ff 0%, #f0f9ff 100%); border-left: 4px solid #3b82f6; padding: 16px; margin: 20px 0; border-radius: 6px; }
    .ai-tag { color: #1e40af; font-weight: 600; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; display: flex; align-items: center; gap: 6px; }
    .ai-content { font-size: 14px; color: #475569; line-height: 1.5; }
    .ai-powered { font-size: 11px; color: #64748b; margin-top: 8px; font-style: italic; }
    .disclaimer { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 25px 0; font-size: 14px; border-radius: 6px; }
    .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 30px; text-align: center; }
    .branding { color: #64748b; font-size: 11px; line-height: 1.4; }
    .branding a { color: #3b82f6; text-decoration: none; font-weight: 500; }
    .branding a:hover { text-decoration: underline; }
    .divider { height: 1px; background: #e2e8f0; margin: 12px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="content">
      <p style="margin: 0 0 20px 0; font-size: 16px;">Hi ${firstName},</p>
      
      <p class="header-text">Here's the latest on your ${companyName ? companyName + ' order' : 'order'}:</p>
      
      ${trackingNumber ? `
      <div class="tracking">
        <strong>Order Status:</strong> ${statusDisplay}<br>
        <strong>Order Number:</strong> ${orderNumber}<br>
        ${carrier ? `<strong>Carrier:</strong> ${carrier}<br>` : ''}
        <strong>Tracking Number:</strong> ${trackingNumber}
        ${trackingUrl ? `<br><a href="${trackingUrl}" class="tracking-link">📦 Track Your Package</a>` : ''}
      </div>
      ` : `
      <div class="tracking">
        <strong>Order Status:</strong> ${statusDisplay}<br>
        <strong>Order Number:</strong> ${orderNumber}
      </div>
      `}
      
      ${aiPrediction ? `
      <div class="ai-prediction">
        <div class="ai-tag">
          <span>🤖</span>
          <span>AI Delivery Prediction</span>
        </div>
        <div class="ai-content">${typeof aiPrediction === 'string' ? aiPrediction : `Our AI analyzes current shipping patterns and conditions to estimate your package will arrive on <strong>${new Date(aiPrediction.estimatedDeliveryDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</strong>.`}</div>
        <div class="ai-powered">${typeof aiPrediction === 'string' ? 'Powered by Delight Desk AI analyzing real-time shipping data' : `Prediction confidence: ${aiPrediction.confidence} • Powered by Delight Desk AI`}</div>
      </div>
      ` : ''}
      
      <div class="disclaimer">
        This email sent from our automated system, designed to resolve issues fast. Need more help? Just reply back <strong>"human"</strong>. We're here!
      </div>
    </div>
    
    <div class="footer">
      <div class="branding">
        Intelligent customer service automation powered by <a href="https://delightdesk.io" target="_blank">Delight Desk</a>
        <div class="divider"></div>
        <a href="https://delightdesk.io/support" target="_blank">Get Support</a> | Helping businesses deliver exceptional support experiences
      </div>
    </div>
  </div>
</body>
</html>`;

    const text = `Hi ${firstName},

${statusLine}

Order Status: ${statusDisplay}
Order Number: ${orderNumber}
${trackingNumber ? `${carrier ? `Carrier: ${carrier}\n` : ''}Tracking Number: ${trackingNumber}${trackingUrl ? `\nTrack Your Package: ${trackingUrl}` : ''}` : ''}

${aiPrediction ? `🤖 AI DELIVERY PREDICTION
${typeof aiPrediction === 'string' ? aiPrediction : `Our AI analyzes current shipping patterns and conditions to estimate your package will arrive on ${new Date(aiPrediction.estimatedDeliveryDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.
Prediction confidence: ${aiPrediction.confidence} • Powered by Delight Desk AI`}
Powered by Delight Desk AI analyzing real-time shipping data

` : ''}---
This email sent from our automated system, designed to resolve issues fast. Need more help? Just reply back "human". We're here!

---
Intelligent customer service automation powered by Delight Desk
Get Support: https://delightdesk.io/support | Helping businesses deliver exceptional support experiences
Visit: https://delightdesk.io`;

    return { html, text };
  }

  static generateRefundEmail(params: RefundEmailParams): { html: string; text: string } {
    const { customerName, orderNumber, refundAmount, companyName } = params;
    
    // Extract first name only from full name and ensure proper capitalization
    const rawFirstName = customerName.split(' ')[0];
    const firstName = rawFirstName ? rawFirstName.charAt(0).toUpperCase() + rawFirstName.slice(1).toLowerCase() : 'Customer';

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background-color: #f8f9fa; }
    .container { max-width: 500px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); overflow: hidden; }
    .content { padding: 30px; }
    .refund-amount { font-weight: 600; font-size: 20px; color: #059669; margin: 20px 0; padding: 15px; background: #ecfdf5; border-left: 4px solid #10b981; border-radius: 6px; }
    .disclaimer { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 25px 0; font-size: 14px; border-radius: 6px; }
    .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 30px; text-align: center; }
    .branding { color: #64748b; font-size: 11px; line-height: 1.4; }
    .branding a { color: #3b82f6; text-decoration: none; font-weight: 500; }
    .branding a:hover { text-decoration: underline; }
    .divider { height: 1px; background: #e2e8f0; margin: 12px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="content">
      <p style="margin: 0 0 20px 0; font-size: 16px;">Hi ${firstName},</p>
      
      <p style="margin: 0 0 15px 0;">Your refund has been processed:</p>
      <div class="refund-amount">$${refundAmount} refund for ${companyName ? `${companyName} ` : ''}order #${orderNumber}</div>
      
      <p style="margin: 0 0 20px 0;">Funds will appear in your account within 3-5 business days.</p>
      
      <div class="disclaimer">
        This email sent from our automated system, designed to resolve issues fast. Need more help? Just reply back <strong>"human"</strong>. We're here!
      </div>
    </div>
    
    <div class="footer">
      <div class="branding">
        Intelligent customer service automation powered by <a href="https://delightdesk.io" target="_blank">Delight Desk</a>
        <div class="divider"></div>
        <a href="https://delightdesk.io/support" target="_blank">Get Support</a> | Helping businesses deliver exceptional support experiences
      </div>
    </div>
  </div>
</body>
</html>`;

    const text = `Hi ${firstName},

Your refund has been processed:
$${refundAmount} refund for ${companyName ? `${companyName} ` : ''}order #${orderNumber}

Funds will appear in your account within 3-5 business days.

---
This email sent from our automated system, designed to resolve issues fast. Need more help? Just reply back "human". We're here!

---
Intelligent customer service automation powered by Delight Desk
Get Support: https://delightdesk.io/support | Helping businesses deliver exceptional support experiences
Visit: https://delightdesk.io`;

    return { html, text };
  }
}