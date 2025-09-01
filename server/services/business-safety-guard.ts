/**
 * CRITICAL BUSINESS SAFETY SYSTEM
 * Prevents AI from generating responses that could damage business revenue
 */

interface BusinessSafetyResult {
  isBusinessSafe: boolean;
  violations: string[];
  correctedResponse?: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

interface BusinessRule {
  id: string;
  name: string;
  pattern: RegExp;
  violation: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  correctionStrategy: string;
}

class BusinessSafetyGuard {
  
  private readonly businessRules: BusinessRule[] = [
    {
      id: 'subscription_upsell_prevention',
      name: 'No Upselling Cancellation on Pause Request',
      pattern: /(pause.*subscription.*(cancel.*permanent|permanently|forever))|((cancel.*permanent|permanently|forever).*pause.*subscription)/gi,
      violation: 'AI offering permanent cancellation when customer only requested pause',
      riskLevel: 'critical',
      correctionStrategy: 'Only offer what the customer specifically requested'
    },
    {
      id: 'automatic_downsell_prevention', 
      name: 'No Automatic Downselling',
      pattern: /(switch.*cheaper|downgrade.*plan|lower.*tier|reduce.*subscription)/gi,
      violation: 'AI suggesting customer downgrade when not requested',
      riskLevel: 'high',
      correctionStrategy: 'Never suggest downgrades unless customer asks'
    },
    {
      id: 'negative_product_volunteering',
      name: 'No Volunteering Negative Product Info',
      pattern: /(not organic|not kosher|not vegan|not certified|however.*not|but.*not|although.*not).*(unless.*ask|didn\'t.*ask)/gi,
      violation: 'AI volunteering negative product information customer did not ask for',
      riskLevel: 'high', 
      correctionStrategy: 'Only mention negative attributes if customer specifically asks'
    },
    {
      id: 'unnecessary_refund_offers',
      name: 'No Unnecessary Refund Offers',
      pattern: /(would you like.*refund|can offer.*refund|happy to refund)(?!.*customer.*ask.*refund)/gi,
      violation: 'AI offering refunds when customer did not ask for one',
      riskLevel: 'critical',
      correctionStrategy: 'Only offer refunds when customer explicitly requests them'
    },
    {
      id: 'competitor_mentions',
      name: 'No Competitor Recommendations',
      pattern: /(try.*competitor|check.*amazon|other.*brands|alternative.*product)/gi,
      violation: 'AI mentioning competitors or alternatives unprompted',
      riskLevel: 'critical',
      correctionStrategy: 'Never mention competitors unless customer specifically asks for alternatives'
    },
    {
      id: 'policy_over_disclosure',
      name: 'No Over-Disclosure of Limitations',
      pattern: /(unfortunately.*cannot|sorry.*unable|policy.*prevent|not allowed.*policy)/gi,
      violation: 'AI over-disclosing limitations and policies',
      riskLevel: 'medium',
      correctionStrategy: 'Focus on what you CAN do, not what you cannot'
    }
  ];

  /**
   * CRITICAL: Check if AI response is business-safe before sending to customer
   */
  async validateBusinessSafety(
    aiResponse: string, 
    customerRequest: string,
    classification: string
  ): Promise<BusinessSafetyResult> {
    
    console.log('[BUSINESS_SAFETY] Validating response for business safety...');
    
    const violations: string[] = [];
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
    
    // Check each business rule
    for (const rule of this.businessRules) {
      if (rule.pattern.test(aiResponse)) {
        violations.push(rule.violation);
        
        // Escalate risk level
        if (rule.riskLevel === 'critical') {
          riskLevel = 'critical';
        } else if (rule.riskLevel === 'high' && riskLevel !== 'critical') {
          riskLevel = 'high';
        } else if (rule.riskLevel === 'medium' && !['critical', 'high'].includes(riskLevel)) {
          riskLevel = 'medium';
        }
        
        console.log(`[BUSINESS_SAFETY] VIOLATION DETECTED: ${rule.name} - ${rule.violation}`);
      }
    }
    
    // Special case: Subscription pause requests
    if (classification === 'subscription_changes' && customerRequest.toLowerCase().includes('pause')) {
      if (aiResponse.toLowerCase().includes('cancel') && aiResponse.toLowerCase().includes('permanent')) {
        violations.push('AI offering cancellation when customer only wants to pause subscription');
        riskLevel = 'critical';
      }
    }
    
    const isBusinessSafe = violations.length === 0;
    
    // Generate corrected response for critical violations
    let correctedResponse;
    if (riskLevel === 'critical') {
      correctedResponse = await this.generateBusinessSafeResponse(
        customerRequest, 
        classification, 
        violations
      );
    }
    
    console.log('[BUSINESS_SAFETY] Validation complete:', {
      isBusinessSafe,
      violationCount: violations.length,
      riskLevel,
      hasCorrectedResponse: !!correctedResponse
    });
    
    return {
      isBusinessSafe,
      violations,
      correctedResponse,
      riskLevel
    };
  }
  
  /**
   * Generate business-safe response that addresses customer need without revenue damage
   */
  private async generateBusinessSafeResponse(
    customerRequest: string,
    classification: string, 
    violations: string[]
  ): Promise<string> {
    
    console.log('[BUSINESS_SAFETY] Generating business-safe corrected response...');
    
    // Special handling for subscription pause requests
    if (classification === 'subscription_changes' && customerRequest.toLowerCase().includes('pause')) {
      return this.generateSafeSubscriptionPauseResponse(customerRequest);
    }
    
    // Default safe response based on classification
    return this.generateGenericSafeResponse(customerRequest, classification);
  }
  
  /**
   * Generate safe subscription pause response - ONLY pause, no cancellation mention
   */
  private generateSafeSubscriptionPauseResponse(customerRequest: string): string {
    return `I can pause your subscription for you. How long would you like it paused? I can set a specific reactivation date or pause it indefinitely until you're ready to restart.

Let me know your preference and I'll take care of it right away.`;
  }
  
  /**
   * Generate generic safe response based on classification
   */
  private generateGenericSafeResponse(customerRequest: string, classification: string): string {
    switch (classification) {
      case 'subscription_changes':
        return `I'd be happy to help with your subscription. Let me assist you with the specific changes you need.`;
      case 'order_status':
        return `Let me check on your order status and get you the latest information.`;
      case 'product':
        return `I can help answer your product questions. What specific information do you need?`;
      default:
        return `I'm here to help with your request. Let me assist you with what you need.`;
    }
  }
  
  /**
   * Log business safety violation for monitoring and improvement
   */
  async logBusinessSafetyViolation(
    userId: string,
    violation: string,
    originalResponse: string,
    customerRequest: string,
    classification: string
  ): Promise<void> {
    try {
      const { storage } = await import('../storage');
      
      await storage.createActivityLog({
        userId,
        action: 'business_safety_violation_blocked',
        type: 'ai_safety',
        executedBy: 'ai',
        customerEmail: 'system@delightdesk.io',
        details: `BLOCKED: ${violation}`,
        status: 'blocked',
        metadata: {
          violation,
          originalResponse,
          customerRequest,
          classification,
          safetySystem: 'business_safety_guard'
        }
      });
      
      console.log('[BUSINESS_SAFETY] Violation logged for analysis and improvement');
    } catch (error) {
      console.error('[BUSINESS_SAFETY] Failed to log violation:', error);
    }
  }
}

export const businessSafetyGuard = new BusinessSafetyGuard();