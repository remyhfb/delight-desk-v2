import { ConfidentialClientApplication, AuthenticationResult } from '@azure/msal-node';
import { Client } from '@microsoft/microsoft-graph-client';
import { AuthenticationProvider } from '@microsoft/microsoft-graph-client';
import { TokenCredentialAuthenticationProvider } from '@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials';
import { ClientSecretCredential } from '@azure/identity';
import { logger, LogCategory } from './logger';

// MSAL Configuration
const msalConfig = {
  auth: {
    clientId: process.env.MICROSOFT_CLIENT_ID!,
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
    authority: `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID}`,
  },
  system: {
    loggerOptions: {
      loggerCallback: (level: any, message: string, containsPii: boolean) => {
        if (!containsPii) {
          logger.info(LogCategory.EMAIL, `MSAL: ${message}`);
        }
      },
      piiLoggingEnabled: false,
      logLevel: 3, // Info level
    },
  },
};

// Required scopes for email operations
export const MICROSOFT_SCOPES = [
  'https://graph.microsoft.com/Mail.ReadWrite',  // Full read/write access including delete and modify
  'https://graph.microsoft.com/Mail.Send',
  'https://graph.microsoft.com/User.Read',
  'offline_access', // For refresh tokens
];

export class MicrosoftGraphService {
  private msalInstance: ConfidentialClientApplication;
  private graphClient: Client | null = null;

  constructor() {
    this.msalInstance = new ConfidentialClientApplication(msalConfig);
  }

  /**
   * Generate authorization URL for OAuth flow
   */
  async getAuthorizationUrl(redirectUri: string, state: string): Promise<string> {
    try {
      const authUrlParameters = {
        scopes: MICROSOFT_SCOPES,
        redirectUri,
        state,
        prompt: 'select_account', // Allow user to choose account
      };

      const response = await this.msalInstance.getAuthCodeUrl(authUrlParameters);
      return response;
    } catch (error) {
      console.error('Error generating Microsoft auth URL:', error);
      throw new Error('Failed to generate authorization URL');
    }
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string, redirectUri: string, state: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
    userEmail: string;
    userName: string;
  }> {
    try {
      const tokenRequest = {
        code,
        scopes: MICROSOFT_SCOPES,
        redirectUri,
        state,
      };

      const response = await this.msalInstance.acquireTokenByCode(tokenRequest);
      
      if (!response) {
        throw new Error('No token response received');
      }

      // Get user profile information
      const graphClient = this.createGraphClient(response.accessToken);
      const userProfile = await graphClient.api('/me').get();

      return {
        accessToken: response.accessToken,
        refreshToken: response.account?.homeAccountId || '',
        expiresAt: response.expiresOn || new Date(Date.now() + 3600000), // 1 hour default
        userEmail: userProfile.mail || userProfile.userPrincipalName,
        userName: userProfile.displayName || userProfile.givenName,
      };
    } catch (error) {
      console.error('Error exchanging code for tokens:', error);
      throw new Error('Failed to exchange authorization code');
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
  }> {
    try {
      const refreshTokenRequest = {
        refreshToken,
        scopes: MICROSOFT_SCOPES,
      };

      const response = await this.msalInstance.acquireTokenByRefreshToken(refreshTokenRequest);
      
      if (!response) {
        throw new Error('No token response received');
      }

      return {
        accessToken: response.accessToken,
        refreshToken: response.account?.homeAccountId || refreshToken, // Keep old if new not provided
        expiresAt: response.expiresOn || new Date(Date.now() + 3600000),
      };
    } catch (error) {
      console.error('Error refreshing Microsoft token:', error);
      throw new Error('Failed to refresh access token');
    }
  }

  /**
   * Create Microsoft Graph client with access token
   */
  private createGraphClient(accessToken: string): Client {
    const authProvider: AuthenticationProvider = {
      getAccessToken: async () => accessToken,
    };

    return Client.initWithMiddleware({ authProvider });
  }

  /**
   * Get authenticated Graph client for user
   */
  async getGraphClient(accessToken: string): Promise<Client> {
    if (!this.graphClient) {
      this.graphClient = this.createGraphClient(accessToken);
    }
    return this.graphClient;
  }

  /**
   * Test connection and get user profile
   */
  async testConnection(accessToken: string): Promise<{
    success: boolean;
    userEmail: string;
    userName: string;
    error?: string;
  }> {
    try {
      const graphClient = await this.getGraphClient(accessToken);
      const userProfile = await graphClient.api('/me').get();

      return {
        success: true,
        userEmail: userProfile.mail || userProfile.userPrincipalName,
        userName: userProfile.displayName || userProfile.givenName,
      };
    } catch (error) {
      console.error('Microsoft Graph connection test failed:', error);
      return {
        success: false,
        userEmail: '',
        userName: '',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Fetch emails from Microsoft Graph API
   */
  async fetchEmails(accessToken: string, options: {
    folder?: string;
    maxResults?: number;
    sinceDate?: Date;
    unreadOnly?: boolean;
  } = {}): Promise<any[]> {
    try {
      const graphClient = await this.getGraphClient(accessToken);
      
      // Use specific folder endpoint if folder specified
      let apiPath = '/me/messages';
      if (options.folder) {
        // For inbox folder, use specific endpoint to avoid junk/spam
        if (options.folder.toLowerCase() === 'inbox') {
          apiPath = '/me/mailFolders/inbox/messages';
        }
      }
      
      let query = graphClient.api(apiPath)
        .select(['id', 'subject', 'from', 'toRecipients', 'receivedDateTime', 'bodyPreview', 'body', 'isRead', 'hasAttachments'])
        .top(options.maxResults || 50)
        .orderby('receivedDateTime desc');

      // Add filtering options
      const filters: string[] = [];
      
      if (options.sinceDate) {
        filters.push(`receivedDateTime ge ${options.sinceDate.toISOString()}`);
      }
      
      if (options.unreadOnly) {
        filters.push('isRead eq false');
      }

      if (filters.length > 0) {
        query = query.filter(filters.join(' and '));
      }

      const response = await query.get();
      return response.value || [];
    } catch (error) {
      console.error('Error fetching Microsoft emails:', error);
      throw new Error('Failed to fetch emails from Microsoft Graph');
    }
  }

  /**
   * Send email via Microsoft Graph API
   */
  async sendEmail(accessToken: string, emailData: {
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject: string;
    body: string;
    isHtml?: boolean;
  }): Promise<void> {
    try {
      const graphClient = await this.getGraphClient(accessToken);

      const message = {
        subject: emailData.subject,
        body: {
          contentType: emailData.isHtml ? 'HTML' : 'Text',
          content: emailData.body,
        },
        toRecipients: emailData.to.map(email => ({
          emailAddress: { address: email }
        })),
        ccRecipients: emailData.cc?.map(email => ({
          emailAddress: { address: email }
        })) || [],
        bccRecipients: emailData.bcc?.map(email => ({
          emailAddress: { address: email }
        })) || [],
      };

      await graphClient.api('/me/sendMail').post({
        message,
        saveToSentItems: true,
      });
    } catch (error) {
      console.error('Error sending Microsoft email:', error);
      throw new Error('Failed to send email via Microsoft Graph');
    }
  }

  /**
   * Mark email as read/unread
   */
  async markEmailAsRead(accessToken: string, messageId: string, isRead: boolean = true): Promise<void> {
    try {
      const graphClient = await this.getGraphClient(accessToken);
      
      await graphClient.api(`/me/messages/${messageId}`).patch({
        isRead: isRead
      });
    } catch (error) {
      console.error('Error marking Microsoft email as read:', error);
      throw new Error('Failed to mark email as read');
    }
  }

  /**
   * Delete email (move to deleted items)
   */
  async deleteEmail(accessToken: string, messageId: string): Promise<void> {
    try {
      const graphClient = await this.getGraphClient(accessToken);
      
      await graphClient.api(`/me/messages/${messageId}`).delete();
    } catch (error) {
      console.error('Error deleting Microsoft email:', error);
      throw new Error('Failed to delete email');
    }
  }

  /**
   * Move email to folder
   */
  async moveEmailToFolder(accessToken: string, messageId: string, folderId: string): Promise<void> {
    try {
      const graphClient = await this.getGraphClient(accessToken);
      
      await graphClient.api(`/me/messages/${messageId}/move`).post({
        destinationId: folderId
      });
    } catch (error) {
      console.error('Error moving Microsoft email:', error);
      throw new Error('Failed to move email to folder');
    }
  }

  /**
   * Get email folders
   */
  async getEmailFolders(accessToken: string): Promise<any[]> {
    try {
      const graphClient = await this.getGraphClient(accessToken);
      
      const response = await graphClient.api('/me/mailFolders')
        .select(['id', 'displayName', 'childFolderCount', 'unreadItemCount', 'totalItemCount'])
        .get();

      return response.value || [];
    } catch (error) {
      console.error('Error fetching Microsoft email folders:', error);
      throw new Error('Failed to fetch email folders');
    }
  }
}

// Export singleton instance
export const microsoftGraphService = new MicrosoftGraphService();