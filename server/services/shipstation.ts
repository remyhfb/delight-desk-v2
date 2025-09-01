import { z } from 'zod';

// ShipStation API Configuration
const SHIPSTATION_BASE_URL = 'https://ssapi.shipstation.com';

// API Response Schemas
const ShipStationStoreSchema = z.object({
  storeId: z.number(),
  storeName: z.string(),
  marketplaceId: z.number(),
  marketplaceName: z.string(),
  accountName: z.string().optional(),
  email: z.string().optional(),
  integrationUrl: z.string().optional(),
  active: z.boolean(),
});

const ShipStationOrderSchema = z.object({
  orderId: z.number(),
  orderNumber: z.string(),
  orderKey: z.string(),
  orderDate: z.string(),
  createDate: z.string(),
  modifyDate: z.string(),
  paymentDate: z.string().optional(),
  shipByDate: z.string().optional(),
  orderStatus: z.enum(['awaiting_payment', 'awaiting_shipment', 'shipped', 'on_hold', 'cancelled']),
  customerUsername: z.string().optional(),
  customerEmail: z.string().optional(),
  billTo: z.object({
    name: z.string(),
    company: z.string().optional(),
    street1: z.string().optional(),
    street2: z.string().optional(),
    street3: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    postalCode: z.string().optional(),
    country: z.string().optional(),
    phone: z.string().optional(),
    residential: z.boolean().optional(),
  }),
  shipTo: z.object({
    name: z.string(),
    company: z.string().optional(),
    street1: z.string().optional(),
    street2: z.string().optional(),
    street3: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    postalCode: z.string().optional(),
    country: z.string().optional(),
    phone: z.string().optional(),
    residential: z.boolean().optional(),
  }),
  items: z.array(z.object({
    orderItemId: z.number(),
    lineItemKey: z.string().optional(),
    sku: z.string().optional(),
    name: z.string(),
    imageUrl: z.string().optional(),
    weight: z.object({
      value: z.number(),
      units: z.string(),
    }).optional(),
    quantity: z.number(),
    unitPrice: z.number(),
    taxAmount: z.number().optional(),
    shippingAmount: z.number().optional(),
    warehouseLocation: z.string().optional(),
    options: z.array(z.object({
      name: z.string(),
      value: z.string(),
    })).optional(),
    productId: z.number().optional(),
    fulfillmentSku: z.string().optional(),
    adjustment: z.boolean().optional(),
    upc: z.string().optional(),
    createDate: z.string(),
    modifyDate: z.string(),
  })),
  orderTotal: z.number(),
  amountPaid: z.number(),
  taxAmount: z.number(),
  shippingAmount: z.number(),
  customerNotes: z.string().optional(),
  internalNotes: z.string().optional(),
  gift: z.boolean(),
  giftMessage: z.string().optional(),
  paymentMethod: z.string().optional(),
  requestedShippingService: z.string().optional(),
  carrierCode: z.string().optional(),
  serviceCode: z.string().optional(),
  packageCode: z.string().optional(),
  confirmation: z.string().optional(),
  shipDate: z.string().optional(),
  holdUntilDate: z.string().optional(),
  weight: z.object({
    value: z.number(),
    units: z.string(),
  }).optional(),
  dimensions: z.object({
    units: z.string(),
    length: z.number(),
    width: z.number(),
    height: z.number(),
  }).optional(),
  insuranceOptions: z.object({
    provider: z.string().optional(),
    insureShipment: z.boolean(),
    insuredValue: z.number(),
  }).optional(),
  internationalOptions: z.object({
    contents: z.string().optional(),
    customsItems: z.array(z.any()).optional(),
    nonDelivery: z.string().optional(),
  }).optional(),
  advancedOptions: z.object({
    warehouseId: z.number().optional(),
    nonMachinable: z.boolean().optional(),
    saturdayDelivery: z.boolean().optional(),
    containsAlcohol: z.boolean().optional(),
    storeId: z.number().optional(),
    customField1: z.string().optional(),
    customField2: z.string().optional(),
    customField3: z.string().optional(),
    source: z.string().optional(),
    mergedOrSplit: z.boolean().optional(),
    mergedIds: z.array(z.number()).optional(),
    parentId: z.number().optional(),
    billToParty: z.string().optional(),
    billToAccount: z.string().optional(),
    billToPostalCode: z.string().optional(),
    billToCountryCode: z.string().optional(),
  }).optional(),
  tagIds: z.array(z.number()).optional(),
  userId: z.string().optional(),
  externallyFulfilled: z.boolean().optional(),
  externallyFulfilledBy: z.string().optional(),
});

const ShipStationShipmentSchema = z.object({
  shipmentId: z.number(),
  orderId: z.number(),
  orderNumber: z.string(),
  userId: z.string().optional(),
  customerEmail: z.string().optional(),
  orderKey: z.string(),
  createDate: z.string(),
  shipDate: z.string(),
  shipTo: z.object({
    name: z.string(),
    company: z.string().optional(),
    street1: z.string().optional(),
    street2: z.string().optional(),
    street3: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    postalCode: z.string().optional(),
    country: z.string().optional(),
    phone: z.string().optional(),
    residential: z.boolean().optional(),
  }),
  weight: z.object({
    value: z.number(),
    units: z.string(),
  }),
  dimensions: z.object({
    units: z.string(),
    length: z.number(),
    width: z.number(),
    height: z.number(),
  }).optional(),
  carrierCode: z.string(),
  serviceCode: z.string(),
  packageCode: z.string(),
  confirmation: z.string().optional(),
  warehouseId: z.number(),
  voided: z.boolean(),
  voidDate: z.string().optional(),
  trackingNumber: z.string().optional(),
  shippingAmount: z.number(),
  insuranceCost: z.number().optional(),
  trackingUrl: z.string().optional(),
});

type ShipStationStore = z.infer<typeof ShipStationStoreSchema>;
type ShipStationOrder = z.infer<typeof ShipStationOrderSchema>;
type ShipStationShipment = z.infer<typeof ShipStationShipmentSchema>;

interface ShipStationConfig {
  apiKey: string;
  apiSecret: string;
  storeId?: string; // Optional store filter
}

export class ShipStationService {
  private config: ShipStationConfig;
  private baseUrl: string;

  constructor(config: ShipStationConfig) {
    this.config = config;
    this.baseUrl = SHIPSTATION_BASE_URL;
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    
    // Create basic auth header
    const auth = Buffer.from(`${this.config.apiKey}:${this.config.apiSecret}`).toString('base64');
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ShipStation API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return response.json();
  }

  /**
   * Get all stores
   */
  async getStores(): Promise<ShipStationStore[]> {
    const data = await this.makeRequest('/stores');
    return ShipStationStoreSchema.array().parse(data);
  }

  /**
   * Search for orders by order number
   */
  async findOrderByNumber(orderNumber: string): Promise<ShipStationOrder | null> {
    try {
      const data = await this.makeRequest(`/orders?orderNumber=${encodeURIComponent(orderNumber)}`);
      
      if (data.orders && data.orders.length > 0) {
        return ShipStationOrderSchema.parse(data.orders[0]);
      }
      
      return null;
    } catch (error) {
      console.error('Error finding ShipStation order:', error);
      return null;
    }
  }

  /**
   * Get order details by order ID
   */
  async getOrder(orderId: number): Promise<ShipStationOrder | null> {
    try {
      const data = await this.makeRequest(`/orders/${orderId}`);
      return ShipStationOrderSchema.parse(data);
    } catch (error) {
      console.error('Error getting ShipStation order:', error);
      return null;
    }
  }

  /**
   * Get shipments for an order
   */
  async getShipments(orderId: number): Promise<ShipStationShipment[]> {
    try {
      const data = await this.makeRequest(`/shipments?orderId=${orderId}`);
      return ShipStationShipmentSchema.array().parse(data.shipments || []);
    } catch (error) {
      console.error('Error getting ShipStation shipments:', error);
      return [];
    }
  }

  /**
   * Check if an order can be cancelled
   */
  async checkCancellationEligibility(orderNumber: string): Promise<{
    eligible: boolean;
    reason: string;
    order?: ShipStationOrder;
    shipments?: ShipStationShipment[];
  }> {
    try {
      const order = await this.findOrderByNumber(orderNumber);
      
      if (!order) {
        return {
          eligible: false,
          reason: 'Order not found in ShipStation',
        };
      }

      // Check order status
      if (order.orderStatus === 'cancelled') {
        return {
          eligible: false,
          reason: 'Order is already cancelled',
          order,
        };
      }

      if (order.orderStatus === 'shipped') {
        return {
          eligible: false,
          reason: 'Order has already been shipped',
          order,
        };
      }

      // Get shipments to check if any are already in progress
      const shipments = await this.getShipments(order.orderId);
      
      const hasActiveShipments = shipments.some(s => !s.voided && s.trackingNumber);
      if (hasActiveShipments) {
        return {
          eligible: false,
          reason: 'Order has active shipments with tracking numbers',
          order,
          shipments,
        };
      }

      // Order is eligible for cancellation
      return {
        eligible: true,
        reason: 'Order can be cancelled - no active shipments found',
        order,
        shipments,
      };

    } catch (error) {
      return {
        eligible: false,
        reason: `Error checking order status: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Cancel an order
   */
  async cancelOrder(orderId: number): Promise<{
    success: boolean;
    message?: string;
    orderId?: number;
  }> {
    try {
      // ShipStation doesn't have a direct "cancel" endpoint
      // Instead, we mark the order as "on_hold" and update status
      const updateData = {
        orderId: orderId,
        orderStatus: 'on_hold',
        internalNotes: `Order cancelled via DelightDesk AI on ${new Date().toISOString()}`,
      };

      await this.makeRequest(`/orders/${orderId}`, {
        method: 'POST',
        body: JSON.stringify(updateData),
      });

      return {
        success: true,
        message: 'Order successfully put on hold (cancelled)',
        orderId: orderId,
      };

    } catch (error) {
      return {
        success: false,
        message: `Failed to cancel order: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Update shipping address for an order
   */
  async updateShippingAddress(orderId: number, newAddress: {
    name: string;
    company?: string;
    street1: string;
    street2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    phone?: string;
  }): Promise<{
    success: boolean;
    message?: string;
    orderId?: number;
  }> {
    try {
      const updateData = {
        orderId: orderId,
        shipTo: {
          name: newAddress.name,
          company: newAddress.company || '',
          street1: newAddress.street1,
          street2: newAddress.street2 || '',
          street3: '',
          city: newAddress.city,
          state: newAddress.state,
          postalCode: newAddress.postalCode,
          country: newAddress.country,
          phone: newAddress.phone || '',
          residential: true,
        }
      };

      await this.makeRequest(`/orders/${orderId}`, {
        method: 'POST',
        body: JSON.stringify(updateData),
      });

      return {
        success: true,
        message: 'Shipping address updated successfully',
        orderId: orderId,
      };

    } catch (error) {
      return {
        success: false,
        message: `Failed to update shipping address: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Check if an order's address can be updated
   */
  async checkAddressUpdateEligibility(orderNumber: string): Promise<{
    eligible: boolean;
    reason: string;
    order?: ShipStationOrder;
    shipments?: ShipStationShipment[];
  }> {
    try {
      const order = await this.findOrderByNumber(orderNumber);
      
      if (!order) {
        return {
          eligible: false,
          reason: 'Order not found in ShipStation',
        };
      }

      // Check order status
      if (order.orderStatus === 'shipped') {
        return {
          eligible: false,
          reason: 'Order has already been shipped',
          order,
        };
      }

      if (order.orderStatus === 'cancelled') {
        return {
          eligible: false,
          reason: 'Order is cancelled',
          order,
        };
      }

      // Get shipments to check if any are already in progress
      const shipments = await this.getShipments(order.orderId);
      
      const hasActiveShipments = shipments.some(s => !s.voided && s.trackingNumber);
      if (hasActiveShipments) {
        return {
          eligible: false,
          reason: 'Order has active shipments with tracking numbers',
          order,
          shipments,
        };
      }

      // Address can be updated
      return {
        eligible: true,
        reason: 'Order address can be updated - no active shipments found',
        order,
        shipments,
      };

    } catch (error) {
      return {
        eligible: false,
        reason: `Error checking order status: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Health check to verify API credentials and connectivity
   */
  async healthCheck(): Promise<{ isHealthy: boolean; message: string }> {
    try {
      await this.getStores();
      return {
        isHealthy: true,
        message: 'ShipStation API connection successful',
      };
    } catch (error) {
      return {
        isHealthy: false,
        message: `ShipStation API connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}

export type { ShipStationOrder, ShipStationShipment, ShipStationStore, ShipStationConfig };