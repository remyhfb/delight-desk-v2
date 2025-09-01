import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, integer, json, jsonb, decimal, unique } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  company: text("company"),
  phone: text("phone"),
  isActive: boolean("is_active").default(true),
  lastLoginAt: timestamp("last_login_at"),
  plan: text("plan"), // 'solopreneur', 'growth', 'scale'
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  weeklyReportsEnabled: boolean("weekly_reports_enabled").default(true),
  lastWeeklyReportSent: text("last_weekly_report_sent"), // Week identifier like "2025-W32"
  emailSignature: text("email_signature"), // User's email signature for all responses
  signatureName: text("signature_name"),
  signatureTitle: text("signature_title"), 
  signatureCompany: text("signature_company"),
  signatureCompanyUrl: text("signature_company_url"),
  signaturePhone: text("signature_phone"),
  signatureEmail: text("signature_email"),
  signatureLogoUrl: text("signature_logo_url"),
  signaturePhotoUrl: text("signature_photo_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const billingPlans = pgTable("billing_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(), // 'solopreneur', 'growth', 'scale'
  displayName: text("display_name").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  resolutions: integer("resolutions").notNull(), // AI resolutions included per month
  storeLimit: integer("store_limit").notNull(),
  emailLimit: integer("email_limit"), // null for unlimited
  features: jsonb("features").notNull(), // array of feature names
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const userBilling = pgTable("user_billing", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull().unique(),
  planId: varchar("plan_id").references(() => billingPlans.id).notNull(),
  status: text("status").default('active'), // 'active', 'trial', 'expired', 'cancelled', 'beta_tester'
  trialEndsAt: timestamp("trial_ends_at"),
  billingCycleStart: timestamp("billing_cycle_start"),
  billingCycleEnd: timestamp("billing_cycle_end"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  
  // API usage tracking columns
  aftershipDailyCount: integer("aftership_daily_count").default(0).notNull(),
  aftershipMonthlyCount: integer("aftership_monthly_count").default(0).notNull(),
  openaiDailyCount: integer("openai_daily_count").default(0).notNull(),
  openaiMonthlyCount: integer("openai_monthly_count").default(0).notNull(),
  lastResetDaily: timestamp("last_reset_daily").defaultNow(),
  lastResetMonthly: timestamp("last_reset_monthly").defaultNow(),
  
  isBetaTester: boolean("is_beta_tester").default(false).notNull(),
  betaTesterGrantedAt: timestamp("beta_tester_granted_at"),
  betaTesterGrantedBy: varchar("beta_tester_granted_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Payment Methods Storage Table
export const paymentMethods = pgTable("payment_methods", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  stripePaymentMethodId: text("stripe_payment_method_id").notNull(),
  type: text("type").notNull(), // 'card'
  cardBrand: text("card_brand"), // 'visa', 'mastercard', etc.
  cardLast4: text("card_last4"),
  cardExpMonth: integer("card_exp_month"),
  cardExpYear: integer("card_exp_year"),
  isDefault: boolean("is_default").default(false),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const passwordResetLogs = pgTable("password_reset_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull(),
  userId: varchar("user_id").references(() => users.id),
  action: text("action").notNull(), // 'request', 'token_generated', 'email_sent', 'email_failed', 'token_validated', 'password_changed', 'token_expired'
  status: text("status").notNull(), // 'success', 'failed', 'error'
  tokenId: varchar("token_id").references(() => passwordResetTokens.id),
  sendgridResponse: jsonb("sendgrid_response"), // Store full SendGrid API response
  errorMessage: text("error_message"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  metadata: jsonb("metadata"), // Additional context data
  createdAt: timestamp("created_at").defaultNow(),
});

// SendGrid Email Logs - Track all outgoing emails
export const sendgridEmailLogs = pgTable("sendgrid_email_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id), // Null for system emails
  messageId: text("message_id"), // SendGrid message ID
  fromEmail: text("from_email").notNull(),
  fromName: text("from_name"),
  toEmail: text("to_email").notNull(),
  toName: text("to_name"),
  subject: text("subject").notNull(),
  htmlContent: text("html_content"),
  textContent: text("text_content"),
  emailType: text("email_type").notNull(), // 'welcome', 'trial_expiration', 'weekly_report', 'setup_reminder', 'password_reset', 'system_notification'
  status: text("status").notNull(), // 'sent', 'failed', 'pending'
  sendgridResponse: jsonb("sendgrid_response"), // Full SendGrid API response
  errorMessage: text("error_message"),
  deliveryStatus: text("delivery_status"), // 'delivered', 'bounced', 'dropped', 'deferred', 'processed' (from webhooks)
  openedAt: timestamp("opened_at"), // When email was opened (from webhooks)
  clickedAt: timestamp("clicked_at"), // When email was clicked (from webhooks)
  unsubscribedAt: timestamp("unsubscribed_at"), // When user unsubscribed (from webhooks)
  spamReportedAt: timestamp("spam_reported_at"), // When marked as spam (from webhooks)
  metadata: jsonb("metadata"), // Additional context data (template variables, etc.)
  sentAt: timestamp("sent_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const integrationLogs = pgTable("integration_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  integration: text("integration").notNull(), // 'woocommerce', 'shopify', 'gmail', 'outlook'
  action: text("action").notNull(), // 'auth_start', 'auth_callback', 'api_call', 'connection_test', 'data_sync'
  status: text("status").notNull(), // 'success', 'failed', 'error', 'pending'
  storeUrl: text("store_url"), // For WooCommerce/Shopify
  endpoint: text("endpoint"), // API endpoint being called
  httpMethod: text("http_method"), // GET, POST, PUT, DELETE
  statusCode: integer("status_code"), // HTTP status code
  requestData: jsonb("request_data"), // Sanitized request payload
  responseData: jsonb("response_data"), // API response data
  errorMessage: text("error_message"),
  errorStack: text("error_stack"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  duration: integer("duration"), // Time taken in milliseconds
  metadata: jsonb("metadata"), // Additional context data
  createdAt: timestamp("created_at").defaultNow(),
});

export const emailAccounts = pgTable("email_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  provider: text("provider").notNull(), // 'gmail', 'outlook', 'sendgrid'
  email: text("email").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  isActive: boolean("is_active").default(true),
  settings: text("settings"), // JSON string for storing provider-specific settings like History ID
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const storeConnections = pgTable("store_connections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  platform: text("platform").notNull(), // 'woocommerce', 'shopify'
  storeUrl: text("store_url").notNull(),
  apiKey: text("api_key").notNull(),
  apiSecret: text("api_secret"),
  storeName: text("store_name"), // Optional display name for the store
  connectionMethod: text("connection_method").default('oauth'), // 'oauth', 'api_key'
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const emails = pgTable("emails", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  fromEmail: text("from_email").notNull(),
  toEmail: text("to_email").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  classification: text("classification"), // 'promo_refund', 'order_status', 'return_request', 'general', 'escalation'
  confidence: integer("confidence"), // 0-100
  status: text("status").default('pending'), // 'pending', 'processing', 'resolved', 'escalated'
  aiResponse: text("ai_response"),
  isResponded: boolean("is_responded").default(false),
  escalationReason: text("escalation_reason"),
  metadata: jsonb("metadata"), // Store order info, customer data, etc.
  
  // Thread tracking fields
  threadId: text("thread_id"), // Groups related emails together
  inReplyToId: text("in_reply_to_id"), // Points to the email this is replying to (email ID)
  messageId: text("message_id"), // External message ID from email provider
  inReplyToMessageId: text("in_reply_to_message_id"), // External message ID this is replying to
  isThreadStart: boolean("is_thread_start").default(false), // True for the first email in a thread
  threadPosition: integer("thread_position").default(1), // Position in the thread (1, 2, 3...)
  
  createdAt: timestamp("created_at").defaultNow(),
  processedAt: timestamp("processed_at"),
}, (table) => {
  return {
    // Prevent duplicate emails from same messageId and userId - fixes race condition in Gmail push notifications
    uniqueMessageIdPerUser: unique("unique_message_id_per_user").on(table.messageId, table.userId),
  }
});

export const autoResponderRules = pgTable("auto_responder_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  classification: text("classification").notNull(),
  isActive: boolean("is_active").default(true),
  template: text("template").notNull(),
  conditions: jsonb("conditions"), // AI classification conditions
  triggerCount: integer("trigger_count").default(0),
  lastTriggered: timestamp("last_triggered"),
  lastActivated: timestamp("last_activated"), // Track when rule was last turned on
  requiresApproval: boolean("requires_approval").default(true), // Whether this rule needs approval before execution
  createdAt: timestamp("created_at").defaultNow(),
  
  // Promo refund automation settings (only for promo_refund classification)
  refundType: text("refund_type"), // 'percentage' | 'fixed_amount'
  refundValue: decimal("refund_value", { precision: 10, scale: 2 }), // percentage (0.20 for 20%) or fixed amount
  refundCap: decimal("refund_cap", { precision: 10, scale: 2 }), // maximum refund amount for percentage
  minOrderAmount: decimal("min_order_amount", { precision: 10, scale: 2 }), // minimum order to qualify
  maxOrderAmount: decimal("max_order_amount", { precision: 10, scale: 2 }), // maximum order for this rule
  firstTimeCustomerOnly: boolean("first_time_customer_only").default(false),
});

// NEW: Promo Code Configuration Table - Separate from existing automation
export const promoCodeConfigs = pgTable("promo_code_configs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  promoCode: text("promo_code").notNull(), // The actual promo code (e.g., "SAVE20")
  description: text("description"), // Admin description of the promo
  
  // Usage type - determines when this promo is offered
  usageType: text("usage_type").notNull().default("refund_only"), // 'refund_only' | 'first_time_customer' | 'general_inquiry' | 'both'
  
  // Discount configuration
  discountType: text("discount_type").notNull(), // 'percentage' | 'fixed_cash'
  discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }).notNull(),
  maxRefundValue: decimal("max_refund_value", { precision: 10, scale: 2 }), // Optional cap
  
  // Validity window
  validFrom: timestamp("valid_from").notNull(),
  validUntil: timestamp("valid_until").notNull(),
  
  // Eligibility rules
  appliesToSubscriptions: boolean("applies_to_subscriptions").default(true),
  minOrderValue: decimal("min_order_value", { precision: 10, scale: 2 }), // Optional minimum
  
  // First-time customer discount specific settings
  enableFirstTimeCustomerOffers: boolean("enable_first_time_customer_offers").default(false),
  firstTimeCustomerMessage: text("first_time_customer_message"), // Custom message for first-time customers
  
  // General discount inquiry settings
  enableGeneralInquiryOffers: boolean("enable_general_inquiry_offers").default(false),
  maxOffersPerCustomer: integer("max_offers_per_customer").default(1), // Limit per customer per time period
  offerFrequencyDays: integer("offer_frequency_days").default(90), // How often same customer can get offers
  
  // Automation settings
  eligibleForAutomation: boolean("eligible_for_automation").default(true),
  requiresApproval: boolean("requires_approval").default(true), // Whether this promo code agent needs approval before execution
  isStorewide: boolean("is_storewide").default(true), // Must be true for automation
  hasProductRestrictions: boolean("has_product_restrictions").default(false), // Must be false for automation
  
  // Tracking
  usageCount: integer("usage_count").default(0),
  firstTimeCustomerOffers: integer("first_time_customer_offers").default(0), // Track first-time customer offers
  generalInquiryOffers: integer("general_inquiry_offers").default(0), // Track general inquiry offers
  lastUsed: timestamp("last_used"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Returns Agent Configuration Table
export const returnsAgentConfigs = pgTable("returns_agent_configs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  
  // Agent settings
  isEnabled: boolean("is_enabled").default(false),
  requiresApproval: boolean("requires_approval").default(true),
  
  // Simple auto-approval settings
  enableAutoApproval: boolean("enable_auto_approval").default(false),
  autoApprovalDays: integer("auto_approval_days").default(30), // Days from purchase for auto-approval
  
  // Automatic refund settings for auto-approval
  enableAutoRefund: boolean("enable_auto_refund").default(false), // Issue instant refunds with auto-approval
  refundProcessingMethod: text("refund_processing_method").default("manual"), // 'manual', 'stripe_auto', 'woocommerce_auto'
  
  // Return policy configuration
  returnPolicyText: text("return_policy_text"), // Natural language return policy
  returnInstructions: text("return_instructions"), // Instructions for customers (mailing address, process, etc.)
  
  // Enhanced conversation handling
  enableSmartFollowUp: boolean("enable_smart_follow_up").default(true), // Ask for missing information intelligently
  maxFollowUpAttempts: integer("max_follow_up_attempts").default(2), // How many times to ask for info before escalating
  requirePhotosForDamaged: boolean("require_photos_for_damaged").default(false), // Request photos for damaged items
  requireReasonForReturn: boolean("require_reason_for_return").default(false), // Ask why customer wants to return
  
  // Tracking and analytics
  totalReturnsProcessed: integer("total_returns_processed").default(0),
  autoApprovalsGranted: integer("auto_approvals_granted").default(0),
  escalationsCreated: integer("escalations_created").default(0),
  conversationsStarted: integer("conversations_started").default(0), // Returns that required back-and-forth
  successfulQualifications: integer("successful_qualifications").default(0), // Returns completed after asking for info
  lastUsed: timestamp("last_used"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Returns Conversation Tracking - Track conversation state for returns requiring back-and-forth
export const returnsConversations = pgTable("returns_conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  customerEmail: text("customer_email").notNull(),
  threadId: text("thread_id").notNull(), // Links to emails.threadId
  originalEmailId: varchar("original_email_id").references(() => emails.id).notNull(),
  
  // Conversation state
  state: text("state").notNull().default("pending_info"), // 'pending_info', 'evaluating', 'approved', 'denied', 'escalated'
  infoNeeded: text("info_needed").array(), // ['order_number', 'photos', 'reason', 'purchase_date']
  followUpAttempts: integer("follow_up_attempts").default(0),
  lastFollowUpAt: timestamp("last_follow_up_at"),
  
  // Order context (once found)
  orderNumber: text("order_number"),
  orderFound: boolean("order_found").default(false),
  orderData: jsonb("order_data"), // Store order details when found
  
  // Return context
  returnReason: text("return_reason"),
  photosProvided: boolean("photos_provided").default(false),
  photoUrls: text("photo_urls").array(),
  
  // Resolution
  finalDecision: text("final_decision"), // 'approved', 'denied', 'escalated'
  decisionReason: text("decision_reason"),
  resolvedAt: timestamp("resolved_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const escalationQueue = pgTable("escalation_queue", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  emailId: varchar("email_id").references(() => emails.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  priority: text("priority").default('medium'), // 'low', 'medium', 'high', 'urgent'
  reason: text("reason").notNull(),
  status: text("status").default('pending'), // 'pending', 'in_progress', 'resolved', 'closed'
  assignedTo: varchar("assigned_to").references(() => users.id),
  notes: text("notes"),
  aiSuggestedResponse: text("ai_suggested_response"),
  aiConfidence: decimal("ai_confidence", { precision: 3, scale: 2 }),
  originalMessageId: text("original_message_id"), // Gmail message ID or Microsoft Graph message ID for inbox sync
  emailProvider: text("email_provider"), // 'gmail' or 'outlook' for inbox sync
  createdAt: timestamp("created_at").defaultNow(),
  resolvedAt: timestamp("resolved_at"),
});

export const systemSettings = pgTable("system_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  openaiApiKey: text("openai_api_key"),
  fromEmail: text("from_email"),
  replyToEmail: text("reply_to_email"),
  companyName: text("company_name"), // Company name for email personalization
  businessVertical: text("business_vertical").default("general_ecommerce"), // Business type for AI context: food_beverage, fashion, electronics, beauty, general_ecommerce
  aiAgentName: text("ai_agent_name").default("Kai"), // AI agent name for email signatures
  aiAgentTitle: text("ai_agent_title").default("AI Customer Service Agent"), // AI agent title for email signatures
  salutation: text("salutation").default("Best regards"), // AI agent email salutation
  customSalutation: text("custom_salutation"), // Custom salutation when user selects "Custom"
  signatureFooter: text("signature_footer").default("We use AI to solve customer problems faster. Reply 'Human' for immediate escalation."), // Custom text at bottom of email signature
  loyalCustomerGreeting: boolean("loyal_customer_greeting").default(false), // Thank loyal customers in first reply of email thread
  
  // OAuth-First Email Configuration
  primaryEmailMethod: text("primary_email_method").default('oauth'), // 'oauth', 'fallback'
  preferredOAuthProvider: text("preferred_oauth_provider"), // 'gmail', 'outlook'
  gmailConnected: boolean("gmail_connected").default(false),
  outlookConnected: boolean("outlook_connected").default(false),
  
  // Rate Limit Tracking
  dailyEmailCount: integer("daily_email_count").default(0),
  lastEmailReset: timestamp("last_email_reset").defaultNow(),
  approachingRateLimit: boolean("approaching_rate_limit").default(false),
  rateLimitWarningShown: boolean("rate_limit_warning_shown").default(false),
  
  automationApprovalRequired: boolean("automation_approval_required").default(true), // New users require approval by default

  warehouseEmail: text("warehouse_email"), // Order cancellation warehouse coordination email
  fulfillmentMethod: text("fulfillment_method").default('warehouse_email'), // 'warehouse_email', 'shipbob', 'self_fulfillment'
  shipbobAccessToken: text("shipbob_access_token"), // ShipBob OAuth Access Token
  shipbobRefreshToken: text("shipbob_refresh_token"), // ShipBob OAuth Refresh Token
  shipbobChannelId: text("shipbob_channel_id"), // ShipBob Channel ID
  shipbobTokenExpiresAt: timestamp("shipbob_token_expires_at"), // Token expiration
  
  // ShipStation Integration Settings
  shipstationApiKey: text("shipstation_api_key"), // ShipStation API Key
  shipstationApiSecret: text("shipstation_api_secret"), // ShipStation API Secret
  
  // Order Cancellation Agent Settings
  orderCancellationEnabled: boolean("order_cancellation_enabled").default(false), // Master toggle for order cancellation agent
  orderCancellationRequiresApproval: boolean("order_cancellation_requires_approval").default(true), // Whether cancellations need approval
  
  // Address Change Agent Settings
  addressChangeEnabled: boolean("address_change_enabled").default(false), // Master toggle for address change agent
  addressChangeRequiresApproval: boolean("address_change_requires_approval").default(true), // Whether address changes need approval
  
  // Order Cancellation Automation Toggles
  warehouseEmailEnabled: boolean("warehouse_email_enabled").default(false), // Warehouse email automation toggle
  shipbobEnabled: boolean("shipbob_enabled").default(false), // ShipBob API automation toggle
  selfFulfillmentEnabled: boolean("self_fulfillment_enabled").default(false), // Self-fulfillment automation toggle
  shipstationEnabled: boolean("shipstation_enabled").default(false), // ShipStation API automation toggle
  settings: jsonb("settings"), // Additional settings
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const activityLogs = pgTable("activity_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  action: text("action").notNull(), // 'sent_order_info', 'processed_refund', 'updated_subscription', etc.
  type: text("type").notNull(), // 'order_info', 'refund', 'subscription', 'email_processed', 'escalation'
  executedBy: text("executed_by").notNull(), // 'human', 'ai'
  customerEmail: text("customer_email").notNull(),
  orderNumber: text("order_number"),
  amount: text("amount"),
  details: text("details").notNull(),
  status: text("status").default('completed'), // 'completed', 'failed', 'pending'
  metadata: jsonb("metadata"), // Additional data
  createdAt: timestamp("created_at").defaultNow(),
});

// Manual Rejection Analytics - Track why users reject automated responses
export const manualRejections = pgTable("manual_rejections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  approvalItemId: varchar("approval_item_id").notNull(), // Links to approval queue item
  emailClassification: text("email_classification").notNull(), // What type of email was auto-classified
  rejectionReason: text("rejection_reason").notNull(), // Predefined reason selected by user
  customReason: text("custom_reason"), // Custom reason if user wrote one
  customerEmail: text("customer_email").notNull(),
  originalSubject: text("original_subject"),
  automatedResponse: text("automated_response"), // What response was rejected
  createdAt: timestamp("created_at").defaultNow(),
});

// Zod schemas and TypeScript types
export const insertManualRejectionSchema = createInsertSchema(manualRejections);
export type ManualRejection = typeof manualRejections.$inferSelect;
export type InsertManualRejection = z.infer<typeof insertManualRejectionSchema>;

export const automationApprovalQueue = pgTable("automation_approval_queue", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  emailId: varchar("email_id").references(() => emails.id).notNull(),
  ruleId: varchar("rule_id").references(() => autoResponderRules.id).notNull(),
  customerEmail: text("customer_email").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  classification: text("classification").notNull(), // promo_refund, order_status, return_request, general, shipping_info
  confidence: integer("confidence").notNull(), // AI confidence score 0-100
  proposedResponse: text("proposed_response").notNull(),
  status: text("status").default('pending'), // 'pending', 'approved', 'rejected', 'executed', 'edited'
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  rejectionReason: text("rejection_reason"),
  // New fields for edit functionality
  originalResponse: text("original_response"), // Store original AI response when edited
  editedResponse: text("edited_response"), // Store user's edited version
  wasEdited: boolean("was_edited").default(false),
  // Agent classification for tracking metrics
  agentType: text("agent_type"), // 'wismo', 'returns', 'product', 'subscription', etc.
  // Execution tracking
  editedAt: timestamp("edited_at"),
  executedAt: timestamp("executed_at"), 
  metadata: jsonb("metadata"), // Additional context data
  createdAt: timestamp("created_at").defaultNow(),
});

// Automated Order Campaign Management
export const automatedOrderCampaigns = pgTable("automated_order_campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  storeConnectionId: varchar("store_connection_id").references(() => storeConnections.id).notNull(),
  name: text("name").notNull(),
  isActive: boolean("is_active").default(false),
  emailIntervals: jsonb("email_intervals").notNull(), // [{"days": 3, "template": "order_status"}, {"days": 7, "template": "order_followup"}]
  emailTemplate: text("email_template").default('order_status'),
  includeAiPredictions: boolean("include_ai_predictions").default(true),
  totalEmailsSent: integer("total_emails_sent").default(0),
  openRate: decimal("open_rate", { precision: 5, scale: 2 }).default('0'), // Percentage like 85.50
  lastProcessedAt: timestamp("last_processed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Order Sync Queue for webhook processing
export const orderSyncQueue = pgTable("order_sync_queue", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  storeConnectionId: varchar("store_connection_id").references(() => storeConnections.id).notNull(),
  campaignId: varchar("campaign_id").references(() => automatedOrderCampaigns.id),
  externalOrderId: text("external_order_id").notNull(), // Order ID from WooCommerce/Shopify
  orderNumber: text("order_number").notNull(),
  customerEmail: text("customer_email").notNull(),
  customerName: text("customer_name").notNull(),
  orderTotal: decimal("order_total", { precision: 10, scale: 2 }),
  orderStatus: text("order_status").notNull(),
  orderDate: timestamp("order_date").notNull(),
  orderData: jsonb("order_data").notNull(), // Full order object from API
  processStatus: text("process_status").default('pending'), // 'pending', 'processed', 'failed'
  processedAt: timestamp("processed_at"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
});

// API Usage Tracking for Free Trial Limits
export const apiUsageTracking = pgTable("api_usage_tracking", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  service: text("service").notNull(), // 'aftership', 'openai', 'sendgrid'
  endpoint: text("endpoint"), // specific API endpoint called
  dailyCount: integer("daily_count").default(0),
  monthlyCount: integer("monthly_count").default(0),
  lastDailyReset: timestamp("last_daily_reset").defaultNow(),
  lastMonthlyReset: timestamp("last_monthly_reset").defaultNow(),
  limitExceeded: boolean("limit_exceeded").default(false),
  limitExceededAt: timestamp("limit_exceeded_at"),
  limitNotificationSent: boolean("limit_notification_sent").default(false),
  warningNotificationSent: boolean("warning_notification_sent").default(false),
  warningNotificationSentAt: timestamp("warning_notification_sent_at"),
  metadata: jsonb("metadata"), // Store additional context like tracking numbers, order IDs
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Scheduled Order Emails
export const scheduledOrderEmails = pgTable("scheduled_order_emails", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  campaignId: varchar("campaign_id").references(() => automatedOrderCampaigns.id).notNull(),
  orderSyncId: varchar("order_sync_id").references(() => orderSyncQueue.id).notNull(),
  customerEmail: text("customer_email").notNull(),
  customerName: text("customer_name").notNull(), 
  orderNumber: text("order_number").notNull(),
  scheduledFor: timestamp("scheduled_for").notNull(),
  intervalDays: integer("interval_days").notNull(), // 3, 7, etc.
  emailTemplate: text("email_template").notNull(),
  status: text("status").default('scheduled'), // 'scheduled', 'sent', 'failed', 'cancelled'
  sentAt: timestamp("sent_at"),
  emailContent: text("email_content"), // Generated email content
  trackingData: jsonb("tracking_data"), // AI predictions and tracking info
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Order Tracking Data Cache
export const orderTrackingData = pgTable("order_tracking_data", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  orderNumber: text("order_number").notNull(),
  externalOrderId: text("external_order_id").notNull(),
  trackingNumber: text("tracking_number"),
  carrier: text("carrier"),
  trackingUrl: text("tracking_url"),
  currentStatus: text("current_status"),
  aiPrediction: text("ai_prediction"),
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const loginHistory = pgTable("login_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  success: boolean("success").default(true),
  failureReason: text("failure_reason"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const onboardingEmails = pgTable("onboarding_emails", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  htmlContent: text("html_content").notNull(),
  delayHours: integer("delay_hours").notNull().default(0), // Hours after signup to send
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const onboardingEmailSents = pgTable("onboarding_email_sents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  emailId: varchar("email_id").references(() => onboardingEmails.id).notNull(),
  sentAt: timestamp("sent_at").defaultNow(),
  opened: boolean("opened").default(false),
  clicked: boolean("clicked").default(false),
});

export const weeklyReports = pgTable("weekly_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  weekStartDate: timestamp("week_start_date").notNull(),
  weekEndDate: timestamp("week_end_date").notNull(),
  emailsProcessed: integer("emails_processed").default(0),
  automationsTriggered: integer("automations_triggered").default(0),
  timesSavedMinutes: integer("times_saved_minutes").default(0), // Total minutes saved
  estimatedCostSavings: integer("estimated_cost_savings").default(0), // In cents
  averageResponseTime: integer("average_response_time").default(0), // In minutes
  customerSatisfactionScore: integer("customer_satisfaction_score").default(0), // 1-100
  topAutomationType: text("top_automation_type"), // Most used automation category
  milestonesAchieved: jsonb("milestones_achieved"), // Array of milestone names
  comparisonToPrevious: jsonb("comparison_to_previous"), // Growth metrics
  industryBenchmarkRank: integer("industry_benchmark_rank"), // 1-100 percentile
  sentAt: timestamp("sent_at"),
  deliveryAttempts: integer("delivery_attempts").default(0),
  lastDeliveryError: text("last_delivery_error"),
  emailDelivered: boolean("email_delivered").default(false),
  opened: boolean("opened").default(false),
  clicked: boolean("clicked").default(false),
  shared: boolean("shared").default(false), // If user shared metrics
  createdAt: timestamp("created_at").defaultNow(),
});

export const weeklyReportShares = pgTable("weekly_report_shares", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reportId: varchar("report_id").references(() => weeklyReports.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  shareType: text("share_type").notNull(), // 'social', 'email', 'referral', 'challenge'
  platform: text("platform"), // 'twitter', 'linkedin', 'email', etc.
  recipientEmail: text("recipient_email"), // For email shares and challenges
  message: text("message"), // Custom message added by user
  clicked: boolean("clicked").default(false), // If shared link was clicked
  converted: boolean("converted").default(false), // If led to signup
  createdAt: timestamp("created_at").defaultNow(),
});

export const revenueEvents = pgTable("revenue_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  stripeInvoiceId: varchar("stripe_invoice_id").notNull(),
  stripeCustomerId: varchar("stripe_customer_id").notNull(),
  amountCents: integer("amount_cents").notNull(),
  planName: varchar("plan_name").notNull(),
  planId: varchar("plan_id").notNull(),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  paymentDate: timestamp("payment_date").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Email event tracking from SendGrid webhooks
export const emailEvents = pgTable("email_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  campaignId: varchar("campaign_id").references(() => automatedOrderCampaigns.id),
  sgMessageId: text("sg_message_id").notNull(), // SendGrid message ID
  sgEventId: text("sg_event_id").notNull().unique(), // SendGrid event ID (prevent duplicates)
  eventType: text("event_type").notNull(), // 'processed', 'delivered', 'open', 'click', 'bounce', etc.
  recipientEmail: text("recipient_email").notNull(),
  timestamp: timestamp("timestamp").notNull(),
  userAgent: text("user_agent"),
  ip: text("ip"),
  url: text("url"), // for click events
  reason: text("reason"), // for bounce/dropped events
  sgMachineOpen: boolean("sg_machine_open").default(false), // Apple Mail Privacy Protection
  createdAt: timestamp("created_at").defaultNow(),
});

// Campaign stats cache (aggregated from email_events)
export const campaignStats = pgTable("campaign_stats", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  campaignId: varchar("campaign_id").references(() => automatedOrderCampaigns.id),
  date: timestamp("date").notNull(), // daily aggregation
  emailsSent: integer("emails_sent").default(0),
  emailsDelivered: integer("emails_delivered").default(0),
  emailsOpened: integer("emails_opened").default(0),
  uniqueOpens: integer("unique_opens").default(0),
  emailsClicked: integer("emails_clicked").default(0),
  emailsBounced: integer("emails_bounced").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// AI Training Configuration
export const aiTrainingConfig = pgTable("ai_training_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull().unique(),
  allowEmojis: boolean("allow_emojis").default(false),
  brandVoice: text("brand_voice").default("Professional"),
  customInstructions: text("custom_instructions"),
  aiAgentName: text("ai_agent_name").default("Kai"),
  aiAgentTitle: text("ai_agent_title").default("Customer Success Specialist"),
  salutation: text("salutation").default("Best regards"),
  customSalutation: text("custom_salutation"),
  signatureCompanyName: text("signature_company_name"),
  signatureFooter: text("signature_footer"),
  loyalCustomerGreeting: boolean("loyal_customer_greeting").default(false),
  businessVertical: text("business_vertical").default("general_ecommerce"),
  useBusinessVerticalGuidance: boolean("use_business_vertical_guidance").default(false),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Manual Training Content - User-pasted content for AI training
export const manualTrainingContent = pgTable("manual_training_content", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  category: text("category"), // 'product_info', 'faq', 'policies', 'brand_info', etc.
  tags: text("tags").array(), // User-defined tags for organization
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Content Chunks - Semantic chunks from ALL sources (URLs and manual content)
export const contentChunks = pgTable("content_chunks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  sourceType: text("source_type").notNull(), // 'training_url', 'manual_content'
  sourceId: varchar("source_id").notNull(), // References training_urls.id or manual_training_content.id
  chunkText: text("chunk_text").notNull(), // 1000-2000 character semantic chunk
  chunkIndex: integer("chunk_index").notNull(), // Order within the source content
  embedding: text("embedding"), // JSON array of OpenAI embedding vector (1536 dimensions)
  tokenCount: integer("token_count"), // Number of tokens in this chunk
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Training URLs for AI to crawl
export const trainingUrls = pgTable("training_urls", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  url: text("url").notNull(),
  status: text("status").default("pending"), // 'pending', 'crawling', 'completed', 'failed'
  pageCount: integer("page_count").default(0),
  lastCrawled: timestamp("last_crawled"),
  errorMessage: text("error_message"),
  crawledContent: text("crawled_content"), // Extracted text content
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Prevent duplicate URLs per user
  uniqueUserUrl: sql`UNIQUE(${table.userId}, ${table.url})`
}));

// Order Cancellation Workflows
export const orderCancellationWorkflows = pgTable("order_cancellation_workflows", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  emailId: varchar("email_id").references(() => emails.id).notNull(),
  orderNumber: text("order_number").notNull(),
  orderPlatform: text("order_platform").notNull(), // 'woocommerce', 'shopify'
  customerEmail: text("customer_email").notNull(),
  warehouseEmail: text("warehouse_email").notNull(),
  
  // Workflow status tracking
  status: text("status").notNull().default("processing"), // 'processing', 'awaiting_warehouse', 'canceled', 'cannot_cancel', 'escalated', 'completed'
  step: text("step").notNull().default("identify_order"), // 'identify_order', 'check_eligibility', 'acknowledge_customer', 'email_warehouse', 'await_warehouse', 'process_result'
  
  // Order data
  orderCreatedAt: timestamp("order_created_at"),
  storeTimezone: text("store_timezone"),
  isEligible: boolean("is_eligible"),
  eligibilityReason: text("eligibility_reason"),
  
  // Communication tracking
  customerAcknowledgmentSent: boolean("customer_acknowledgment_sent").default(false),
  warehouseEmailSent: boolean("warehouse_email_sent").default(false),
  warehouseReplyReceived: boolean("warehouse_reply_received").default(false),
  warehouseReply: text("warehouse_reply"),
  warehouseReplyAt: timestamp("warehouse_reply_at"),
  
  // Final outcome
  wasCanceled: boolean("was_canceled"),
  refundProcessed: boolean("refund_processed").default(false),
  refundAmount: decimal("refund_amount", { precision: 10, scale: 2 }),
  refundId: text("refund_id"),
  
  // Fulfillment method tracking
  fulfillmentMethod: text("fulfillment_method").notNull().default("warehouse_email"), // 'warehouse_email', 'shipbob', 'self_fulfillment', 'shipstation'
  shipbobOrderId: text("shipbob_order_id"), // ShipBob order ID for API cancellation
  shipbobShipmentIds: jsonb("shipbob_shipment_ids"), // Array of ShipBob shipment IDs
  shipstationOrderId: text("shipstation_order_id"), // ShipStation order ID for API cancellation
  shipstationShipmentIds: jsonb("shipstation_shipment_ids"), // Array of ShipStation shipment IDs
  
  // Error handling
  errorMessage: text("error_message"),
  escalationReason: text("escalation_reason"),
  
  // Timing
  timeout: timestamp("timeout"), // When to escalate if no warehouse response
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Order Cancellation Events Log
export const orderCancellationEvents = pgTable("order_cancellation_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workflowId: varchar("workflow_id").references(() => orderCancellationWorkflows.id).notNull(),
  eventType: text("event_type").notNull(), // 'email_sent', 'email_received', 'status_updated', 'error_occurred'
  description: text("description").notNull(),
  metadata: jsonb("metadata"), // Additional event data
  createdAt: timestamp("created_at").defaultNow(),
});

// Address Change Workflows
export const addressChangeWorkflows = pgTable("address_change_workflows", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  emailId: varchar("email_id").references(() => emails.id).notNull(),
  orderNumber: text("order_number").notNull(),
  orderPlatform: text("order_platform").notNull(), // 'woocommerce', 'shopify'
  customerEmail: text("customer_email").notNull(),
  warehouseEmail: text("warehouse_email").notNull(),
  
  // Workflow status tracking
  status: text("status").notNull().default("processing"), // 'processing', 'awaiting_warehouse', 'updated', 'cannot_change', 'escalated', 'completed'
  step: text("step").notNull().default("identify_order"), // 'identify_order', 'check_eligibility', 'acknowledge_customer', 'email_warehouse', 'await_warehouse', 'process_result'
  
  // Order data
  orderCreatedAt: timestamp("order_created_at"),
  storeTimezone: text("store_timezone"),
  isEligible: boolean("is_eligible"),
  eligibilityReason: text("eligibility_reason"),
  
  // Address change data
  currentAddress: jsonb("current_address"), // Current shipping address
  requestedAddress: jsonb("requested_address"), // New requested address
  
  // Communication tracking
  customerAcknowledgmentSent: boolean("customer_acknowledgment_sent").default(false),
  warehouseEmailSent: boolean("warehouse_email_sent").default(false),
  warehouseReplyReceived: boolean("warehouse_reply_received").default(false),
  warehouseReply: text("warehouse_reply"),
  warehouseReplyAt: timestamp("warehouse_reply_at"),
  
  // Final outcome
  wasUpdated: boolean("was_updated"),
  
  // Fulfillment method tracking
  fulfillmentMethod: text("fulfillment_method").notNull().default("warehouse_email"), // 'warehouse_email', 'shipbob', 'self_fulfillment', 'shipstation'
  shipbobOrderId: text("shipbob_order_id"), // ShipBob order ID for API updates
  shipbobShipmentIds: jsonb("shipbob_shipment_ids"), // Array of ShipBob shipment IDs
  shipstationOrderId: text("shipstation_order_id"), // ShipStation order ID for API updates
  shipstationShipmentIds: jsonb("shipstation_shipment_ids"), // Array of ShipStation shipment IDs
  
  // Error handling
  errorMessage: text("error_message"),
  escalationReason: text("escalation_reason"),
  
  // Timing
  timeout: timestamp("timeout"), // When to escalate if no warehouse response
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Address Change Events Log
export const addressChangeEvents = pgTable("address_change_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workflowId: varchar("workflow_id").references(() => addressChangeWorkflows.id).notNull(),
  eventType: text("event_type").notNull(), // 'email_sent', 'email_received', 'status_updated', 'error_occurred'
  description: text("description").notNull(),
  metadata: jsonb("metadata"), // Additional event data
  createdAt: timestamp("created_at").defaultNow(),
});

// Subscription Conversion Workflows
export const subscriptionConversionWorkflows = pgTable("subscription_conversion_workflows", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  emailId: varchar("email_id").references(() => emails.id).notNull(),
  customerEmail: text("customer_email").notNull(),
  // Workflow status tracking
  status: text("status").notNull().default("processing"), // 'processing', 'awaiting_customer', 'converting', 'converted', 'declined', 'escalated', 'completed'
  step: text("step").notNull().default("analyze_request"), // 'analyze_request', 'identify_subscription', 'calculate_pricing', 'send_offer', 'await_confirmation', 'process_conversion'
  // Subscription data
  currentSubscriptionId: text("current_subscription_id"),
  currentPlanName: text("current_plan_name"),
  currentPlanPrice: decimal("current_plan_price", { precision: 10, scale: 2 }),
  currentBillingCycle: text("current_billing_cycle"), // 'monthly', 'yearly', 'one_time'
  // Conversion details
  targetPlanName: text("target_plan_name"),
  targetPlanPrice: decimal("target_plan_price", { precision: 10, scale: 2 }),
  targetBillingCycle: text("target_billing_cycle"),
  priceDifference: decimal("price_difference", { precision: 10, scale: 2 }),
  conversionType: text("conversion_type"), // 'upgrade', 'downgrade', 'plan_change', 'billing_change'
  // Customer interaction
  offerSent: boolean("offer_sent").default(false),
  offerSentAt: timestamp("offer_sent_at"),
  offerAccepted: boolean("offer_accepted"),
  customerResponse: text("customer_response"),
  customerResponseAt: timestamp("customer_response_at"),
  // Payment processing
  prorationCalculated: boolean("proration_calculated").default(false),
  prorationAmount: decimal("proration_amount", { precision: 10, scale: 2 }),
  paymentProcessed: boolean("payment_processed").default(false),
  stripeSubscriptionId: text("stripe_subscription_id"),
  stripeInvoiceId: text("stripe_invoice_id"),
  // Final outcome
  conversionCompleted: boolean("conversion_completed").default(false),
  conversionCompletedAt: timestamp("conversion_completed_at"),
  newSubscriptionId: text("new_subscription_id"),
  // Error handling
  errorMessage: text("error_message"),
  escalationReason: text("escalation_reason"),
  // Timing
  timeout: timestamp("timeout"), // When to escalate if no customer response
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Subscription Conversion Events Log
export const subscriptionConversionEvents = pgTable("subscription_conversion_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workflowId: varchar("workflow_id").references(() => subscriptionConversionWorkflows.id).notNull(),
  eventType: text("event_type").notNull(), // 'email_sent', 'customer_response', 'payment_processed', 'status_updated', 'error_occurred'
  description: text("description").notNull(),
  metadata: jsonb("metadata"), // Additional event data
  createdAt: timestamp("created_at").defaultNow(),
});

// AI Response Suggestions for escalated emails
export const aiResponseSuggestions = pgTable("ai_response_suggestions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  escalationId: varchar("escalation_id").references(() => escalationQueue.id).notNull(),
  suggestedResponse: text("suggested_response").notNull(),
  confidence: integer("confidence").notNull(), // 0-100
  reasoning: text("reasoning"), // Why AI thinks this response is appropriate
  isAccepted: boolean("is_accepted").default(false),
  isRejected: boolean("is_rejected").default(false),
  userFeedback: text("user_feedback"), // Optional feedback from admin
  createdAt: timestamp("created_at").defaultNow(),
});

// AI Rejection Analytics - Track approval queue rejections for AI improvement
export const aiRejectionAnalytics = pgTable("ai_rejection_analytics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  emailId: varchar("email_id"),
  rejectionReason: text("rejection_reason").notNull(),
  customReason: text("custom_reason"),
  aiResponse: text("ai_response").notNull(),
  aiConfidence: integer("ai_confidence").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const aiEditAnalytics = pgTable("ai_edit_analytics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  emailId: varchar("email_id"),
  originalResponse: text("original_response").notNull(),
  editedResponse: text("edited_response").notNull(),
  aiConfidence: integer("ai_confidence").default(0),
  // Edit analysis fields
  editType: text("edit_type"), // 'tone_adjustment', 'fact_correction', 'length_change', 'structure_change', 'personalization_added'
  wordsAdded: integer("words_added").default(0),
  wordsRemoved: integer("words_removed").default(0),
  charactersChanged: integer("characters_changed").default(0),
  significantEdit: boolean("significant_edit").default(false), // >30% change
  // Context fields
  emailClassification: text("email_classification"),
  customerEmail: text("customer_email"),
  originalEmailSubject: text("original_email_subject"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many, one }) => ({
  emailAccounts: many(emailAccounts),
  storeConnections: many(storeConnections),
  emails: many(emails),
  autoResponderRules: many(autoResponderRules),
  promoCodeConfigs: many(promoCodeConfigs),
  returnsAgentConfigs: many(returnsAgentConfigs),
  returnsConversations: many(returnsConversations),
  escalationQueue: many(escalationQueue),
  systemSettings: many(systemSettings),
  activityLogs: many(activityLogs),
  passwordResetTokens: many(passwordResetTokens),
  passwordResetLogs: many(passwordResetLogs),
  automationApprovalQueue: many(automationApprovalQueue),
  loginHistory: many(loginHistory),
  onboardingEmailSents: many(onboardingEmailSents),
  weeklyReports: many(weeklyReports),
  weeklyReportShares: many(weeklyReportShares),
  revenueEvents: many(revenueEvents),
  emailEvents: many(emailEvents),
  campaignStats: many(campaignStats),
  trainingUrls: many(trainingUrls),
  aiTrainingConfig: one(aiTrainingConfig),
  billing: one(userBilling),
  aiRejectionAnalytics: many(aiRejectionAnalytics),
  aiEditAnalytics: many(aiEditAnalytics),
  sendgridEmailLogs: many(sendgridEmailLogs),
  agentMetrics: many(agentMetrics),
  agentFeedback: many(agentFeedback),
}));

export const billingPlansRelations = relations(billingPlans, ({ many }) => ({
  userBilling: many(userBilling),
}));

export const userBillingRelations = relations(userBilling, ({ one }) => ({
  user: one(users, {
    fields: [userBilling.userId],
    references: [users.id],
  }),
  plan: one(billingPlans, {
    fields: [userBilling.planId],
    references: [billingPlans.id],
  }),
}));

export const passwordResetTokensRelations = relations(passwordResetTokens, ({ one, many }) => ({
  user: one(users, {
    fields: [passwordResetTokens.userId],
    references: [users.id],
  }),
  logs: many(passwordResetLogs),
}));

export const passwordResetLogsRelations = relations(passwordResetLogs, ({ one }) => ({
  user: one(users, {
    fields: [passwordResetLogs.userId],
    references: [users.id],
  }),
  token: one(passwordResetTokens, {
    fields: [passwordResetLogs.tokenId],
    references: [passwordResetTokens.id],
  }),
}));

export const emailAccountsRelations = relations(emailAccounts, ({ one }) => ({
  user: one(users, {
    fields: [emailAccounts.userId],
    references: [users.id],
  }),
}));

export const storeConnectionsRelations = relations(storeConnections, ({ one }) => ({
  user: one(users, {
    fields: [storeConnections.userId],
    references: [users.id],
  }),
}));

export const emailsRelations = relations(emails, ({ one }) => ({
  user: one(users, {
    fields: [emails.userId],
    references: [users.id],
  }),
  escalation: one(escalationQueue),
}));

export const autoResponderRulesRelations = relations(autoResponderRules, ({ one }) => ({
  user: one(users, {
    fields: [autoResponderRules.userId],
    references: [users.id],
  }),
}));

export const escalationQueueRelations = relations(escalationQueue, ({ one }) => ({
  email: one(emails, {
    fields: [escalationQueue.emailId],
    references: [emails.id],
  }),
  user: one(users, {
    fields: [escalationQueue.userId],
    references: [users.id],
  }),
  assignedUser: one(users, {
    fields: [escalationQueue.assignedTo],
    references: [users.id],
  }),
}));

export const systemSettingsRelations = relations(systemSettings, ({ one }) => ({
  user: one(users, {
    fields: [systemSettings.userId],
    references: [users.id],
  }),
}));

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  user: one(users, {
    fields: [activityLogs.userId],
    references: [users.id],
  }),
}));

export const loginHistoryRelations = relations(loginHistory, ({ one }) => ({
  user: one(users, {
    fields: [loginHistory.userId],
    references: [users.id],
  }),
}));

export const onboardingEmailsRelations = relations(onboardingEmails, ({ many }) => ({
  sentEmails: many(onboardingEmailSents),
}));

export const onboardingEmailSentsRelations = relations(onboardingEmailSents, ({ one }) => ({
  user: one(users, {
    fields: [onboardingEmailSents.userId],
    references: [users.id],
  }),
  email: one(onboardingEmails, {
    fields: [onboardingEmailSents.emailId],
    references: [onboardingEmails.id],
  }),
}));

export const weeklyReportsRelations = relations(weeklyReports, ({ one, many }) => ({
  user: one(users, {
    fields: [weeklyReports.userId],
    references: [users.id],
  }),
  shares: many(weeklyReportShares),
}));

export const weeklyReportSharesRelations = relations(weeklyReportShares, ({ one }) => ({
  report: one(weeklyReports, {
    fields: [weeklyReportShares.reportId],
    references: [weeklyReports.id],
  }),
  user: one(users, {
    fields: [weeklyReportShares.userId],
    references: [users.id],
  }),
}));

export const revenueEventsRelations = relations(revenueEvents, ({ one }) => ({
  user: one(users, {
    fields: [revenueEvents.userId],
    references: [users.id],
  }),
}));

export const emailEventsRelations = relations(emailEvents, ({ one }) => ({
  user: one(users, {
    fields: [emailEvents.userId],
    references: [users.id],
  }),
  campaign: one(automatedOrderCampaigns, {
    fields: [emailEvents.campaignId],
    references: [automatedOrderCampaigns.id],
  }),
}));

export const campaignStatsRelations = relations(campaignStats, ({ one }) => ({
  user: one(users, {
    fields: [campaignStats.userId],
    references: [users.id],
  }),
  campaign: one(automatedOrderCampaigns, {
    fields: [campaignStats.campaignId],
    references: [automatedOrderCampaigns.id],
  }),
}));

export const automationApprovalQueueRelations = relations(automationApprovalQueue, ({ one }) => ({
  user: one(users, {
    fields: [automationApprovalQueue.userId],
    references: [users.id],
  }),
  email: one(emails, {
    fields: [automationApprovalQueue.emailId],
    references: [emails.id],
  }),
  rule: one(autoResponderRules, {
    fields: [automationApprovalQueue.ruleId],
    references: [autoResponderRules.id],
  }),
  reviewedBy: one(users, {
    fields: [automationApprovalQueue.reviewedBy],
    references: [users.id],
  }),
}));

export const automatedOrderCampaignsRelations = relations(automatedOrderCampaigns, ({ one, many }) => ({
  user: one(users, {
    fields: [automatedOrderCampaigns.userId],
    references: [users.id],
  }),
  storeConnection: one(storeConnections, {
    fields: [automatedOrderCampaigns.storeConnectionId],
    references: [storeConnections.id],
  }),
  orderQueue: many(orderSyncQueue),
  scheduledEmails: many(scheduledOrderEmails),
  emailEvents: many(emailEvents),
  campaignStats: many(campaignStats),
}));

export const orderSyncQueueRelations = relations(orderSyncQueue, ({ one, many }) => ({
  user: one(users, {
    fields: [orderSyncQueue.userId],
    references: [users.id],
  }),
  storeConnection: one(storeConnections, {
    fields: [orderSyncQueue.storeConnectionId],
    references: [storeConnections.id],
  }),
  campaign: one(automatedOrderCampaigns, {
    fields: [orderSyncQueue.campaignId],
    references: [automatedOrderCampaigns.id],
  }),
  scheduledEmails: many(scheduledOrderEmails),
}));

export const scheduledOrderEmailsRelations = relations(scheduledOrderEmails, ({ one }) => ({
  user: one(users, {
    fields: [scheduledOrderEmails.userId],
    references: [users.id],
  }),
  campaign: one(automatedOrderCampaigns, {
    fields: [scheduledOrderEmails.campaignId],
    references: [automatedOrderCampaigns.id],
  }),
  orderSync: one(orderSyncQueue, {
    fields: [scheduledOrderEmails.orderSyncId],
    references: [orderSyncQueue.id],
  }),
}));

export const orderTrackingDataRelations = relations(orderTrackingData, ({ one }) => ({
  user: one(users, {
    fields: [orderTrackingData.userId],
    references: [users.id],
  }),
}));

// AI Training Relations
export const aiTrainingConfigRelations = relations(aiTrainingConfig, ({ one }) => ({
  user: one(users, {
    fields: [aiTrainingConfig.userId],
    references: [users.id],
  }),
}));

export const trainingUrlsRelations = relations(trainingUrls, ({ one }) => ({
  user: one(users, {
    fields: [trainingUrls.userId],
    references: [users.id],
  }),
}));

export const aiResponseSuggestionsRelations = relations(aiResponseSuggestions, ({ one }) => ({
  escalation: one(escalationQueue, {
    fields: [aiResponseSuggestions.escalationId],
    references: [escalationQueue.id],
  }),
}));

export const aiRejectionAnalyticsRelations = relations(aiRejectionAnalytics, ({ one }) => ({
  user: one(users, {
    fields: [aiRejectionAnalytics.userId],
    references: [users.id],
  }),
}));

export const aiEditAnalyticsRelations = relations(aiEditAnalytics, ({ one }) => ({
  user: one(users, {
    fields: [aiEditAnalytics.userId],
    references: [users.id],
  }),
}));

export const sendgridEmailLogsRelations = relations(sendgridEmailLogs, ({ one }) => ({
  user: one(users, {
    fields: [sendgridEmailLogs.userId],
    references: [users.id],
  }),
}));

export const promoCodeConfigsRelations = relations(promoCodeConfigs, ({ one }) => ({
  user: one(users, {
    fields: [promoCodeConfigs.userId],
    references: [users.id],
  }),
}));

export const returnsAgentConfigsRelations = relations(returnsAgentConfigs, ({ one }) => ({
  user: one(users, {
    fields: [returnsAgentConfigs.userId],
    references: [users.id],
  }),
}));

export const returnsConversationsRelations = relations(returnsConversations, ({ one }) => ({
  user: one(users, {
    fields: [returnsConversations.userId],
    references: [users.id],
  }),
  originalEmail: one(emails, {
    fields: [returnsConversations.originalEmailId],
    references: [emails.id],
  }),
}));

export const orderCancellationWorkflowsRelations = relations(orderCancellationWorkflows, ({ one, many }) => ({
  user: one(users, {
    fields: [orderCancellationWorkflows.userId],
    references: [users.id],
  }),
  email: one(emails, {
    fields: [orderCancellationWorkflows.emailId],
    references: [emails.id],
  }),
  events: many(orderCancellationEvents),
}));

export const orderCancellationEventsRelations = relations(orderCancellationEvents, ({ one }) => ({
  workflow: one(orderCancellationWorkflows, {
    fields: [orderCancellationEvents.workflowId],
    references: [orderCancellationWorkflows.id],
  }),
}));

export const subscriptionConversionWorkflowsRelations = relations(subscriptionConversionWorkflows, ({ one, many }) => ({
  user: one(users, {
    fields: [subscriptionConversionWorkflows.userId],
    references: [users.id],
  }),
  email: one(emails, {
    fields: [subscriptionConversionWorkflows.emailId],
    references: [emails.id],
  }),
  events: many(subscriptionConversionEvents),
}));

export const subscriptionConversionEventsRelations = relations(subscriptionConversionEvents, ({ one }) => ({
  workflow: one(subscriptionConversionWorkflows, {
    fields: [subscriptionConversionEvents.workflowId],
    references: [subscriptionConversionWorkflows.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).pick({
  password: true,
  email: true,
  firstName: true,
  lastName: true,
  company: true,
});

export const insertEmailAccountSchema = createInsertSchema(emailAccounts).omit({
  id: true,
  createdAt: true,
});

export const insertStoreConnectionSchema = createInsertSchema(storeConnections).omit({
  id: true,
  createdAt: true,
});

export const insertEmailSchema = createInsertSchema(emails).omit({
  id: true,
  createdAt: true,
  processedAt: true,
});

export const insertAutoResponderRuleSchema = createInsertSchema(autoResponderRules).omit({
  id: true,
  triggerCount: true,
  lastTriggered: true,
  createdAt: true,
});

export const insertPromoCodeConfigSchema = createInsertSchema(promoCodeConfigs).omit({
  id: true,
  usageCount: true,
  firstTimeCustomerOffers: true,
  generalInquiryOffers: true,
  lastUsed: true,
  createdAt: true,
  updatedAt: true,
});

export const insertReturnsAgentConfigSchema = createInsertSchema(returnsAgentConfigs).omit({
  id: true,
  totalReturnsProcessed: true,
  autoApprovalsGranted: true,
  escalationsCreated: true,
  conversationsStarted: true,
  successfulQualifications: true,
  lastUsed: true,
  createdAt: true,
  updatedAt: true,
});

export const insertReturnsConversationSchema = createInsertSchema(returnsConversations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertApiUsageTrackingSchema = createInsertSchema(apiUsageTracking).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Type exports
export type InsertApiUsageTracking = z.infer<typeof insertApiUsageTrackingSchema>;
export type ApiUsageTracking = typeof apiUsageTracking.$inferSelect;
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type ActivityLog = typeof activityLogs.$inferSelect;
export type InsertOrderCancellationWorkflow = z.infer<typeof insertOrderCancellationWorkflowSchema>;
export type OrderCancellationWorkflow = typeof orderCancellationWorkflows.$inferSelect;
export type InsertOrderCancellationEvent = z.infer<typeof insertOrderCancellationEventSchema>;
export type OrderCancellationEvent = typeof orderCancellationEvents.$inferSelect;
export type InsertAddressChangeWorkflow = z.infer<typeof insertAddressChangeWorkflowSchema>;
export type AddressChangeWorkflow = typeof addressChangeWorkflows.$inferSelect;
export type InsertAddressChangeEvent = z.infer<typeof insertAddressChangeEventSchema>;
export type AddressChangeEvent = typeof addressChangeEvents.$inferSelect;
export type InsertSubscriptionConversionWorkflow = z.infer<typeof insertSubscriptionConversionWorkflowSchema>;
export type SubscriptionConversionWorkflow = typeof subscriptionConversionWorkflows.$inferSelect;
export type InsertSubscriptionConversionEvent = z.infer<typeof insertSubscriptionConversionEventSchema>;
export type SubscriptionConversionEvent = typeof subscriptionConversionEvents.$inferSelect;

export const insertEscalationQueueSchema = createInsertSchema(escalationQueue).omit({
  id: true,
  createdAt: true,
  resolvedAt: true,
});

export const insertSystemSettingsSchema = createInsertSchema(systemSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertActivityLogSchema = createInsertSchema(activityLogs).omit({
  id: true,
  createdAt: true,
});

export const insertOrderCancellationWorkflowSchema = createInsertSchema(orderCancellationWorkflows).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOrderCancellationEventSchema = createInsertSchema(orderCancellationEvents).omit({
  id: true,
  createdAt: true,
});

export const insertAddressChangeWorkflowSchema = createInsertSchema(addressChangeWorkflows).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAddressChangeEventSchema = createInsertSchema(addressChangeEvents).omit({
  id: true,
  createdAt: true,
});

export const insertSubscriptionConversionWorkflowSchema = createInsertSchema(subscriptionConversionWorkflows).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSubscriptionConversionEventSchema = createInsertSchema(subscriptionConversionEvents).omit({
  id: true,
  createdAt: true,
});

// Email Preferences for Unsubscribe Management
export const emailPreferences = pgTable("email_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  email: text("email").notNull(),
  unsubscribedFromMarketing: boolean("unsubscribed_from_marketing").default(false),
  unsubscribedFromTrialReminders: boolean("unsubscribed_from_trial_reminders").default(false),
  unsubscribedFromWeeklyReports: boolean("unsubscribed_from_weekly_reports").default(false),
  unsubscribedFromAll: boolean("unsubscribed_from_all").default(false),
  unsubscribeToken: text("unsubscribe_token").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertEmailPreferencesSchema = createInsertSchema(emailPreferences).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPaymentMethodSchema = createInsertSchema(paymentMethods).omit({
  id: true,
  createdAt: true,
});

export type EmailPreferences = typeof emailPreferences.$inferSelect;
export type InsertEmailPreferences = z.infer<typeof insertEmailPreferencesSchema>;
export type PaymentMethod = typeof paymentMethods.$inferSelect;
export type InsertPaymentMethod = z.infer<typeof insertPaymentMethodSchema>;

// Payment Methods Relations
export const paymentMethodsRelations = relations(paymentMethods, ({ one }) => ({
  user: one(users, {
    fields: [paymentMethods.userId],
    references: [users.id],
  }),
}));

export const systemEmails = pgTable('system_emails', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  description: text('description').notNull(),
  templateFile: text('template_file').notNull(),
  enabled: boolean('enabled').default(true).notNull(),
  category: text('category').notNull(), // 'trial', 'onboarding', 'reports', 'system'
  triggerType: text('trigger_type').notNull(), // 'schedule', 'event', 'condition'
  triggerDescription: text('trigger_description').notNull(),
  triggerTiming: text('trigger_timing').notNull(),
  targetingAudience: text('targeting_audience').notNull(),
  targetingConditions: text('targeting_conditions').array().notNull(),
  totalSent: integer('total_sent').default(0).notNull(),
  sentToday: integer('sent_today').default(0).notNull(),
  sentThisWeek: integer('sent_this_week').default(0).notNull(),
  sentThisMonth: integer('sent_this_month').default(0).notNull(),
  lastSent: timestamp('last_sent'),
  successfulSends: integer('successful_sends').default(0).notNull(),
  failedSends: integer('failed_sends').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const emailSendLogs = pgTable('email_send_logs', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  systemEmailId: text('system_email_id').notNull().references(() => systemEmails.id),
  recipientEmail: text('recipient_email').notNull(),
  userId: text('user_id').references(() => users.id),
  status: text('status').notNull(), // 'sent', 'failed', 'bounced'
  messageId: text('message_id'),
  errorMessage: text('error_message'),
  sentAt: timestamp('sent_at').defaultNow().notNull(),
});

export const systemLogs = pgTable('system_logs', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  level: text('level').notNull(), // 'error', 'warn', 'info', 'debug'
  category: text('category').notNull(), // 'api', 'auth', 'billing', 'email', etc.
  message: text('message').notNull(),
  metadata: text('metadata'), // JSON string
  userId: text('user_id').references(() => users.id),
  requestId: text('request_id'),
  timestamp: timestamp('timestamp').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Health Check Logs - Track all health check runs for production troubleshooting
export const healthCheckLogs = pgTable('health_check_logs', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  runId: varchar('run_id').notNull(), // Groups all tests from a single health check run
  testName: text('test_name').notNull(), // e.g., 'Database Connection', 'Trial Expiration Reminders'
  status: text('status').notNull(), // 'pass', 'fail'
  duration: integer('duration').notNull(), // Test execution time in milliseconds
  errorMessage: text('error_message'), // Null if passed, error details if failed
  errorStack: text('error_stack'), // Full error stack for debugging
  environment: text('environment').notNull(), // 'development', 'production'
  serverVersion: text('server_version'), // App version/commit hash if available
  userAgent: text('user_agent'), // If triggered by user visit
  ipAddress: text('ip_address'), // If triggered by user visit
  metadata: jsonb('metadata'), // Additional context (API response times, etc.)
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Health Check Run Summary - Overview of each health check execution
export const healthCheckRuns = pgTable('health_check_runs', {
  id: varchar('id').primaryKey(), // Manual ID from nanoid, referenced by healthCheckLogs.runId
  overallStatus: text('overall_status').notNull(), // 'healthy', 'unhealthy'
  totalTests: integer('total_tests').notNull(),
  passedTests: integer('passed_tests').notNull(),
  failedTests: integer('failed_tests').notNull(),
  totalDuration: integer('total_duration').notNull(), // Total execution time in milliseconds
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// System Email types
export type SystemEmail = typeof systemEmails.$inferSelect;
export type InsertSystemEmail = typeof systemEmails.$inferInsert;

// Email Send Log types  
export type EmailSendLog = typeof emailSendLogs.$inferSelect;
export type InsertEmailSendLog = typeof emailSendLogs.$inferInsert;

// System Log types
export type SystemLog = typeof systemLogs.$inferSelect;
export type InsertSystemLog = typeof systemLogs.$inferInsert;

// Health Check Log types
export type HealthCheckLog = typeof healthCheckLogs.$inferSelect;
export type InsertHealthCheckLog = typeof healthCheckLogs.$inferInsert;

export type HealthCheckRun = typeof healthCheckRuns.$inferSelect;
export type InsertHealthCheckRun = typeof healthCheckRuns.$inferInsert;

// AI Rejection Analytics types
export type AiRejectionAnalytics = typeof aiRejectionAnalytics.$inferSelect;
export type InsertAiRejectionAnalytics = typeof aiRejectionAnalytics.$inferInsert;

// AI Edit Analytics types
export type AiEditAnalytics = typeof aiEditAnalytics.$inferSelect;
export type InsertAiEditAnalytics = typeof aiEditAnalytics.$inferInsert;

// SendGrid Email Log types
export type SendgridEmailLog = typeof sendgridEmailLogs.$inferSelect;
export type InsertSendgridEmailLog = typeof sendgridEmailLogs.$inferInsert;

export const insertAutomationApprovalQueueSchema = createInsertSchema(automationApprovalQueue).omit({
  id: true,
  createdAt: true,
  reviewedAt: true,
});

export const insertAiRejectionAnalyticsSchema = createInsertSchema(aiRejectionAnalytics).omit({
  id: true,
  createdAt: true,
});

export const insertAiEditAnalyticsSchema = createInsertSchema(aiEditAnalytics).omit({
  id: true,
  createdAt: true,
});

export const insertAutomatedOrderCampaignSchema = createInsertSchema(automatedOrderCampaigns).omit({
  id: true,
  totalEmailsSent: true,
  lastProcessedAt: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOrderSyncQueueSchema = createInsertSchema(orderSyncQueue).omit({
  id: true,
  processedAt: true,
  createdAt: true,
});

export const insertScheduledOrderEmailSchema = createInsertSchema(scheduledOrderEmails).omit({
  id: true,
  sentAt: true,
  createdAt: true,
});

export const insertOrderTrackingDataSchema = createInsertSchema(orderTrackingData).omit({
  id: true,
  lastUpdated: true,
  createdAt: true,
});

export const insertPasswordResetTokenSchema = createInsertSchema(passwordResetTokens).omit({
  id: true,
  createdAt: true,
});

export const insertPasswordResetLogSchema = createInsertSchema(passwordResetLogs).omit({
  id: true,
  createdAt: true,
});

export const insertSendgridEmailLogSchema = createInsertSchema(sendgridEmailLogs).omit({
  id: true,
  sentAt: true,
  createdAt: true,
});

export const insertIntegrationLogSchema = createInsertSchema(integrationLogs).omit({
  id: true,
  createdAt: true,
});

export const insertBillingPlanSchema = createInsertSchema(billingPlans).omit({
  id: true,
  createdAt: true,
});

export const insertUserBillingSchema = createInsertSchema(userBilling).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOnboardingEmailSchema = createInsertSchema(onboardingEmails).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOnboardingEmailSentSchema = createInsertSchema(onboardingEmailSents).omit({
  id: true,
  sentAt: true,
});

export const insertWeeklyReportSchema = createInsertSchema(weeklyReports).omit({
  id: true,
  createdAt: true,
});

export const insertWeeklyReportShareSchema = createInsertSchema(weeklyReportShares).omit({
  id: true,
  createdAt: true,
});

export const insertRevenueEventSchema = createInsertSchema(revenueEvents).omit({
  id: true,
  createdAt: true,
});

// Additional schemas for account management
export const updateUserProfileSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  company: z.string().optional(),
  phone: z.string().optional(),
});

export const changeEmailSchema = z.object({
  newEmail: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string().min(1, "Please confirm your new password"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertPasswordResetToken = z.infer<typeof insertPasswordResetTokenSchema>;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;

export type InsertPasswordResetLog = z.infer<typeof insertPasswordResetLogSchema>;
export type PasswordResetLog = typeof passwordResetLogs.$inferSelect;

export type InsertIntegrationLog = z.infer<typeof insertIntegrationLogSchema>;
export type IntegrationLog = typeof integrationLogs.$inferSelect;

export type InsertBillingPlan = z.infer<typeof insertBillingPlanSchema>;
export type BillingPlan = typeof billingPlans.$inferSelect;

export type InsertUserBilling = z.infer<typeof insertUserBillingSchema>;
export type UserBilling = typeof userBilling.$inferSelect;

export type UpdateUserProfile = z.infer<typeof updateUserProfileSchema>;
export type ChangeEmail = z.infer<typeof changeEmailSchema>;
export type ChangePassword = z.infer<typeof changePasswordSchema>;

export type InsertEmailAccount = z.infer<typeof insertEmailAccountSchema>;
export type EmailAccount = typeof emailAccounts.$inferSelect;

export type InsertStoreConnection = z.infer<typeof insertStoreConnectionSchema>;
export type StoreConnection = typeof storeConnections.$inferSelect;

export type InsertEmail = z.infer<typeof insertEmailSchema>;
export type Email = typeof emails.$inferSelect;

export type InsertAutoResponderRule = z.infer<typeof insertAutoResponderRuleSchema>;
export type AutoResponderRule = typeof autoResponderRules.$inferSelect;
export type InsertPromoCodeConfig = z.infer<typeof insertPromoCodeConfigSchema>;
export type PromoCodeConfig = typeof promoCodeConfigs.$inferSelect;

export type InsertReturnsAgentConfig = z.infer<typeof insertReturnsAgentConfigSchema>;
export type ReturnsAgentConfig = typeof returnsAgentConfigs.$inferSelect;

export type InsertReturnsConversation = z.infer<typeof insertReturnsConversationSchema>;
export type ReturnsConversation = typeof returnsConversations.$inferSelect;

export type InsertEscalationQueue = z.infer<typeof insertEscalationQueueSchema>;
export type EscalationQueue = typeof escalationQueue.$inferSelect;

export type InsertSystemSettings = z.infer<typeof insertSystemSettingsSchema>;
export type SystemSettings = typeof systemSettings.$inferSelect;

export type InsertAutomationApprovalQueue = z.infer<typeof insertAutomationApprovalQueueSchema>;
export type AutomationApprovalQueue = typeof automationApprovalQueue.$inferSelect;

export type InsertAutomatedOrderCampaign = z.infer<typeof insertAutomatedOrderCampaignSchema>;
export type AutomatedOrderCampaign = typeof automatedOrderCampaigns.$inferSelect;

export type InsertOrderSyncQueue = z.infer<typeof insertOrderSyncQueueSchema>;
export type OrderSyncQueue = typeof orderSyncQueue.$inferSelect;

export type InsertScheduledOrderEmail = z.infer<typeof insertScheduledOrderEmailSchema>;
export type ScheduledOrderEmail = typeof scheduledOrderEmails.$inferSelect;

export type InsertOrderTrackingData = z.infer<typeof insertOrderTrackingDataSchema>;
export type OrderTrackingData = typeof orderTrackingData.$inferSelect;

export type InsertOnboardingEmail = z.infer<typeof insertOnboardingEmailSchema>;
export type OnboardingEmail = typeof onboardingEmails.$inferSelect;

export type InsertOnboardingEmailSent = z.infer<typeof insertOnboardingEmailSentSchema>;
export type OnboardingEmailSent = typeof onboardingEmailSents.$inferSelect;

export type WeeklyReport = typeof weeklyReports.$inferSelect;
export type InsertWeeklyReport = z.infer<typeof insertWeeklyReportSchema>;
export type WeeklyReportShare = typeof weeklyReportShares.$inferSelect;
export type InsertWeeklyReportShare = z.infer<typeof insertWeeklyReportShareSchema>;

export type RevenueEvent = typeof revenueEvents.$inferSelect;
export type InsertRevenueEvent = z.infer<typeof insertRevenueEventSchema>;

// AI Training Schemas
export const insertAITrainingConfigSchema = createInsertSchema(aiTrainingConfig).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTrainingUrlSchema = createInsertSchema(trainingUrls).omit({
  id: true,
  pageCount: true,
  lastCrawled: true,
  errorMessage: true,
  crawledContent: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAIResponseSuggestionSchema = createInsertSchema(aiResponseSuggestions).omit({
  id: true,
  isAccepted: true,
  isRejected: true,
  userFeedback: true,
  createdAt: true,
});

// AI Training Types
export type AITrainingConfig = typeof aiTrainingConfig.$inferSelect;
export type InsertAITrainingConfig = z.infer<typeof insertAITrainingConfigSchema>;

export type TrainingUrl = typeof trainingUrls.$inferSelect;
export type InsertTrainingUrl = z.infer<typeof insertTrainingUrlSchema>;

export type AIResponseSuggestion = typeof aiResponseSuggestions.$inferSelect;
export type InsertAIResponseSuggestion = z.infer<typeof insertAIResponseSuggestionSchema>;

// Manual Training Content Schemas
export const insertManualTrainingContentSchema = createInsertSchema(manualTrainingContent).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertContentChunkSchema = createInsertSchema(contentChunks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Agent Performance Metrics - Track success rates by agent
export const agentMetrics = pgTable("agent_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  agentType: text("agent_type").notNull(), // 'wismo', 'returns', 'product', 'subscription', etc.
  // Action counts
  totalApprovals: integer("total_approvals").default(0),
  totalEdits: integer("total_edits").default(0),
  totalRejections: integer("total_rejections").default(0),
  // Feedback counts
  thumbsUp: integer("thumbs_up").default(0),
  thumbsDown: integer("thumbs_down").default(0),
  // Calculated metrics
  approvalRate: decimal("approval_rate", { precision: 5, scale: 2 }).default('0'), // Percentage
  editRate: decimal("edit_rate", { precision: 5, scale: 2 }).default('0'), // Percentage
  rejectionRate: decimal("rejection_rate", { precision: 5, scale: 2 }).default('0'), // Percentage
  satisfactionScore: decimal("satisfaction_score", { precision: 5, scale: 2 }).default('0'), // thumbsUp/(thumbsUp+thumbsDown)*100
  // Time tracking
  lastActivityAt: timestamp("last_activity_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Agent Rules - Configuration and behavior rules for each agent type
export const agentRules = pgTable("agent_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  agentType: text("agent_type").notNull(), // 'wismo', 'product', 'subscription', 'returns', etc.
  name: text("name").notNull(),
  description: text("description"),
  // Agent behavior settings
  isEnabled: boolean("is_enabled").default(true),
  requiresApproval: boolean("requires_approval").default(true),
  // Response configuration
  responseTemplate: text("response_template"),
  responseType: text("response_type").default('template'), // 'template', 'dynamic', 'ai_generated'
  // Business logic settings
  configuration: text("configuration"), // JSON string for agent-specific settings
  conditions: text("conditions"), // JSON string for trigger conditions
  // Integration settings
  integrations: text("integrations"), // JSON string for API keys, webhook configs, etc.
  // Performance tracking
  triggerCount: integer("trigger_count").default(0),
  lastTriggered: timestamp("last_triggered"),
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Ensure one rule per agent type per user
  uniqueUserAgent: unique().on(table.userId, table.agentType),
}));

// Agent Feedback - Individual thumbs up/down ratings
export const agentFeedback = pgTable("agent_feedback", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  approvalItemId: varchar("approval_item_id").references(() => automationApprovalQueue.id).notNull(),
  agentType: text("agent_type").notNull(), // 'wismo', 'returns', 'product', etc.
  rating: text("rating").notNull(), // 'thumbs_up', 'thumbs_down'
  feedback: text("feedback"), // Optional text feedback
  customerEmail: text("customer_email").notNull(),
  classification: text("classification").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Content Management Types
export type ManualTrainingContent = typeof manualTrainingContent.$inferSelect;
export type InsertManualTrainingContent = z.infer<typeof insertManualTrainingContentSchema>;

export type ContentChunk = typeof contentChunks.$inferSelect;
export type InsertContentChunk = z.infer<typeof insertContentChunkSchema>;

// Agent Performance Relations
export const agentMetricsRelations = relations(agentMetrics, ({ one }) => ({
  user: one(users, {
    fields: [agentMetrics.userId],
    references: [users.id],
  }),
}));

export const agentFeedbackRelations = relations(agentFeedback, ({ one }) => ({
  user: one(users, {
    fields: [agentFeedback.userId], 
    references: [users.id],
  }),
  approvalItem: one(automationApprovalQueue, {
    fields: [agentFeedback.approvalItemId],
    references: [automationApprovalQueue.id],
  }),
}));

export const agentRulesRelations = relations(agentRules, ({ one }) => ({
  user: one(users, {
    fields: [agentRules.userId],
    references: [users.id],
  }),
}));

// Agent Metrics Zod Schemas
export const insertAgentMetricsSchema = createInsertSchema(agentMetrics).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAgentFeedbackSchema = createInsertSchema(agentFeedback).omit({
  id: true,
  createdAt: true,
});

export const insertAgentRulesSchema = createInsertSchema(agentRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  triggerCount: true,
  lastTriggered: true,
});

// Agent Metrics Types
export type AgentMetrics = typeof agentMetrics.$inferSelect;
export type InsertAgentMetrics = z.infer<typeof insertAgentMetricsSchema>;

export type AgentFeedback = typeof agentFeedback.$inferSelect; 
export type InsertAgentFeedback = z.infer<typeof insertAgentFeedbackSchema>;

export type AgentRules = typeof agentRules.$inferSelect;
export type InsertAgentRules = z.infer<typeof insertAgentRulesSchema>;

// Agent Monitoring & Testing Tables
export const agentExecutionLogs = pgTable("agent_execution_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  agentType: text("agent_type").notNull(), // 'wismo', 'product', etc.
  emailId: varchar("email_id").references(() => emails.id),
  executionId: varchar("execution_id").notNull(), // Unique execution instance
  // Step tracking
  stepName: text("step_name").notNull(), // 'email_received', 'order_lookup', 'tracking_lookup', etc.
  stepStatus: text("step_status").notNull().default("started"), // 'started', 'completed', 'failed', 'skipped'
  stepOrder: integer("step_order").notNull(), // 1, 2, 3, etc.
  // Timing data
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  durationMs: integer("duration_ms"), // Calculated when completed
  // Step details
  inputData: jsonb("input_data"), // What was passed to this step
  outputData: jsonb("output_data"), // What was produced by this step
  errorDetails: text("error_details"), // If failed, why
  // Context
  metadata: jsonb("metadata"), // Additional step-specific data
  createdAt: timestamp("created_at").defaultNow(),
});

export const agentErrors = pgTable("agent_errors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  agentType: text("agent_type").notNull(),
  emailId: varchar("email_id").references(() => emails.id),
  executionId: varchar("execution_id").notNull(),
  // Error categorization
  errorType: text("error_type").notNull(), // 'network_error', 'api_error', 'data_error', 'logic_error'
  errorCategory: text("error_category").notNull(), // 'woocommerce_api', 'aftership_api', 'order_lookup', etc.
  errorMessage: text("error_message").notNull(),
  errorStack: text("error_stack"), // Full stack trace
  // Recovery information
  isRecoverable: boolean("is_recoverable").default(true),
  retryCount: integer("retry_count").default(0),
  maxRetries: integer("max_retries").default(3),
  lastRetryAt: timestamp("last_retry_at"),
  // Context
  stepName: text("step_name"), // Which step failed
  inputData: jsonb("input_data"), // What caused the error
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const agentTests = pgTable("agent_tests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id), // NULL for system tests
  agentType: text("agent_type").notNull(),
  // Test definition
  testName: text("test_name").notNull(),
  testDescription: text("test_description"),
  testScenario: text("test_scenario").notNull(), // 'valid_order', 'invalid_order', 'api_failure', etc.
  // Test data
  testEmailSubject: text("test_email_subject").notNull(),
  testEmailBody: text("test_email_body").notNull(),
  testEmailFrom: text("test_email_from").notNull(),
  expectedOutcome: text("expected_outcome"), // What should happen
  mockApiResponses: jsonb("mock_api_responses"), // Predefined API responses
  // Test configuration  
  isActive: boolean("is_active").default(true),
  testPriority: integer("test_priority").default(1), // 1=high, 2=medium, 3=low
  testType: text("test_type").default("functional"), // 'functional', 'performance', 'edge_case'
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const agentTestResults = pgTable("agent_test_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  testId: varchar("test_id").references(() => agentTests.id).notNull(),
  executionId: varchar("execution_id").notNull(), // Links to agent_execution_logs
  // Test results
  testStatus: text("test_status").notNull(), // 'passed', 'failed', 'error', 'skipped'
  actualOutcome: text("actual_outcome"),
  testDurationMs: integer("test_duration_ms"),
  // Performance metrics
  totalSteps: integer("total_steps"),
  failedSteps: integer("failed_steps"),
  apiCallCount: integer("api_call_count"),
  totalApiTimeMs: integer("total_api_time_ms"),
  // Failure details
  failureReason: text("failure_reason"),
  errorDetails: text("error_details"),
  // Test run context
  testRunId: varchar("test_run_id"), // Group tests run together
  triggeredBy: text("triggered_by").default("manual"), // 'manual', 'automated', 'deployment'
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations for monitoring tables
export const agentExecutionLogsRelations = relations(agentExecutionLogs, ({ one }) => ({
  user: one(users, {
    fields: [agentExecutionLogs.userId],
    references: [users.id],
  }),
  email: one(emails, {
    fields: [agentExecutionLogs.emailId],
    references: [emails.id],
  }),
}));

export const agentErrorsRelations = relations(agentErrors, ({ one }) => ({
  user: one(users, {
    fields: [agentErrors.userId],
    references: [users.id],
  }),
  email: one(emails, {
    fields: [agentErrors.emailId],
    references: [emails.id],
  }),
}));

export const agentTestsRelations = relations(agentTests, ({ one, many }) => ({
  user: one(users, {
    fields: [agentTests.userId],
    references: [users.id],
  }),
  testResults: many(agentTestResults),
}));

export const agentTestResultsRelations = relations(agentTestResults, ({ one }) => ({
  test: one(agentTests, {
    fields: [agentTestResults.testId],
    references: [agentTests.id],
  }),
}));

// Insert schemas for monitoring tables
export const insertAgentExecutionLogSchema = createInsertSchema(agentExecutionLogs).omit({
  id: true,
  createdAt: true,
});

export const insertAgentErrorSchema = createInsertSchema(agentErrors).omit({
  id: true,
  createdAt: true,
});

export const insertAgentTestSchema = createInsertSchema(agentTests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAgentTestResultSchema = createInsertSchema(agentTestResults).omit({
  id: true,
  createdAt: true,
});

// Types for monitoring tables
export type AgentExecutionLog = typeof agentExecutionLogs.$inferSelect;
export type InsertAgentExecutionLog = z.infer<typeof insertAgentExecutionLogSchema>;

export type AgentError = typeof agentErrors.$inferSelect;
export type InsertAgentError = z.infer<typeof insertAgentErrorSchema>;

export type AgentTest = typeof agentTests.$inferSelect;
export type InsertAgentTest = z.infer<typeof insertAgentTestSchema>;

export type AgentTestResult = typeof agentTestResults.$inferSelect;
export type InsertAgentTestResult = z.infer<typeof insertAgentTestResultSchema>;
