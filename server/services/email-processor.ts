import { storage } from "../storage";
import { openaiService } from "./openai";
// SendGrid service removed in OAuth-first architecture migration
import { oauthService } from "./oauth";
import { microsoftGraphService } from "./microsoft-graph";
import { emailFilterService } from "./email-filter";
import { emailRoutingService } from "./email-routing";

export class EmailProcessor {

  /**
   * Process initial 10 emails after Gmail OAuth connection
   * Fetches recent emails, classifies them, and populates escalation/approval queues
   */
  async processInitialEmails(userId: string, emailAccountId: string): Promise<{
    processed: number;
    escalated: number;
    approved: number;
    errors: string[];
  }> {
    try {
      console.log(`[EMAIL_PROCESSOR] Starting initial email processing for user ${userId}`);

      const emailAccount = await storage.getEmailAccountById(emailAccountId);
      if (!emailAccount || !emailAccount.isActive) {
        throw new Error('Email account not found or inactive');
      }

      const settings = await storage.getSystemSettings(userId);

      // Fetch the 10 most recent emails from Gmail
      const recentEmails = await this.fetchRecentGmailEmails(emailAccount, 10);
      console.log(`[EMAIL_PROCESSOR] Fetched ${recentEmails.length} recent emails`);

      let processedCount = 0;
      let escalatedCount = 0;
      let approvedCount = 0;
      const errors: string[] = [];

      for (const emailData of recentEmails) {
        try {
          // Filter email to prevent spam/promotional content
          const filterResult = await emailFilterService.filterEmail({
            from: emailData.from,
            subject: emailData.subject,
            body: emailData.body,
            labels: emailData.labels || [],
            folder: emailData.folder || 'INBOX',
            isInPrimaryTab: true
          });

          // Skip processing if email is filtered out
          if (!filterResult.shouldProcess) {
            console.log(`[EMAIL_PROCESSOR] Email filtered out: ${filterResult.filterReason}`);
            continue;
          }

          // Create email record
          const email = await storage.createEmail({
            userId,
            fromEmail: emailData.from,
            toEmail: emailData.to,
            subject: emailData.subject,
            body: emailData.body,
            status: 'processing',
            metadata: {
              messageId: emailData.messageId,
              threadId: emailData.threadId,
              initialProcessing: true,
              oauthTriggered: true
            }
          });

          // Link email to thread for conversation context
          try {
            const { ThreadContextService } = await import('./thread-context');
            await ThreadContextService.linkEmailToThread(
              email.id,
              emailData.subject,
              emailData.from,
              userId
            );
          } catch (contextError) {
            console.warn('[EMAIL_PROCESSOR] Thread context linking failed:', contextError);
          }

          // Classify the email using AI with hallucination prevention
          const { autoResponderService } = await import('./auto-responder');
          const classification = await autoResponderService.classifyEmail(emailData.body, emailData.subject, userId);

          console.log(`[EMAIL_PROCESSOR] Email classified as ${classification.classification} with ${classification.confidence}% confidence, priority: ${classification.priority}`);

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

            console.log(`[EMAIL_PROCESSOR] Sentiment analysis: ${sentimentResult.sentiment} (${sentimentResult.confidence}% confidence)`);
            if (sentimentEscalation) {
              console.log(`[EMAIL_PROCESSOR] Sentiment escalation triggered: ${sentimentReason}`);
            }
          } catch (sentimentError) {
            console.warn('[EMAIL_PROCESSOR] Sentiment analysis failed:', sentimentError);
            // Continue without sentiment analysis if it fails
          }

          // Simple routing: try specific AI agents, otherwise AI Assistant
          {
            // **AI ASSISTANT PRIORITY**: General emails ALWAYS go to AI Assistant, never automation rules
            if (classification.classification === 'general' || classification.classification === 'general_inquiry') {
              // Force route to AI Assistant regardless of automation rules
              console.log(`[EMAIL_PROCESSOR] General email detected - routing directly to AI Assistant approval queue (initial processing)`);
              const emailWithMetadata = { ...email, subject: emailData.subject, body: emailData.body, fromEmail: emailData.from };
              await this.routeToAIAssistant(emailWithMetadata, classification, settings, userId);
              processedCount++;
            } else {
              // Check for auto-responder rules (non-general classifications only)
              const rules = await storage.getAutoResponderRules(userId);
              console.log(`[EMAIL_PROCESSOR] DEBUG: Found ${rules.length} total rules`);
              console.log(`[EMAIL_PROCESSOR] DEBUG: Looking for classification: "${classification.classification}"`);
              console.log(`[EMAIL_PROCESSOR] DEBUG: Raw rules from DB:`, JSON.stringify(rules.slice(0, 3), null, 2));
              console.log(`[EMAIL_PROCESSOR] DEBUG: Available classifications:`, rules.map(r => `"${r.classification}" (active: ${r.isActive}, type: ${typeof r.isActive})`));
              
              const matchingRule = rules.find(rule =>
                rule.isActive && rule.classification === classification.classification
              );

              console.log(`[EMAIL_PROCESSOR] DEBUG: matchingRule=${!!matchingRule}, settings.automationApprovalRequired=${settings.automationApprovalRequired}, classification=${classification.classification}`);
              
              // Debug subscription rules specifically
              if (classification.classification === 'subscription_changes') {
                console.log(`[EMAIL_PROCESSOR] DEEP DEBUG for subscription_changes:`);
                console.log(`[EMAIL_PROCESSOR] settings.automationApprovalRequired = ${settings.automationApprovalRequired} (${typeof settings.automationApprovalRequired})`);
                rules.forEach((rule, index) => {
                  const isActiveMatch = rule.isActive;
                  const classificationMatch = rule.classification === classification.classification;
                  const overallMatch = isActiveMatch && classificationMatch;
                  console.log(`  Rule ${index + 1}: name="${rule.name}"`);
                  console.log(`    isActive=${rule.isActive} (${typeof rule.isActive}) -> match: ${isActiveMatch}`);
                  console.log(`    classification="${rule.classification}" -> match: ${classificationMatch}`);
                  console.log(`    OVERALL MATCH: ${overallMatch}`);
                });
              }
              
              if (matchingRule && settings.automationApprovalRequired) {
                console.log(`[EMAIL_PROCESSOR] Automation approval flow triggered`);
                
                // Special handling for subscription changes - execute action first, then approve
                if (classification.classification === 'subscription_changes') {
                  console.log(`[EMAIL_PROCESSOR] SUBSCRIPTION AUTOMATION PATH TRIGGERED - executing action first`);
                  const { subscriptionAutomationService } = await import('./subscription-automation');
                  const automationResult = await subscriptionAutomationService.processSubscriptionRequest(
                    { 
                      id: email.id, 
                      subject: emailData.subject, 
                      body: emailData.body, 
                      fromEmail: emailData.from 
                    },
                    userId,
                    `${emailData.subject} ${emailData.body}`
                  );
                  console.log(`[EMAIL_PROCESSOR] SUBSCRIPTION AUTOMATION RESULT:`, automationResult);
                
                await storage.createAutomationApprovalItem({
                  userId,
                  emailId: email.id,
                  ruleId: matchingRule.id,
                  customerEmail: emailData.from,
                  subject: emailData.subject,
                  body: emailData.body,
                  classification: classification.classification,
                  confidence: 95,
                  proposedResponse: automationResult.message,
                  status: 'pending',
                  metadata: {
                    initialProcessing: true,
                    priority: classification.priority,
                    classificationReasoning: classification.reasoning,
                    automationExecuted: automationResult.success,
                    actionTaken: automationResult.actionTaken,
                    subscriptionId: automationResult.subscriptionId
                  }
                });
              } else {
                // Regular approval queue flow for non-subscription emails
                const responseData = await autoResponderService.generateProposedResponse(matchingRule, emailData, userId);

                await storage.createAutomationApprovalItem({
                  userId,
                  emailId: email.id,
                  ruleId: matchingRule.id,
                  customerEmail: emailData.from,
                  subject: emailData.subject,
                  body: emailData.body,
                  classification: classification.classification,
                  confidence: responseData.adjustedConfidence,
                  proposedResponse: responseData.response,
                  status: 'pending',
                  metadata: {
                    initialProcessing: true,
                    priority: classification.priority,
                    classificationReasoning: classification.reasoning
                  }
                });
              }
              approvedCount++;
              console.log(`[EMAIL_PROCESSOR] Email added to approval queue`);
            } else if (matchingRule && !settings.automationApprovalRequired) {
              // Execute automation rule directly
              await this.sendAutoResponse(email, matchingRule, classification, settings);
              processedCount++;
              } else {
                // No matching rule - route all unmatched emails to AI Assistant approval queue (initial processing)
                console.log(`[EMAIL_PROCESSOR] No specific automation rule for ${classification.classification}, routing to AI Assistant approval queue (initial processing)`);
                const emailWithMetadata = { ...email, subject: emailData.subject, body: emailData.body, fromEmail: emailData.from };
                await this.routeToAIAssistant(emailWithMetadata, classification, settings, userId);
                processedCount++;
              }
            }
          }

          // Email status is updated by the routing methods themselves
          // No need to update here as routing is now atomic

          processedCount++;

        } catch (emailError) {
          const errorMsg = `Failed to process email: ${emailError instanceof Error ? emailError.message : 'Unknown error'}`;
          console.error('[EMAIL_PROCESSOR]', errorMsg);
          errors.push(errorMsg);
        }
      }

      console.log(`[EMAIL_PROCESSOR] Initial processing complete: ${processedCount} processed, ${escalatedCount} escalated, ${approvedCount} queued for approval`);

      return {
        processed: processedCount,
        escalated: escalatedCount,
        approved: approvedCount,
        errors
      };

    } catch (error) {
      console.error('[EMAIL_PROCESSOR] Initial email processing failed:', error);
      throw error;
    }
  }

  /**
   * Fetch recent emails from Gmail (for initial processing)
   */
  private async fetchRecentGmailEmails(account: any, maxResults: number = 10): Promise<any[]> {
    try {
      // Query for recent emails, excluding spam and trash, prioritizing unread
      const query = '-in:spam -in:trash newer_than:7d'; // Last 7 days

      const response = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`,
        {
          headers: {
            Authorization: `Bearer ${account.accessToken}`,
          },
        }
      );

      if (!response.ok) {
        // Try to refresh token if expired
        try {
          const newTokens = await oauthService.refreshGmailToken(account.refreshToken);
          await storage.updateEmailAccount(account.id, {
            accessToken: newTokens.access_token,
          });

          // Retry with new token
          const retryResponse = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`,
            {
              headers: {
                Authorization: `Bearer ${newTokens.access_token}`,
              },
            }
          );

          if (!retryResponse.ok) {
            throw new Error(`Gmail API request failed: ${retryResponse.status}`);
          }

          const retryData = await retryResponse.json();
          return await this.fetchEmailDetails(retryData.messages || [], newTokens.access_token);
        } catch (refreshError) {
          throw new Error(`Failed to refresh token and fetch emails: ${refreshError instanceof Error ? refreshError.message : 'Unknown error'}`);
        }
      }

      const data = await response.json();
      return await this.fetchEmailDetails(data.messages || [], account.accessToken);

    } catch (error) {
      console.error('[EMAIL_PROCESSOR] Error fetching recent Gmail emails:', error);
      return [];
    }
  }

  /**
   * Fetch detailed email content for message IDs
   */
  private async fetchEmailDetails(messages: any[], accessToken: string): Promise<any[]> {
    const emails = [];

    for (const message of messages) {
      try {
        const emailResponse = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        if (!emailResponse.ok) {
          console.warn(`[EMAIL_PROCESSOR] Failed to fetch email ${message.id}`);
          continue;
        }

        const emailData = await emailResponse.json();
        const headers = emailData.payload?.headers || [];

        const getHeader = (name: string) =>
          headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

        // Extract email body
        let body = '';
        if (emailData.payload?.parts) {
          // Multi-part email
          const textPart = emailData.payload.parts.find((part: any) =>
            part.mimeType === 'text/plain' || part.mimeType === 'text/html'
          );
          if (textPart?.body?.data) {
            body = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
          }
        } else if (emailData.payload?.body?.data) {
          // Single part email
          body = Buffer.from(emailData.payload.body.data, 'base64').toString('utf-8');
        }

        // Clean HTML tags if present
        body = body.replace(/<[^>]*>/g, '').trim();

        emails.push({
          messageId: emailData.id,
          threadId: emailData.threadId,
          from: getHeader('From'),
          to: getHeader('To'),
          subject: getHeader('Subject'),
          body: body,
          labels: emailData.labelIds || [],
          folder: 'INBOX'
        });

      } catch (emailError) {
        console.error(`[EMAIL_PROCESSOR] Error fetching individual email ${message.id}:`, emailError);
      }
    }

    return emails;
  }

  async processUserEmails(userId: string): Promise<number> {
    try {
      const emailAccounts = await storage.getEmailAccounts(userId);
      const activeRules = await storage.getAutoResponderRules(userId);
      const settings = await storage.getSystemSettings(userId);

      let processedCount = 0;

      for (const account of emailAccounts) {
        if (!account.isActive) continue;

        // Fetch new emails from the email provider
        const newEmails = await this.fetchEmailsFromProvider(account);

        for (const emailData of newEmails) {
          try {
            // Filter email to prevent spam/promotional content from cluttering escalation queue
            const filterResult = await emailFilterService.filterEmail({
              from: emailData.from,
              subject: emailData.subject,
              body: emailData.body,
              labels: emailData.labels,
              folder: emailData.folder,
              isInPrimaryTab: emailData.isInPrimaryTab
            });

            // Skip processing if email is filtered out
            if (!filterResult.shouldProcess) {
              console.log(`Email filtered out: ${filterResult.filterReason} (confidence: ${filterResult.confidence})`);
              continue;
            }

            // Create email record
            const email = await storage.createEmail({
              userId,
              fromEmail: emailData.from,
              toEmail: emailData.to,
              subject: emailData.subject,
              body: emailData.body,
              status: 'processing',
            });

            // CRITICAL: Link email to thread for conversation context
            try {
              const { ThreadContextService } = await import('./thread-context');
              await ThreadContextService.linkEmailToThread(
                email.id,
                emailData.subject,
                emailData.from,
                userId
              );
            } catch (error) {
              console.error('Failed to link email to thread:', error);
              // Continue processing - thread linking is not critical for basic functionality
            }

            // UPGRADED: Classify email with vector embeddings and hallucination prevention
            const { autoResponderService } = await import('./auto-responder');
            const enhancedClassification = await autoResponderService.classifyEmail(
              email.body,
              email.subject,
              userId // Enable vector embeddings for this user
            );

            // Create enhanced classification object structure
            const classification = {
              classification: enhancedClassification.classification,
              confidence: enhancedClassification.confidence,
              reasoning: `Vector-enhanced: ${enhancedClassification.reasoning}`,
              orderNumber: null,
              customerInfo: null
            };

            // Update email with classification
            await storage.updateEmail(email.id, {
              classification: classification.classification,
              confidence: classification.confidence,
              metadata: {
                reasoning: classification.reasoning,
                orderNumber: classification.orderNumber,
                customerInfo: classification.customerInfo,
              },
            });

            // **AI ASSISTANT PRIORITY**: General emails ALWAYS go to AI Assistant, never automation rules
            if (classification.classification === 'general' || classification.classification === 'general_inquiry') {
              // Force route to AI Assistant regardless of automation rules
              console.log(`[EMAIL_PROCESSOR] General email detected - routing directly to AI Assistant approval queue (regular processing)`);
              await this.routeToAIAssistant(email, classification, settings, userId);
              processedCount++;
            } else {
              // Find matching auto-responder rule (non-general classifications only)
              const matchingRule = activeRules.find(
                rule => rule.classification === classification.classification
              );

              if (matchingRule) {
                // Generate and send response
                await this.sendAutoResponse(email, matchingRule, classification, settings);
                processedCount++;
              } else {
                // No matching rule - fallback to AI Assistant (approval queue)
                console.log(`[EMAIL_PROCESSOR] No specific automation rule for ${classification.classification}, routing to AI Assistant`);
                await this.routeToAIAssistant(email, classification, settings, userId);
                processedCount++;
              }
            }

            // Log activity
            await storage.createActivityLog({
              userId,
              action: 'email_processed',
              type: 'email_processed',
              executedBy: 'ai',
              customerEmail: email.fromEmail,
              details: `Email classified as ${classification.classification} with ${classification.confidence}% confidence`,
              status: 'completed',
              metadata: {
                emailId: email.id,
                classification: classification.classification,
                confidence: classification.confidence,
              },
            });

          } catch (error) {
            console.error('Error processing email:', error);
            // Continue with next email
          }
        }
      }

      return processedCount;
    } catch (error) {
      console.error('Email processing error:', error);
      return 0;
    }
  }

  private async fetchEmailsFromProvider(account: any): Promise<any[]> {
    try {
      if (account.provider === 'gmail') {
        return await this.fetchGmailEmails(account);
      } else if (account.provider === 'outlook') {
        return await this.fetchOutlookEmails(account);
      }
      return [];
    } catch (error) {
      console.error('Error fetching emails from provider:', error);
      return [];
    }
  }

  private async fetchGmailEmails(account: any): Promise<any[]> {
    try {
      // VERIFIED: Gmail API can exclude spam folder using query parameter
      // Official Google docs confirm this works: q="-in:spam"
      const query = '-in:spam -in:trash is:unread newer_than:1d'; // Exclude spam/trash, unread, last 24 hours

      const response = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=50`,
        {
          headers: {
            Authorization: `Bearer ${account.accessToken}`,
          },
        }
      );

      if (!response.ok) {
        // Try to refresh token
        const newTokens = await oauthService.refreshGmailToken(account.refreshToken);
        await storage.updateEmailAccount(account.id, {
          accessToken: newTokens.access_token,
        });

        // Retry with new token
        const retryResponse = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=50`,
          {
            headers: {
              Authorization: `Bearer ${newTokens.access_token}`,
            },
          }
        );

        if (!retryResponse.ok) {
          throw new Error('Gmail API request failed');
        }
      }

      const data = await response.json();
      const messages = data.messages || [];

      // Fetch full email content for each message
      const emails = [];
      for (const message of messages) {
        try {
          const emailResponse = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}`,
            {
              headers: {
                Authorization: `Bearer ${account.accessToken}`,
              },
            }
          );

          if (emailResponse.ok) {
            const emailData = await emailResponse.json();
            const email = this.parseGmailMessage(emailData);
            if (email) emails.push(email);
          }
        } catch (emailError) {
          console.error('Error fetching individual Gmail message:', emailError);
          continue;
        }
      }

      return emails;
    } catch (error) {
      console.error('Gmail fetch error:', error);
      return [];
    }
  }

  private parseGmailMessage(gmailMessage: any): any | null {
    try {
      const payload = gmailMessage.payload;
      const headers = payload.headers || [];

      // Extract headers
      const from = headers.find((h: any) => h.name === 'From')?.value || '';
      const to = headers.find((h: any) => h.name === 'To')?.value || '';
      const subject = headers.find((h: any) => h.name === 'Subject')?.value || '';

      // Extract body
      let body = '';
      if (payload.body?.data) {
        body = Buffer.from(payload.body.data, 'base64').toString();
      } else if (payload.parts) {
        // Multi-part message
        for (const part of payload.parts) {
          if (part.mimeType === 'text/plain' && part.body?.data) {
            body += Buffer.from(part.body.data, 'base64').toString();
          }
        }
      }

      return {
        id: gmailMessage.id,
        from: from,
        to: to,
        subject: subject,
        body: body,
        labels: gmailMessage.labelIds || [],
        isInPrimaryTab: gmailMessage.labelIds?.includes('CATEGORY_PRIMARY') ||
                       (!gmailMessage.labelIds?.includes('CATEGORY_PROMOTIONS') &&
                        !gmailMessage.labelIds?.includes('CATEGORY_SOCIAL') &&
                        !gmailMessage.labelIds?.includes('CATEGORY_UPDATES')),
        receivedAt: new Date(parseInt(gmailMessage.internalDate))
      };
    } catch (error) {
      console.error('Error parsing Gmail message:', error);
      return null;
    }
  }

  private async fetchOutlookEmails(account: any): Promise<any[]> {
    try {
      // Use Microsoft Graph service - this DEFINITELY works to exclude spam
      // API endpoint: /me/mailFolders/inbox/messages excludes "Junk Email" folder
      const emails = await microsoftGraphService.fetchEmails(account.accessToken, {
        folder: 'inbox', // Proven: only fetches from inbox folder, excludes Junk Email
        maxResults: 50,
        sinceDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        unreadOnly: true, // Only fetch unread emails for processing
      });

      // Transform Microsoft Graph email format to internal format
      return emails.map(email => ({
        id: email.id,
        from: email.from?.emailAddress?.address || '',
        to: email.toRecipients?.[0]?.emailAddress?.address || '',
        subject: email.subject || '',
        body: email.body?.content || email.bodyPreview || '',
        folder: 'inbox', // Mark as inbox email
        receivedAt: new Date(email.receivedDateTime),
        isRead: email.isRead,
        hasAttachments: email.hasAttachments,
      }));
    } catch (error) {
      console.error('Outlook fetch error:', error);

      // Try to refresh token if authentication failed
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('401') || errorMessage.includes('unauthorized')) {
        try {
          const newTokens = await oauthService.refreshOutlookToken(account.refreshToken);
          await storage.updateEmailAccount(account.id, {
            accessToken: newTokens.access_token,
          });

          // Retry with new token
          const retryEmails = await microsoftGraphService.fetchEmails(newTokens.access_token, {
            maxResults: 50,
            sinceDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
            unreadOnly: true,
          });

          return retryEmails.map(email => ({
            id: email.id,
            from: email.from?.emailAddress?.address || '',
            to: email.toRecipients?.[0]?.emailAddress?.address || '',
            subject: email.subject || '',
            body: email.body?.content || email.bodyPreview || '',
            receivedAt: new Date(email.receivedDateTime),
            isRead: email.isRead,
            hasAttachments: email.hasAttachments,
          }));
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError instanceof Error ? refreshError.message : refreshError);
          return [];
        }
      }

      return [];
    }
  }

  private async sendAutoResponse(email: any, rule: any, classification: any, settings: any): Promise<void> {
    try {
      // For order status emails, extract order number and use enhanced tracking response
      if (classification.classification === 'order_status') {
        // Extract order number from email content
        const orderNumber = this.extractOrderNumberFromEmail(email.subject, email.body);
        if (orderNumber) {
          // Add order number to classification for enhanced response
          const enhancedClassification = { ...classification, orderNumber };
          await this.sendEnhancedOrderStatusResponse(email, rule, enhancedClassification, settings);
          return;
        }
      }

      // For order cancellation emails, trigger the cancellation workflow
      if (classification.classification === 'order_cancellation') {
        await this.handleOrderCancellationEmail(email, classification, settings, email.userId);
        return;
      }

      // Generate personalized response for other classifications with full thread context
      const response = await openaiService.generateFromInstructions(
        rule.template,
        `${email.subject}\n\n${email.body}`,
        'Customer Service Team',
        classification.orderNumber ? { orderNumber: classification.orderNumber } : undefined,
        undefined, // No subscription data for this context
        undefined, // No signature context needed
        email.userId
      );



      // Send response via email routing service (uses customer's connected Gmail/Microsoft account)
      const { emailRoutingService } = await import('./email-routing');
      await emailRoutingService.sendEmail(email.userId, {
        to: email.fromEmail,
        subject: `Re: ${email.subject}`,
        html: `<p>${response.replace(/\n/g, '<br>')}</p>`,
      });

      // Update email as resolved
      await storage.updateEmail(email.id, {
        status: 'resolved',
        isResponded: true,
        aiResponse: response,
        processedAt: new Date(),
      });

      // Update rule trigger count
      await storage.updateAutoResponderRule(rule.id, {
        triggerCount: (rule.triggerCount || 0) + 1,
        lastTriggered: new Date(),
      });

    } catch (error) {
      console.error('Auto-response error:', error);
      // Route to AI Assistant if auto-response fails
      await this.routeToAIAssistant(email, classification, settings, email.userId);
    }
  }

  /**
   * Handle order cancellation emails by triggering the cancellation workflow
   */


  /**
   * Route to AI Assistant (escalation queue) when no specific automation rule matches
   * Create escalation item with AI-generated suggested response for human review
   */
  private async routeToAIAssistant(email: any, classification: any, settings: any, userId: string): Promise<void> {
    try {
      console.log(`[EMAIL_PROCESSOR] Routing to AI Assistant escalation queue for ${email.subject}`);

      // Try to generate AI suggested response - gracefully handle missing API key
      let aiSuggestedResponse = 'This email requires manual review and response.';
      try {
        if (settings?.openaiApiKey || process.env.OPENAI_API_KEY) {
          aiSuggestedResponse = await openaiService.generateFromInstructions(
            'You are a helpful AI customer service assistant. Create a professional, friendly response to this customer inquiry.',
            `${email.subject}\n\n${email.body}`,
            settings?.companyName || 'Customer Service Team',
            undefined, // No order data
            undefined, // No subscription data
            undefined, // No signature context
            userId
          );
        } else {
          console.warn('[EMAIL_PROCESSOR] No OpenAI API key available - using fallback response');
        }
      } catch (openaiError) {
        console.warn('[EMAIL_PROCESSOR] OpenAI suggestion failed - using fallback:', openaiError);
      }

      // Create escalation item for human review with AI suggestion
      await storage.createEscalationQueue({
        userId,
        emailId: email.id,
        priority: classification.priority || 'medium',
        reason: `General inquiry requiring human review: ${classification.reasoning || 'AI confidence below threshold'}`,
        status: 'pending',
        assignedTo: null,
        notes: null,
        createdAt: new Date(),
        resolvedAt: null,
        aiSuggestedResponse: aiSuggestedResponse,
        aiConfidence: classification.confidence / 100, // Convert percentage to decimal
        originalMessageId: email.messageId || null,
        emailProvider: 'gmail'
      });

      // Update email status to indicate escalation
      await storage.updateEmail(email.id, {
        status: 'escalated',
        processedAt: new Date(),
        metadata: {
          ...email.metadata,
          escalatedToAIAssistant: true,
          escalationReason: 'General inquiry requiring human review',
          aiSuggestionGenerated: true
        }
      });

      // Log activity
      await storage.createActivityLog({
        userId,
        action: 'email_escalated',
        type: 'ai_escalation',
        executedBy: 'ai_assistant',
        customerEmail: email.fromEmail,
        details: `Email escalated to AI Assistant queue with suggested response`,
        status: 'completed',
        metadata: {
          emailId: email.id,
          classification: classification.classification,
          confidence: classification.confidence,
        },
      });

      console.log(`[EMAIL_PROCESSOR] Email ${email.id} escalated to AI Assistant queue with suggested response`);

    } catch (error) {
      console.error('[EMAIL_PROCESSOR] AI Assistant escalation failed:', error);

      // Fallback escalation without AI suggestion
      await this.escalateEmail(
        email.id,
        userId,
        `AI Assistant escalation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'medium'
      );
    }
  }

  private async sendEnhancedOrderStatusResponse(email: any, rule: any, classification: any, settings: any): Promise<void> {
    try {
      const fromAddress = settings?.fromEmail || 'support@delightdesk.io';
      const replyToAddress = settings?.replyToEmail || fromAddress;
      const companyName = settings?.companyName;
      const orderNumber = classification.orderNumber;
      const customerName = classification.customerInfo?.name || 'Valued Customer';

      // Try to look up order details and tracking information
      let orderData = null;
      let trackingNumber: string | undefined = undefined;
      let trackingUrl: string | undefined = undefined;
      let carrier: string | undefined = undefined;
      let aiPrediction: string | undefined = undefined;

      try {
        // Import order lookup service
        const { OrderLookupService } = await import('./order-lookup');
        const orderLookupService = new OrderLookupService();
        orderData = await orderLookupService.searchOrderByNumber(email.userId, orderNumber);

        if (orderData && orderData.trackingNumber) {
          trackingNumber = orderData.trackingNumber;

          // Get enhanced AI predictions
          try {
            const { aftershipService } = await import('./aftership');
            const enhancedTracking = await aftershipService.getEnhancedTrackingForEmail(trackingNumber);

            trackingUrl = enhancedTracking.trackingUrl;
            carrier = enhancedTracking.tracking.slug.toUpperCase();

            // Generate AI prediction based on tracking status
            if (enhancedTracking.tracking.tag === 'OutForDelivery') {
              aiPrediction = `Package is out for delivery. Expected delivery by end of business day based on ${carrier} tracking patterns.`;
            } else if (enhancedTracking.tracking.tag === 'InTransit') {
              aiPrediction = `Package is in transit. Estimated delivery within 1-2 business days based on current location and ${carrier} delivery patterns.`;
            } else if (enhancedTracking.tracking.tag === 'Delivered') {
              aiPrediction = `Package successfully delivered. Thank you for your order!`;
            } else if (enhancedTracking.tracking.tag === 'Pending') {
              aiPrediction = `Package information received. Estimated delivery within 3-5 business days based on ${carrier} delivery patterns.`;
            }

            console.log('AI prediction added to automated email:', {
              orderNumber,
              trackingNumber,
              status: enhancedTracking.tracking.tag,
              aiPrediction: aiPrediction ? 'Generated' : 'Not available'
            });
          } catch (trackingError) {
            console.log('Enhanced tracking lookup failed for automation, using fallback tracking');
            // Generate fallback tracking URL
            if (trackingNumber.startsWith('1Z')) {
              trackingUrl = `https://www.ups.com/track?tracknum=${trackingNumber}`;
              carrier = 'UPS';
            } else if (trackingNumber.length === 12 && /^\d+$/.test(trackingNumber)) {
              trackingUrl = `https://tools.usps.com/go/TrackConfirmAction?tLabels=${trackingNumber}`;
              carrier = 'USPS';
            }
          }
        }
      } catch (lookupError) {
        console.log('Order lookup failed for automation, using basic response');
      }

      // Generate enhanced email using template
      const { EmailTemplates } = await import('./email-templates');
      const emailContent = EmailTemplates.generateOrderStatusEmail({
        customerName,
        orderNumber,
        status: orderData?.status || 'Processing',
        companyName,
        trackingNumber,
        trackingUrl,
        carrier,
        aiPrediction
      });



      const { emailRoutingService } = await import('./email-routing');
      await emailRoutingService.sendEmail(email.userId, {
        to: email.fromEmail,
        subject: `Status and estimated delivery date for ${companyName || 'your'} order number ${orderNumber}`,
        html: emailContent.html,
      });

      // Update email as resolved with enhanced response
      await storage.updateEmail(email.id, {
        status: 'resolved',
        isResponded: true,
        aiResponse: `Enhanced order status response with ${aiPrediction ? 'AI predictions' : 'tracking info'}`,
        processedAt: new Date(),
      });

      // Update rule trigger count
      await storage.updateAutoResponderRule(rule.id, {
        triggerCount: (rule.triggerCount || 0) + 1,
        lastTriggered: new Date(),
      });

    } catch (error) {
      console.error('Enhanced order status response error:', error);
      // Route to AI Assistant if enhanced response fails
      const emailData = { id: email.id, subject: email.subject, body: email.body, fromEmail: email.fromEmail, userId: email.userId };
      await this.routeToAIAssistant(emailData, classification, settings, email.userId);
    }
  }

  /**
   * **REARCHITECTED ORDER CANCELLATION HANDLER**
   * Guarantees approval queue arrival with fulfillment-method-aware processing
   */
  private async handleOrderCancellationEmail(
    email: any,
    classification: any,
    settings: any,
    userId: string
  ): Promise<void> {
    console.log(`[EMAIL_PROCESSOR] Handling order cancellation email ${email.id} for user ${userId}`);

    try {
      // CRITICAL: Always create approval queue item FIRST to guarantee it arrives
      // This ensures even if processing fails, the email still gets human attention
      let proposedResponse = '';
      let confidence = classification.confidence || 85;
      let metadata: any = {
        automationType: 'order_cancellation',
        guaranteedApprovalQueue: true,
        processingTimestamp: new Date().toISOString()
      };

      // Try intelligent processing, but NEVER fail the approval queue creation
      try {
        const { orderCancellationService } = await import('./order-cancellation');

        // Check fulfillment method to determine processing approach
        const fulfillmentMethod = settings?.fulfillmentMethod || 'warehouse_email';

        if (settings?.automationApprovalRequired) {
          // If approval required, send directly to approval queue with smart proposed response
          console.log(`[EMAIL_PROCESSOR] Order cancellation requires approval - sending to queue with intelligent proposal`);

          if (fulfillmentMethod === 'self_fulfillment') {
            // Self-fulfillment: can process immediately after approval
            proposedResponse = `Hi there,

We received your cancellation request. Since we handle fulfillment in-house, we can process this quickly once approved.

We'll cancel your order and issue a full refund if it hasn't shipped yet. If it has shipped, we'll help you set up a return.

Best regards,
Customer Service Team`;
            confidence = 90;
            metadata.processingApproach = 'synchronous_after_approval';
            metadata.fulfillmentMethod = fulfillmentMethod;
          } else {
            // Warehouse/ShipBob: needs coordination workflow
            proposedResponse = `Hi there,

We received your cancellation request for your order. We're checking with our fulfillment team to see if we can cancel it before it ships.

We'll update you shortly with the results. If we can't cancel in time, we'll help you coordinate a return once you receive it.

Best regards,
Customer Service Team`;
            confidence = 85;
            metadata.processingApproach = 'state_machine_after_approval';
            metadata.fulfillmentMethod = fulfillmentMethod;
          }
        } else {
          // If automation is enabled, try to initiate the workflow
          console.log(`[EMAIL_PROCESSOR] Order cancellation automation enabled - initiating workflow`);

          const workflowResult = await orderCancellationService.initiateCancellationWorkflow(
            userId,
            email.id,
            email.fromEmail,
            email.subject,
            email.body
          );

          if (workflowResult.success) {
            // Workflow initiated successfully - get current workflow state for perfect sync
            const workflow = await storage.getOrderCancellationWorkflow(workflowResult.workflowId!);
            if (workflow) {
              proposedResponse = this.generateWorkflowProposedResponse(workflow, fulfillmentMethod);
              confidence = 95;
              metadata.workflowId = workflowResult.workflowId;
              metadata.automationStatus = 'workflow_initiated';

              // **CRITICAL SYNC**: Mirror exact workflow state in approval queue
              metadata.currentStep = workflow.step;
              metadata.stepNumber = this.getStepNumber(workflow.step);
              metadata.totalSteps = this.getTotalSteps(fulfillmentMethod);
              metadata.workflowStatus = workflow.status;
              metadata.fulfillmentMethod = workflow.fulfillmentMethod;
              metadata.isEligible = workflow.isEligible;
              metadata.eligibilityReason = workflow.eligibilityReason;
            } else {
              proposedResponse = `Workflow initiated but unable to sync state. Manual review required.`;
              confidence = 70;
            }
          } else {
            // Workflow failed - still send to approval queue with error context
            proposedResponse = `Automated cancellation failed: ${workflowResult.error}. Manual review required.`;
            confidence = 70;
            metadata.automationError = workflowResult.error;
            metadata.automationStatus = 'workflow_failed';
          }
        }
      } catch (processingError) {
        // Processing failed - prepare fallback response
        console.error(`[EMAIL_PROCESSOR] Order cancellation processing failed:`, processingError);
        proposedResponse = `Order cancellation requires manual review due to processing error. Please review and respond appropriately.`;
        confidence = 60;
        metadata.processingError = processingError instanceof Error ? processingError.message : 'Unknown error';
        metadata.automationStatus = 'processing_failed';
      }

      // **GUARANTEED APPROVAL QUEUE CREATION** - This MUST succeed
      await storage.createAutomationApprovalItem({
        userId,
        emailId: email.id,
        ruleId: 'order-cancellation-agent',
        customerEmail: email.fromEmail,
        subject: email.subject,
        body: email.body,
        classification: 'order_cancellation',
        proposedResponse,
        confidence,
        status: 'pending',
        agentType: 'order_cancellation',
        metadata
      });

      // Update email status to indicate it's in the approval queue
      await storage.updateEmail(email.id, {
        status: 'needs_review',
        metadata: {
          ...email.metadata,
          sentToApprovalQueue: true,
          approvalQueueTimestamp: new Date().toISOString(),
          orderCancellationProcessed: true
        }
      });

      console.log(`[EMAIL_PROCESSOR] Order cancellation email ${email.id} successfully routed to approval queue`);

    } catch (error) {
      // ABSOLUTE FALLBACK: If even approval queue creation fails, log and escalate
      console.error(`[EMAIL_PROCESSOR] CRITICAL: Failed to route order cancellation to approval queue:`, error);

      // Last resort: create a basic approval item
      try {
        await storage.createAutomationApprovalItem({
          userId,
          emailId: email.id,
          ruleId: 'order-cancellation-fallback',
          customerEmail: email.fromEmail,
          subject: email.subject,
          body: email.body,
          classification: 'order_cancellation',
          proposedResponse: 'CRITICAL: Order cancellation processing failed. Immediate manual review required.',
          confidence: 50,
          status: 'pending',
          agentType: 'order_cancellation',
          metadata: {
            criticalFailure: true,
            fallbackProcessing: true,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        });
      } catch (fallbackError) {
        console.error(`[EMAIL_PROCESSOR] ULTIMATE FAILURE: Could not create fallback approval item:`, fallbackError);
        // At this point, we need manual intervention
      }
    }
  }

  /**
   * ATOMIC EMAIL ROUTING: Classify and route email in one operation
   * Eliminates "classified" status gap that causes emails to get stuck
   */
  async routeEmailDirectly(email: any, classification: any, userId: string): Promise<void> {
    try {
      const settings = await storage.getSystemSettings(userId);
      const activeRules = await storage.getAutoResponderRules(userId);
      
      console.log(`[EMAIL_PROCESSOR] Routing email ${email.id} with classification ${classification.classification}`);

      // **AI ASSISTANT PRIORITY**: General emails ALWAYS go to AI Assistant
      if (classification.classification === 'general' || classification.classification === 'general_inquiry') {
        console.log(`[EMAIL_PROCESSOR] General email detected - routing directly to AI Assistant`);
        await this.routeToAIAssistant(email, classification, settings, userId);
        return;
      }
      
      // **ORDER CANCELLATION**: Handle with guaranteed approval queue arrival
      if (classification.classification === 'order_cancellation') {
        console.log(`[EMAIL_PROCESSOR] Order cancellation detected - routing to specialized handler`);
        await this.handleOrderCancellationEmail(email, classification, settings, userId);
        return;
      }
      
      // Find matching auto-responder rule for other classifications
      const matchingRule = activeRules.find(
        rule => rule.classification === classification.classification && rule.isActive
      );

      if (matchingRule && settings.automationApprovalRequired) {
        // Add to approval queue
        console.log(`[EMAIL_PROCESSOR] Routing to approval queue with rule: ${matchingRule.name}`);
        const { autoResponderService } = await import('./auto-responder');
        const responseData = await autoResponderService.generateProposedResponse(matchingRule, {
          subject: email.subject,
          body: email.body,
          fromEmail: email.fromEmail
        }, userId);

        await storage.createAutomationApprovalItem({
          userId,
          emailId: email.id,
          ruleId: matchingRule.id,
          customerEmail: email.fromEmail,
          subject: email.subject,
          body: email.body,
          classification: classification.classification,
          confidence: responseData.adjustedConfidence,
          proposedResponse: responseData.response,
          status: 'pending',
          metadata: {
            atomicProcessing: true,
            priority: classification.priority,
            classificationReasoning: classification.reasoning
          }
        });
        
        await storage.updateEmail(email.id, {
          status: 'processed',
          processedAt: new Date()
        });
        
      } else if (matchingRule && !settings.automationApprovalRequired) {
        // Execute automation rule directly
        console.log(`[EMAIL_PROCESSOR] Executing automation rule directly: ${matchingRule.name}`);
        await this.sendAutoResponse(email, matchingRule, classification, settings);
        
      } else {
        // No matching rule - route to AI Assistant
        console.log(`[EMAIL_PROCESSOR] No automation rule found for ${classification.classification}, routing to AI Assistant`);
        await this.routeToAIAssistant(email, classification, settings, userId);
      }
      
    } catch (error) {
      console.error(`[EMAIL_PROCESSOR] Error in atomic routing for email ${email.id}:`, error);
      // GUARANTEED FALLBACK: Always escalate if routing fails
      throw error; // Let caller handle fallback
    }
  }

  private async escalateEmail(emailId: string, userId: string, reason: string, priority: 'low' | 'medium' | 'high' | 'urgent' = 'medium'): Promise<void> {
    try {
      await storage.createAutomationApprovalItem({
        emailId,
        userId,
        subject: 'Email escalation',
        body: reason,
        classification: 'escalation',
        confidence: 95,
        customerEmail: 'system',
        ruleId: 'escalation-rule',
        proposedResponse: 'Manual review required',
        status: 'pending',
      });

      await storage.updateEmail(emailId, {
        status: 'escalated',
        escalationReason: reason,
      });
    } catch (error) {
      console.error('Escalation error:', error);
    }
  }

  // New method for AI-powered escalation analysis
  private async analyzeAndEscalateIfNeeded(email: any): Promise<boolean> {
    try {
      // Import the AI analyzer (would be at the top of the file in practice)
      const { aiEscalationAnalyzer } = await import('./ai-escalation-analyzer');

      const analysis = await aiEscalationAnalyzer.analyzeEmailForEscalation(
        email.subject,
        email.body,
        email.fromEmail,
        email.classification
      );

      if (analysis.shouldEscalate) {
        await this.escalateEmail(
          email.id,
          email.userId,
          analysis.reason,
          analysis.priority
        );

        // Log the suggested actions for the human agent
        await storage.createActivityLog({
          userId: email.userId,
          type: 'escalation',
          action: 'escalation_created',
          executedBy: 'ai',
          customerEmail: email.fromEmail || 'system',
          details: `Email escalated: ${analysis.reason}. Suggested actions: ${analysis.suggestedActions.join(', ')}`,
          status: 'pending',
          metadata: {
            emailId: email.id,
            priority: analysis.priority,
            suggestedActions: analysis.suggestedActions
          }
        });

        return true;
      }

      return false;
    } catch (error) {
      console.error('AI escalation analysis error:', error);
      // Fallback to basic escalation logic
      await this.escalateEmail(email.id, email.userId, 'Automated escalation due to classification');
      return true;
    }
  }

  /**
   * **WORKFLOW-APPROVAL QUEUE SYNCHRONIZATION HELPERS**
   * These methods ensure perfect sync between workflow tracker and approval queue
   */

  /**
   * Generate proposed response based on current workflow state
   * This mirrors what humans see in the workflow tracker
   */
  private generateWorkflowProposedResponse(workflow: any, fulfillmentMethod: string): string {
    const stepDescriptions = {
      'acknowledge_customer': 'Customer has been acknowledged, waiting for next step',
      'email_warehouse': 'Warehouse has been contacted, awaiting response',
      'awaiting_warehouse': 'Waiting for warehouse confirmation',
      'process_result': 'Processing warehouse response',
      'completed': 'Workflow completed successfully',
      'canceled': 'Order cancelled and refund processed',
      'cannot_cancel': 'Order could not be cancelled due to timing'
    };

    const stepDescription = (stepDescriptions as any)[workflow.step] || `Current step: ${workflow.step}`;

    return `Order Cancellation Workflow (${fulfillmentMethod})

Current Status: ${workflow.status}
Current Step: ${stepDescription}
Eligibility: ${workflow.isEligible ? 'Eligible' : 'Not eligible'} - ${workflow.eligibilityReason}

${workflow.isEligible ?
  'Processing cancellation through ' + fulfillmentMethod + ' coordination.' :
  'Customer will be notified that cancellation is not possible due to timing.'
}

Workflow ID: ${workflow.id}`;
  }

  /**
   * Map workflow step to step number for progress visualization
   * Must match exactly what the workflow tracker shows
   */
  private getStepNumber(step: string): number {
    const stepMap = {
      'identify_order': 1,
      'check_eligibility': 2,
      'acknowledge_customer': 3,
      'email_warehouse': 4,
      'awaiting_warehouse': 5,
      'warehouse_received': 6,
      'process_result': 7,
      'completed': 7,
      'canceled': 7,
      'cannot_cancel': 7
    };
    return (stepMap as any)[step] || 1;
  }

  /**
   * Get total steps based on fulfillment method
   * Must match workflow tracker step count exactly
   */
  private getTotalSteps(fulfillmentMethod: string): number {
    switch (fulfillmentMethod) {
      case 'warehouse_email':
      case 'shipbob':
      case 'shipstation':
        return 7; // Full coordination workflow
      case 'self_fulfillment':
        return 4; // Simplified workflow (no warehouse coordination)
      default:
        return 7;
    }
  }

  /**
   * Extract order number from email content using regex patterns
   */
  private extractOrderNumberFromEmail(subject: string, body: string): string | null {
    try {
      const content = `${subject} ${body}`;
      
      // Common order number patterns
      const patterns = [
        /#(\d{4,})/i,                    // #12345
        /order\s*#?(\d{4,})/i,          // order 12345, order #12345
        /order\s*number\s*#?(\d{4,})/i, // order number 12345
        /ord[er]*-(\d{4,})/i,           // ORD-12345
        /\b(\d{5,})\b/                  // Any 5+ digit number
      ];
      
      for (const pattern of patterns) {
        const match = content.match(pattern);
        if (match) {
          return match[1];
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error extracting order number:', error);
      return null;
    }
  }
}

// Export singleton instance
export const emailProcessor = new EmailProcessor();