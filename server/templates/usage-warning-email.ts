export function generateUsageWarningEmailTemplate(
  userName: string,
  serviceName: string,
  usagePercentage: number,
  currentCount: number,
  limit: number,
  limitType: 'daily' | 'monthly',
  resetTime: string
) {
  // Ensure proper capitalization of customer name
  const capitalizedName = userName ? userName.charAt(0).toUpperCase() + userName.slice(1).toLowerCase() : 'Customer';
  
  // Map service names to business-friendly terms
  const serviceDisplayName = 'AI-Powered Actions';
  const upgradeUrl = process.env.NODE_ENV === 'production' 
    ? 'https://delightdesk.replit.app/account-settings?tab=billing'
    : 'http://localhost:5000/account-settings?tab=billing';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI Credit Usage Warning - Delight Desk</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; line-height: 1.6;">
  
  <div style="max-width: 600px; margin: 40px auto; background-color: white; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden;">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 32px 24px; text-align: center;">
      <h1 style="margin: 0; font-size: 28px; font-weight: 600;">⚠️ Credit Usage Warning</h1>
      <p style="margin: 8px 0 0 0; font-size: 16px; opacity: 0.9;">You're approaching your monthly AI credit limit</p>
    </div>
    
    <!-- Content -->
    <div style="padding: 32px 24px;">
      
      <p style="margin: 0 0 24px 0; font-size: 16px; color: #374151;">Hi ${capitalizedName},</p>
      
      <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 4px; margin-bottom: 24px;">
        <p style="margin: 0; font-size: 16px; color: #92400e; font-weight: 500;">
          You've used <strong>${currentCount} of ${limit}</strong> AI-powered action credits (${usagePercentage}% of your monthly limit).
        </p>
      </div>
      
      <p style="margin: 0 0 24px 0; font-size: 16px; color: #374151;">
        Your AI-powered actions include <strong>order lookups with delivery predictions</strong> and <strong>intelligent order status emails</strong>. To keep using these smart features, consider upgrading before reaching your limit.
      </p>
      
      <!-- What happens next -->
      <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
        <h3 style="margin: 0 0 12px 0; font-size: 18px; color: #1f2937;">What happens when you reach 100%?</h3>
        <ul style="margin: 0; padding-left: 20px; color: #6b7280;">
          <li style="margin-bottom: 8px;">AI-powered order tracking and predictions will be temporarily paused</li>
          <li style="margin-bottom: 8px;">Basic customer service features remain fully available</li>
          <li style="margin-bottom: 8px;">Credits automatically reset on the 1st of next month</li>
          <li>No overage charges - we never surprise you with extra fees</li>
        </ul>
      </div>
      
      <!-- CTA Buttons -->
      <div style="text-align: center; margin: 32px 0;">
        <a href="${upgradeUrl}" 
           style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-weight: 600; font-size: 16px; margin: 0 8px 16px 8px;">
          Upgrade Plan
        </a>
        <a href="http://localhost:5000/account-settings?tab=usage" 
           style="display: inline-block; background-color: #f3f4f6; color: #374151; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-weight: 600; font-size: 16px; margin: 0 8px 16px 8px;">
          View Usage Dashboard
        </a>
      </div>
      
    </div>
    
    <!-- Footer -->
    <div style="background-color: #f9fafb; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="margin: 0 0 8px 0; font-size: 14px; color: #6b7280;">
        Questions? Contact us at <a href="mailto:support@delightdesk.io" style="color: #667eea;">support@delightdesk.io</a>
      </p>
      <p style="margin: 0; font-size: 12px; color: #9ca3af;">
        Delight Desk - Customer Support Automation
      </p>
    </div>
    
  </div>

</body>
</html>
  `;
}