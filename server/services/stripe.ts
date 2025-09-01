import Stripe from "stripe";
import { storage } from "../storage";
import { logger, LogCategory } from "./logger";

// Production Stripe Configuration - Live Mode Only
// This system operates exclusively in live mode for all environments
const stripeKey = process.env.STRIPE_SECRET_KEY!;

const stripe = new Stripe(stripeKey, {
  apiVersion: "2025-07-30.basil",
});

export interface CreateSubscriptionParams {
  userId: string;
  planId: string;
  paymentMethodId: string;
  email: string;
  name?: string;
}

export interface UpdateSubscriptionParams {
  userId: string;
  newPlanId: string;
}

export class StripeService {
  async createCustomer(email: string, name?: string): Promise<Stripe.Customer> {
    try {
      logger.info(
        LogCategory.STRIPE,
        `Creating Stripe customer in live mode`,
        {
          email,
        },
      );

      const customer = await stripe.customers.create({
        email,
        name,
      });

      logger.info(
        LogCategory.STRIPE,
        `Created Stripe customer: ${customer.id}`,
        {
          email,
          customerId: customer.id,
        },
      );
      return customer;
    } catch (error) {
      logger.error(
        LogCategory.STRIPE,
        `Failed to create Stripe customer: ${error}`,
        {
          email,
        },
      );
      throw new Error(
        `Failed to create customer: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async createSetupIntent(customerId: string): Promise<Stripe.SetupIntent> {
    try {
      logger.info(LogCategory.STRIPE, `Creating setup intent in live mode`, {
        customerId,
      });

      const setupIntent = await stripe.setupIntents.create({
        customer: customerId,
        payment_method_types: ["card"],
        usage: "off_session", // For saving payment methods
      });

      logger.info(
        LogCategory.STRIPE,
        `Created setup intent: ${setupIntent.id}`,
        {
          customerId,
        },
      );
      return setupIntent;
    } catch (error) {
      logger.error(
        LogCategory.STRIPE,
        `Failed to create setup intent: ${error}`,
        {
          customerId,
        },
      );
      throw new Error(
        `Failed to create setup intent: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async getPaymentMethods(customerId: string): Promise<Stripe.ApiList<Stripe.PaymentMethod>> {
    try {
      logger.info(LogCategory.STRIPE, `Retrieving payment methods in live mode`, {
        customerId,
      });

      const paymentMethods = await stripe.paymentMethods.list({
        customer: customerId,
        type: "card",
      });

      logger.info(
        LogCategory.STRIPE,
        `Retrieved ${paymentMethods.data.length} payment methods`,
        {
          customerId,
          count: paymentMethods.data.length,
        },
      );
      return paymentMethods;
    } catch (error) {
      logger.error(
        LogCategory.STRIPE,
        `Failed to retrieve payment methods: ${error}`,
        {
          customerId,
        },
      );
      throw new Error(
        `Failed to retrieve payment methods: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async createSubscription(params: CreateSubscriptionParams): Promise<{
    subscription: Stripe.Subscription;
    clientSecret?: string;
  }> {
    try {
      // Get the billing plan
      const plans = await storage.getBillingPlans();
      const plan = plans.find((p) => p.id === params.planId);
      if (!plan) {
        throw new Error("Invalid plan selected");
      }

      // Get or create Stripe customer
      let stripeCustomerId: string;
      const existingBilling = await storage.getUserBilling(params.userId);

      if (existingBilling?.stripeCustomerId) {
        stripeCustomerId = existingBilling.stripeCustomerId;
      } else {
        const customer = await this.createCustomer(params.email, params.name);
        stripeCustomerId = customer.id;
      }

      // Create or find product
      let product: Stripe.Product;
      try {
        // Try to find existing product
        const products = await stripe.products.list({ limit: 100 });
        product =
          products.data.find((p) => p.name === `${plan.displayName} Plan`) ||
          (await stripe.products.create({
            name: `${plan.displayName} Plan`,
            description: `Monthly subscription to ${plan.displayName} plan`,
          }));
      } catch (error) {
        // Create new product if not found
        product = await stripe.products.create({
          name: `${plan.displayName} Plan`,
          description: `Monthly subscription to ${plan.displayName} plan`,
        });
      }

      // Attach payment method to customer first
      await stripe.paymentMethods.attach(params.paymentMethodId, {
        customer: stripeCustomerId,
      });

      // Create subscription with trial period
      const subscription = await stripe.subscriptions.create({
        customer: stripeCustomerId,
        items: [
          {
            price_data: {
              currency: "usd",
              product: product.id,
              unit_amount: Math.round(parseFloat(plan.price.toString()) * 100), // Convert to cents
              recurring: {
                interval: "month",
              },
            },
          },
        ],
        payment_behavior: "default_incomplete",
        payment_settings: {
          save_default_payment_method: "on_subscription",
        },
        default_payment_method: params.paymentMethodId,
        trial_period_days: 7,
        expand: ["latest_invoice.payment_intent"],
      });

      // Update user billing in database
      const subscriptionData = subscription as any;
      const periodStart = subscriptionData.current_period_start;
      const periodEnd = subscriptionData.current_period_end;
      const currentPeriodStart =
        periodStart && typeof periodStart === "number"
          ? new Date(periodStart * 1000)
          : new Date();
      const currentPeriodEnd =
        periodEnd && typeof periodEnd === "number"
          ? new Date(periodEnd * 1000)
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      await storage.updateUserBilling(params.userId, {
        planId: params.planId,
        status: "trial",
        stripeCustomerId,
        stripeSubscriptionId: subscription.id,
        trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        billingCycleStart: currentPeriodStart,
        billingCycleEnd: currentPeriodEnd,
      });

      logger.info(
        LogCategory.STRIPE,
        `Created subscription: ${subscription.id}`,
        {
          userId: params.userId,
          planId: params.planId,
          subscriptionId: subscription.id,
        },
      );

      const invoice = subscription.latest_invoice as Stripe.Invoice;
      const paymentIntent = (invoice as any)
        ?.payment_intent as Stripe.PaymentIntent;

      return {
        subscription,
        clientSecret: paymentIntent?.client_secret || undefined,
      };
    } catch (error) {
      logger.error(
        LogCategory.STRIPE,
        `Failed to create subscription: ${error}`,
        {
          userId: params.userId,
        },
      );
      throw new Error(
        `Failed to create subscription: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async updateSubscription(
    params: UpdateSubscriptionParams,
  ): Promise<Stripe.Subscription> {
    // **TRANSACTION SAFETY: Store original state for rollback**
    const originalBilling = await storage.getUserBilling(params.userId);
    let stripeSubscriptionUpdated = false;
    let updatedSubscription: Stripe.Subscription | null = null;

    try {
      if (!originalBilling?.stripeSubscriptionId) {
        throw new Error("No active subscription found");
      }

      // Get the new plan
      const plans = await storage.getBillingPlans();
      const newPlan = plans.find((p) => p.id === params.newPlanId);
      if (!newPlan) {
        throw new Error("Invalid plan selected");
      }

      // Get current subscription
      const subscription = await stripe.subscriptions.retrieve(
        originalBilling.stripeSubscriptionId,
      );

      // Create or find product for new plan
      let product: Stripe.Product;
      try {
        const products = await stripe.products.list({ limit: 100 });
        product =
          products.data.find((p) => p.name === `${newPlan.displayName} Plan`) ||
          (await stripe.products.create({
            name: `${newPlan.displayName} Plan`,
            description: `Monthly subscription to ${newPlan.displayName} plan`,
          }));
      } catch (error) {
        product = await stripe.products.create({
          name: `${newPlan.displayName} Plan`,
          description: `Monthly subscription to ${newPlan.displayName} plan`,
        });
      }

      // **CRITICAL: Update subscription in Stripe first**
      updatedSubscription = await stripe.subscriptions.update(
        originalBilling.stripeSubscriptionId,
        {
          items: [
            {
              id: subscription.items.data[0].id,
              price_data: {
                currency: "usd",
                product: product.id,
                unit_amount: Math.round(
                  parseFloat(newPlan.price.toString()) * 100,
                ),
                recurring: {
                  interval: "month",
                },
              },
            },
          ],
          proration_behavior: "create_prorations",
        },
      );
      stripeSubscriptionUpdated = true;

      // **SAFE: Extract dates after successful Stripe update**
      const currentPeriodStart = updatedSubscription.current_period_start 
        ? new Date(updatedSubscription.current_period_start * 1000)
        : new Date();
      const currentPeriodEnd = updatedSubscription.current_period_end
        ? new Date(updatedSubscription.current_period_end * 1000)
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      // **CRITICAL: Update database with error handling**
      try {
        await storage.updateUserBilling(params.userId, {
          planId: params.newPlanId,
          billingCycleStart: currentPeriodStart,
          billingCycleEnd: currentPeriodEnd,
        });
      } catch (dbError) {
        logger.error(
          LogCategory.STRIPE,
          `Database update failed after Stripe update. MANUAL INTERVENTION REQUIRED.`,
          {
            userId: params.userId,
            stripeSubscriptionId: updatedSubscription.id,
            newPlanId: params.newPlanId,
            dbError: dbError instanceof Error ? dbError.message : 'Unknown database error',
            needsManualSync: true
          }
        );
        
        // **ROLLBACK: Attempt to revert Stripe subscription**
        try {
          await stripe.subscriptions.update(
            originalBilling.stripeSubscriptionId,
            {
              items: [
                {
                  id: subscription.items.data[0].id,
                  price: subscription.items.data[0].price.id,
                },
              ],
              proration_behavior: "create_prorations",
            }
          );
          logger.info(LogCategory.STRIPE, 'Successfully rolled back Stripe subscription after database failure', {
            userId: params.userId,
            subscriptionId: originalBilling.stripeSubscriptionId
          });
        } catch (rollbackError) {
          logger.error(
            LogCategory.STRIPE,
            `CRITICAL: Failed to rollback Stripe subscription. Customer billed but database not updated.`,
            {
              userId: params.userId,
              stripeSubscriptionId: updatedSubscription.id,
              rollbackError: rollbackError instanceof Error ? rollbackError.message : 'Unknown rollback error',
              requiresManualFix: true
            }
          );
        }
        
        throw new Error(
          `Subscription update failed during database sync. Payment processing has been reverted. Please try again.`
        );
      }

      logger.info(
        LogCategory.STRIPE,
        `Successfully updated subscription with transaction safety: ${updatedSubscription.id}`,
        {
          userId: params.userId,
          newPlanId: params.newPlanId,
          transactionSafe: true
        },
      );

      return updatedSubscription;
    } catch (error) {
      // **ENHANCED ERROR HANDLING with rollback context**
      const errorContext = {
        userId: params.userId,
        stripeUpdated: stripeSubscriptionUpdated,
        subscriptionId: updatedSubscription?.id || originalBilling?.stripeSubscriptionId,
        originalPlanId: originalBilling?.planId,
        newPlanId: params.newPlanId
      };

      logger.error(
        LogCategory.STRIPE,
        `Failed to update subscription with transaction safety: ${error}`,
        errorContext
      );
      
      throw new Error(
        `Failed to update subscription: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async cancelSubscription(userId: string): Promise<Stripe.Subscription> {
    // **TRANSACTION SAFETY: Store original state for rollback**
    const originalBilling = await storage.getUserBilling(userId);
    let stripeCancelledSuccessfully = false;
    let cancelledSubscription: Stripe.Subscription | null = null;

    try {
      if (!originalBilling?.stripeSubscriptionId) {
        throw new Error("No active subscription found");
      }

      // **CRITICAL: Cancel in Stripe first**
      cancelledSubscription = await stripe.subscriptions.update(
        originalBilling.stripeSubscriptionId,
        {
          cancel_at_period_end: true,
        },
      );
      stripeCancelledSuccessfully = true;

      // **CRITICAL: Update database with error handling**
      try {
        await storage.updateUserBilling(userId, {
          status: "cancelled",
        });
      } catch (dbError) {
        logger.error(
          LogCategory.STRIPE,
          `Database update failed after Stripe cancellation. MANUAL INTERVENTION REQUIRED.`,
          {
            userId,
            stripeSubscriptionId: cancelledSubscription.id,
            dbError: dbError instanceof Error ? dbError.message : 'Unknown database error',
            needsManualSync: true
          }
        );
        
        // **ROLLBACK: Attempt to reactivate Stripe subscription**
        try {
          await stripe.subscriptions.update(
            originalBilling.stripeSubscriptionId,
            {
              cancel_at_period_end: false,
            }
          );
          logger.info(LogCategory.STRIPE, 'Successfully rolled back Stripe cancellation after database failure', {
            userId,
            subscriptionId: originalBilling.stripeSubscriptionId
          });
        } catch (rollbackError) {
          logger.error(
            LogCategory.STRIPE,
            `CRITICAL: Failed to rollback Stripe cancellation. Customer subscription cancelled but database not updated.`,
            {
              userId,
              stripeSubscriptionId: cancelledSubscription.id,
              rollbackError: rollbackError instanceof Error ? rollbackError.message : 'Unknown rollback error',
              requiresManualFix: true
            }
          );
        }
        
        throw new Error(
          `Subscription cancellation failed during database sync. Cancellation has been reverted. Please try again.`
        );
      }

      logger.info(
        LogCategory.STRIPE,
        `Successfully cancelled subscription with transaction safety: ${cancelledSubscription.id}`,
        {
          userId,
          transactionSafe: true
        },
      );
      return cancelledSubscription;
    } catch (error) {
      // **ENHANCED ERROR HANDLING with rollback context**
      const errorContext = {
        userId,
        stripeCancelled: stripeCancelledSuccessfully,
        subscriptionId: cancelledSubscription?.id || originalBilling?.stripeSubscriptionId,
        originalStatus: originalBilling?.status
      };

      logger.error(
        LogCategory.STRIPE,
        `Failed to cancel subscription with transaction safety: ${error}`,
        errorContext
      );
      throw new Error(
        `Failed to cancel subscription: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  // async createSetupIntent(customerId: string): Promise<Stripe.SetupIntent> {
  //   try {
  //     const setupIntent = await stripe.setupIntents.create({
  //       customer: customerId,
  //       usage: "off_session",
  //       payment_method_types: ["card"],
  //     });

  //     return setupIntent;
  //   } catch (error) {
  //     throw new Error(
  //       `Failed to create setup intent: ${error instanceof Error ? error.message : "Unknown error"}`,
  //     );
  //   }
  // }

  async handleWebhook(body: string, signature: string): Promise<void> {
    try {
      const webHookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

      logger.info(LogCategory.STRIPE, `WebHook Signature`, {
        signature: signature,
      });

      const event = stripe.webhooks.constructEvent(
        body,
        signature,
        webHookSecret,
      );

      logger.info(LogCategory.STRIPE, `Received webhook: ${event.type}`, {
        eventId: event.id,
      });

      switch (event.type) {
        case "customer.subscription.created":
        case "customer.subscription.updated":
          await this.handleSubscriptionUpdate(
            event.data.object as Stripe.Subscription,
          );
          break;

        case "customer.subscription.deleted":
          await this.handleSubscriptionDeleted(
            event.data.object as Stripe.Subscription,
          );
          break;

        case "invoice.payment_succeeded":
          await this.handlePaymentSucceeded(
            event.data.object as Stripe.Invoice,
          );
          break;

        case "invoice.payment_failed":
          await this.handlePaymentFailed(event.data.object as Stripe.Invoice);
          break;

        default:
          logger.info(
            LogCategory.STRIPE,
            `Unhandled webhook event: ${event.type}`,
            {
              eventId: event.id,
            },
          );
      }
    } catch (error) {
      logger.error(LogCategory.STRIPE, `Webhook error: ${error}`, { error });
      throw error;
    }
  }

  private async handleSubscriptionUpdate(
    subscription: Stripe.Subscription,
  ): Promise<void> {
    try {
      // Find user billing by customer ID - need to implement this lookup method
      const userBilling = await this.findUserBillingByCustomerId(
        subscription.customer as string,
      );

      if (!userBilling) {
        logger.warn(
          LogCategory.STRIPE,
          "No user found for subscription update",
          {
            subscriptionId: subscription.id,
          },
        );
        return;
      }

      const status =
        subscription.status === "active"
          ? "active"
          : subscription.status === "trialing"
            ? "trial"
            : subscription.status;

      const periodStart = (subscription as any).current_period_start;
      const periodEnd = (subscription as any).current_period_end;

      await storage.updateUserBilling(userBilling.userId, {
        status,
        billingCycleStart:
          periodStart && typeof periodStart === "number"
            ? new Date(periodStart * 1000)
            : new Date(),
        billingCycleEnd:
          periodEnd && typeof periodEnd === "number"
            ? new Date(periodEnd * 1000)
            : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });
    } catch (error) {
      logger.error(LogCategory.STRIPE, `Failed to handle subscription update: ${error}`, {
        subscriptionId: subscription.id,
      });
    }
  }

  private async handleSubscriptionDeleted(
    subscription: Stripe.Subscription,
  ): Promise<void> {
    try {
      const userBilling = await this.findUserBillingByCustomerId(
        subscription.customer as string,
      );

      if (!userBilling) return;

      await storage.updateUserBilling(userBilling.userId, {
        status: "cancelled",
      });
    } catch (error) {
      logger.error(
        LogCategory.STRIPE,
        `Failed to handle subscription deletion: ${error}`,
        { subscriptionId: subscription.id },
      );
    }
  }

  private async handlePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
    try {
      const userBilling = await this.findUserBillingByCustomerId(
        invoice.customer as string,
      );

      if (!userBilling) return;

      // Update user billing status
      await storage.updateUserBilling(userBilling.userId, {
        status: "active",
      });

      // **REVENUE TRACKING: Capture actual payment data for analytics**
      if (invoice.amount_paid && invoice.lines.data.length > 0) {
        const lineItem = invoice.lines.data[0];
        // Access price through proper path for line items
        const price = (lineItem as any).price as Stripe.Price | null;
        const planName =
          price?.nickname || lineItem.description || "Unknown Plan";
        const planId = price?.id || "unknown";

        // Create revenue event record for accurate analytics
        const revenueData = {
          userId: userBilling.userId,
          stripeInvoiceId: invoice.id,
          stripeCustomerId: invoice.customer as string,
          amountCents: invoice.amount_paid,
          planName,
          planId,
          periodStart:
            (invoice as any).period_start &&
            typeof (invoice as any).period_start === "number"
              ? new Date((invoice as any).period_start * 1000)
              : new Date(),
          periodEnd:
            (invoice as any).period_end &&
            typeof (invoice as any).period_end === "number"
              ? new Date((invoice as any).period_end * 1000)
              : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          paymentDate:
            invoice.created && typeof invoice.created === "number"
              ? new Date(invoice.created * 1000)
              : new Date(),
        };

        // Store revenue event (once storage.ts is fixed, this will work)
        try {
          // await storage.createRevenueEvent(revenueData);
          logger.info(
            LogCategory.STRIPE,
            `Revenue captured: $${(invoice.amount_paid / 100).toFixed(2)}`,
            {
              userId: userBilling.userId,
              planName,
              amount: invoice.amount_paid,
            },
          );
        } catch (storageError) {
          logger.error(
            LogCategory.STRIPE,
            `Failed to store revenue event: ${storageError}`,
            { invoiceId: invoice.id },
          );
        }
      }
    } catch (error) {
      logger.error(LogCategory.STRIPE, `Failed to handle payment success: ${error}`, {
        invoiceId: invoice.id,
      });
    }
  }

  private async handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    try {
      const userBilling = await this.findUserBillingByCustomerId(
        invoice.customer as string,
      );

      if (!userBilling) return;

      await storage.updateUserBilling(userBilling.userId, {
        status: "expired",
      });
    } catch (error) {
      logger.error(LogCategory.STRIPE, `Failed to handle payment failure: ${error}`, {
        invoiceId: invoice.id,
      });
    }
  }

  private async findUserBillingByCustomerId(customerId: string) {
    try {
      return await storage.getUserBillingByCustomerId(customerId);
    } catch (error) {
      logger.error(LogCategory.STRIPE, `Failed to find user by customer ID: ${error}`, {
        customerId,
      });
      return null;
    }
  }

  async savePaymentMethod(
    userId: string,
    paymentMethodId: string,
    customerId: string,
  ): Promise<any> {
    try {
      // Get payment method details from Stripe
      const paymentMethod =
        await stripe.paymentMethods.retrieve(paymentMethodId);

      if (!paymentMethod.card) {
        throw new Error("Invalid payment method type");
      }

      // Save to database
      const paymentMethodData = {
        userId,
        stripePaymentMethodId: paymentMethodId,
        type: paymentMethod.type,
        cardBrand: paymentMethod.card.brand,
        cardLast4: paymentMethod.card.last4,
        cardExpMonth: paymentMethod.card.exp_month,
        cardExpYear: paymentMethod.card.exp_year,
        isDefault: false, // Will be set later if needed
        isActive: true,
      };

      const savedMethod = await storage.createPaymentMethod(paymentMethodData);

      logger.info(
        LogCategory.STRIPE,
        `Saved payment method: ${paymentMethodId}`,
        {
          userId,
        },
      );
      return savedMethod;
    } catch (error) {
      logger.error(
        LogCategory.STRIPE,
        `Failed to save payment method: ${error}`,
        {
          userId,
          paymentMethodId,
        },
      );
      throw new Error(
        `Failed to save payment method: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async deletePaymentMethod(
    paymentMethodId: string,
    userId: string,
  ): Promise<void> {
    try {
      // Get the payment method from database
      const paymentMethod = await storage.getPaymentMethodById(paymentMethodId);
      if (!paymentMethod || paymentMethod.userId !== userId) {
        throw new Error("Payment method not found");
      }

      // Detach from Stripe
      await stripe.paymentMethods.detach(paymentMethod.stripePaymentMethodId);

      // Delete from database
      await storage.deletePaymentMethod(paymentMethodId);

      logger.info(
        LogCategory.STRIPE,
        `Deleted payment method: ${paymentMethodId}`,
        {
          userId,
        },
      );
    } catch (error) {
      logger.error(
        LogCategory.STRIPE,
        `Failed to delete payment method: ${error}`,
        {
          userId,
          paymentMethodId,
        },
      );
      throw new Error(
        `Failed to delete payment method: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async setDefaultPaymentMethod(
    paymentMethodId: string,
    userId: string,
  ): Promise<void> {
    try {
      // Get the payment method from database
      const paymentMethod = await storage.getPaymentMethodById(paymentMethodId);
      if (!paymentMethod || paymentMethod.userId !== userId) {
        throw new Error("Payment method not found");
      }

      // Update database - set all to non-default, then set this one as default
      await storage.setDefaultPaymentMethod(userId, paymentMethodId);

      logger.info(
        LogCategory.STRIPE,
        `Set default payment method: ${paymentMethodId}`,
        {
          userId,
        },
      );
    } catch (error) {
      logger.error(
        LogCategory.STRIPE,
        `Failed to set default payment method: ${error}`,
        {
          userId,
          paymentMethodId,
        },
      );
      throw new Error(
        `Failed to set default payment method: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async createBillingPortalSession(
    customerId: string,
    returnUrl: string,
  ): Promise<Stripe.BillingPortal.Session> {
    try {
      // First, try to create a billing portal configuration if none exists
      let configuration: Stripe.BillingPortal.Configuration | null = null;

      try {
        // Check if we have any configurations
        const configurations = await stripe.billingPortal.configurations.list({
          limit: 1,
        });
        if (configurations.data.length === 0) {
          // Create a default configuration for test mode
          configuration = await stripe.billingPortal.configurations.create({
            business_profile: {
              headline: "Delight Desk - Customer Support Automation",
            },
            features: {
              customer_update: {
                enabled: true,
                allowed_updates: ["email", "address"],
              },
              invoice_history: { enabled: true },
              payment_method_update: { enabled: true },
              subscription_cancel: {
                enabled: true,
                mode: "at_period_end",
                cancellation_reason: {
                  enabled: true,
                  options: [
                    "too_expensive",
                    "missing_features",
                    "switched_service",
                    "unused",
                    "other",
                  ],
                },
              },
              subscription_pause: {
                enabled: false,
              },
              subscription_update: {
                enabled: true,
                default_allowed_updates: ["price"],
                proration_behavior: "create_prorations",
              },
            },
          });
          logger.info(
            LogCategory.STRIPE,
            `Created billing portal configuration: ${configuration.id}`,
            { customerId },
          );
        }
      } catch (configError) {
        logger.warn(
          LogCategory.STRIPE,
          `Could not create billing portal configuration: ${configError}`,
          { customerId },
        );
      }

      const sessionParams: Stripe.BillingPortal.SessionCreateParams = {
        customer: customerId,
        return_url: returnUrl,
      };

      // Add configuration if we created one
      if (configuration) {
        sessionParams.configuration = configuration.id;
      }

      const session = await stripe.billingPortal.sessions.create(sessionParams);

      logger.info(
        LogCategory.STRIPE,
        `Created billing portal session for customer: ${customerId}`,
        { customerId, sessionId: session.id },
      );
      return session;
    } catch (error) {
      logger.error(
        LogCategory.STRIPE,
        `Failed to create billing portal session: ${error}`,
        { customerId },
      );
      throw new Error(
        `Failed to create billing portal session: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }
}

export const stripeService = new StripeService();
