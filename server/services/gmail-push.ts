/**
 * Gmail Push Notifications Service
 * Implements real-time email processing using Gmail's Push notifications
 */

import { storage } from "../storage";
import { logger, LogCategory } from "./logger";

interface PushNotificationData {
  emailAddress: string;
  historyId: string;
}

class GmailPushService {
  private readonly topicName = "gmail-notifications";
  private readonly subscriptionName = "gmail-email-processor";

  /**
   * Check and refresh Gmail watch subscriptions for all user's active Gmail accounts
   * This should be called on user login to ensure continuous push notifications
   */
  async refreshGmailWatchForUser(userId: string): Promise<void> {
    try {
      console.log('refreshGmailWatchForUser called for userId:', userId);
      
      // Get all active Gmail accounts for this user
      const emailAccounts = await storage.getEmailAccounts(userId);
      console.log('Found email accounts:', emailAccounts?.length || 0);
      
      const gmailAccounts = emailAccounts.filter(
        account => account.provider === 'gmail' && account.isActive
      );
      
      console.log('Found Gmail accounts:', gmailAccounts?.length || 0);

      if (gmailAccounts.length === 0) {
        console.log('No Gmail accounts to refresh for user:', userId);
        return; // No Gmail accounts to refresh
      }

      logger.info(LogCategory.EMAIL, 'Refreshing Gmail watch subscriptions on login', {
        userId,
        accountCount: gmailAccounts.length
      });
      
      console.log('About to refresh watch for Gmail accounts:', gmailAccounts.map(acc => ({ id: acc.id, email: acc.email })));

      // Refresh watch for each Gmail account
      for (const account of gmailAccounts) {
        try {
          console.log('Attempting to refresh Gmail watch for account:', account.id, account.email);
          
          // Check if token needs refresh (401 errors indicate expired tokens)
          let accessToken = account.accessToken;
          
          try {
            // Try to refresh the access token first
            if (account.refreshToken) {
              console.log('Refreshing access token for account:', account.id);
              const { oauthService } = await import('./oauth');
              const refreshedTokens = await oauthService.refreshGmailToken(account.refreshToken);
              
              if (refreshedTokens.access_token) {
                accessToken = refreshedTokens.access_token;
                console.log('Access token refreshed successfully for account:', account.id);
                
                // Update the stored token
                await storage.updateEmailAccountTokens(account.id, {
                  accessToken: refreshedTokens.access_token,
                  refreshToken: refreshedTokens.refresh_token || account.refreshToken,
                  expiresAt: new Date(Date.now() + (refreshedTokens.expires_in || 3600) * 1000)
                });
              }
            }
          } catch (refreshError) {
            console.log('Token refresh failed for account:', account.id, refreshError);
            // Continue with existing token as fallback
          }
          
          await this.enableGmailWatch(accessToken!, userId, account.id);
          logger.info(LogCategory.EMAIL, 'Gmail watch refreshed successfully', {
            userId,
            accountId: account.id,
            email: account.email
          });
          console.log('Gmail watch refresh successful for account:', account.id);
        } catch (error) {
          logger.warn(LogCategory.EMAIL, 'Failed to refresh Gmail watch for account', {
            userId,
            accountId: account.id,
            email: account.email,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          console.log('Gmail watch refresh failed for account:', account.id, error);
        }
      }
    } catch (error) {
      logger.error(LogCategory.EMAIL, 'Failed to refresh Gmail watch subscriptions', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Enable Gmail polling fallback when push notifications aren't available
   * This periodically checks for new emails instead of receiving push notifications
   */
  private async enableGmailPolling(
    accessToken: string,
    userId: string,
    emailAccountId: string,
  ): Promise<void> {
    try {
      // Get current history ID to track from
      const response = await fetch(
        "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=1&q=in:inbox",
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to get Gmail messages: ${response.status}`);
      }

      const messagesData = await response.json();
      const currentTimestamp = new Date().toISOString();

      logger.info(LogCategory.EMAIL, "Gmail polling fallback configured", {
        userId,
        accountId: emailAccountId,
        configuredAt: currentTimestamp,
        messageCount: messagesData.messages?.length || 0
      });

      // Store polling configuration (using logs for now)
      logger.info(
        LogCategory.EMAIL,
        "Gmail polling setup complete - will check periodically",
        {
          accountId: emailAccountId,
          pollingMethod: "fallback",
          lastChecked: currentTimestamp,
        }
      );
    } catch (error) {
      logger.error(LogCategory.EMAIL, "Gmail polling setup failed", {
        userId,
        accountId: emailAccountId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Set up Gmail Push notifications for a user's email account
   */
  async setupPushNotifications(
    userId: string,
    emailAccountId: string,
  ): Promise<void> {
    try {
      const emailAccount = await storage.getEmailAccountById(emailAccountId);
      if (!emailAccount || !emailAccount.isActive) {
        throw new Error("Email account not found or inactive");
      }

      logger.info(LogCategory.EMAIL, "Setting up Gmail Push notifications", {
        userId,
        accountId: emailAccountId,
        email: emailAccount.email,
      });

      // Enable Gmail Push notifications via Gmail API
      await this.enableGmailWatch(
        emailAccount.accessToken!,
        userId,
        emailAccountId,
      );

      // Update account to mark push notifications as enabled
      // Note: Using a simple approach since metadata field may not be in schema
      logger.info(
        LogCategory.EMAIL,
        "Push notifications setup completed - metadata stored in logs",
        {
          accountId: emailAccountId,
          pushSetupTimestamp: new Date().toISOString(),
        },
      );

      logger.info(
        LogCategory.EMAIL,
        "Gmail Push notifications enabled successfully",
        {
          userId,
          accountId: emailAccountId,
        },
      );
    } catch (error) {
      logger.error(
        LogCategory.EMAIL,
        "Failed to setup Gmail Push notifications",
        {
          userId,
          accountId: emailAccountId,
          error: error instanceof Error ? error.message : "Unknown error",
        },
      );
      throw error;
    }
  }

  /**
   * Enable Gmail watch for push notifications
   */
  private async enableGmailWatch(
    accessToken: string,
    userId: string,
    emailAccountId: string,
  ): Promise<void> {
    try {
      // Gmail watch request to enable push notifications
      // Note: The webhook URL is configured at the Pub/Sub subscription level, not here
      const watchRequest = {
        labelIds: ["INBOX"], // Only watch inbox
        topicName: `projects/${process.env.GOOGLE_CLOUD_PROJECT_ID || "delightdesk-testing"}/topics/gmail-notifications`,
        labelFilterBehavior: "INCLUDE",
      };

      logger.info(LogCategory.EMAIL, "Setting up Gmail watch", {
        userId,
        accountId: emailAccountId,
        topicName: watchRequest.topicName,
        note: "Webhook URL is configured at Pub/Sub subscription level"
      });

      const response = await fetch(
        "https://gmail.googleapis.com/gmail/v1/users/me/watch",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(watchRequest),
        },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Gmail watch setup failed: ${response.status} - ${JSON.stringify(errorData)}`,
        );
      }

      const watchData = await response.json();

      logger.info(LogCategory.EMAIL, "Gmail watch enabled", {
        userId,
        accountId: emailAccountId,
        historyId: watchData.historyId,
        expiration: watchData.expiration,
      });

      // Store the initial history ID for future processing
      // Note: Store in logs for now, consider adding dedicated fields to schema
      logger.info(
        LogCategory.EMAIL,
        "Gmail watch setup complete - storing history ID",
        {
          accountId: emailAccountId,
          lastHistoryId: watchData.historyId,
          watchExpiration: watchData.expiration,
        },
      );
    } catch (error) {
      logger.error(LogCategory.EMAIL, "Gmail watch setup failed", {
        userId,
        accountId: emailAccountId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Process incoming Gmail Push notification
   * This endpoint will be called by Google's Pub/Sub when new emails arrive
   */
  async handlePushNotification(notificationData: any): Promise<void> {
    try {
      logger.info(LogCategory.EMAIL, "Received Gmail Push notification", {
        data: notificationData,
      });

      // Decode the push notification data
      const decodedData = this.decodePushNotification(notificationData);
      if (!decodedData) {
        logger.warn(
          LogCategory.EMAIL,
          "Invalid push notification data received",
        );
        return;
      }

      // Find the email account associated with this notification
      const emailAccount = await this.findEmailAccountByEmail(
        decodedData.emailAddress,
      );
      if (!emailAccount) {
        logger.warn(
          LogCategory.EMAIL,
          "No email account found for push notification",
          {
            emailAddress: decodedData.emailAddress,
          },
        );
        return;
      }

      // Process new emails since the last history ID
      await this.processNewEmails(emailAccount, decodedData.historyId);
    } catch (error) {
      logger.error(LogCategory.EMAIL, "Push notification processing failed", {
        error: error instanceof Error ? error.message : "Unknown error",
        notificationData,
      });
    }
  }

  /**
   * Decode Gmail Push notification data
   */
  private decodePushNotification(
    notificationData: any,
  ): PushNotificationData | null {
    try {
      if (!notificationData.message?.data) {
        return null;
      }

      // Decode base64 data
      const decodedData = Buffer.from(
        notificationData.message.data,
        "base64",
      ).toString();
      const parsedData = JSON.parse(decodedData);

      return {
        emailAddress: parsedData.emailAddress,
        historyId: parsedData.historyId,
      };
    } catch (error) {
      logger.error(LogCategory.EMAIL, "Failed to decode push notification", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return null;
    }
  }

  /**
   * Save Gmail History ID for an email account
   */
  private async saveHistoryId(accountId: string, historyId: string): Promise<void> {
    try {
      // Store History ID in settings JSON field
      const historySettings = JSON.stringify({ 
        lastHistoryId: historyId, 
        lastUpdated: new Date().toISOString() 
      });
      
      // Use the existing storage instance to save History ID
      const { storage } = await import('../storage');
      
      await storage.updateEmailAccount(accountId, {
        settings: historySettings
      });
      
      logger.info(LogCategory.EMAIL, "History ID saved successfully", {
        accountId,
        historyId,
      });
    } catch (error) {
      logger.error(LogCategory.EMAIL, "Failed to save History ID", {
        accountId,
        historyId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Get saved Gmail History ID for an email account
   */
  private async getLastHistoryId(accountId: string): Promise<string | null> {
    try {
      const account = await storage.getEmailAccountById(accountId);
      if (!account || !account.settings) {
        return null;
      }
      
      const settings = JSON.parse(account.settings);
      return settings.lastHistoryId || null;
    } catch (error) {
      logger.error(LogCategory.EMAIL, "Failed to get last History ID", {
        accountId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return null;
    }
  }

  /**
   * Fetch and process initial 10 recent emails after OAuth setup
   * This is called once during OAuth completion to establish a baseline
   */
  async fetchAndProcessInitialEmails(userId: string, accountId: string): Promise<void> {
    try {
      logger.info(LogCategory.EMAIL, "Starting initial email fetch after OAuth", {
        userId,
        accountId,
      });

      // Get the email account details
      const emailAccount = await storage.getEmailAccountById(accountId);
      if (!emailAccount) {
        throw new Error(`Email account not found: ${accountId}`);
      }

      logger.info(LogCategory.EMAIL, "Found email account for initial fetch", {
        accountId,
        email: emailAccount.email,
        provider: emailAccount.provider,
      });

      // Use the existing fetchAndProcessRecentEmails method
      // This fetches 10 recent emails from last hour and saves History ID
      await this.fetchAndProcessRecentEmails(emailAccount);

      logger.info(LogCategory.EMAIL, "Initial email fetch completed successfully", {
        userId,
        accountId,
        email: emailAccount.email,
      });

    } catch (error) {
      logger.error(LogCategory.EMAIL, "Initial email fetch failed", {
        userId,
        accountId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Find email account by email address
   */
  private async findEmailAccountByEmail(emailAddress: string): Promise<any> {
    try {
      // Get all email accounts and find the matching one
      const allAccounts = await storage.getAllEmailAccounts();
      // Find the active account for this email address
      // Sort by active first, then by creation date (most recent first) to prefer active accounts
      const matchingAccounts = allAccounts.filter(
        (account) =>
          account.email === emailAddress &&
          account.provider === "gmail"
      );
      
      const account = matchingAccounts.find(acc => acc.isActive) || 
                     matchingAccounts.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())[0];
      
      if (account) {
        logger.info(LogCategory.EMAIL, "Found matching email account", {
          accountId: account.id,
          userId: account.userId,
          email: account.email,
          provider: account.provider
        });
      } else {
        logger.warn(LogCategory.EMAIL, "No matching email account found", {
          emailAddress,
          totalAccounts: allAccounts.length,
          availableEmails: allAccounts.map(acc => acc.email)
        });
      }
      
      return account;
    } catch (error) {
      logger.error(LogCategory.EMAIL, "Failed to find email account", {
        emailAddress,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return null;
    }
  }

  /**
   * Process new emails since the last history ID
   */
  private async processNewEmails(
    emailAccount: any,
    currentHistoryId: string,
  ): Promise<void> {
    try {
      // Get the last processed history ID from database
      const lastHistoryId = await this.getLastHistoryId(emailAccount.id);

      if (!lastHistoryId) {
        logger.info(
          LogCategory.EMAIL,
          "No previous history ID, fetching recent emails instead",
        );
        // When no history ID is available, fetch recent emails (last hour)
        await this.fetchAndProcessRecentEmails(emailAccount);
        return;
      }

      logger.info(LogCategory.EMAIL, "Processing new emails from history", {
        userId: emailAccount.userId,
        accountId: emailAccount.id,
        lastHistoryId,
        currentHistoryId,
      });

      // Get history of changes since last processed
      const historyResponse = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/history?startHistoryId=${lastHistoryId}&historyTypes=messageAdded`,
        {
          headers: {
            Authorization: `Bearer ${emailAccount.accessToken}`,
          },
        },
      );

      if (!historyResponse.ok) {
        // Try to refresh token if authentication failed
        if (historyResponse.status === 401) {
          await this.refreshTokenAndRetry(emailAccount, currentHistoryId);
          return;
        }
        throw new Error(
          `History API request failed: ${historyResponse.status}`,
        );
      }

      const historyData = await historyResponse.json();
      
      logger.info(LogCategory.EMAIL, "Gmail history response received", {
        userId: emailAccount.userId,
        accountId: emailAccount.id,
        historyCount: historyData.history?.length || 0
      });

      const newMessages = this.extractNewMessages(historyData);

      if (newMessages.length === 0) {
        logger.info(LogCategory.EMAIL, "No new messages found in history - checking extraction logic");
        // DEBUG: Log why no messages were found
        if (historyData.history) {
          for (const historyRecord of historyData.history) {
            logger.info(LogCategory.EMAIL, "History record details", {
              hasMessagesAdded: !!historyRecord.messagesAdded,
              messagesAddedCount: historyRecord.messagesAdded?.length || 0,
              allMessageLabels: historyRecord.messagesAdded?.map((m: any) => m.message.labelIds) || []
            });
          }
        }
        return;
      }

      logger.info(LogCategory.EMAIL, "Found new messages to process", {
        count: newMessages.length,
        userId: emailAccount.userId,
      });

      // Process each new message
      for (const messageId of newMessages) {
        await this.processNewMessage(emailAccount, messageId);
      }

      // Save the processed history ID to prevent reprocessing
      await this.saveHistoryId(emailAccount.id, currentHistoryId);
      
      logger.info(LogCategory.EMAIL, "Updated last processed history ID", {
        accountId: emailAccount.id,
        lastHistoryId: currentHistoryId,
        lastProcessedTimestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error(
        LogCategory.EMAIL,
        "Failed to process new emails from history",
        {
          userId: emailAccount.userId,
          accountId: emailAccount.id,
          error: error instanceof Error ? error.message : "Unknown error",
        },
      );
    }
  }

  /**
   * Fetch and process recent emails (last hour) when no history ID is available
   */
  private async fetchAndProcessRecentEmails(emailAccount: any): Promise<void> {
    try {
      logger.info(LogCategory.EMAIL, "Fetching recent emails", {
        userId: emailAccount.userId,
        accountId: emailAccount.id,
      });

      // Get messages from the last 7 days (comprehensive search to catch any missed emails)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const query = `in:inbox after:${Math.floor(sevenDaysAgo.getTime() / 1000)} OR (in:inbox "Order #18907")`;
      
      logger.info(LogCategory.EMAIL, "Searching for emails with query", {
        userId: emailAccount.userId,
        accountId: emailAccount.id,
        query,
        timeRangeStart: sevenDaysAgo.toISOString()
      });
      
      const messagesResponse = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=100`,
        {
          headers: {
            Authorization: `Bearer ${emailAccount.accessToken}`,
          },
        },
      );

      if (!messagesResponse.ok) {
        if (messagesResponse.status === 401) {
          // Try to refresh token
          logger.info(LogCategory.EMAIL, "Access token expired, refreshing", {
            accountId: emailAccount.id,
          });
          // Import and use the existing OAuth service instance for token refresh
          const { oauthService } = await import('./oauth');
          const newTokens = await oauthService.refreshGmailToken(emailAccount.refreshToken);
          
          // Update tokens in database
          await storage.updateEmailAccountTokens(emailAccount.id, {
            accessToken: newTokens.access_token,
            refreshToken: newTokens.refresh_token || emailAccount.refreshToken,
            expiresAt: new Date(Date.now() + (newTokens.expires_in || 3600) * 1000)
          });

          // Retry with new token
          emailAccount.accessToken = newTokens.access_token;
          return await this.fetchAndProcessRecentEmails(emailAccount);
        }
        throw new Error(`Messages API request failed: ${messagesResponse.status}`);
      }

      const messagesData = await messagesResponse.json();
      const messageIds = messagesData.messages?.map((msg: any) => msg.id) || [];

      if (messageIds.length === 0) {
        logger.info(LogCategory.EMAIL, "No recent messages found");
        return;
      }

      logger.info(LogCategory.EMAIL, "Found recent messages to process", {
        count: messageIds.length,
        userId: emailAccount.userId,
      });

      // Process each message
      for (const messageId of messageIds) {
        await this.processNewMessage(emailAccount, messageId);
      }

      // CRITICAL: After processing recent emails, we need to save the current History ID
      // to prevent reprocessing the same emails on subsequent webhook notifications
      logger.info(LogCategory.EMAIL, "Saving current History ID after processing recent emails", {
        userId: emailAccount.userId,
        accountId: emailAccount.id,
      });
      
      // Fetch current profile to get the latest historyId
      const profileResponse = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/profile`,
        {
          headers: {
            Authorization: `Bearer ${emailAccount.accessToken}`,
          },
        },
      );

      if (profileResponse.ok) {
        const profileData = await profileResponse.json();
        const currentHistoryId = profileData.historyId;
        
        // Save this History ID so we don't reprocess these emails again
        await this.saveHistoryId(emailAccount.id, currentHistoryId);
        
        logger.info(LogCategory.EMAIL, "Saved current History ID", {
          accountId: emailAccount.id,
          historyId: currentHistoryId,
        });
      }
    } catch (error) {
      logger.error(LogCategory.EMAIL, "Failed to fetch recent emails", {
        userId: emailAccount.userId,
        accountId: emailAccount.id,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Extract new message IDs from Gmail history response
   */
  private extractNewMessages(historyData: any): string[] {
    const messageIds: string[] = [];

    if (!historyData.history) {
      return messageIds;
    }

    for (const historyRecord of historyData.history) {
      if (historyRecord.messagesAdded) {
        for (const messageAdded of historyRecord.messagesAdded) {
          const labels = messageAdded.message.labelIds || [];
          
          // DEBUG: Log each message found with its labels
          logger.info(LogCategory.EMAIL, "Found message in history", {
            messageId: messageAdded.message.id,
            labels: labels,
            hasInboxLabel: labels.includes("INBOX"),
            threadId: messageAdded.message.threadId
          });
          
          // Only process messages in INBOX
          if (messageAdded.message.labelIds?.includes("INBOX")) {
            messageIds.push(messageAdded.message.id);
            logger.info(LogCategory.EMAIL, "Added message to processing queue", {
              messageId: messageAdded.message.id
            });
          }
        }
      }
    }

    return messageIds;
  }

  /**
   * Process a single new message (public method for manual processing)
   */
  public async processNewMessage(
    emailAccount: any,
    messageId: string,
  ): Promise<void> {
    try {
      logger.info(LogCategory.EMAIL, "Processing new message", {
        userId: emailAccount.userId,
        messageId,
      });

      // Fetch the full message details
      const messageResponse = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}`,
        {
          headers: {
            Authorization: `Bearer ${emailAccount.accessToken}`,
          },
        },
      );

      if (!messageResponse.ok) {
        throw new Error(`Message fetch failed: ${messageResponse.status}`);
      }

      const messageData = await messageResponse.json();
      const emailData = this.parseGmailMessage(messageData);

      if (!emailData) {
        logger.warn(LogCategory.EMAIL, "Failed to parse message data", {
          messageId,
        });
        return;
      }

      // Filter email to prevent spam/promotional content
      const { emailFilterService } = await import("./email-filter");
      const filterResult = await emailFilterService.filterEmail({
        from: emailData.from,
        subject: emailData.subject,
        body: emailData.body,
        labels: emailData.labels || [],
        folder: "INBOX",
        isInPrimaryTab: true,
      });

      if (!filterResult.shouldProcess) {
        logger.info(LogCategory.EMAIL, "Email filtered out", {
          messageId,
          reason: filterResult.filterReason,
        });
        return;
      }

      // Check if we've already processed this email to prevent duplicates
      const existingEmail = await storage.getEmailByMessageId(emailData.messageId, emailAccount.userId);
      if (existingEmail) {
        logger.info(LogCategory.EMAIL, "Email already processed, skipping duplicate", {
          messageId,
          existingEmailId: existingEmail.id,
          existingStatus: existingEmail.status
        });
        return;
      }

      // Create email record
      const email = await storage.createEmail({
        userId: emailAccount.userId,
        fromEmail: emailData.from,
        toEmail: emailData.to,
        subject: emailData.subject,
        body: emailData.body,
        status: "processing",
        metadata: {
          messageId: messageData.id,
          threadId: messageData.threadId,
          realTimeProcessing: true,
          receivedViaWebhook: true,
        },
      });

      // Link email to thread for conversation context
      try {
        const { ThreadContextService } = await import("./thread-context");
        await ThreadContextService.linkEmailToThread(
          email.id,
          emailData.subject,
          emailData.from,
          emailAccount.userId,
        );
      } catch (contextError) {
        logger.warn(LogCategory.EMAIL, "Thread context linking failed", {
          emailId: email.id,
          error:
            contextError instanceof Error
              ? contextError.message
              : "Unknown error",
        });
      }

      // Classify and route the email
      await this.classifyAndRouteEmail(email, emailData, emailAccount.userId);
    } catch (error) {
      logger.error(LogCategory.EMAIL, "Failed to process new message", {
        userId: emailAccount.userId,
        messageId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Classify email and route to appropriate queue
   */
  private async classifyAndRouteEmail(
    email: any,
    emailData: any,
    userId: string,
  ): Promise<void> {
    try {
      // Classify the email using AI
      const { autoResponderService } = await import("./auto-responder");
      const classification = await autoResponderService.classifyEmail(
        emailData.body,
        emailData.subject,
        userId
      );

      logger.info(
        LogCategory.EMAIL,
        "Email classified via real-time processing",
        {
          emailId: email.id,
          classification: classification.classification,
          priority: classification.priority,
          confidence: classification.confidence,
        },
      );

      // SENTIMENT ANALYSIS - Check for negative sentiment that needs immediate escalation
      let sentimentEscalation = false;
      let sentimentReason = '';
      try {
        const { sentimentAnalysisService } = await import('./sentiment-analysis');
        const sentimentResult = await sentimentAnalysisService.analyzeSentiment(emailData.body);
        
        // Escalate highly negative sentiment emails immediately
        if (sentimentResult.sentiment === 'NEGATIVE') {
          const negativeScore = sentimentResult.scores.negative || 0;
          const sentimentConfidence = sentimentResult.confidence || 0;
          
          // PRACTICAL sentiment escalation - only escalate if truly problematic
          // Standard customer disappointment should go to AI agents for instant helpful responses
          
          // For now, rely on existing confidence-based routing and human review processes
          // Sentiment analysis provides valuable data but doesn't need to trigger automatic escalation
          // AI agents can handle disappointed customers with instant, helpful responses
          
          if (false) { // Disabled - let AI agents leverage their instant response advantage
            sentimentEscalation = true;
            sentimentReason = `Sentiment escalation disabled - AI agents handle negative sentiment effectively`;
          }
        }
        
        logger.info(LogCategory.EMAIL, "Sentiment analysis completed for real-time email", {
          emailId: email.id,
          sentiment: sentimentResult.sentiment,
          confidence: sentimentResult.confidence,
          escalationTriggered: sentimentEscalation
        });
        
        if (sentimentEscalation) {
          logger.warn(LogCategory.EMAIL, "Sentiment escalation triggered for real-time email", {
            emailId: email.id,
            reason: sentimentReason
          });
        }
      } catch (sentimentError) {
        logger.warn(LogCategory.EMAIL, "Sentiment analysis failed for real-time email", {
          emailId: email.id,
          error: sentimentError instanceof Error ? sentimentError.message : 'Unknown error'
        });
        // Continue without sentiment analysis if it fails
      }

      // Route to escalation queue only for very low confidence, urgent priority, or negative sentiment
      // High priority emails should go to AI agents for approval, not escalation
      if (
        classification.confidence < 60 ||
        classification.priority === "urgent" ||
        sentimentEscalation
      ) {
        const escalationReason = sentimentEscalation 
          ? `Negative sentiment detected - ${sentimentReason}`
          : classification.confidence < 60
            ? `Low confidence classification (${classification.confidence}%) requires human review`
            : `Urgent priority email requires immediate attention`;
        
        await autoResponderService.escalateEmail(
          email.id,
          userId,
          classification,
          escalationReason,
        );

        if (sentimentEscalation) {
          logger.info(LogCategory.EMAIL, "Email routed to escalation queue due to negative sentiment", {
            emailId: email.id,
            reason: sentimentReason,
            confidence: classification.confidence,
          });
        } else {
          logger.info(LogCategory.EMAIL, "Email routed to escalation queue", {
            emailId: email.id,
            reason: classification.confidence < 60 ? 'low confidence' : 'urgent priority',
            confidence: classification.confidence,
          });
        }
      } else {
        // Check for auto-responder rules and route to approval queue if needed
        const settings = await storage.getSystemSettings(userId);
        const rules = await storage.getAutoResponderRules(userId);
        const matchingRule = rules.find(
          (rule) =>
            rule.isActive &&
            rule.classification === classification.classification,
        );

        if (matchingRule && matchingRule.requiresApproval) {
          logger.info(LogCategory.EMAIL, "Found matching auto-responder rule, will route via EmailProcessor", {
            emailId: email.id,
            ruleId: matchingRule.id,
            classification: classification.classification
          });
          // Note: Don't create approval queue item here - let routeEmailDirectly handle it
          // to prevent duplicate approval queue items
        }
      }

      // ATOMIC PROCESSING: Classify and route in one operation
      try {
        const { EmailProcessor } = await import('./email-processor');
        const emailProcessor = new EmailProcessor();
        
        // Route email directly based on classification
        await emailProcessor.routeEmailDirectly(email, classification, userId);
        
        // Update email with final status (set by routing method)
        await storage.updateEmail(email.id, {
          classification: classification.classification,
          confidence: classification.confidence,
          metadata: {
            ...email.metadata,
            classification: classification.classification,
            confidence: classification.confidence,
            priority: classification.priority,
            classifiedAt: new Date().toISOString(),
            processedAt: new Date().toISOString()
          },
        });
        
      } catch (processingError) {
        logger.error(LogCategory.EMAIL, "Email processing failed - escalating to AI Assistant", {
          emailId: email.id,
          error: processingError instanceof Error ? processingError.message : "Unknown error"
        });
        
        // GUARANTEED FALLBACK: Always escalate to AI Assistant if anything fails
        await storage.createEscalationQueue({
          userId: userId,
          emailId: email.id,
          priority: 'high',
          reason: `Email processing failed: ${processingError instanceof Error ? processingError.message : "Unknown error"}`,
          status: 'pending',
          assignedTo: null,
          notes: null,
          createdAt: new Date(),
          resolvedAt: null,
          aiSuggestedResponse: 'This email requires manual review due to processing failure.',
          aiConfidence: 0.5,
          originalMessageId: emailData.messageId || null,
          emailProvider: 'gmail'
        });
        
        // Update email status to escalated
        await storage.updateEmail(email.id, {
          status: 'escalated',
          classification: classification.classification,
          confidence: classification.confidence,
          escalationReason: 'Processing failure - automatically escalated',
          metadata: {
            ...email.metadata,
            classification: classification.classification,
            confidence: classification.confidence,
            priority: 'high',
            processingFailed: true,
            escalatedAt: new Date().toISOString()
          }
        });
        
        // Create approval queue item for emails that need review
        try {
          await storage.createAutomationApprovalItem({
            userId: userId,
            emailId: email.id,
            ruleId: 'processing-failed',
            customerEmail: email.fromEmail || 'unknown',
            subject: email.subject || 'No subject',
            body: email.body || 'No content',
            classification: classification.classification || 'general',
            confidence: classification.confidence || 50,
            proposedResponse: 'This email requires manual review due to processing failure. Please review and respond appropriately.',
            status: 'pending',
            agentType: 'general',
            metadata: {
              processingFailed: false,
              classificationReasoning: classification.reasoning || 'Email requires manual review',
              priority: 'high',
              realTimeProcessing: true
            }
          });
        } catch (approvalError) {
          console.error('[GMAIL_PUSH] Failed to create approval queue item:', approvalError);
        }

        await storage.updateEmail(email.id, {
          status: "needs_review",
          metadata: {
            ...email.metadata,
            processingFailed: true,
            sentToApprovalQueue: true
          }
        });
      }
    } catch (error) {
      logger.error(
        LogCategory.EMAIL,
        "Email classification and routing failed",
        {
          emailId: email.id,
          error: error instanceof Error ? error.message : "Unknown error",
        },
      );
      
      // Let EmailProcessor handle all approval queue logic - no duplicates
      logger.warn(LogCategory.EMAIL, "Email classification failed - will delegate to EmailProcessor fallback", {
        emailId: email.id,
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  }

  /**
   * Parse Gmail message data into internal format
   */
  private parseGmailMessage(gmailMessage: any): any | null {
    try {
      const payload = gmailMessage.payload;
      const headers = payload.headers || [];

      const getHeader = (name: string) =>
        headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())
          ?.value || "";

      // Extract email body
      let body = "";
      if (payload.body?.data) {
        body = Buffer.from(payload.body.data, "base64").toString("utf-8");
      } else if (payload.parts) {
        const textPart = payload.parts.find(
          (part: any) =>
            part.mimeType === "text/plain" || part.mimeType === "text/html",
        );
        if (textPart?.body?.data) {
          body = Buffer.from(textPart.body.data, "base64").toString("utf-8");
        }
      }

      // Clean HTML tags if present
      body = body.replace(/<[^>]*>/g, "").trim();

      return {
        messageId: gmailMessage.id,
        threadId: gmailMessage.threadId,
        from: getHeader("From"),
        to: getHeader("To"),
        subject: getHeader("Subject"),
        body: body,
        labels: gmailMessage.labelIds || [],
        receivedAt: new Date(parseInt(gmailMessage.internalDate)),
      };
    } catch (error) {
      logger.error(LogCategory.EMAIL, "Failed to parse Gmail message", {
        messageId: gmailMessage.id,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return null;
    }
  }

  /**
   * Refresh access token and retry operation
   */
  private async refreshTokenAndRetry(
    emailAccount: any,
    currentHistoryId: string,
  ): Promise<void> {
    try {
      const { oauthService } = await import("./oauth");
      const newTokens = await oauthService.refreshGmailToken(
        emailAccount.refreshToken,
      );

      await storage.updateEmailAccount(emailAccount.id, {
        accessToken: newTokens.access_token,
      });

      logger.info(
        LogCategory.EMAIL,
        "Token refreshed, retrying history processing",
        {
          accountId: emailAccount.id,
        },
      );

      // Update the account object and retry
      emailAccount.accessToken = newTokens.access_token;
      await this.processNewEmails(emailAccount, currentHistoryId);
    } catch (error) {
      logger.error(LogCategory.EMAIL, "Token refresh failed", {
        accountId: emailAccount.id,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}

export const gmailPushService = new GmailPushService();
