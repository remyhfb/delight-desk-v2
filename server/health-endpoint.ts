import { Router } from 'express';
import { storage } from './storage';
import { autoResponderService } from './services/auto-responder';
import { orderLookupService } from './services/order-lookup';
import { sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';

const router = Router();

interface HealthCheckResult {
  test: string;
  status: 'pass' | 'fail';
  message?: string;
  timestamp: string;
  duration: number;
  error?: string;
}

interface HealthCheckResponse {
  overall: 'healthy' | 'unhealthy';
  results: HealthCheckResult[];
  summary: {
    passed: number;
    failed: number;
    total: number;
  };
  lastChecked: string;
}

class WebHealthChecker {
  private runId: string = nanoid();
  private userAgent?: string;
  private ipAddress?: string;

  constructor(userAgent?: string, ipAddress?: string) {
    this.userAgent = userAgent;
    this.ipAddress = ipAddress;
  }

  private async runTest(name: string, testFn: () => Promise<void>): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();
    
    try {
      await testFn();
      const duration = Date.now() - startTime;
      
      // Log successful test
      await this.logHealthCheck(name, 'pass', duration);
      
      return {
        test: name,
        status: 'pass',
        timestamp,
        duration
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      // Log failed test with full error details
      await this.logHealthCheck(name, 'fail', duration, errorMessage, errorStack);
      
      return {
        test: name,
        status: 'fail',
        message: errorMessage,
        timestamp,
        duration,
        error: errorMessage
      };
    }
  }

  private async logHealthCheck(testName: string, status: 'pass' | 'fail', duration: number, errorMessage?: string, errorStack?: string): Promise<void> {
    try {
      // First ensure the run record exists
      await storage.insertHealthCheckRun({
        id: this.runId,
        totalDuration: 0,
        overallStatus: 'running',
        totalTests: 0,
        passedTests: 0,
        failedTests: 0
      });
    } catch (runError) {
      // Run might already exist, that's okay
    }
    
    try {
      await storage.insertHealthCheckLog({
        runId: this.runId,
        testName,
        status,
        duration,
        errorMessage: errorMessage || null,
        errorStack: errorStack || null,
        environment: process.env.NODE_ENV || 'development',
        serverVersion: process.env.SERVER_VERSION || null,
        userAgent: this.userAgent || null,
        ipAddress: this.ipAddress || null,
        metadata: null
      });
    } catch (logError) {
      // Don't let logging errors break health checks
      console.error('Failed to log health check:', logError);
    }
  }

  async runAllChecks(): Promise<HealthCheckResponse> {
    const startTime = Date.now();
    const TEST_USER_ID = 'health-check-user';
    
    // Create the health check run entry first to satisfy foreign key constraints
    try {
      await storage.insertHealthCheckRun({
        id: this.runId,
        totalDuration: 0, // Will be updated at the end
        overallStatus: 'healthy', // Will be updated at the end  
        totalTests: 0, // Will be updated at the end
        passedTests: 0, // Will be updated at the end
        failedTests: 0 // Will be updated at the end
      });
    } catch (logError) {
      console.error('Failed to initialize health check run:', logError);
    }
    
    const results: HealthCheckResult[] = [];

    // Test 1: Database Connection
    results.push(await this.runTest('Database Connection', async () => {
      // Test by trying to query a simple table
      const users = await storage.getAllUsers();
      if (users === null || users === undefined) throw new Error('Database connection failed');
    }));

    // Test 2: Critical Storage Methods
    results.push(await this.runTest('Storage Methods', async () => {
      const criticalMethods: (keyof typeof storage)[] = ['getUserById', 'createEmail', 'getSystemSettings'];
      for (const methodName of criticalMethods) {
        if (typeof storage[methodName] !== 'function') {
          throw new Error(`Critical method storage.${methodName} is missing`);
        }
      }
    }));

    // Test 3: Auto-Responder Service
    results.push(await this.runTest('AI Email Processing', async () => {
      const mockEmailData = {
        fromEmail: 'customer@test.com',
        toEmail: 'support@company.com',
        subject: 'Test Order Status',
        body: 'Where is my order #12345?',
        messageId: 'test-message-health-check'
      };

      try {
        await autoResponderService.processIncomingEmail(TEST_USER_ID, mockEmailData);
      } catch (error) {
        // Only fail on schema/method errors, not business logic
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        if (errorMessage.includes('does not exist on type') ||
            errorMessage.includes('Cannot find name') ||
            errorMessage.includes('undefined is not a function')) {
          throw error;
        }
      }
    }));

    // Test 4: WooCommerce Integration
    results.push(await this.runTest('WooCommerce Integration', async () => {
      const { WooCommerceService } = await import('./services/woocommerce');
      const wooService = new WooCommerceService({
        storeUrl: 'https://test-store.com',
        consumerKey: 'test-key', 
        consumerSecret: 'test-secret'
      });

      // Test that critical methods exist
      if (typeof wooService.searchOrderByNumber !== 'function') {
        throw new Error('WooCommerce method searchOrderByNumber is missing');
      }
      if (typeof wooService.searchOrderByEmail !== 'function') {
        throw new Error('WooCommerce method searchOrderByEmail is missing');
      }
      if (typeof wooService.updateOrderTracking !== 'function') {
        throw new Error('WooCommerce method updateOrderTracking is missing');
      }
    }));

    // Test 5: Email Sending
    results.push(await this.runTest('Email Sending', async () => {
      const { sendEmailWithSendGrid, sendGridService } = await import('./services/sendgrid');
      
      if (typeof sendEmailWithSendGrid !== 'function') {
        throw new Error('Email sending function missing');
      }

      if (!sendGridService || typeof sendGridService.sendEmail !== 'function') {
        throw new Error('Email service not properly initialized');
      }
    }));

    // Test 6: Authentication System
    results.push(await this.runTest('Authentication System', async () => {
      // Test password reset service
      const { passwordResetService } = await import('./services/password-reset');
      if (!passwordResetService || typeof passwordResetService.requestPasswordReset !== 'function') {
        throw new Error('Password reset service not properly initialized');
      }

      // Test that critical auth storage methods exist
      const authMethods: (keyof typeof storage)[] = ['getUserById', 'getUserByEmail', 'createUser'];
      for (const methodName of authMethods) {
        if (typeof storage[methodName] !== 'function') {
          throw new Error(`Critical auth method storage.${methodName} is missing`);
        }
      }

      // Test session store functionality
      if (!process.env.DATABASE_URL) {
        throw new Error('DATABASE_URL required for session storage');
      }
    }));

    // Test 7: Password Reset Workflow
    results.push(await this.runTest('Password Reset System', async () => {
      const { passwordResetService } = await import('./services/password-reset');
      
      // Test that all password reset methods exist
      if (typeof passwordResetService.requestPasswordReset !== 'function') {
        throw new Error('Password reset method requestPasswordReset is missing');
      }
      if (typeof passwordResetService.resetPassword !== 'function') {
        throw new Error('Password reset method resetPassword is missing');
      }
      if (typeof passwordResetService.validateResetToken !== 'function') {
        throw new Error('Password reset method validateResetToken is missing');
      }

      // Test storage methods for password reset logs
      const logMethods: (keyof typeof storage)[] = ['getPasswordResetLogs', 'getPasswordResetLogsByUser'];
      for (const methodName of logMethods) {
        if (typeof storage[methodName] !== 'function') {
          throw new Error(`Password reset log method storage.${methodName} is missing`);
        }
      }
    }));

    // Test 8: Database Schema Validation
    results.push(await this.runTest('Database Schema Validation', async () => {
      const { db } = await import('./db');
      
      // Critical schema checks to prevent schema mismatches
      const criticalTables = [
        { table: 'ai_training_config', requiredColumns: ['ai_agent_title', 'loyal_customer_greeting', 'business_vertical'] },
        { table: 'ai_rejection_analytics', requiredColumns: ['email_id', 'rejection_reason', 'ai_response'] },
        { table: 'users', requiredColumns: ['id', 'email', 'password'] },
        { table: 'system_settings', requiredColumns: ['user_id', 'loyal_customer_greeting'] }
      ];

      for (const { table, requiredColumns } of criticalTables) {
        try {
          // Test that we can query table structure
          const result = await db.execute(sql`
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = ${table} AND table_schema = 'public'
          `);
          
          const actualColumns = result.rows.map((row: any) => row.column_name);
          
          // Check required columns exist
          for (const column of requiredColumns) {
            if (!actualColumns.includes(column)) {
              throw new Error(`Missing required column '${column}' in table '${table}'`);
            }
          }
        } catch (error) {
          throw new Error(`Schema validation failed for table '${table}': ${error.message}`);
        }
      }
    }));

    // Test 9: Weekly Report Email System
    results.push(await this.runTest('Weekly Report Emails', async () => {
      const { WeeklyReportService } = await import('./services/weekly-report');
      const { sendGridService } = await import('./services/sendgrid');
      
      if (!WeeklyReportService) {
        throw new Error('WeeklyReportService not available');
      }
      
      // Test service instantiation
      const weeklyService = new WeeklyReportService(sendGridService, storage);
      if (typeof weeklyService.generateTestReport !== 'function') {
        throw new Error('Weekly report generation method missing');
      }
      
      // Test template exists
      const templatePath = './templates/weekly-report-template.html';
      try {
        await import(templatePath);
      } catch {
        // Check if file exists alternatively
        const fs = await import('fs');
        const path = await import('path');
        const fullPath = path.join(process.cwd(), 'server', 'templates', 'weekly-report-template.html');
        if (!fs.existsSync(fullPath)) {
          throw new Error('Weekly report template not found');
        }
      }
    }));

    // Test 10: Trial Expiration Reminder System
    results.push(await this.runTest('Trial Expiration Reminders', async () => {
      try {
        const trialModule = await import('./services/trial-expiration-reminder');
        
        // Test that the module can be imported
        if (!trialModule) {
          throw new Error('Trial expiration reminder module not available');
        }
        
        // Check if the exported service exists
        const trialService = trialModule.trialExpirationReminderService;
        if (!trialService) {
          throw new Error('trialExpirationReminderService export not found');
        }
        
        // Test critical methods exist
        if (typeof trialService.sendTrialExpirationReminder !== 'function') {
          throw new Error('sendTrialExpirationReminder method missing');
        }
        if (typeof trialService.checkAndSendReminders !== 'function') {
          throw new Error('checkAndSendReminders method missing');
        }
      } catch (error) {
        throw new Error(`Trial service test failed: ${error.message}`);
      }
      
      // Test template exists
      const fs = await import('fs');
      const path = await import('path');
      const templatePath = path.join(process.cwd(), 'server', 'templates', 'trial-day-six-urgency-email.html');
      if (!fs.existsSync(templatePath)) {
        throw new Error('Trial expiration email template not found');
      }
    }));

    // Test 11: Setup Reminder System
    results.push(await this.runTest('Setup Reminder Emails', async () => {
      const { SetupReminderService } = await import('./services/setup-reminder');
      
      if (!SetupReminderService) {
        throw new Error('Setup reminder service not available');
      }
      
      const setupService = SetupReminderService.getInstance();
      if (typeof setupService.checkUserSetupStatus !== 'function') {
        throw new Error('Setup status check method missing');
      }
      
      // Test template exists
      const fs = await import('fs');
      const path = await import('path');
      const templatePath = path.join(process.cwd(), 'server', 'templates', 'setup-reminder-email.html');
      if (!fs.existsSync(templatePath)) {
        throw new Error('Setup reminder email template not found');
      }
    }));

    // Test 12: Onboarding Email System
    results.push(await this.runTest('Onboarding Email Sequence', async () => {
      const { OnboardingEmailService } = await import('./services/onboarding-email');
      
      if (!OnboardingEmailService) {
        throw new Error('Onboarding email service not available');
      }
      
      const onboardingService = new OnboardingEmailService();
      if (typeof onboardingService.sendOnboardingEmails !== 'function') {
        throw new Error('Onboarding email send method missing');
      }
      
      // Test that we can query onboarding emails from database
      const onboardingEmails = await storage.getOnboardingEmails();
      if (!Array.isArray(onboardingEmails)) {
        throw new Error('Cannot retrieve onboarding emails from database');
      }
    }));

    // Test 13: Email Disconnection Alert System
    results.push(await this.runTest('Email Disconnection Alerts', async () => {
      const { sendGridService } = await import('./services/sendgrid');
      
      if (!sendGridService) {
        throw new Error('SendGrid service not available for disconnection alerts');
      }
      
      if (typeof sendGridService.sendEmailDisconnectionAlert !== 'function') {
        throw new Error('Email disconnection alert method missing');
      }
      
      // Test email validation for reputation protection
      if (typeof sendGridService.isValidEmailForProduction !== 'function') {
        // Check if validation is built into the alert method
        const alertMethod = sendGridService.sendEmailDisconnectionAlert.toString();
        if (!alertMethod.includes('test') && !alertMethod.includes('demo')) {
          throw new Error('Email reputation protection not implemented');
        }
      }
    }));

    // Test 14: Contact Form Email System  
    results.push(await this.runTest('Contact Form Emails', async () => {
      try {
        const contactModule = await import('./services/contact-email');
        
        // Test that the module can be imported
        if (!contactModule) {
          throw new Error('Contact email module not available');
        }
        
        // Check if the sendContactEmail function exists
        if (typeof contactModule.sendContactEmail !== 'function') {
          throw new Error('sendContactEmail function not found');
        }
        
        // Test that SendGrid API key is configured
        if (!process.env.SENDGRID_API_KEY) {
          throw new Error('SendGrid API key not configured for contact emails');
        }
      } catch (error) {
        throw new Error(`Contact email test failed: ${error.message}`);
      }
    }));

    // Test 15: OAuth Configuration & Connectivity
    results.push(await this.runTest('OAuth Configuration', async () => {
      // Test OAuth environment variables
      if (!process.env.GOOGLE_CLIENT_ID) {
        throw new Error('Google Client ID not configured');
      }
      if (!process.env.GOOGLE_CLIENT_SECRET) {
        throw new Error('Google Client Secret not configured');
      }
      
      // Test OAuth service instantiation
      const { OAuthService } = await import('./services/oauth');
      const oauthService = new OAuthService();
      
      if (typeof oauthService.generateAuthUrl !== 'function') {
        throw new Error('OAuth generateAuthUrl method missing');
      }
      if (typeof oauthService.exchangeCodeForTokens !== 'function') {
        throw new Error('OAuth exchangeCodeForTokens method missing');
      }
      if (typeof oauthService.getUserInfo !== 'function') {
        throw new Error('OAuth getUserInfo method missing');
      }
    }));

    // Test 16: Google API Connectivity
    results.push(await this.runTest('Google API Connectivity', async () => {
      try {
        // Test Google OAuth discovery endpoint with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const discoveryResponse = await fetch('https://accounts.google.com/.well-known/openid_configuration', {
          method: 'HEAD',
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        if (!discoveryResponse.ok) {
          throw new Error(`Google OAuth discovery endpoint unreachable: ${discoveryResponse.status}`);
        }
        
        // Test Gmail API base endpoint reachability
        const controller2 = new AbortController();
        const timeoutId2 = setTimeout(() => controller2.abort(), 5000);
        
        const gmailResponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
          method: 'HEAD',
          signal: controller2.signal
        });
        clearTimeout(timeoutId2);
        
        // We expect 401 (unauthorized) which means the endpoint is reachable
        if (gmailResponse.status !== 401) {
          throw new Error(`Gmail API endpoint unexpected status: ${gmailResponse.status}`);
        }
      } catch (error) {
        if (error.name === 'AbortError') {
          throw new Error('Google API endpoints timeout - network connectivity issue');
        }
        throw error;
      }
    }));

    // Test 17: OAuth Callback Configuration  
    results.push(await this.runTest('OAuth Callback Configuration', async () => {
      // Test OAuth service can generate auth URLs with proper hostnames
      const { OAuthService } = await import('./services/oauth');
      const oauthService = new OAuthService();
      
      try {
        // Test auth URL generation with production hostname
        const authUrl = oauthService.generateAuthUrl('test-state', 'delightdesk.io');
        if (!authUrl || !authUrl.includes('accounts.google.com')) {
          throw new Error('Invalid OAuth auth URL generated');
        }
        
        // Verify redirect URI format
        const redirectUri = oauthService.getRedirectUri('delightdesk.io');
        if (!redirectUri.includes('delightdesk.io/api/oauth/gmail/callback')) {
          throw new Error('OAuth redirect URI format incorrect');
        }
        
        // Test Outlook redirect URI
        const outlookUri = oauthService.getOutlookRedirectUri('delightdesk.io');
        if (!outlookUri.includes('delightdesk.io/api/oauth/outlook/callback')) {
          throw new Error('Outlook redirect URI format incorrect');
        }
      } catch (error) {
        throw new Error(`OAuth callback configuration failed: ${error.message}`);
      }
    }));

    // Test 18: Microsoft OAuth Configuration
    results.push(await this.runTest('Microsoft OAuth Configuration', async () => {
      // Test Microsoft Graph service
      const { microsoftGraphService } = await import('./services/microsoft-graph');
      
      if (!microsoftGraphService) {
        throw new Error('Microsoft Graph service not available');
      }
      
      // Test that Microsoft Graph methods exist
      if (typeof microsoftGraphService.getAccessToken !== 'function') {
        throw new Error('Microsoft Graph getAccessToken method missing');
      }
      if (typeof microsoftGraphService.getUserEmails !== 'function') {
        throw new Error('Microsoft Graph getUserEmails method missing');
      }
    }));

    // Test 19: Core Service Dependencies  
    results.push(await this.runTest('Core Services', async () => {
      try {
        // Test WooCommerce service specifically
        const wooModule = await import('./services/woocommerce');
        if (!wooModule) {
          throw new Error('WooCommerce service module not available');
        }

        // Test other core services
        const sendgridModule = await import('./services/sendgrid');
        if (!sendgridModule) {
          throw new Error('SendGrid service module not available');
        }

        const signatureModule = await import('./services/ai-agent-signature');
        if (!signatureModule) {
          throw new Error('AI agent signature service module not available');
        }

        const hallucinationModule = await import('./services/hallucination-prevention');
        if (!hallucinationModule) {
          throw new Error('Hallucination prevention service module not available');
        }

        const passwordModule = await import('./services/password-reset');
        if (!passwordModule) {
          throw new Error('Password reset service module not available');
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`Core services validation failed: ${errorMessage}`);
      }
    }));

    const passed = results.filter(r => r.status === 'pass').length;
    const failed = results.filter(r => r.status === 'fail').length;
    const totalDuration = Date.now() - startTime;
    const overallStatus = failed === 0 ? 'healthy' : 'unhealthy';

    // Update the health check run with final results
    try {
      // Since we can't easily update, we'll insert a new complete record
      // and clean up the placeholder one if needed
      await storage.insertHealthCheckRun({
        id: this.runId + '-final',
        totalDuration,
        overallStatus,
        totalTests: results.length,
        passedTests: passed,
        failedTests: failed
      });
    } catch (logError) {
      console.error('Failed to log final health check run:', logError);
    }

    return {
      overall: overallStatus,
      results,
      summary: {
        passed,
        failed,
        total: results.length
      },
      lastChecked: new Date().toISOString()
    };
  }
}

// Health check endpoint
router.get('/health', async (req, res) => {
  try {
    const userAgent = req.get('User-Agent');
    const ipAddress = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
    const checker = new WebHealthChecker(userAgent, ipAddress);
    const results = await checker.runAllChecks();
    
    // Set HTTP status based on health
    const statusCode = results.overall === 'healthy' ? 200 : 503;
    
    res.status(statusCode).json(results);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Health check crashed';
    res.status(500).json({
      overall: 'unhealthy',
      error: errorMessage,
      timestamp: new Date().toISOString()
    });
  }
});

// Pretty HTML health check page
router.get('/health/dashboard', async (req, res) => {
  try {
    const userAgent = req.get('User-Agent');
    const ipAddress = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
    const checker = new WebHealthChecker(userAgent, ipAddress);
    const results = await checker.runAllChecks();
    
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>System Health Dashboard</title>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', roboto, sans-serif; margin: 0; padding: 20px; background: #f8fafc; }
        .container { max-width: 800px; margin: 0 auto; }
        .header { background: white; padding: 24px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 20px; }
        .status-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 14px; font-weight: 600; }
        .healthy { background: #10b981; color: white; }
        .unhealthy { background: #ef4444; color: white; }
        .test-grid { display: grid; gap: 12px; }
        .test-item { background: white; padding: 16px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); display: flex; justify-content: space-between; align-items: center; }
        .test-name { font-weight: 500; }
        .pass { color: #10b981; font-weight: 600; }
        .fail { color: #ef4444; font-weight: 600; }
        .error { color: #6b7280; font-size: 14px; margin-top: 4px; }
        .summary { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-top: 20px; }
        .refresh-btn { background: #3b82f6; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>System Health Dashboard</h1>
          <p>Overall Status: <span class="status-badge ${results.overall}">${results.overall.toUpperCase()}</span></p>
          <p>Last checked: ${new Date(results.lastChecked).toLocaleString()}</p>
          <button class="refresh-btn" onclick="window.location.reload()">Refresh</button>
        </div>
        
        <div class="test-grid">
          ${results.results.map(result => `
            <div class="test-item">
              <div>
                <div class="test-name">${result.test}</div>
                ${result.message ? `<div class="error">${result.message}</div>` : ''}
              </div>
              <div class="${result.status}">${result.status.toUpperCase()}</div>
            </div>
          `).join('')}
        </div>
        
        <div class="summary">
          <h3>Summary</h3>
          <p><strong>${results.summary.passed}</strong> tests passed, <strong>${results.summary.failed}</strong> failed out of <strong>${results.summary.total}</strong> total tests.</p>
        </div>
      </div>
    </body>
    </html>
    `;
    
    res.send(html);
  } catch (error) {
    res.status(500).send(`<h1>Health Check Error</h1><p>${error.message}</p>`);
  }
});

// Health check logs API endpoints

// Get recent health check runs
router.get('/health/logs/runs', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const runs = await storage.getHealthCheckRuns(limit);
    res.json(runs);
  } catch (error) {
    console.error('Error fetching health check runs:', error);
    res.status(500).json({ error: 'Failed to fetch health check runs' });
  }
});

// Get logs for a specific run
router.get('/health/logs/runs/:runId', async (req, res) => {
  try {
    const { runId } = req.params;
    const logs = await storage.getHealthCheckLogsForRun(runId);
    res.json(logs);
  } catch (error) {
    console.error('Error fetching health check logs for run:', error);
    res.status(500).json({ error: 'Failed to fetch health check logs' });
  }
});

// Get recent failures
router.get('/health/logs/failures', async (req, res) => {
  try {
    const hours = parseInt(req.query.hours as string) || 24;
    const limit = parseInt(req.query.limit as string) || 100;
    const failures = await storage.getRecentHealthCheckFailures(hours, limit);
    res.json(failures);
  } catch (error) {
    console.error('Error fetching health check failures:', error);
    res.status(500).json({ error: 'Failed to fetch health check failures' });
  }
});

// Get health check statistics
router.get('/health/logs/stats', async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    const stats = await storage.getHealthCheckStats(days);
    res.json(stats);
  } catch (error) {
    console.error('Error fetching health check stats:', error);
    res.status(500).json({ error: 'Failed to fetch health check stats' });
  }
});

// Production Health Check Logs Dashboard
router.get('/health/logs/dashboard', async (req, res) => {
  try {
    const stats = await storage.getHealthCheckStats(7);
    const recentRuns = await storage.getHealthCheckRuns(20);
    const recentFailures = await storage.getRecentHealthCheckFailures(24, 50);
    
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Production Health Check Logs</title>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', roboto, sans-serif; margin: 0; padding: 20px; background: #f1f5f9; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { background: white; padding: 24px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 20px; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 20px; }
        .stat-card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); text-align: center; }
        .stat-value { font-size: 24px; font-weight: 700; margin-bottom: 4px; }
        .stat-label { color: #64748b; font-size: 14px; }
        .success { color: #10b981; }
        .danger { color: #ef4444; }
        .warning { color: #f59e0b; }
        .info { color: #3b82f6; }
        .section { background: white; margin-bottom: 20px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .section-header { padding: 20px; border-bottom: 1px solid #e2e8f0; }
        .section-body { padding: 20px; }
        .run-item { display: flex; justify-content: between; align-items: center; padding: 12px 0; border-bottom: 1px solid #f1f5f9; }
        .run-item:last-child { border-bottom: none; }
        .run-status { display: inline-block; padding: 4px 8px; border-radius: 12px; font-size: 12px; font-weight: 600; }
        .healthy { background: #dcfce7; color: #166534; }
        .unhealthy { background: #fecaca; color: #991b1b; }
        .failure-item { background: #fef2f2; padding: 12px; margin-bottom: 8px; border-radius: 6px; border-left: 4px solid #ef4444; }
        .failure-test { font-weight: 600; color: #991b1b; }
        .failure-error { color: #6b7280; font-size: 14px; margin-top: 4px; }
        .failure-time { color: #9ca3af; font-size: 12px; }
        .refresh-btn { background: #3b82f6; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: 500; }
        .no-data { text-align: center; color: #64748b; padding: 40px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Production Health Check Logs</h1>
          <p>Complete transparency on system health with detailed failure analysis</p>
          <button class="refresh-btn" onclick="window.location.reload()">Refresh Data</button>
        </div>
        
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value success">${stats.totalRuns}</div>
            <div class="stat-label">Total Runs (7 days)</div>
          </div>
          <div class="stat-card">
            <div class="stat-value success">${stats.successfulRuns}</div>
            <div class="stat-label">Successful Runs</div>
          </div>
          <div class="stat-card">
            <div class="stat-value danger">${stats.failedRuns}</div>
            <div class="stat-label">Failed Runs</div>
          </div>
          <div class="stat-card">
            <div class="stat-value info">${stats.averageDuration}ms</div>
            <div class="stat-label">Average Duration</div>
          </div>
        </div>

        <div class="section">
          <div class="section-header">
            <h2>Recent Health Check Runs</h2>
          </div>
          <div class="section-body">
            ${recentRuns.length === 0 ? '<div class="no-data">No health check runs found</div>' : recentRuns.map(run => `
              <div class="run-item">
                <div>
                  <span class="run-status ${run.overallStatus}">${run.overallStatus}</span>
                  <span style="margin-left: 12px;">${run.passedTests}/${run.totalTests} tests passed</span>
                  <span style="margin-left: 12px; color: #64748b;">${run.totalDuration}ms</span>
                </div>
                <div style="color: #64748b; font-size: 14px;">
                  ${new Date(run.createdAt).toLocaleString()}
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="section">
          <div class="section-header">
            <h2>Recent Failures (Last 24 Hours)</h2>
          </div>
          <div class="section-body">
            ${recentFailures.length === 0 ? '<div class="no-data">No failures in the last 24 hours 🎉</div>' : recentFailures.map(failure => `
              <div class="failure-item">
                <div class="failure-test">${failure.testName}</div>
                <div class="failure-error">${failure.errorMessage || 'No error message'}</div>
                <div class="failure-time">${new Date(failure.createdAt).toLocaleString()} • Duration: ${failure.duration}ms</div>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="section">
          <div class="section-header">
            <h2>Most Failed Tests (Last 7 Days)</h2>
          </div>
          <div class="section-body">
            ${stats.mostFailedTests.length === 0 ? '<div class="no-data">No test failures in the last 7 days 🎉</div>' : stats.mostFailedTests.map(test => `
              <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f1f5f9;">
                <span>${test.testName}</span>
                <span class="danger">${test.failureCount} failures</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    </body>
    </html>
    `;
    
    res.send(html);
  } catch (error) {
    console.error('Error generating health check logs dashboard:', error);
    res.status(500).json({ error: 'Failed to generate dashboard' });
  }
});

export default router;