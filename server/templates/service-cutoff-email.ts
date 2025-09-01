export function generateServiceCutoffEmailTemplate(
  userName: string,
  serviceName: string,
  limitType: 'daily' | 'monthly',
  resetTime: string,
  currentCount: number,
  limit: number
) {
  // Ensure proper capitalization of customer name
  const capitalizedName = userName ? userName.charAt(0).toUpperCase() + userName.slice(1).toLowerCase() : 'Customer';
  
  // Map to business-friendly terminology
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
  <title>AI Credits Exhausted - Delight Desk</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; line-height: 1.6;">
  
  <div style="max-width: 600px; margin: 40px auto; background-color: white; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden;">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); color: white; padding: 32px 24px; text-align: center;">
      <h1 style="margin: 0; font-size: 28px; font-weight: 600;">🚫 AI Credits Exhausted</h1>
      <p style="margin: 8px 0 0 0; font-size: 16px; opacity: 0.9;">Your monthly AI credit limit has been reached</p>
    </div>
    
    <!-- Content -->
    <div style="padding: 32px 24px;">
      
      <p style="margin: 0 0 24px 0; font-size: 16px; color: #374151;">Hi ${capitalizedName},</p>
      
      <div style="background-color: #fee2e2; border-left: 4px solid #dc2626; padding: 16px; border-radius: 4px; margin-bottom: 24px;">
        <p style="margin: 0; font-size: 16px; color: #991b1b; font-weight: 500;">
          Your AI-powered features have been temporarily paused after using all <strong>${limit} monthly credits</strong>.
        </p>
      </div>
      
      <p style="margin: 0 0 24px 0; font-size: 16px; color: #374151;">
        <strong>What's affected:</strong> AI-powered order lookups with delivery predictions and intelligent order status emails are now paused.
      </p>

      <p style="margin: 0 0 24px 0; font-size: 16px; color: #374151;">
        <strong>What still works:</strong> All basic customer service features, manual actions, and your dashboard remain fully available.
      </p>

      <!-- Service Status -->
      <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
        <h3 style="margin: 0 0 12px 0; font-size: 18px; color: #1f2937;">AI Service Status</h3>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <span style="color: #6b7280; font-size: 14px;">AI-Powered Features:</span>
          <span style="color: #dc2626; font-weight: 600; background-color: #fee2e2; padding: 4px 8px; border-radius: 4px; font-size: 12px;">PAUSED</span>
        </div>
        <p style="margin: 0; color: #6b7280; font-size: 14px;">
          ✓ Credits automatically reset on the 1st of next month<br>
          ✓ All your data and settings are preserved<br>
          ✓ No overage charges - we protect you from surprise fees
        </p>
      </div>
      
      <!-- Options -->
      <div style="background-color: #ecfdf5; border-left: 4px solid #10b981; padding: 16px; border-radius: 4px; margin-bottom: 24px;">
        <h4 style="margin: 0 0 8px 0; color: #065f46; font-size: 16px;">Options to restore AI features immediately:</h4>
        <ol style="margin: 8px 0 0 0; padding-left: 20px; color: #047857;">
          <li style="margin-bottom: 4px;">Upgrade to a paid plan (higher monthly credit limits)</li>
          <li>Wait for automatic credit reset on the 1st of next month</li>
        </ol>
      </div>
      
      <!-- CTA Buttons -->
      <div style="text-align: center; margin: 32px 0;">
        <a href="${upgradeUrl}" 
           style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-weight: 600; font-size: 16px; margin: 0 8px 16px 8px;">
          Upgrade Plan - Restore AI Features
        </a>
        <a href="http://localhost:5000/account-settings?tab=usage" 
           style="display: inline-block; background-color: #f3f4f6; color: #374151; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-weight: 600; font-size: 16px; margin: 0 8px 16px 8px;">
          View Usage Dashboard
        </a>
      </div>
      
      <p style="margin: 24px 0 0 0; font-size: 14px; color: #6b7280; text-align: center;">
        We understand this is inconvenient. Our free trial limits help us provide reliable service to all users while keeping costs predictable.
      </p>
      
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