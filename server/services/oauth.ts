import { OAuth2Client } from 'google-auth-library';
import { logger, LogCategory } from './logger';
import { microsoftGraphService } from './microsoft-graph';
import { storage } from '../storage';

interface OAuthTokens {
  access_token: string;
  refresh_token?: string;
  email: string;
  expires_in?: number;
}

interface ShipBobTokens {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  channelId?: string;
}

export class OAuthService {
  private oauth2Client: OAuth2Client;
  private scopes = [
    'https://www.googleapis.com/auth/gmail.modify',  // Full read/write access including delete and mark as read
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/userinfo.email'
  ];

  constructor() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    this.oauth2Client = new OAuth2Client(
      clientId,
      clientSecret,
      this.getRedirectUri()
    );
  }

  getRedirectUri(hostname?: string): string {
    if (hostname) {
      return `https://${hostname}/api/oauth/gmail/callback`;
    }
    
    // Fallback for constructor - will be overridden in actual OAuth flows
    return 'https://placeholder.com/api/oauth/gmail/callback';
  }

  getOutlookRedirectUri(hostname: string): string {
    return `https://${hostname}/api/oauth/outlook/callback`;
  }

  generateAuthUrl(state: string, hostname: string): string {
    // Create a temporary OAuth2Client with the correct redirect URI for this request
    const tempClient = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      this.getRedirectUri(hostname)
    );

    return tempClient.generateAuthUrl({
      access_type: 'offline',
      scope: this.scopes,
      state,
      prompt: 'consent',
      include_granted_scopes: true,
    });
  }

  async exchangeCodeForTokens(code: string, hostname?: string) {
    // Create a temporary OAuth2Client with the correct redirect URI for this token exchange
    const oauth2Client = hostname 
      ? new OAuth2Client(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET,
          this.getRedirectUri(hostname)
        )
      : this.oauth2Client;

    const { tokens } = await oauth2Client.getToken(code);
    return {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_in: tokens.expiry_date ? Math.floor((tokens.expiry_date - Date.now()) / 1000) : 3600,
      scope: this.scopes.join(' '),
    };
  }

  async getUserInfo(accessToken: string) {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return response.json();
  }

  // Gmail inbox synchronization methods
  async markEmailAsRead(accessToken: string, messageId: string): Promise<void> {
    const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        removeLabelIds: ['UNREAD']
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to mark email as read: ${response.statusText}`);
    }
  }

  async deleteEmail(accessToken: string, messageId: string): Promise<void> {
    const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/trash`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to delete email: ${response.statusText}`);
    }
  }

  async moveEmailToFolder(accessToken: string, messageId: string, folderName: string): Promise<void> {
    // First get current labels
    const messageResponse = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!messageResponse.ok) {
      throw new Error(`Failed to get message details: ${messageResponse.statusText}`);
    }

    const message = await messageResponse.json();
    const currentLabelIds = message.labelIds || [];

    // Get available labels to find the target folder
    const labelsResponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!labelsResponse.ok) {
      throw new Error(`Failed to get labels: ${labelsResponse.statusText}`);
    }

    const labels = await labelsResponse.json();
    const targetLabel = labels.labels.find((label: any) => label.name === folderName);

    if (!targetLabel) {
      throw new Error(`Folder '${folderName}' not found`);
    }

    // Move message by modifying labels
    const modifyResponse = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        addLabelIds: [targetLabel.id],
        removeLabelIds: currentLabelIds.filter((id: string) => id !== targetLabel.id)
      }),
    });

    if (!modifyResponse.ok) {
      throw new Error(`Failed to move email to folder: ${modifyResponse.statusText}`);
    }
  }

  // Legacy methods for backwards compatibility
  getGmailAuthUrl(userId?: string, hostname?: string): string {
    const state = userId || 'user1';
    const host = hostname || 'placeholder.com';
    
    logger.info(LogCategory.OAUTH, 'Generating Gmail auth URL', { 
      userId, 
      hostname: host,
      redirect_uri: this.getRedirectUri(host),
      environment: process.env.NODE_ENV
    });
    
    const authUrl = this.generateAuthUrl(state, host);
    logger.debug(LogCategory.OAUTH, 'Gmail auth URL generated', { authUrl: authUrl.substring(0, 100) + '...' });
    
    return authUrl;
  }

  async getOutlookAuthUrl(userId?: string, hostname?: string): Promise<string> {
    const host = hostname || 'placeholder.com';
    const redirectUri = this.getOutlookRedirectUri(host);
      
    const state = userId || 'user1';
      
    logger.info(LogCategory.OAUTH, 'Generating Outlook auth URL', { 
      userId, 
      redirect_uri: redirectUri,
      environment: process.env.NODE_ENV,
      state
    });
    
    try {
      const authUrl = await microsoftGraphService.getAuthorizationUrl(redirectUri, state);
      logger.debug(LogCategory.OAUTH, 'Outlook auth URL generated', { authUrl: authUrl.substring(0, 100) + '...' });
      return authUrl;
    } catch (error) {
      logger.error(LogCategory.OAUTH, 'Failed to generate Outlook auth URL', { 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error('Failed to generate Outlook authorization URL');
    }
  }

  async exchangeGmailCode(code: string, hostname?: string): Promise<OAuthTokens> {
    try {
      logger.info(LogCategory.OAUTH, 'Starting Gmail token exchange', { codeLength: code.length, hostname });
      
      const tokens = await this.exchangeCodeForTokens(code, hostname);
      const userInfo = await this.getUserInfo(tokens.access_token!);
      
      logger.info(LogCategory.OAUTH, 'Gmail OAuth completed successfully', { email: userInfo.email });

      return {
        access_token: tokens.access_token!,
        refresh_token: tokens.refresh_token || undefined,
        email: userInfo.email,
        expires_in: tokens.expires_in,
      };
    } catch (error) {
      logger.error(LogCategory.OAUTH, 'Gmail OAuth exchange error', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined 
      });
      throw new Error('Failed to connect Gmail account');
    }
  }

  async exchangeOutlookCode(code: string, state: string): Promise<OAuthTokens> {
    try {
      logger.info(LogCategory.OAUTH, 'Starting Outlook token exchange', { 
        codeLength: code.length,
        state 
      });
      
      const redirectUri = this.getOutlookRedirectUri(state);
      
      const tokens = await microsoftGraphService.exchangeCodeForTokens(code, redirectUri, state);
      
      logger.info(LogCategory.OAUTH, 'Outlook OAuth completed successfully', { 
        email: tokens.userEmail,
        userName: tokens.userName
      });

      return {
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        email: tokens.userEmail,
        expires_in: Math.floor((tokens.expiresAt.getTime() - Date.now()) / 1000),
      };
    } catch (error) {
      logger.error(LogCategory.OAUTH, 'Outlook OAuth exchange error', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined 
      });
      throw new Error('Failed to connect Outlook account');
    }
  }

  async refreshGmailToken(refreshToken: string): Promise<OAuthTokens> {
    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          refresh_token: refreshToken,
          client_id: process.env.GOOGLE_CLIENT_ID || '',
          client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
          grant_type: 'refresh_token',
        }),
      });

      const tokens = await response.json();
      
      return {
        access_token: tokens.access_token,
        refresh_token: refreshToken, // Keep existing refresh token
        email: '', // Will need to be updated by caller
        expires_in: tokens.expires_in,
      };
    } catch (error) {
      console.error('Gmail token refresh error:', error);
      throw new Error('Failed to refresh Gmail token');
    }
  }

  async refreshOutlookToken(refreshToken: string): Promise<OAuthTokens> {
    try {
      logger.info(LogCategory.OAUTH, 'Starting Outlook token refresh', { 
        refreshTokenLength: refreshToken.length 
      });
      
      const tokens = await microsoftGraphService.refreshAccessToken(refreshToken);
      
      logger.info(LogCategory.OAUTH, 'Outlook token refresh completed successfully');
      
      return {
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        email: '', // Will need to be updated by caller
        expires_in: Math.floor((tokens.expiresAt.getTime() - Date.now()) / 1000),
      };
    } catch (error) {
      logger.error(LogCategory.OAUTH, 'Outlook token refresh error', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined 
      });
      throw new Error('Failed to refresh Outlook token');
    }
  }

  // WooCommerce OAuth methods
  getWooCommerceAuthUrl(storeUrl: string, userId?: string): string {
    const state = userId || 'user1';
    
    // Ensure store URL uses HTTPS for proper session handling
    const httpsStoreUrl = storeUrl.replace(/^http:\/\//, 'https://');
    
    const callbackUrl = `${this.getWooCommerceRedirectUri()}?store_url=${encodeURIComponent(httpsStoreUrl)}`;
    
    logger.info(LogCategory.OAUTH, 'Generating WooCommerce auth URL', { 
      userId, 
      storeUrl: httpsStoreUrl,
      originalUrl: storeUrl,
      state,
      callbackUrl,
      environment: process.env.NODE_ENV
    });
    
    const params = new URLSearchParams({
      app_name: 'Customer Service Automation',
      scope: 'read_write',
      user_id: state,
      return_url: callbackUrl,
      callback_url: callbackUrl,
    });

    const authUrl = `${httpsStoreUrl}/wc-auth/v1/authorize?${params.toString()}`;
    logger.debug(LogCategory.OAUTH, 'WooCommerce auth URL generated', { 
      authUrl,
      fullUrl: authUrl
    });
    
    return authUrl;
  }

  private getWooCommerceRedirectUri(): string {
    const isDev = process.env.NODE_ENV === 'development';
    const replitDomains = process.env.REPLIT_DOMAINS;

    // For development, use the Replit domain with HTTPS
    if (isDev && replitDomains) {
      const domains = replitDomains.split(',');
      const devDomain = `https://${domains[0]}/oauth/woocommerce/callback`;
      
      logger.info(LogCategory.OAUTH, 'Using Replit development callback URL', { 
        callbackUrl: devDomain,
        environment: process.env.NODE_ENV,
        replitDomain: domains[0]
      });
      return devDomain;
    }

    // For production, use the verified domain
    const productionDomain = 'https://delightdesk.io/oauth/woocommerce/callback';
    
    if (replitDomains && !isDev) {
      const domains = replitDomains.split(',');
      // Check if we have the verified domain in REPLIT_DOMAINS
      if (domains.includes('delightdesk.io')) {
        return `https://delightdesk.io/oauth/woocommerce/callback`;
      }
      return `https://${domains[0]}/oauth/woocommerce/callback`;
    }

    logger.info(LogCategory.OAUTH, 'Using production callback URL', { 
      callbackUrl: productionDomain,
      environment: process.env.NODE_ENV
    });
    return productionDomain;
  }

  async handleWooCommerceCallback(bodyParams: Record<string, string>, queryParams: Record<string, string>) {
    const startTime = Date.now();
    
    // WooCommerce sends data via POST body, not query params
    const allParams = { ...queryParams, ...bodyParams };
    
    // Log all parameters to debug what WooCommerce is actually sending
    logger.info(LogCategory.OAUTH, 'WooCommerce callback - all parameters', { 
      bodyParams,
      queryParams,
      allParams,
      parameterCount: Object.keys(allParams).length
    });

    // Log to database for troubleshooting
    await this.logIntegrationEvent('woocommerce', 'auth_callback', 'pending', {
      bodyParams,
      queryParams, 
      allParams,
      parameterCount: Object.keys(allParams).length,
      hasSuccess: 'success' in allParams,
      successValue: allParams.success
    });
    
    const { 
      success, 
      user_id, 
      consumer_key, 
      consumer_secret, 
      key_id,
      // WooCommerce might send these alternative parameter names
      api_key,
      api_secret,
      // Or these
      oauth_consumer_key,
      oauth_consumer_secret
    } = allParams;
    
    // WooCommerce doesn't send success=1 on successful authorization, only credentials
    // Only fail if explicitly denied (success=0) or if we have no credentials at all

    // Check for explicit denial first
    if (success === '0') {
      await this.logIntegrationEvent('woocommerce', 'auth_callback', 'failed', {
        reason: 'authorization_denied',
        successValue: success,
        allParams
      });
      throw new Error('WooCommerce OAuth authorization was explicitly denied');
    }

    // Try different possible parameter names that WooCommerce might use
    const accessToken = consumer_key || key_id || api_key || oauth_consumer_key;
    const refreshToken = consumer_secret || api_secret || oauth_consumer_secret;

    if (!accessToken) {
      const errorData = {
        allParams,
        availableParams: Object.keys(allParams),
        paramValues: Object.entries(allParams).map(([k, v]) => `${k}=${v}`),
        reason: 'missing_credentials'
      };
      
      logger.error(LogCategory.OAUTH, 'Missing WooCommerce credentials - dumping all parameters', errorData);
      
      await this.logIntegrationEvent('woocommerce', 'auth_callback', 'failed', errorData);
      
      // If we still don't have credentials, it might be a WooCommerce configuration issue
      throw new Error(`Missing WooCommerce OAuth credentials. Received parameters: ${Object.keys(allParams).join(', ')}`);
    }

    logger.info(LogCategory.OAUTH, 'WooCommerce credentials found', {
      hasAccessToken: !!accessToken,
      hasRefreshToken: !!refreshToken,
      userId: user_id,
      duration: Date.now() - startTime
    });

    // Log successful credential retrieval
    await this.logIntegrationEvent('woocommerce', 'auth_callback', 'success', {
      hasAccessToken: !!accessToken,
      hasRefreshToken: !!refreshToken,
      accessTokenSource: consumer_key ? 'consumer_key' : key_id ? 'key_id' : api_key ? 'api_key' : 'oauth_consumer_key',
      refreshTokenSource: consumer_secret ? 'consumer_secret' : api_secret ? 'api_secret' : 'oauth_consumer_secret'
    }, undefined, undefined, undefined, undefined, user_id, Date.now() - startTime);

    return {
      access_token: accessToken,
      refresh_token: refreshToken || 'no-refresh-token',
      expires_in: null, // WooCommerce keys don't expire
      scope: 'read_write',
      user_id,
    };
  }

  // Shopify OAuth methods
  getShopifyAuthUrl(shopDomain: string, userId?: string): string {
    const shopifyApiKey = process.env.SHOPIFY_API_KEY;
    if (!shopifyApiKey) {
      throw new Error('SHOPIFY_API_KEY environment variable is not set');
    }

    const state = userId || 'user1';
    const scopes = 'read_orders,read_customers,read_products,write_orders,read_fulfillments';
    const redirectUri = this.getShopifyRedirectUri();
    
    logger.info(LogCategory.OAUTH, 'Generating Shopify auth URL', { 
      userId, 
      shopDomain,
      state,
      redirectUri,
      environment: process.env.NODE_ENV
    });
    
    const params = new URLSearchParams({
      client_id: shopifyApiKey,
      scope: scopes,
      redirect_uri: redirectUri,
      state: `${state}|${shopDomain}`, // Include shop domain in state
    });

    const authUrl = `https://${shopDomain}/admin/oauth/authorize?${params.toString()}`;
    logger.debug(LogCategory.OAUTH, 'Shopify auth URL generated', { authUrl: authUrl.substring(0, 100) + '...' });
    
    return authUrl;
  }

  private getShopifyRedirectUri(): string {
    // For development, always use localhost (must be configured in Shopify Partner app)
    const isDev = process.env.NODE_ENV === 'development';
    
    if (isDev) {
      const callbackUrl = 'http://localhost:5000/api/oauth/shopify/callback';
      logger.info(LogCategory.OAUTH, 'Using Shopify callback URL (development)', { callbackUrl });
      return callbackUrl;
    }

    // For production, use the verified domain
    const replitDomains = process.env.REPLIT_DOMAINS;
    if (replitDomains) {
      const domains = replitDomains.split(',');
      // Check if we have the verified domain in REPLIT_DOMAINS
      if (domains.includes('delightdesk.io')) {
        const callbackUrl = `https://delightdesk.io/api/oauth/shopify/callback`;
        logger.info(LogCategory.OAUTH, 'Using Shopify callback URL (verified domain)', { callbackUrl });
        return callbackUrl;
      }
      const callbackUrl = `https://${domains[0]}/api/oauth/shopify/callback`;
      logger.info(LogCategory.OAUTH, 'Using Shopify callback URL (production)', { callbackUrl });
      return callbackUrl;
    }

    // Use verified domain as fallback for production
    const callbackUrl = 'https://delightdesk.io/api/oauth/shopify/callback';
    logger.info(LogCategory.OAUTH, 'Using Shopify callback URL (verified domain fallback)', { callbackUrl });
    return callbackUrl;
  }

  async exchangeShopifyCode(shopDomain: string, code: string): Promise<{ access_token: string; shop: string }> {
    const shopifyApiKey = process.env.SHOPIFY_API_KEY;
    const shopifyApiSecret = process.env.SHOPIFY_API_SECRET;
    
    if (!shopifyApiKey || !shopifyApiSecret) {
      throw new Error('Shopify API credentials are not configured');
    }

    logger.info(LogCategory.OAUTH, 'Starting Shopify token exchange', { shopDomain, codeLength: code.length });

    const response = await fetch(`https://${shopDomain}/admin/oauth/access_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: shopifyApiKey,
        client_secret: shopifyApiSecret,
        code,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error(LogCategory.OAUTH, 'Shopify token exchange failed', { error, status: response.status, shopDomain });
      throw new Error('Failed to exchange authorization code for access token');
    }

    const tokens = await response.json();
    
    logger.info(LogCategory.OAUTH, 'Shopify OAuth completed successfully', { shopDomain });

    return {
      access_token: tokens.access_token,
      shop: shopDomain,
    };
  }

  // ShipBob OAuth Methods
  async getShipBobAuthUrl(userId: string, hostname: string): Promise<string> {
    const baseUrl = process.env.NODE_ENV === 'development'
      ? `https://${hostname}`
      : 'https://delightdesk.io';
    
    const redirectUri = `${baseUrl}/api/oauth/shipbob/callback`;
    
    // ShipBob OAuth endpoint
    const shipbobAuthUrl = process.env.SHIPBOB_SANDBOX === 'true'
      ? 'https://auth.shipbob.com/oauth/authorize'  // Sandbox
      : 'https://auth.shipbob.com/oauth/authorize';  // Production
    
    const params = new URLSearchParams({
      client_id: process.env.SHIPBOB_CLIENT_ID!,
      response_type: 'code',
      redirect_uri: redirectUri,
      state: userId,
      scope: 'orders:read orders:write inventory:read channels:read'
    });

    const authUrl = `${shipbobAuthUrl}?${params.toString()}`;
    
    logger.info(LogCategory.OAUTH, 'Generated ShipBob auth URL', { 
      userId, 
      redirectUri,
      environment: process.env.NODE_ENV
    });
    
    return authUrl;
  }

  async exchangeShipBobCode(code: string): Promise<ShipBobTokens> {
    const tokenUrl = process.env.SHIPBOB_SANDBOX === 'true'
      ? 'https://auth.shipbob.com/oauth/token'  // Sandbox
      : 'https://auth.shipbob.com/oauth/token';  // Production

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: process.env.SHIPBOB_CLIENT_ID!,
        client_secret: process.env.SHIPBOB_CLIENT_SECRET!,
        code,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(LogCategory.OAUTH, 'ShipBob token exchange failed', { 
        status: response.status, 
        error: errorText 
      });
      throw new Error(`ShipBob OAuth failed: ${response.status} - ${errorText}`);
    }

    const tokenData = await response.json();
    
    logger.info(LogCategory.OAUTH, 'ShipBob token exchange successful', { 
      hasAccessToken: !!tokenData.access_token,
      hasRefreshToken: !!tokenData.refresh_token,
      expiresIn: tokenData.expires_in
    });

    // Get available channels for the user
    let channelId = null;
    try {
      const channelsResponse = await fetch('https://api.shipbob.com/1.0/channel', {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (channelsResponse.ok) {
        const channels = await channelsResponse.json();
        if (channels && channels.length > 0) {
          channelId = channels[0].id.toString();
        }
      }
    } catch (error) {
      logger.warn(LogCategory.OAUTH, 'Could not fetch ShipBob channels during OAuth', { error });
    }

    return {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_in: tokenData.expires_in || 3600,
      channelId
    };
  }

  // Integration logging method for troubleshooting
  private async logIntegrationEvent(
    integration: string,
    action: string,
    status: string,
    data: any,
    storeUrl?: string,
    endpoint?: string,
    httpMethod?: string,
    statusCode?: number,
    userId?: string,
    duration?: number,
    error?: Error
  ) {
    try {
      await storage.createIntegrationLog({
        userId,
        integration,
        action,
        status,
        storeUrl,
        endpoint,
        httpMethod,
        statusCode,
        requestData: data.requestData ? JSON.stringify(data.requestData) : null,
        responseData: data.responseData ? JSON.stringify(data.responseData) : null,
        errorMessage: error?.message || data.errorMessage || data.reason,
        errorStack: error?.stack,
        duration,
        metadata: JSON.stringify({
          ...data,
          timestamp: new Date().toISOString(),
          userAgent: data.userAgent,
          ipAddress: data.ipAddress
        })
      });
    } catch (logError) {
      logger.error(LogCategory.OAUTH, 'Failed to log integration event', { 
        error: logError instanceof Error ? logError.message : logError 
      });
    }
  }
}

export const oauthService = new OAuthService();
