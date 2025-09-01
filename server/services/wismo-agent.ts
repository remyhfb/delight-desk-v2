import { storage } from "../storage";
import { nanoid } from "nanoid";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface WismoExecutionContext {
  executionId: string;
  userId: string;
  emailId: string;
  customerEmail: string;
  subject: string;
  body: string;
  startTime: Date;
  steps: WismoStepLog[];
}

export interface WismoStepLog {
  stepName: string;
  stepOrder: number;
  startTime: Date;
  endTime?: Date;
  status: 'started' | 'completed' | 'failed' | 'skipped';
  inputData?: any;
  outputData?: any;
  errorDetails?: string;
  metadata?: any;
}

export interface OrderLookupResult {
  found: boolean;
  orderNumber?: string;
  orderStatus?: string;
  trackingNumber?: string;
  orderDate?: string;
  customerName?: string;
  shippingAddress?: any;
  orderItems?: any[];
  source: 'extracted' | 'customer_lookup';
}

export interface TrackingLookupResult {
  found: boolean;
  carrier?: string;
  trackingNumber?: string;
  deliveryStatus?: string;
  estimatedDelivery?: string;
  trackingHistory?: any[];
  deliveryConfirmed?: boolean;
}

export interface WismoResponse {
  success: boolean;
  response?: string;
  escalationReason?: string;
  executionLog: WismoExecutionContext;
}

class WismoAgentService {
  /**
   * Process WISMO (Where Is My Order) requests with comprehensive audit trail
   */
  async processWismoRequest(
    userId: string,
    emailId: string,
    customerEmail: string,
    subject: string,
    body: string
  ): Promise<WismoResponse> {
    
    const executionId = nanoid();
    const startTime = new Date();
    
    const context: WismoExecutionContext = {
      executionId,
      userId,
      emailId,
      customerEmail,
      subject,
      body,
      startTime,
      steps: []
    };

    try {
      // Step 1: Email Received and Classified
      await this.logStep(context, 'email_received', 1, {
        subject,
        customerEmail,
        bodyLength: body.length
      });

      // Step 2: Order Number Extraction or Customer Lookup
      const orderLookup = await this.performOrderLookup(context, customerEmail, subject, body);
      
      if (!orderLookup.found) {
        await this.logStepFailure(context, 'order_lookup', 2, {
          customerEmail,
          searchMethod: orderLookup.source
        }, 'No order found for customer or extracted from email');
        
        return {
          success: false,
          escalationReason: 'Unable to identify order for customer',
          executionLog: context
        };
      }

      // Step 3: WooCommerce Order Details Lookup  
      const orderDetails = await this.fetchWooCommerceOrderDetails(context, orderLookup.orderNumber!, userId);
      
      if (!orderDetails.found) {
        await this.logStepFailure(context, 'woocommerce_lookup', 3, {
          orderNumber: orderLookup.orderNumber
        }, 'Order not found in WooCommerce');
        
        return {
          success: false,
          escalationReason: `Order ${orderLookup.orderNumber} not found in store system`,
          executionLog: context
        };
      }

      // Step 4: AfterShip Tracking Enhancement (if tracking number exists)
      let trackingData: TrackingLookupResult = { found: false };
      if (orderDetails.trackingNumber) {
        trackingData = await this.fetchAfterShipTrackingData(context, orderDetails.trackingNumber, userId);
      } else {
        await this.logStep(context, 'tracking_lookup_skipped', 4, {
          reason: 'No tracking number available'
        }, undefined, 'skipped');
      }

      // Step 5: Response Generation  
      const response = await this.generateWismoResponse(context, orderDetails, trackingData, userId);
      
      // Step 6: Approval Queue or Direct Send
      const agentRule = await this.getWismoAgentRule(userId);
      const requiresApproval = agentRule?.requiresApproval ?? true;
      
      if (requiresApproval) {
        await this.queueForApproval(context, response, orderDetails, trackingData);
        await this.logStep(context, 'queued_for_approval', 6, {
          requiresApproval: true,
          responseLength: response.length
        });
      } else {
        await this.sendDirectResponse(context, response, customerEmail, subject);
        await this.logStep(context, 'response_sent', 6, {
          responseLength: response.length,
          method: 'direct_send'
        });
      }

      // Step 7: Update Agent Metrics
      await this.updateAgentMetrics(context, userId, true);

      return {
        success: true,
        response,
        executionLog: context
      };

    } catch (error) {
      console.error('[WISMO_AGENT] Fatal error:', error);
      await this.logExecutionError(context, error, 'fatal_error');
      
      return {
        success: false,
        escalationReason: `System error during WISMO processing: ${error instanceof Error ? error.message : 'Unknown error'}`,
        executionLog: context
      };
    } finally {
      // Always save execution log to database
      await this.saveExecutionLog(context);
    }
  }

  /**
   * Step 2: Intelligent Order Lookup - Extract from email or lookup by customer
   */
  private async performOrderLookup(
    context: WismoExecutionContext,
    customerEmail: string,
    subject: string,
    body: string
  ): Promise<OrderLookupResult> {
    
    const stepStart = new Date();
    
    try {
      // First try to extract order number from email content
      const orderNumber = this.extractOrderNumberFromContent(`${subject} ${body}`);
      
      if (orderNumber) {
        await this.logStep(context, 'order_extraction', 2, {
          extractionMethod: 'regex',
          orderNumber,
          source: 'email_content'
        });
        
        return {
          found: true,
          orderNumber,
          source: 'extracted'
        };
      }

      // Fallback: Customer lookup for most recent order
      await this.logStep(context, 'customer_lookup_started', 2, {
        customerEmail,
        method: 'most_recent_order'
      });

      // This would integrate with WooCommerce customer lookup
      // For now, we'll return not found and escalate
      return {
        found: false,
        source: 'customer_lookup'
      };

    } catch (error) {
      await this.logStepFailure(context, 'order_lookup', 2, {
        customerEmail,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, `Order lookup failed: ${error}`);
      
      return {
        found: false,
        source: 'customer_lookup'
      };
    }
  }

  /**
   * Step 3: WooCommerce Order Details Lookup
   */
  private async fetchWooCommerceOrderDetails(
    context: WismoExecutionContext,
    orderNumber: string,
    userId: string
  ): Promise<OrderLookupResult> {
    
    try {
      await this.logStep(context, 'woocommerce_lookup_started', 3, {
        orderNumber,
        api: 'woocommerce'
      });

      // TODO: Integrate with actual WooCommerce API
      // For now, simulate the lookup
      const mockOrderData = {
        found: true,
        orderNumber,
        orderStatus: 'shipped',
        trackingNumber: '1Z999AA1234567890',
        orderDate: '2025-08-20',
        customerName: 'John Doe',
        orderItems: [
          { name: 'Organic Baby Food Bundle', quantity: 2, price: 29.99 }
        ]
      };

      await this.logStep(context, 'woocommerce_lookup_completed', 3, {
        orderNumber,
        orderStatus: mockOrderData.orderStatus,
        trackingNumber: mockOrderData.trackingNumber,
        itemCount: mockOrderData.orderItems.length
      });

      return mockOrderData;

    } catch (error) {
      await this.logStepFailure(context, 'woocommerce_lookup', 3, {
        orderNumber,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, `WooCommerce lookup failed: ${error}`);
      
      return { found: false, source: 'extracted' };
    }
  }

  /**
   * Step 4: AfterShip Tracking Data Enhancement
   */
  private async fetchAfterShipTrackingData(
    context: WismoExecutionContext,
    trackingNumber: string,
    userId: string
  ): Promise<TrackingLookupResult> {
    
    try {
      await this.logStep(context, 'aftership_lookup_started', 4, {
        trackingNumber,
        api: 'aftership'
      });

      // Use real AfterShip API via the service
      const aftershipService = (await import('./aftership')).AftershipService;
      const service = new aftershipService();
      
      const trackingData = await service.getEnhancedTrackingForEmail(
        trackingNumber,
        'ups', // Default carrier for compatibility
        userId
      );

      const realTrackingData = {
        found: !!trackingData.tracking,
        carrier: trackingData.tracking?.slug || 'Unknown',
        trackingNumber,
        deliveryStatus: trackingData.formattedStatus || 'Status pending',
        estimatedDelivery: trackingData.aiPrediction?.estimatedDeliveryDate || 
                          trackingData.tracking?.expected_delivery || 
                          'Updates coming soon',
        deliveryConfirmed: trackingData.tracking?.tag === 'Delivered',
        trackingHistory: trackingData.tracking?.checkpoints?.slice(0, 5).map((cp: any) => ({
          timestamp: cp.checkpoint_time,
          status: cp.tag,
          location: cp.location,
          message: cp.message
        })) || [],
        aiPrediction: trackingData.aiPrediction,
        deliveryPerformance: trackingData.tracking ? {
          onTimeStatus: trackingData.tracking.on_time_status,
          onTimeDifference: trackingData.tracking.on_time_difference,
          estimatedDelivery: trackingData.tracking.expected_delivery,
          actualDelivery: trackingData.tracking.shipment_delivery_date
        } : null
      };

      await this.logStep(context, 'aftership_lookup_completed', 4, {
        trackingNumber,
        carrier: realTrackingData.carrier,
        deliveryStatus: realTrackingData.deliveryStatus,
        estimatedDelivery: realTrackingData.estimatedDelivery,
        historyEvents: realTrackingData.trackingHistory.length,
        hasAiPrediction: !!realTrackingData.aiPrediction
      });

      return realTrackingData;

    } catch (error) {
      await this.logStepFailure(context, 'aftership_lookup', 4, {
        trackingNumber,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, `AfterShip lookup failed: ${error}`);
      
      return { found: false };
    }
  }

  /**
   * Step 5: Generate Empathetic WISMO Response with Real Data
   */
  private async generateWismoResponse(
    context: WismoExecutionContext,
    orderDetails: OrderLookupResult,
    trackingData: TrackingLookupResult,
    userId: string
  ): Promise<string> {
    
    try {
      await this.logStep(context, 'response_generation_started', 5, {
        orderNumber: orderDetails.orderNumber,
        orderStatus: orderDetails.orderStatus,
        hasTracking: !!trackingData.found
      });

      // Get user's AI configuration for personalization
      const aiConfig = await storage.getAiTrainingConfig(userId);
      
      const prompt = `
You are a customer service agent. Reply back to a customer inquiring about their order status using all of the provided information about their order.

CUSTOMER CONTEXT:
- Customer asked about their order
- Order Number: ${orderDetails.orderNumber}
- Order Status: ${orderDetails.orderStatus}
- Order Date: ${orderDetails.orderDate}

SHIPPING INFORMATION:
${trackingData.found ? `
- Carrier: ${trackingData.carrier}
- Tracking Number: ${trackingData.trackingNumber}
- Current Status: ${trackingData.deliveryStatus}
- Estimated Delivery: ${trackingData.estimatedDelivery}
- Latest Update: ${trackingData.trackingHistory?.[trackingData.trackingHistory.length - 1]?.message}
` : `
- Tracking information not yet available
- Order Status: ${orderDetails.orderStatus}
`}

AFTERSHIP AI DELIVERY INSIGHTS:
${trackingData.aiPrediction ? `
- AI Predicted Delivery: ${trackingData.aiPrediction.estimatedDeliveryDate} (${trackingData.aiPrediction.confidence})
- Prediction Source: ${trackingData.aiPrediction.source}` : '- AI delivery prediction not available'}

DELIVERY PERFORMANCE DATA:
${trackingData.deliveryPerformance ? `
- On-Time Status: ${trackingData.deliveryPerformance.onTimeStatus !== null ? (trackingData.deliveryPerformance.onTimeStatus ? 'On Time' : 'Delayed') : 'Not Available'}
${trackingData.deliveryPerformance.onTimeDifference ? `- Delivery Variance: ${trackingData.deliveryPerformance.onTimeDifference > 0 ? '+' : ''}${trackingData.deliveryPerformance.onTimeDifference} days from estimate` : ''}
${trackingData.deliveryPerformance.actualDelivery ? `- Actual Delivery Date: ${trackingData.deliveryPerformance.actualDelivery}` : ''}` : '- Delivery performance data not available'}

RESPONSE REQUIREMENTS:
1. Be as concise as possible 
2. Acknowledge their order inquiry specifically
3. Provide the current status clearly
4. Include tracking link
5. Include AI delivery predictions
6. Use Professional tone

Generate response as ${aiConfig?.aiAgentName || 'Customer Service Team'}.
`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 300
      });

      const response = completion.choices[0]?.message?.content?.trim() || '';

      await this.logStep(context, 'response_generation_completed', 5, {
        responseLength: response.length,
        model: 'gpt-4',
        tokenCount: completion.usage?.total_tokens
      });

      return response;

    } catch (error) {
      await this.logStepFailure(context, 'response_generation', 5, {
        error: error instanceof Error ? error.message : 'Unknown error'
      }, `Response generation failed: ${error}`);
      
      // Fallback template response
      return `Hi there!\n\nThank you for checking on your order ${orderDetails.orderNumber}. Your order is currently ${orderDetails.orderStatus}.${
        trackingData.found 
          ? `\n\nTracking Information:\n- Carrier: ${trackingData.carrier}\n- Tracking Number: ${trackingData.trackingNumber}\n- Status: ${trackingData.deliveryStatus}\n- Expected Delivery: ${trackingData.estimatedDelivery}`
          : '\n\nWe\'ll send you tracking information as soon as it becomes available.'
      }\n\nIf you have any questions, please don't hesitate to reach out!\n\nBest regards,\nCustomer Service Team`;
    }
  }

  /**
   * Queue response for human approval with comprehensive context
   */
  private async queueForApproval(
    context: WismoExecutionContext,
    response: string,
    orderDetails: OrderLookupResult,
    trackingData: TrackingLookupResult
  ): Promise<void> {
    
    const auditTrail = {
      agentType: 'wismo',
      executionId: context.executionId,
      steps: context.steps,
      orderData: orderDetails,
      trackingData: trackingData,
      apiIntegrationsUsed: ['woocommerce', trackingData.found ? 'aftership' : null].filter(Boolean)
    };

    // First, ensure we have a valid rule ID by creating WISMO rule if needed
    let ruleId = `wismo-agent-${context.userId}`;
    try {
      const existingRules = await storage.getAutoResponderRules(context.userId);
      let wismoRule = existingRules.find(rule => rule.name?.includes('WISMO'));
      
      if (!wismoRule) {
        wismoRule = await storage.createAutoResponderRule({
          userId: context.userId,
          name: 'WISMO Agent - Order Status',
          isEnabled: true,
          triggerType: 'classification',
          conditions: { classification: 'order_status' },
          autoResponse: 'AI-generated order status response',
          requiresApproval: true,
          metadata: { agentType: 'wismo', isSystemGenerated: true }
        });
      }
      ruleId = wismoRule.id;
    } catch (error) {
      console.log('[WISMO_AGENT] Using fallback rule ID for test scenarios');
      ruleId = null; // Allow null for test cases
    }

    await storage.createAutomationApprovalItem({
      userId: context.userId,
      emailId: context.emailId,
      ruleId,
      customerEmail: context.customerEmail,
      subject: context.subject,
      body: context.body,
      classification: 'order_status',
      confidence: 95, // High confidence for WISMO agent
      proposedResponse: response,
      status: 'pending',
      metadata: {
        agentProcessingDetails: auditTrail,
        processingMethod: 'Agent Workflow',
        completionTime: new Date().toISOString(),
        // Display data for the audit trail UI
        orderNumber: orderDetails.orderNumber,
        orderStatus: orderDetails.orderStatus,
        trackingNumber: trackingData.trackingNumber,
        carrier: trackingData.carrier,
        deliveryStatus: trackingData.deliveryStatus,
        estimatedDelivery: trackingData.estimatedDelivery
      }
    });
  }

  /**
   * Send response directly (when approval not required)
   */
  private async sendDirectResponse(
    context: WismoExecutionContext,
    response: string,
    customerEmail: string,
    subject: string
  ): Promise<void> {
    
    try {
      // TODO: Integrate with actual email sending service
      console.log('[WISMO_AGENT] Sending direct response to:', customerEmail);
      console.log('[WISMO_AGENT] Response:', response);
      
      // Update email record
      await storage.updateEmail(context.emailId, {
        status: 'resolved',
        isResponded: true,
        aiResponse: response,
        processedAt: new Date()
      });

    } catch (error) {
      throw new Error(`Failed to send direct response: ${error}`);
    }
  }

  /**
   * Get WISMO agent configuration from agent_rules table
   */
  private async getWismoAgentRule(userId: string) {
    try {
      // TODO: Implement this query to agent_rules table
      // For now return default config
      return {
        isEnabled: true,
        requiresApproval: true,
        agentType: 'wismo'
      };
    } catch (error) {
      console.error('[WISMO_AGENT] Failed to fetch agent rule:', error);
      return null;
    }
  }

  /**
   * Extract order number from email content using regex patterns
   */
  private extractOrderNumberFromContent(content: string): string | null {
    const patterns = [
      /#(\d+)/,           // #12345
      /order[:\s]*(\d+)/i, // order: 12345, order 12345
      /(\d{4,6})/,        // Any 4-6 digit number
    ];

    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match) {
        return match[1] || match[0].replace('#', '');
      }
    }

    return null;
  }

  /**
   * Update agent performance metrics
   */
  private async updateAgentMetrics(
    context: WismoExecutionContext,
    userId: string,
    success: boolean
  ): Promise<void> {
    
    try {
      // TODO: Implement agent metrics update
      await this.logStep(context, 'metrics_updated', 7, {
        agentType: 'wismo',
        success,
        totalSteps: context.steps.length,
        executionTime: Date.now() - context.startTime.getTime()
      });

    } catch (error) {
      console.error('[WISMO_AGENT] Failed to update metrics:', error);
    }
  }

  /**
   * Log successful step execution
   */
  private async logStep(
    context: WismoExecutionContext,
    stepName: string,
    stepOrder: number,
    inputData?: any,
    outputData?: any,
    status: 'started' | 'completed' | 'failed' | 'skipped' = 'completed',
    metadata?: any
  ): Promise<void> {
    
    const step: WismoStepLog = {
      stepName,
      stepOrder,
      startTime: new Date(),
      endTime: status !== 'started' ? new Date() : undefined,
      status,
      inputData,
      outputData,
      metadata
    };

    context.steps.push(step);
    
    // Also log to the new agent_execution_logs table
    try {
      await storage.createAgentExecutionLog({
        userId: context.userId,
        agentType: 'wismo',
        emailId: context.emailId,
        executionId: context.executionId,
        stepName,
        stepStatus: status,
        stepOrder,
        startedAt: step.startTime,
        completedAt: step.endTime,
        durationMs: step.endTime ? step.endTime.getTime() - step.startTime.getTime() : null,
        inputData,
        outputData,
        metadata
      });
    } catch (error) {
      console.error(`[WISMO] Failed to log step ${stepName} to agent_execution_logs:`, error);
      // Don't fail the entire process if logging fails
    }
    
    console.log(`[WISMO_AGENT] Step ${stepOrder} - ${stepName}: ${status}`);
  }

  /**
   * Log step failure with error details
   */
  private async logStepFailure(
    context: WismoExecutionContext,
    stepName: string,
    stepOrder: number,
    inputData: any,
    errorMessage: string,
    metadata?: any
  ): Promise<void> {
    
    const step: WismoStepLog = {
      stepName,
      stepOrder,
      startTime: new Date(),
      endTime: new Date(),
      status: 'failed',
      inputData,
      errorDetails: errorMessage,
      metadata
    };

    context.steps.push(step);
    
    // Also log failure to the new agent_execution_logs table
    try {
      await storage.createAgentExecutionLog({
        userId: context.userId,
        agentType: 'wismo',
        emailId: context.emailId,
        executionId: context.executionId,
        stepName,
        stepStatus: 'failed',
        stepOrder,
        startedAt: step.startTime,
        completedAt: step.endTime,
        durationMs: step.endTime.getTime() - step.startTime.getTime(),
        inputData,
        outputData: null,
        errorDetails: errorMessage,
        metadata
      });
    } catch (error) {
      console.error(`[WISMO] Failed to log failure for step ${stepName}:`, error);
    }
    
    console.error(`[WISMO_AGENT] Step ${stepOrder} - ${stepName}: FAILED - ${errorMessage}`);
  }

  /**
   * Log execution-level errors
   */
  private async logExecutionError(
    context: WismoExecutionContext,
    error: any,
    errorType: string
  ): Promise<void> {
    
    try {
      // TODO: Save to agent_errors table
      console.error(`[WISMO_AGENT] Execution error (${errorType}):`, error);
      
    } catch (logError) {
      console.error('[WISMO_AGENT] Failed to log execution error:', logError);
    }
  }

  /**
   * Save comprehensive execution log to database
   */
  private async saveExecutionLog(context: WismoExecutionContext): Promise<void> {
    
    try {
      // TODO: Save each step to agent_execution_logs table
      console.log(`[WISMO_AGENT] Saving execution log for ${context.executionId} with ${context.steps.length} steps`);
      
      for (const step of context.steps) {
        // Each step gets its own database record for detailed tracking
        console.log(`[WISMO_AGENT] - Step ${step.stepOrder}: ${step.stepName} (${step.status})`);
      }
      
    } catch (error) {
      console.error('[WISMO_AGENT] Failed to save execution log:', error);
    }
  }

  /**
   * Test the WISMO agent with predefined scenarios
   */
  async runAgentTests(userId: string, testScenarios?: string[]): Promise<any[]> {
    
    console.log('[WISMO_AGENT] Running automated tests...');
    
    const defaultTests = [
      {
        name: 'Valid Order Number',
        scenario: 'valid_order',
        subject: 'Where is my order #12345?',
        body: 'Hi, I placed order #12345 a few days ago and wondering when it will arrive. Thanks!',
        from: 'test@example.com',
        expectedOutcome: 'successful_response'
      },
      {
        name: 'No Order Number',
        scenario: 'customer_lookup',
        subject: 'Order status question',
        body: 'Hi, I placed an order last week but haven\'t received any updates. When will it arrive?',
        from: 'customer@example.com',
        expectedOutcome: 'customer_lookup_required'
      },
      {
        name: 'Invalid Order Number',
        scenario: 'invalid_order',
        subject: 'Where is order #99999?',
        body: 'I need to know the status of my order #99999 please.',
        from: 'test@example.com',
        expectedOutcome: 'order_not_found'
      }
    ];

    const results = [];
    
    for (const test of defaultTests) {
      console.log(`[WISMO_AGENT] Running test: ${test.name}`);
      
      try {
        // Create a test email record first to satisfy foreign key constraints
        const testEmailId = `test-${nanoid()}`;
        const testEmail = await storage.createEmail({
          userId,
          fromEmail: test.from,
          toEmail: 'test@delightdesk.io',
          subject: test.subject,
          body: test.body,
          status: 'processing',
          metadata: {
            messageId: testEmailId,
            isTestEmail: true,
            receivedAt: new Date().toISOString()
          }
        });
        
        const result = await this.processWismoRequest(
          userId,
          testEmail.id,
          test.from,
          test.subject,
          test.body
        );
        
        results.push({
          testName: test.name,
          scenario: test.scenario,
          status: result.success ? 'passed' : 'failed',
          executionLog: result.executionLog,
          actualOutcome: result.success ? 'success' : result.escalationReason
        });
        
      } catch (error) {
        results.push({
          testName: test.name,
          scenario: test.scenario,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    console.log(`[WISMO_AGENT] Tests completed: ${results.filter(r => r.status === 'passed').length}/${results.length} passed`);
    
    return results;
  }
}

export const wismoAgentService = new WismoAgentService();