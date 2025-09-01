import { WooCommerceService, type OrderData, type CustomerAnalytics } from './woocommerce';
// Shopify import removed for MVP focus - see archived-shopify-functionality/
import { storage } from '../storage';
import { aftershipService } from './aftership';

export interface UnifiedOrderData {
  id: string;
  platform: 'woocommerce'; // Shopify removed for MVP
  orderNumber: string;
  status: string;
  customerEmail: string;
  customerName: string;
  total: string;
  dateCreated: string;
  trackingNumber?: string;
  trackingUrl?: string;
  shippingCarrier?: string;
  shippingMethod?: string;
  fulfillmentStatus?: string;
  storeUrl?: string; // Added for platform link generation
  aiPredictedDelivery?: {
    estimatedDate: string;
    confidence: string;
    source: string;
  };
  deliveryStatus?: string; // Enhanced AfterShip status description
  customerActionRequired?: boolean; // True if customer action needed
  customerActionMessage?: string; // Specific message for customer action
  deliveryAttemptFailed?: boolean; // True if delivery attempt failed
  availableForPickup?: boolean; // True if package available for pickup
  deliveryException?: boolean; // True if delivery exception occurred
  deliveryPerformance?: {
    onTimeStatus: boolean | null;
    onTimeDifference?: number | null;
    estimatedDelivery?: string;
    actualDelivery?: string;
  };
  checkpointTimeline?: Array<{
    timestamp: string;
    status: string;
    location?: string;
    message: string;
    carrier: string;
  }>;
  shippingAddress?: {
    firstName: string;
    lastName: string;
    address1: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
  };
  lineItems: Array<{
    name: string;
    quantity: number;
    price: string;
  }>;
}

export class OrderLookupService {
  async searchOrdersByEmail(userId: string, customerEmail: string): Promise<UnifiedOrderData[]> {
    try {
      const storeConnections = await storage.getStoreConnections(userId);
      const results: UnifiedOrderData[] = [];
      
      // Search WooCommerce stores
      for (const connection of storeConnections) {
        if (connection.platform === 'woocommerce' && connection.isActive && connection.apiKey && connection.apiSecret) {
          const wooService = new WooCommerceService({
            storeUrl: connection.storeUrl,
            consumerKey: connection.apiKey,
            consumerSecret: connection.apiSecret,
          });
          
          const orders = await wooService.searchOrderByEmail(customerEmail);
          for (const order of orders) {
            const formattedOrder = this.formatWooCommerceOrder(order);
            // Add store URL for platform link
            const orderWithStore = {
              ...formattedOrder,
              storeUrl: connection.storeUrl
            };
            
            // Enhance with AI delivery prediction
            const enhancedOrder = await this.enhanceOrderWithAIDelivery(orderWithStore, userId);
            results.push(enhancedOrder);
          }
        }
      }

      // Shopify search removed for MVP focus - see archived-shopify-functionality/
      
      // CRITICAL: Log order lookup activity for user visibility
      if (results.length > 0) {
        try {
          await storage.createActivityLog({
            userId,
            action: `Found ${results.length} order(s) by email`,
            type: 'order_lookup',
            executedBy: 'ai',
            customerEmail,
            details: `AI successfully found ${results.length} order(s) for customer email ${customerEmail}. Orders: ${results.map(o => o.orderNumber).join(', ')}`,
            status: 'completed',
            metadata: {
              searchType: 'email_search',
              ordersFound: results.length,
              orderNumbers: results.map(o => o.orderNumber),
              platforms: [...new Set(results.map(r => r.platform))]
            }
          });
        } catch (logError) {
          console.warn('Failed to log order lookup activity:', logError);
        }
      }
      
      return results;
    } catch (error) {
      console.error('Error searching orders by email:', error);
      
      // Log failed lookup attempt
      try {
        await storage.createActivityLog({
          userId,
          action: 'Order lookup failed',
          type: 'order_lookup',
          executedBy: 'ai',
          customerEmail,
          details: `Failed to search orders for customer email ${customerEmail}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          status: 'failed',
          metadata: {
            searchType: 'email_search',
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        });
      } catch (logError) {
        console.warn('Failed to log failed lookup activity:', logError);
      }
      
      return [];
    }
  }

  // Alias method to match auto-responder expectations
  async lookupOrder(orderNumber: string, userId: string): Promise<any> {
    const order = await this.searchOrderByNumber(userId, orderNumber);
    if (!order) {
      return { success: false };
    }

    return {
      success: true,
      status: order.status,
      tracking_code: order.trackingNumber,
      estimated_delivery: order.aiPredictedDelivery?.estimatedDate,
      tracking_url: order.trackingUrl,
      total: order.total,
      date_created: order.dateCreated
    };
  }

  // Alias method for customer search functionality
  async searchOrdersByCustomer(userId: string, customerEmail: string): Promise<UnifiedOrderData[]> {
    return this.searchOrdersByEmail(userId, customerEmail);
  }

  async searchOrderByNumber(userId: string, orderNumber: string): Promise<UnifiedOrderData | null> {
    try {
      const storeConnections = await storage.getStoreConnections(userId);
      
      // Search WooCommerce stores
      for (const connection of storeConnections) {
        if (connection.platform === 'woocommerce' && connection.isActive && connection.apiKey && connection.apiSecret) {
          const wooService = new WooCommerceService({
            storeUrl: connection.storeUrl,
            consumerKey: connection.apiKey,
            consumerSecret: connection.apiSecret,
          });
          
          const order = await wooService.searchOrderByNumber(orderNumber);
          if (order) {
            const formattedOrder = this.formatWooCommerceOrder(order);
            // Add store URL for platform link
            const orderWithStore = {
              ...formattedOrder,
              storeUrl: connection.storeUrl
            };
            
            // Enhance with AI delivery prediction
            const enhancedOrder = await this.enhanceOrderWithAIDelivery(orderWithStore, userId);
            
            // CRITICAL: Log successful order lookup for user visibility
            try {
              await storage.createActivityLog({
                userId,
                action: 'Found order by number',
                type: 'order_lookup',
                executedBy: 'ai',
                customerEmail: enhancedOrder.customerEmail,
                orderNumber: enhancedOrder.orderNumber,
                details: `AI successfully found order ${enhancedOrder.orderNumber} for customer ${enhancedOrder.customerEmail}. Status: ${enhancedOrder.status}`,
                status: 'completed',
                metadata: {
                  searchType: 'order_number_search',
                  platform: enhancedOrder.platform,
                  orderStatus: enhancedOrder.status,
                  hasTracking: !!enhancedOrder.trackingNumber,
                  trackingNumber: enhancedOrder.trackingNumber,
                  fulfillmentStatus: enhancedOrder.fulfillmentStatus
                }
              });
            } catch (logError) {
              console.warn('Failed to log order lookup activity:', logError);
            }
            
            return enhancedOrder;
          }
        }
      }

      // Shopify search removed for MVP focus - see archived-shopify-functionality/

      return null;
    } catch (error) {
      console.error('Order lookup by number error:', error);
      return null;
    }
  }



  async updateOrderTracking(
    userId: string, 
    platform: 'woocommerce',
    orderId: string, 
    trackingNumber: string,
    trackingUrl?: string
  ): Promise<boolean> {
    try {
      const storeConnections = await storage.getStoreConnections(userId);
      
      const connection = storeConnections.find(
        conn => conn.platform === platform && conn.isActive
      );

      if (!connection) {
        throw new Error(`No active ${platform} connection found`);
      }

      if (platform === 'woocommerce' && connection.apiKey && connection.apiSecret) {
        const wooService = new WooCommerceService({
          storeUrl: connection.storeUrl,
          consumerKey: connection.apiKey,
          consumerSecret: connection.apiSecret,
        });
        
        return await wooService.updateOrderTracking(orderId, trackingNumber, trackingUrl);
      }
      // Shopify handling removed for MVP focus

      return false;
    } catch (error) {
      console.error('Order tracking update error:', error);
      return false;
    }
  }

  async lookupRecentOrderByCustomer(customerEmail: string, userId: string): Promise<UnifiedOrderData | null> {
    try {
      const orders = await this.searchOrdersByEmail(userId, customerEmail);
      if (orders.length === 0) return null;
      
      // Sort by date created (most recent first) and return the first one
      orders.sort((a, b) => new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime());
      return orders[0];
    } catch (error) {
      console.error('Failed to lookup recent order by customer:', error);
      return null;
    }
  }

  async processRefund(orderNumber: string, userId: string, amount: number): Promise<{ success: boolean; message: string; refundId?: string }> {
    try {
      const storeConnections = await storage.getStoreConnections(userId);
      
      // Try to process refund through each connected store
      for (const connection of storeConnections) {
        if (connection.platform === 'woocommerce' && connection.isActive && connection.apiKey && connection.apiSecret) {
          const wooService = new WooCommerceService({
            storeUrl: connection.storeUrl,
            consumerKey: connection.apiKey,
            consumerSecret: connection.apiSecret,
          });
          
          try {
            const refundResult = await wooService.processRefund(orderNumber, amount.toString());
            if (refundResult) {
              return { success: true, message: 'Refund processed successfully' };
            }
          } catch (error) {
            console.log(`WooCommerce refund failed for order ${orderNumber}:`, error);
            // Continue to try other stores
          }
        }
        
        // Shopify refund processing removed for MVP focus
      }
      
      return { success: false, message: `Order ${orderNumber} not found in any connected stores` };
    } catch (error: any) {
      console.error('Failed to process refund:', error);
      return { success: false, message: 'Failed to process refund: ' + (error?.message || 'Unknown error') };
    }
  }

  private formatWooCommerceOrder(order: OrderData): UnifiedOrderData {
    return {
      ...order,
      platform: 'woocommerce',
    };
  }

  private async enhanceOrderWithAIDelivery(order: UnifiedOrderData, userId: string): Promise<UnifiedOrderData> {
    // Only enhance if we have a tracking number
    if (!order.trackingNumber) {
      console.log(`[ORDER_ENHANCEMENT] No tracking number for order ${order.orderNumber}, skipping Aftership enhancement`);
      return order;
    }

    try {
      console.log(`🚚 [ORDER_ENHANCEMENT] Fetching AI delivery prediction for tracking: ${order.trackingNumber}, carrier: ${order.shippingCarrier}, userId: ${userId}`);
      
      const trackingData = await aftershipService.getEnhancedTrackingForEmail(
        order.trackingNumber,
        order.shippingCarrier,
        userId
      );
      
      console.log(`[ORDER_ENHANCEMENT] Aftership response received:`, {
        trackingFound: !!trackingData.tracking,
        aiPrediction: !!trackingData.aiPrediction,
        limitExceeded: trackingData.limitExceeded,
        formattedStatus: trackingData.formattedStatus
      });

      // If we got AI prediction data, add it to the order
      if (trackingData.aiPrediction && !trackingData.limitExceeded) {
        order.aiPredictedDelivery = {
          estimatedDate: trackingData.aiPrediction.estimatedDeliveryDate,
          confidence: trackingData.aiPrediction.confidence,
          source: trackingData.aiPrediction.source
        };
        console.log(`✅ AI delivery prediction added: ${trackingData.aiPrediction.estimatedDeliveryDate} (${trackingData.aiPrediction.confidence})`);
      } else if (trackingData.limitExceeded) {
        console.log(`⚠️ AfterShip API limit exceeded for user ${userId}`);
        // Set the credits error message in the order's delivery status
        order.deliveryStatus = trackingData.formattedStatus;
      } else {
        console.log(`ℹ️ No AI prediction available for tracking ${order.trackingNumber}`);
      }

      // Add comprehensive delivery status information
      console.log(`[ORDER_ENHANCEMENT] Checking conditions: trackingData.tracking=${!!trackingData.tracking}, limitExceeded=${trackingData.limitExceeded}, formattedStatus="${trackingData.formattedStatus}"`);
      if (trackingData.tracking && !trackingData.limitExceeded) {
        // Update delivery status with detailed AfterShip information
        console.log(`[ORDER_ENHANCEMENT] Setting deliveryStatus from "${order.deliveryStatus}" to "${trackingData.formattedStatus}"`);
        order.deliveryStatus = trackingData.formattedStatus;
        
        // Check if customer action is required
        if (aftershipService.requiresCustomerAction(trackingData.tracking)) {
          order.customerActionRequired = true;
          order.customerActionMessage = aftershipService.getCustomerActionMessage(trackingData.tracking);
          console.log(`⚠️ Customer action required: ${order.customerActionMessage}`);
        }

        // Add delivery attempt information
        if (trackingData.tracking.tag === 'AttemptFail') {
          order.deliveryAttemptFailed = true;
        }

        // Add pickup information
        if (trackingData.tracking.tag === 'AvailableForPickup') {
          order.availableForPickup = true;
        }

        // Add exception information
        if (trackingData.tracking.tag === 'Exception') {
          order.deliveryException = true;
        }

        // Add delivery performance data only if meaningful data exists
        if (trackingData.tracking.on_time_status !== null || 
            trackingData.tracking.shipment_delivery_date || 
            trackingData.tracking.expected_delivery || 
            trackingData.tracking.latest_estimated_delivery) {
          order.deliveryPerformance = {
            onTimeStatus: trackingData.tracking.on_time_status,
            onTimeDifference: trackingData.tracking.on_time_difference,
            estimatedDelivery: trackingData.tracking.expected_delivery || trackingData.tracking.latest_estimated_delivery,
            actualDelivery: trackingData.tracking.shipment_delivery_date
          };
        }

        // Add checkpoint timeline for customer inquiries
        if (trackingData.tracking.checkpoints && trackingData.tracking.checkpoints.length > 0) {
          order.checkpointTimeline = trackingData.tracking.checkpoints.map((checkpoint: any) => ({
            timestamp: checkpoint.checkpoint_time || checkpoint.created_at,
            status: checkpoint.tag,
            location: checkpoint.location || `${checkpoint.city || ''}, ${checkpoint.state || ''} ${checkpoint.country_name || ''}`.trim(),
            message: checkpoint.message || checkpoint.subtag_message || '',
            carrier: trackingData.tracking.slug.toUpperCase()
          })).reverse(); // Most recent first
        }
      }

      // Update tracking URL if AfterShip provided a better one
      if (trackingData.trackingUrl && !trackingData.limitExceeded) {
        order.trackingUrl = trackingData.trackingUrl;
      }

    } catch (error) {
      console.error(`❌ [ORDER_ENHANCEMENT] Failed to get AI delivery prediction for ${order.trackingNumber}:`, error);
      console.error(`❌ [ORDER_ENHANCEMENT] Error details:`, {
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        orderNumber: order.orderNumber,
        trackingNumber: order.trackingNumber,
        userId: userId
      });
      // Don't fail the entire order lookup if AfterShip fails
    }

    return order;
  }

  async getCustomerAnalytics(customerEmail: string, userId: string): Promise<CustomerAnalytics | null> {
    try {
      const storeConnections = await storage.getStoreConnections(userId);
      
      // Try to get customer analytics from each connected store
      for (const connection of storeConnections) {
        if (connection.platform === 'woocommerce' && connection.isActive && connection.apiKey && connection.apiSecret) {
          const wooService = new WooCommerceService({
            storeUrl: connection.storeUrl,
            consumerKey: connection.apiKey,
            consumerSecret: connection.apiSecret,
          });
          
          try {
            const analytics = await wooService.getCustomerAnalytics(customerEmail);
            if (analytics) {
              console.log(`✅ Found customer analytics for ${customerEmail}`);
              return analytics;
            }
          } catch (error) {
            console.log(`WooCommerce customer analytics failed for ${customerEmail}:`, error);
            // Continue to try other stores
          }
        }
        
        // Shopify customer analytics removed for MVP focus
      }
      
      return null;
    } catch (error: any) {
      console.error('Failed to get customer analytics:', error);
      return null;
    }
  }

  /**
   * Check if a customer is a repeat customer (has more than one order)
   */
  async isRepeatCustomer(customerEmail: string, userId: string): Promise<boolean> {
    try {
      const analytics = await this.getCustomerAnalytics(customerEmail, userId);
      return analytics ? analytics.totalOrders > 1 : false;
    } catch (error) {
      console.error('Failed to check repeat customer status:', error);
      return false;
    }
  }

  // formatShopifyOrder method removed for MVP focus - see archived-shopify-functionality/
}

export const orderLookupService = new OrderLookupService();