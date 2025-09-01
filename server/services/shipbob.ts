import { z } from 'zod';

// ShipBob API Configuration
const SHIPBOB_BASE_URL = 'https://api.shipbob.com';
const SHIPBOB_SANDBOX_URL = 'https://sandbox-api.shipbob.com';

// API Response Schemas
const ShipBobChannelSchema = z.object({
  id: z.number(),
  name: z.string(),
  application_id: z.number(),
});

const ShipBobOrderSchema = z.object({
  id: z.number(),
  reference_id: z.string(),
  order_number: z.string().optional(),
  status: z.enum(['Processing', 'Completed', 'On Hold', 'Exception', 'Cancelled']),
  recipient: z.object({
    name: z.string(),
    email: z.string(),
    address: z.object({
      address1: z.string(),
      city: z.string(),
      state: z.string(),
      country: z.string(),
      zip_code: z.string(),
    }),
  }),
  shipments: z.array(z.object({
    id: z.number(),
    status: z.string(),
    tracking: z.string().optional(),
  })).optional(),
});

const ShipBobShipmentSchema = z.object({
  id: z.number(),
  order_id: z.number(),
  reference_id: z.string(),
  status: z.enum(['Processing', 'Completed', 'On Hold', 'Exception', 'Cancelled']),
  tracking: z.string().optional(),
  recipient: z.object({
    name: z.string(),
    email: z.string(),
  }),
  products: z.array(z.object({
    id: z.number(),
    reference_id: z.string(),
    name: z.string(),
    sku: z.string(),
    quantity: z.number(),
  })),
});

type ShipBobChannel = z.infer<typeof ShipBobChannelSchema>;
type ShipBobOrder = z.infer<typeof ShipBobOrderSchema>;
type ShipBobShipment = z.infer<typeof ShipBobShipmentSchema>;

interface ShipBobConfig {
  accessToken: string; // OAuth access token instead of API key
  channelId: string;
  useSandbox?: boolean;
}

export class ShipBobService {
  private config: ShipBobConfig;
  private baseUrl: string;

  constructor(config: ShipBobConfig) {
    this.config = config;
    this.baseUrl = config.useSandbox ? SHIPBOB_SANDBOX_URL : SHIPBOB_BASE_URL;
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers = {
      'Authorization': `Bearer ${this.config.accessToken}`, // OAuth access token
      'shipbob_channel_id': this.config.channelId,
      'Content-Type': 'application/json',
      ...options.headers,
    };

    console.log(`[SHIPBOB] Making request to: ${url}`);
    
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[SHIPBOB] API Error: ${response.status} - ${errorText}`);
      throw new Error(`ShipBob API Error: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  // Get available channels for the authenticated user
  async getChannels(): Promise<ShipBobChannel[]> {
    const response = await this.makeRequest('/1.0/channel');
    return z.array(ShipBobChannelSchema).parse(response);
  }

  // Get order by reference ID (WooCommerce order number)
  async getOrderByReference(referenceId: string): Promise<ShipBobOrder | null> {
    try {
      const response = await this.makeRequest(`/1.0/order?reference_id=${encodeURIComponent(referenceId)}`);
      const orders = z.array(ShipBobOrderSchema).parse(response);
      return orders.length > 0 ? orders[0] : null;
    } catch (error) {
      console.error(`[SHIPBOB] Error fetching order by reference ${referenceId}:`, error);
      return null;
    }
  }

  // Get order by ShipBob internal ID
  async getOrderById(orderId: number): Promise<ShipBobOrder | null> {
    try {
      const response = await this.makeRequest(`/1.0/order/${orderId}`);
      return ShipBobOrderSchema.parse(response);
    } catch (error) {
      console.error(`[SHIPBOB] Error fetching order ${orderId}:`, error);
      return null;
    }
  }

  // Get shipments for an order
  async getShipmentsForOrder(orderId: number): Promise<ShipBobShipment[]> {
    try {
      const response = await this.makeRequest(`/2.0/shipment?order_id=${orderId}`);
      return z.array(ShipBobShipmentSchema).parse(response);
    } catch (error) {
      console.error(`[SHIPBOB] Error fetching shipments for order ${orderId}:`, error);
      return [];
    }
  }

  // Cancel order by ShipBob order ID
  async cancelOrder(orderId: number): Promise<{ success: boolean; message?: string }> {
    try {
      console.log(`[SHIPBOB] Attempting to cancel order ${orderId}`);
      
      // First, get the order to check its current status
      const order = await this.getOrderById(orderId);
      if (!order) {
        return { success: false, message: 'Order not found' };
      }

      if (order.status === 'Cancelled') {
        return { success: true, message: 'Order already cancelled' };
      }

      if (order.status === 'Completed') {
        return { success: false, message: 'Cannot cancel completed order' };
      }

      // Get shipments for this order
      const shipments = await this.getShipmentsForOrder(orderId);
      
      if (shipments.length === 0) {
        return { success: false, message: 'No shipments found for order' };
      }

      // Cancel all shipments that aren't already cancelled or completed
      const cancellationResults = [];
      
      for (const shipment of shipments) {
        if (shipment.status !== 'Cancelled' && shipment.status !== 'Completed') {
          try {
            await this.makeRequest(`/1.0/shipment/${shipment.id}/cancel`, {
              method: 'PUT',
            });
            cancellationResults.push({ shipmentId: shipment.id, success: true });
            console.log(`[SHIPBOB] Successfully cancelled shipment ${shipment.id}`);
          } catch (error) {
            console.error(`[SHIPBOB] Failed to cancel shipment ${shipment.id}:`, error);
            cancellationResults.push({ 
              shipmentId: shipment.id, 
              success: false, 
              error: error instanceof Error ? error.message : 'Unknown error' 
            });
          }
        } else {
          cancellationResults.push({ 
            shipmentId: shipment.id, 
            success: true, 
            message: `Shipment already ${shipment.status.toLowerCase()}` 
          });
        }
      }

      const successCount = cancellationResults.filter(result => result.success).length;
      const totalCount = cancellationResults.length;

      if (successCount === totalCount) {
        return { 
          success: true, 
          message: `Successfully cancelled all ${totalCount} shipments` 
        };
      } else {
        return { 
          success: false, 
          message: `Cancelled ${successCount}/${totalCount} shipments. Some shipments may have already been processed.` 
        };
      }

    } catch (error) {
      console.error(`[SHIPBOB] Error cancelling order ${orderId}:`, error);
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Unknown error occurred' 
      };
    }
  }

  // Cancel specific shipments by ID
  async cancelShipments(shipmentIds: number[]): Promise<{ success: boolean; results: any[] }> {
    const results = [];
    
    for (const shipmentId of shipmentIds) {
      try {
        await this.makeRequest(`/1.0/shipment/${shipmentId}/cancel`, {
          method: 'PUT',
        });
        results.push({ shipmentId, success: true });
        console.log(`[SHIPBOB] Successfully cancelled shipment ${shipmentId}`);
      } catch (error) {
        console.error(`[SHIPBOB] Failed to cancel shipment ${shipmentId}:`, error);
        results.push({ 
          shipmentId, 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    return {
      success: successCount === shipmentIds.length,
      results
    };
  }

  // Check if order is eligible for cancellation
  async checkCancellationEligibility(referenceId: string): Promise<{
    eligible: boolean;
    reason: string;
    order?: ShipBobOrder;
    shipments?: ShipBobShipment[];
  }> {
    try {
      const order = await this.getOrderByReference(referenceId);
      
      if (!order) {
        return {
          eligible: false,
          reason: 'Order not found in ShipBob system'
        };
      }

      if (order.status === 'Cancelled') {
        return {
          eligible: false,
          reason: 'Order already cancelled',
          order
        };
      }

      if (order.status === 'Completed') {
        return {
          eligible: false,
          reason: 'Order has already been shipped and cannot be cancelled',
          order
        };
      }

      const shipments = await this.getShipmentsForOrder(order.id);
      const activeShipments = shipments.filter(s => 
        s.status !== 'Cancelled' && s.status !== 'Completed'
      );

      if (activeShipments.length === 0) {
        return {
          eligible: false,
          reason: 'All shipments have already been processed or cancelled',
          order,
          shipments
        };
      }

      // Check if any shipments are too far in processing
      const processingShipments = activeShipments.filter(s => s.status === 'Processing');
      
      return {
        eligible: true,
        reason: `Order can be cancelled. ${activeShipments.length} shipment(s) will be cancelled.`,
        order,
        shipments: activeShipments
      };

    } catch (error) {
      console.error(`[SHIPBOB] Error checking cancellation eligibility for ${referenceId}:`, error);
      return {
        eligible: false,
        reason: 'Unable to check order status in ShipBob system'
      };
    }
  }

  // Test API connection and permissions
  async testConnection(): Promise<{ success: boolean; message: string; channels?: ShipBobChannel[] }> {
    try {
      const channels = await this.getChannels();
      return {
        success: true,
        message: `Connected successfully. Found ${channels.length} channel(s).`,
        channels
      };
    } catch (error) {
      console.error('[SHIPBOB] Connection test failed:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown connection error'
      };
    }
  }

  // Health check for service availability
  async healthCheck(): Promise<{ isHealthy: boolean; reason?: string }> {
    try {
      // Simple API health check - get channels endpoint is lightweight
      const response = await fetch(`${this.baseUrl}/1.0/channel`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });

      if (!response.ok) {
        if (response.status === 401) {
          return { isHealthy: false, reason: 'ShipBob authentication failed - access token invalid' };
        }
        if (response.status === 403) {
          return { isHealthy: false, reason: 'ShipBob access forbidden - insufficient permissions' };
        }
        return { isHealthy: false, reason: `ShipBob API error: ${response.status} ${response.statusText}` };
      }

      return { isHealthy: true };
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'TimeoutError') {
          return { isHealthy: false, reason: 'ShipBob API timeout - service may be unavailable' };
        }
        return { isHealthy: false, reason: `ShipBob API error: ${error.message}` };
      }
      return { isHealthy: false, reason: 'ShipBob API health check failed' };
    }
  }
}

// Static method to generate OAuth authorization URL
export function getShipBobAuthUrl(redirectUri: string, state?: string): string {
  const clientId = process.env.SHIPBOB_CLIENT_ID;
  if (!clientId) {
    throw new Error('SHIPBOB_CLIENT_ID environment variable not set');
  }
  
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'orders:read orders:write shipments:read', // Adjust scopes as needed
    ...(state && { state })
  });

  return `https://api.shipbob.com/1.0/oauth/authorize?${params.toString()}`;
}

// Factory function to create ShipBob service instance
export async function createShipBobService(config: ShipBobConfig): Promise<ShipBobService> {
  const service = new ShipBobService(config);
  
  // Test connection on creation
  const connectionTest = await service.testConnection();
  if (!connectionTest.success) {
    throw new Error(`ShipBob connection failed: ${connectionTest.message}`);
  }

  console.log(`[SHIPBOB] Service initialized successfully: ${connectionTest.message}`);
  return service;
}

export type { ShipBobConfig, ShipBobOrder, ShipBobShipment, ShipBobChannel };