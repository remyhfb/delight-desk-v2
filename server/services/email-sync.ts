import { oauthService } from './oauth';
import { microsoftGraphService } from './microsoft-graph';
import { storage } from '../storage';
import { logger, LogCategory } from './logger';

interface EmailSyncAction {
  userId: string;
  emailId: string;
  originalMessageId: string; // Gmail message ID or Microsoft Graph message ID
  provider: 'gmail' | 'outlook';
  action: 'mark_read' | 'delete' | 'move_folder';
  folderName?: string;
  folderId?: string;
}

export class EmailSyncService {
  /**
   * Synchronize escalation queue actions with the user's real inbox
   */
  async syncEscalationAction(action: EmailSyncAction): Promise<void> {
    try {
      logger.info(LogCategory.EMAIL, 'Starting inbox synchronization', {
        userId: action.userId,
        emailId: action.emailId,
        provider: action.provider,
        action: action.action
      });

      // Get user's email account connection
      const emailAccounts = await storage.getEmailAccounts(action.userId);
      const account = emailAccounts.find(acc => 
        (action.provider === 'gmail' && acc.provider === 'google') ||
        (action.provider === 'outlook' && acc.provider === 'microsoft')
      );

      if (!account) {
        throw new Error(`No ${action.provider} account connected for user ${action.userId}`);
      }

      // Check if token needs refresh
      const now = new Date();
      // Skip token expiry check - tokenExpiresAt not in current schema
      // await this.refreshTokenIfNeeded(account);

      // Execute sync action based on provider
      if (action.provider === 'gmail') {
        await this.syncGmailAction(account.accessToken || '', action);
      } else if (action.provider === 'outlook') {
        await this.syncOutlookAction(account.accessToken || '', action);
      }

      logger.info(LogCategory.EMAIL, 'Inbox synchronization completed successfully', {
        userId: action.userId,
        emailId: action.emailId,
        action: action.action
      });

    } catch (error) {
      logger.error(LogCategory.EMAIL, 'Failed to synchronize with inbox', {
        userId: action.userId,
        emailId: action.emailId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  private async syncGmailAction(accessToken: string, action: EmailSyncAction): Promise<void> {
    switch (action.action) {
      case 'mark_read':
        await oauthService.markEmailAsRead(accessToken, action.originalMessageId);
        break;
      
      case 'delete':
        await oauthService.deleteEmail(accessToken, action.originalMessageId);
        break;
      
      case 'move_folder':
        if (!action.folderName) {
          throw new Error('Folder name required for move action');
        }
        await oauthService.moveEmailToFolder(accessToken, action.originalMessageId, action.folderName);
        break;
      
      default:
        throw new Error(`Unsupported Gmail sync action: ${action.action}`);
    }
  }

  private async syncOutlookAction(accessToken: string, action: EmailSyncAction): Promise<void> {
    switch (action.action) {
      case 'mark_read':
        await microsoftGraphService.markEmailAsRead(accessToken, action.originalMessageId, true);
        break;
      
      case 'delete':
        await microsoftGraphService.deleteEmail(accessToken, action.originalMessageId);
        break;
      
      case 'move_folder':
        if (!action.folderId) {
          throw new Error('Folder ID required for Outlook move action');
        }
        await microsoftGraphService.moveEmailToFolder(accessToken, action.originalMessageId, action.folderId);
        break;
      
      default:
        throw new Error(`Unsupported Outlook sync action: ${action.action}`);
    }
  }

  private async refreshTokenIfNeeded(account: any): Promise<void> {
    try {
      if (account.provider === 'google') {
        const newTokens = await oauthService.refreshGmailToken(account.refreshToken);
        await storage.updateEmailAccount(account.id, {
          accessToken: newTokens.access_token
        });
      } else if (account.provider === 'microsoft') {
        const newTokens = await microsoftGraphService.refreshAccessToken(account.refreshToken);
        await storage.updateEmailAccount(account.id, {
          accessToken: newTokens.accessToken
        });
      }
    } catch (error) {
      logger.error(LogCategory.EMAIL, 'Failed to refresh token', {
        accountId: account.id,
        provider: account.provider,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get available folders for a user's email account
   */
  async getEmailFolders(userId: string, provider: 'gmail' | 'outlook'): Promise<Array<{id: string, name: string}>> {
    try {
      const emailAccounts = await storage.getUserEmailAccounts(userId);
      const account = emailAccounts.find(acc => 
        (provider === 'gmail' && acc.provider === 'google') ||
        (provider === 'outlook' && acc.provider === 'microsoft')
      );

      if (!account) {
        throw new Error(`No ${provider} account connected for user ${userId}`);
      }

      if (provider === 'gmail') {
        // Gmail uses labels as folders
        const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
          headers: {
            'Authorization': `Bearer ${account.accessToken}`,
          },
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch Gmail labels');
        }
        
        const data = await response.json();
        return data.labels.map((label: any) => ({
          id: label.id,
          name: label.name
        }));
      } else {
        const folders = await microsoftGraphService.getEmailFolders(account.accessToken!);
        return folders.map(folder => ({
          id: folder.id,
          name: folder.displayName
        }));
      }
    } catch (error) {
      logger.error(LogCategory.EMAIL, 'Failed to get email folders', {
        userId,
        provider,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }
}

export const emailSyncService = new EmailSyncService();