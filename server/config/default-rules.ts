/**
 * Default Auto-Responder Rule Templates
 * 
 * These templates are used to seed new users with a complete set of 
 * auto-responder rules covering all email classification types.
 * 
 * Categories:
 * - core: Essential rules created active by default
 * - agent: AI agent rules created inactive, activated when user enables agents
 * - advanced: Complex rules created inactive, requiring user configuration
 */

import type { IStorage } from '../storage';

export interface RuleTemplate {
  name: string;
  description: string;
  category: 'core' | 'agent' | 'advanced';
  classification: string;
  isActive: boolean;
  template: string;
  conditions: {
    keywords: string[];
  };
  requiresApproval: boolean;
  // Promo refund specific fields (only for promo_refund)
  refundType?: string;
  refundValue?: number;
  refundCap?: number;
  minOrderAmount?: number;
  maxOrderAmount?: number;
}

export const DEFAULT_RULE_TEMPLATES: Record<string, RuleTemplate[]> = {
  core: [
    {
      name: "General Inquiries",
      description: "Handle general inquiries and questions that don't fit other categories",
      category: "core",
      classification: "general",
      isActive: true,
      template: "Hi {customerName}!\n\nThank you for reaching out to us. I've received your message and our team will get back to you within 24 hours.\n\nIf this is urgent, please reply with 'URGENT' and we'll prioritize your request.\n\nBest regards,\n{agentName}",
      conditions: {
        keywords: []
      },
      requiresApproval: false
    },
    {
      name: "Priority Escalation",
      description: "Handle complex issues and frustrated customers requiring immediate attention",
      category: "core",
      classification: "escalation",
      isActive: true,
      template: "Hi {customerName}!\n\nI understand your concern and I want to make sure we address this properly. Your message has been escalated to our senior support team who will contact you within 2 hours.\n\nWe take all customer concerns seriously and will resolve this for you.\n\nBest regards,\n{agentName}",
      conditions: {
        keywords: ["angry", "frustrated", "complaint", "terrible", "awful"]
      },
      requiresApproval: false
    },
    {
      name: "Human Agent Request",
      description: "Handle explicit requests for human assistance",
      category: "core",
      classification: "human_escalation",
      isActive: true,
      template: "Hi {customerName}!\n\nI understand you'd like to speak with a human representative. I've immediately forwarded your request to our support team.\n\nA human agent will contact you within 1 hour during business hours.\n\nBest regards,\n{agentName}",
      conditions: {
        keywords: ["speak to human", "real person", "human agent", "talk to someone"]
      },
      requiresApproval: false
    }
  ],

  agent: [
    {
      name: "Order Tracking",
      description: "Handle order tracking and delivery inquiries (Where Is My Order)",
      category: "agent",
      classification: "order_status",
      isActive: false,
      template: "Hi {customerName}!\n\nI'll help you track your order #{orderNumber}. Let me check the latest status for you.\n\n{trackingInfo}\n\nIf you have any other questions, just let me know!\n\nBest regards,\n{agentName}",
      conditions: {
        keywords: ["where is my order", "tracking", "shipped", "delivery", "order status"]
      },
      requiresApproval: true
    },
    {
      name: "Subscription Management",
      description: "Handle subscription modifications, pauses, and billing updates",
      category: "agent",
      classification: "subscription_changes",
      isActive: false,
      template: "Hi {customerName}!\n\nI can help you with your subscription changes. {subscriptionAction}\n\n{subscriptionDetails}\n\nYour changes will take effect with your next billing cycle.\n\nBest regards,\n{agentName}",
      conditions: {
        keywords: ["pause subscription", "change subscription", "modify subscription", "billing cycle"]
      },
      requiresApproval: true
    },
    {
      name: "Returns & Exchanges",
      description: "Handle product returns and exchanges for received items",
      category: "agent",
      classification: "return_request",
      isActive: false,
      template: "Hi {customerName}!\n\nI'm sorry to hear that order #{orderNumber} didn't meet your expectations. I'm here to help with your return.\n\n{returnInstructions}\n\nOnce we receive your return, we'll process your refund within 3-5 business days.\n\nBest regards,\n{agentName}",
      conditions: {
        keywords: ["return", "exchange", "defective", "wrong item", "not satisfied"]
      },
      requiresApproval: true
    },
    {
      name: "Product Information",
      description: "Handle product information, features, and compatibility questions",
      category: "agent",
      classification: "product",
      isActive: false,
      template: "Hi {customerName}!\n\nI'm happy to help with your product question about {productName}.\n\n{productInfo}\n\nIf you have any other questions, just let me know!\n\nBest regards,\n{agentName}",
      conditions: {
        keywords: ["product features", "compatibility", "specifications", "how to use"]
      },
      requiresApproval: true
    },
    {
      name: "Order Cancellation",
      description: "Handle requests to cancel orders before shipping",
      category: "agent",
      classification: "order_cancellations",
      isActive: false,
      template: "Hi {customerName}!\n\nI understand you need to cancel order #{orderNumber}. I've successfully processed the cancellation for you.\n\n{cancellationDetails}\n\nThe refund will be processed back to your original payment method within 3-5 business days.\n\nIf you need to place a new order, I'm here to help!\n\nBest regards,\n{agentName}",
      conditions: {
        keywords: ["cancel order", "stop order", "cancel my order", "don't want"]
      },
      requiresApproval: true
    },
    {
      name: "Address Changes",
      description: "Handle shipping address updates and delivery location changes",
      category: "agent",
      classification: "address_updates",
      isActive: false,
      template: "Hi {customerName}!\n\nI can help you update the shipping address for order #{orderNumber}.\n\n{addressUpdate}\n\nYour order will be shipped to the new address as requested.\n\nBest regards,\n{agentName}",
      conditions: {
        keywords: ["change address", "update address", "wrong address", "ship to different"]
      },
      requiresApproval: true
    }
  ],

  advanced: [
    {
      name: "Refund Processing",
      description: "Handle billing issues, refund requests, and promotional code problems",
      category: "advanced",
      classification: "promo_refund",
      isActive: false,
      template: "Hi {customerName}!\n\nI understand you're having an issue with your order #{orderNumber}. I've reviewed your request and I'm happy to help.\n\n{refundDetails}\n\nThe refund will be processed within 3-5 business days to your original payment method.\n\nBest regards,\n{agentName}",
      conditions: {
        keywords: ["refund", "billing", "charge", "promo code", "discount", "money back"]
      },
      requiresApproval: true,
      refundType: "percentage",
      refundValue: 0.10,
      refundCap: 50.00,
      minOrderAmount: 25.00,
      maxOrderAmount: 500.00
    },
    {
      name: "Payment Issues",
      description: "Handle failed payments and payment method problems",
      category: "advanced",
      classification: "payment_issues",
      isActive: false,
      template: "Hi {customerName}!\n\nI see there's an issue with your payment for order #{orderNumber}. I'm here to help resolve this.\n\n{paymentSolution}\n\nOnce updated, your order will process normally.\n\nBest regards,\n{agentName}",
      conditions: {
        keywords: ["payment failed", "card declined", "payment error", "billing problem"]
      },
      requiresApproval: true
    },
    {
      name: "Promo Codes & Discounts",
      description: "Handle promo code requests and discount questions",
      category: "advanced",
      classification: "discount_inquiries",
      isActive: false,
      template: "Hi {customerName}!\n\nI'd be happy to help with discount information.\n\n{discountInfo}\n\nThe discount has been applied to your account for future use.\n\nBest regards,\n{agentName}",
      conditions: {
        keywords: ["discount", "promo code", "coupon", "sale", "deal"]
      },
      requiresApproval: true
    }
  ]
};

/**
 * Get all rule templates as a flat array
 */
export function getAllRuleTemplates(): RuleTemplate[] {
  return [
    ...DEFAULT_RULE_TEMPLATES.core,
    ...DEFAULT_RULE_TEMPLATES.agent,
    ...DEFAULT_RULE_TEMPLATES.advanced
  ];
}

/**
 * Get rule templates by category
 */
export function getRuleTemplatesByCategory(category: 'core' | 'agent' | 'advanced'): RuleTemplate[] {
  return DEFAULT_RULE_TEMPLATES[category] || [];
}

/**
 * Get a specific rule template by name
 */
export function getRuleTemplate(name: string): RuleTemplate | undefined {
  return getAllRuleTemplates().find(template => template.name === name);
}

/**
 * Seed auto-responder rules for a new user
 * Creates all default rules in the auto_responder_rules table
 */
export async function seedAutoResponderRules(userId: string, storage: IStorage): Promise<void> {
  const allTemplates = getAllRuleTemplates();
  let createdCount = 0;
  let failedCount = 0;
  
  console.log(`[AUTO-RESPONDER] Seeding ${allTemplates.length} default rules for user: ${userId}`);
  
  for (const template of allTemplates) {
    // Map template to auto_responder_rules table format
    const ruleData = {
      userId,
      name: template.name,
      description: template.description,
      classification: template.classification,
      isActive: template.isActive,
      template: template.template,
      conditions: template.conditions,
      requiresApproval: template.requiresApproval,
      
      // Promo refund specific fields (only for promo_refund classification)
      ...(template.classification === 'promo_refund' && {
        refundType: template.refundType,
        refundValue: template.refundValue,
        refundCap: template.refundCap,
        minOrderAmount: template.minOrderAmount,
        maxOrderAmount: template.maxOrderAmount,
      })
    };

    try {
      await storage.createAutoResponderRule(ruleData);
      createdCount++;
      console.log(`[AUTO-RESPONDER] ✓ Created rule: ${template.name} (${template.classification})`);
    } catch (error) {
      failedCount++;
      console.error(`[AUTO-RESPONDER] ✗ Failed to create rule: ${template.name}`, error);
      // Continue creating other rules even if one fails
    }
  }
  
  console.log(`[AUTO-RESPONDER] Seeding complete: ${createdCount} created, ${failedCount} failed`);
}