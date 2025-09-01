import { storage } from '../storage';

export interface WooCommerceConfig {
  storeUrl: string;
  consumerKey: string;
  consumerSecret: string;
}

export interface OrderData {
  id: string;
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

export interface CustomerData {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  username?: string;
  dateCreated: string;
  dateModified: string;
  ordersCount: number;
  totalSpent: string;
  avatarUrl?: string;
  billing?: {
    firstName: string;
    lastName: string;
    company?: string;
    address1?: string;
    address2?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
    phone?: string;
  };
  shipping?: {
    firstName: string;
    lastName: string;
    company?: string;
    address1?: string;
    address2?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
}

export interface CustomerAnalytics {
  customer: CustomerData;
  lifetimeValue: number;
  totalOrders: number;
  averageOrderValue: number;
  firstOrderDate: string;
  lastOrderDate: string;
  profileUrl: string;
  recentOrders: OrderData[];
}

export class WooCommerceService {
  private config: WooCommerceConfig;

  constructor(config: WooCommerceConfig) {
    this.config = config;
  }

  // Integration logging method for troubleshooting
  private async logIntegrationEvent(
    action: string,
    status: string,
    data: any,
    endpoint?: string,
    httpMethod?: string,
    statusCode?: number,
    duration?: number,
    error?: Error
  ) {
    try {
      await storage.createIntegrationLog({
        userId: data.userId,
        integration: 'woocommerce',
        action,
        status,
        storeUrl: this.config.storeUrl,
        endpoint,
        httpMethod,
        statusCode,
        requestData: data.requestData ? JSON.stringify(data.requestData) : null,
        responseData: data.responseData ? JSON.stringify(data.responseData) : null,
        errorMessage: error?.message || data.errorMessage,
        errorStack: error?.stack,
        duration,
        metadata: JSON.stringify({
          ...data,
          timestamp: new Date().toISOString(),
          storeUrl: this.config.storeUrl,
          hasConsumerKey: !!this.config.consumerKey,
          hasConsumerSecret: !!this.config.consumerSecret
        })
      });
    } catch (logError) {
      console.error('WooCommerce integration logging failed:', logError);
    }
  }

  async searchOrderByNumber(orderNumber: string, userId?: number): Promise<OrderData | null> {
    const startTime = Date.now();
    
    try {
      console.log('WooCommerce API Request:', {
        storeUrl: this.config.storeUrl,
        hasConsumerKey: !!this.config.consumerKey,
        hasConsumerSecret: !!this.config.consumerSecret,
        orderNumber
      });

      await this.logIntegrationEvent('api_call', 'pending', {
        userId,
        requestData: { orderNumber, action: 'searchOrderByNumber' }
      }, `/wp-json/wc/v3/orders/${orderNumber}`, 'GET');

      // Method 1: Try query parameters (more compatible with some WooCommerce setups)
      const queryUrl = `${this.config.storeUrl}/wp-json/wc/v3/orders/${orderNumber}?consumer_key=${this.config.consumerKey}&consumer_secret=${this.config.consumerSecret}`;
      console.log('Query URL (sanitized):', queryUrl.replace(/consumer_key=.*?&/, 'consumer_key=***&').replace(/consumer_secret=.*$/, 'consumer_secret=***'));
      
      try {
        const directResponse = await fetch(queryUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Delight Desk Customer Service Platform'
          },
        });

        console.log('Direct response status:', directResponse.status);
        
        if (directResponse.ok) {
          const order = await directResponse.json();
          console.log('Found order via direct lookup:', { id: order.id, number: order.number });
          
          await this.logIntegrationEvent('api_call', 'success', {
            userId,
            responseData: { orderId: order.id, orderNumber: order.number, method: 'direct_lookup' }
          }, `/wp-json/wc/v3/orders/${orderNumber}`, 'GET', directResponse.status, Date.now() - startTime);
          
          const orderData = this.formatOrderData(order);
          // Check if this is actually a subscription order by parent_id
          if (order.parent_id && order.parent_id > 0) {
            (orderData as any).isSubscription = true;
          }
          return orderData;
        } else {
          const errorText = await directResponse.text();
          console.log('Direct response error:', directResponse.status, errorText);
        }
      } catch (directError) {
        console.log('Direct request failed:', directError);
        // Order ID not found, try other methods
      }

      // Method 2: Try WooCommerce Subscriptions API
      const auth = Buffer.from(`${this.config.consumerKey}:${this.config.consumerSecret}`).toString('base64');
      
      try {
        const subscriptionResponse = await fetch(`${this.config.storeUrl}/wp-json/wc/v1/subscriptions/${orderNumber}`, {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
        });

        if (subscriptionResponse.ok) {
          const subscription = await subscriptionResponse.json();
          const subscriptionData = this.formatSubscriptionData(subscription);
          // Mark this as a subscription for proper UI handling
          (subscriptionData as any).isSubscription = true;
          return subscriptionData;
        }
      } catch (subscriptionError) {
        // Subscription not found, continue with other methods
      }

      // Method 3: Try search parameter
      const searchResponse = await fetch(`${this.config.storeUrl}/wp-json/wc/v3/orders?search=${orderNumber}`, {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
      });

      if (searchResponse.ok) {
        const orders = await searchResponse.json();
        if (orders.length > 0) {
          const order = orders[0];
          return this.formatOrderData(order);
        }
      }

      // Method 4: Try number parameter (exact match)
      const numberResponse = await fetch(`${this.config.storeUrl}/wp-json/wc/v3/orders?number=${orderNumber}`, {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
      });

      if (numberResponse.ok) {
        const orders = await numberResponse.json();
        if (orders.length > 0) {
          const order = orders[0];
          return this.formatOrderData(order);
        }
      }

      await this.logIntegrationEvent('api_call', 'failed', {
        userId,
        errorMessage: 'Order not found after trying all search methods'
      }, 'multiple_endpoints', 'GET', 404, Date.now() - startTime);

      return null;
    } catch (error) {
      console.error('WooCommerce order search error:', error);
      
      await this.logIntegrationEvent('api_call', 'error', {
        userId,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        requestData: { orderNumber, action: 'searchOrderByNumber' }
      }, 'multiple_endpoints', 'GET', undefined, Date.now() - startTime, error instanceof Error ? error : new Error(String(error)));

      return null;
    }
  }

  async searchOrderByEmail(email: string): Promise<OrderData[]> {
    try {
      const auth = Buffer.from(`${this.config.consumerKey}:${this.config.consumerSecret}`).toString('base64');
      const targetEmail = email.toLowerCase().trim();
      
      console.log('🔍 Starting optimized email search for:', targetEmail);
      console.log('🔍 Store:', this.config.storeUrl);
      
      let allMatchingOrders: any[] = [];
      
      // Strategy 1: Try customer endpoint first (most efficient)
      try {
        const customerUrl = `${this.config.storeUrl}/wp-json/wc/v3/customers?email=${encodeURIComponent(email)}&per_page=100`;
        const customerResponse = await fetch(customerUrl, {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (customerResponse.ok) {
          const customers = await customerResponse.json();
          console.log(`👥 Found ${customers.length} matching customers`);
          
          // Get orders for each customer ID
          for (const customer of customers) {
            if (customer.id) {
              const ordersUrl = `${this.config.storeUrl}/wp-json/wc/v3/orders?customer=${customer.id}&per_page=100&orderby=date&order=desc`;
              const ordersResponse = await fetch(ordersUrl, {
                headers: {
                  'Authorization': `Basic ${auth}`,
                  'Content-Type': 'application/json',
                },
              });
              
              if (ordersResponse.ok) {
                const customerOrders = await ordersResponse.json();
                console.log(`📦 Found ${customerOrders.length} orders for customer ${customer.id}`);
                allMatchingOrders.push(...customerOrders);
              }
            }
          }
          
          if (allMatchingOrders.length > 0) {
            console.log(`✅ Fast customer search found ${allMatchingOrders.length} orders`);
            return allMatchingOrders.map((order: any) => this.formatOrderData(order));
          }
        }
      } catch (customerError) {
        console.log('Customer endpoint failed, falling back to comprehensive search');
      }
      
      // Strategy 2: Use WooCommerce search parameter (faster than full scan)
      try {
        const searchUrl = `${this.config.storeUrl}/wp-json/wc/v3/orders?search=${encodeURIComponent(email)}&per_page=100&orderby=date&order=desc`;
        const searchResponse = await fetch(searchUrl, {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (searchResponse.ok) {
          const searchResults = await searchResponse.json();
          const exactMatches = searchResults.filter((order: any) => {
            const orderEmail = (order.billing?.email || '').toLowerCase().trim();
            return orderEmail === targetEmail;
          });
          
          if (exactMatches.length > 0) {
            console.log(`✅ Search parameter found ${exactMatches.length} exact matches`);
            return exactMatches.map((order: any) => this.formatOrderData(order));
          }
        }
      } catch (searchError) {
        console.log('Search parameter failed, falling back to full scan');
      }
      
      // Strategy 3: Full database scan (last resort)
      console.log('🔄 Performing comprehensive database scan...');
      let page = 1;
      let totalProcessed = 0;
      const perPage = 100;
      
      while (true) {
        const searchUrl = `${this.config.storeUrl}/wp-json/wc/v3/orders?per_page=${perPage}&page=${page}&orderby=date&order=desc`;
        
        const response = await fetch(searchUrl, {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          if (response.status === 404 || response.status === 400) {
            break;
          }
          throw new Error(`WooCommerce API error: ${response.status}`);
        }

        const orders = await response.json();
        
        if (!orders || orders.length === 0) {
          break;
        }
        
        totalProcessed += orders.length;
        
        const pageMatches = orders.filter((order: any) => {
          const orderEmail = (order.billing?.email || '').toLowerCase().trim();
          return orderEmail === targetEmail;
        });
        
        allMatchingOrders.push(...pageMatches);
        
        if (pageMatches.length > 0) {
          console.log(`✅ Page ${page}: Found ${pageMatches.length} matches`);
        }
        
        page++;
        
        if (totalProcessed % 1000 === 0) {
          console.log(`🔄 Scanned ${totalProcessed} orders, found ${allMatchingOrders.length} matches...`);
        }
        
        if (totalProcessed > 50000) {
          console.log('⚠️ Reached 50,000 order limit');
          break;
        }
      }
      
      console.log(`🎯 FINAL RESULT: Found ${allMatchingOrders.length} orders for ${targetEmail} after checking ${totalProcessed} total orders`);
      
      return allMatchingOrders.map((order: any) => this.formatOrderData(order));
      
    } catch (error) {
      console.error('WooCommerce email search error:', error);
      return [];
    }
  }

  async getCustomerSubscriptions(email: string): Promise<any[]> {
    try {
      const auth = Buffer.from(`${this.config.consumerKey}:${this.config.consumerSecret}`).toString('base64');
      
      // Step 1: Look up customer by email
      const customerUrl = `${this.config.storeUrl}/wp-json/wc/v3/customers?email=${encodeURIComponent(email)}&per_page=1`;
      const customerResponse = await fetch(customerUrl, {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!customerResponse.ok) {
        console.log(`No customer found for email: ${email}`);
        return [];
      }
      
      const customers = await customerResponse.json();
      if (!customers || customers.length === 0) {
        console.log(`No customers found for email: ${email}`);
        return [];
      }
      
      const customer = customers[0];
      console.log(`Found customer: ${customer.first_name} ${customer.last_name} (ID: ${customer.id})`);
      
      // Step 2: Get subscriptions for this customer
      const subscriptionsUrl = `${this.config.storeUrl}/wp-json/wc/v1/subscriptions?customer=${customer.id}&per_page=100&orderby=date&order=desc`;
      const subscriptionsResponse = await fetch(subscriptionsUrl, {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!subscriptionsResponse.ok) {
        console.log(`Failed to fetch subscriptions for customer ${customer.id}`);
        return [];
      }
      
      const subscriptions = await subscriptionsResponse.json();
      console.log(`Found ${subscriptions.length} subscriptions for customer ${email}`);
      
      return subscriptions || [];
      
    } catch (error) {
      console.error('Error getting customer subscriptions:', error);
      return [];
    }
  }

  async getCustomerAnalytics(email: string): Promise<CustomerAnalytics | null> {
    try {
      const auth = Buffer.from(`${this.config.consumerKey}:${this.config.consumerSecret}`).toString('base64');
      const targetEmail = email.toLowerCase().trim();
      
      console.log('🔍 Getting customer analytics for:', targetEmail);
      
      // Get customer data
      const customerUrl = `${this.config.storeUrl}/wp-json/wc/v3/customers?email=${encodeURIComponent(email)}&per_page=1`;
      const customerResponse = await fetch(customerUrl, {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!customerResponse.ok) {
        console.log('Customer not found');
        return null;
      }
      
      const customers = await customerResponse.json();
      if (!customers || customers.length === 0) {
        console.log('No customers found for email');
        return null;
      }
      
      const customer = customers[0];
      console.log(`👥 Found customer: ${customer.first_name} ${customer.last_name} (ID: ${customer.id})`);
      
      // Get all orders for this customer
      let allOrders: any[] = [];
      let page = 1;
      const perPage = 100;
      
      while (true) {
        const ordersUrl = `${this.config.storeUrl}/wp-json/wc/v3/orders?customer=${customer.id}&per_page=${perPage}&page=${page}&orderby=date&order=desc`;
        const ordersResponse = await fetch(ordersUrl, {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (!ordersResponse.ok) {
          break;
        }
        
        const orders = await ordersResponse.json();
        if (!orders || orders.length === 0) {
          break;
        }
        
        allOrders.push(...orders);
        
        if (orders.length < perPage) {
          break; // Last page
        }
        
        page++;
      }
      
      console.log(`📦 Found ${allOrders.length} total orders for customer`);
      
      // Calculate analytics
      const completedOrders = allOrders.filter(order => order.status !== 'cancelled' && order.status !== 'failed');
      const lifetimeValue = completedOrders.reduce((sum, order) => sum + parseFloat(order.total || '0'), 0);
      const averageOrderValue = completedOrders.length > 0 ? lifetimeValue / completedOrders.length : 0;
      
      // Get date range
      const orderDates = allOrders.map(order => new Date(order.date_created)).sort((a, b) => a.getTime() - b.getTime());
      const firstOrderDate = orderDates.length > 0 ? orderDates[0].toISOString() : '';
      const lastOrderDate = orderDates.length > 0 ? orderDates[orderDates.length - 1].toISOString() : '';
      
      // Format customer data
      const customerData: CustomerData = {
        id: customer.id,
        email: customer.email,
        firstName: customer.first_name || '',
        lastName: customer.last_name || '',
        username: customer.username,
        dateCreated: customer.date_created,
        dateModified: customer.date_modified,
        ordersCount: customer.orders_count || allOrders.length,
        totalSpent: customer.total_spent || lifetimeValue.toString(),
        avatarUrl: customer.avatar_url,
        billing: customer.billing ? {
          firstName: customer.billing.first_name || '',
          lastName: customer.billing.last_name || '',
          company: customer.billing.company,
          address1: customer.billing.address_1,
          address2: customer.billing.address_2,
          city: customer.billing.city,
          state: customer.billing.state,
          postcode: customer.billing.postcode,
          country: customer.billing.country,
          phone: customer.billing.phone
        } : undefined,
        shipping: customer.shipping ? {
          firstName: customer.shipping.first_name || '',
          lastName: customer.shipping.last_name || '',
          company: customer.shipping.company,
          address1: customer.shipping.address_1,
          address2: customer.shipping.address_2,
          city: customer.shipping.city,
          state: customer.shipping.state,
          postcode: customer.shipping.postcode,
          country: customer.shipping.country
        } : undefined
      };
      
      // Get recent orders (latest 5)
      const recentOrders = allOrders.slice(0, 5).map(order => this.formatOrderData(order));
      
      // Generate profile URL
      const profileUrl = `${this.config.storeUrl}/wp-admin/user-edit.php?user_id=${customer.id}`;
      
      const analytics: CustomerAnalytics = {
        customer: customerData,
        lifetimeValue: Math.round(lifetimeValue * 100) / 100, // Round to 2 decimal places
        totalOrders: allOrders.length,
        averageOrderValue: Math.round(averageOrderValue * 100) / 100,
        firstOrderDate,
        lastOrderDate,
        profileUrl,
        recentOrders
      };
      
      console.log(`📊 Customer analytics: LTV: $${analytics.lifetimeValue}, Orders: ${analytics.totalOrders}, AOV: $${analytics.averageOrderValue}`);
      
      return analytics;
      
    } catch (error) {
      console.error('WooCommerce customer analytics error:', error);
      return null;
    }
  }

  async updateOrderTracking(orderId: string, trackingNumber: string, trackingUrl?: string): Promise<boolean> {
    try {
      const auth = Buffer.from(`${this.config.consumerKey}:${this.config.consumerSecret}`).toString('base64');
      
      const updateData = {
        meta_data: [
          {
            key: '_tracking_number',
            value: trackingNumber,
          },
          ...(trackingUrl ? [{
            key: '_tracking_url',
            value: trackingUrl,
          }] : []),
        ],
      };

      const response = await fetch(`${this.config.storeUrl}/wp-json/wc/v3/orders/${orderId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      return response.ok;
    } catch (error) {
      console.error('WooCommerce tracking update error:', error);
      return false;
    }
  }

  async updateSubscriptionStatus(subscriptionId: string, status: 'active' | 'on-hold' | 'cancelled' | 'pending-cancel'): Promise<boolean> {
    try {
      const auth = Buffer.from(`${this.config.consumerKey}:${this.config.consumerSecret}`).toString('base64');
      
      const updateData = {
        status: status,
      };

      const response = await fetch(`${this.config.storeUrl}/wp-json/wc/v1/subscriptions/${subscriptionId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      return response.ok;
    } catch (error) {
      console.error('WooCommerce subscription update error:', error);
      return false;
    }
  }

  async pauseSubscription(subscriptionId: string): Promise<boolean> {
    return this.updateSubscriptionStatus(subscriptionId, 'on-hold');
  }

  async reactivateSubscription(subscriptionId: string): Promise<boolean> {
    return this.updateSubscriptionStatus(subscriptionId, 'active');
  }

  async cancelSubscription(subscriptionId: string): Promise<boolean> {
    return this.updateSubscriptionStatus(subscriptionId, 'cancelled');
  }

  async updateSubscriptionNextPayment(subscriptionId: string, nextPaymentDate: string): Promise<boolean> {
    try {
      const auth = Buffer.from(`${this.config.consumerKey}:${this.config.consumerSecret}`).toString('base64');
      
      const updateData = {
        next_payment_date: nextPaymentDate,
      };

      const response = await fetch(`${this.config.storeUrl}/wp-json/wc/v1/subscriptions/${subscriptionId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      return response.ok;
    } catch (error) {
      console.error('WooCommerce subscription next payment update error:', error);
      return false;
    }
  }

  private formatSubscriptionData(subscription: any): OrderData {
    // Extract tracking information from meta data (try multiple common field names)
    const trackingNumber = this.extractTrackingNumber(subscription);
    const trackingUrl = this.extractTrackingUrl(subscription, trackingNumber);
    const shippingCarrier = this.extractShippingCarrier(subscription);
    const shippingMethod = subscription.shipping_lines?.[0]?.method_title || null;

    return {
      id: subscription.id.toString(),
      orderNumber: subscription.number || subscription.id.toString(),
      status: subscription.status,
      customerEmail: subscription.billing?.email || '',
      customerName: `${subscription.billing?.first_name || ''} ${subscription.billing?.last_name || ''}`.trim(),
      total: subscription.total || '0.00',
      dateCreated: subscription.date_created,
      trackingNumber,
      trackingUrl,
      shippingCarrier,
      shippingMethod,

      shippingAddress: subscription.shipping ? {
        firstName: subscription.shipping.first_name,
        lastName: subscription.shipping.last_name,
        address1: subscription.shipping.address_1,
        city: subscription.shipping.city,
        state: subscription.shipping.state,
        postcode: subscription.shipping.postcode,
        country: subscription.shipping.country,
      } : undefined,
      lineItems: subscription.line_items?.map((item: any) => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price || item.total,
      })) || [],
    };
  }

  private formatOrderData(order: any): OrderData {
    // Extract tracking information from meta data (try multiple common field names)
    const trackingNumber = this.extractTrackingNumber(order);
    const trackingUrl = this.extractTrackingUrl(order, trackingNumber);
    const shippingCarrier = this.extractShippingCarrier(order);
    const shippingMethod = order.shipping_lines?.[0]?.method_title || null;


    return {
      id: order.id.toString(),
      orderNumber: order.number,
      status: order.status,
      customerEmail: order.billing.email,
      customerName: `${order.billing.first_name} ${order.billing.last_name}`,
      total: order.total,
      dateCreated: order.date_created,
      trackingNumber,
      trackingUrl,
      shippingCarrier,
      shippingMethod,
      shippingAddress: {
        firstName: order.shipping.first_name,
        lastName: order.shipping.last_name,
        address1: order.shipping.address_1,
        city: order.shipping.city,
        state: order.shipping.state,
        postcode: order.shipping.postcode,
        country: order.shipping.country,
      },
      lineItems: order.line_items.map((item: any) => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price,
      })),
    };
  }

  private extractTrackingNumber(order: any): string | undefined {
    const possibleKeys = [
      '_tracking_number',
      '_shipment_tracking_number', 
      '_tracking_code',
      'tracking_number',
      'shipstation_tracking_number',
      '_wc_shipment_tracking_items'
    ];

    // Check meta_data for tracking number
    for (const key of possibleKeys) {
      const meta = order.meta_data?.find((meta: any) => meta.key === key);
      if (meta?.value) {
        // Handle shipment tracking items (array format)
        if (key === '_wc_shipment_tracking_items' && Array.isArray(meta.value)) {
          return meta.value[0]?.tracking_number;
        }
        return meta.value;
      }
    }

    return undefined;
  }

  private extractShippingCarrier(order: any): string | undefined {
    const possibleKeys = [
      '_tracking_provider',
      '_shipment_tracking_provider',
      '_shipping_carrier',
      'tracking_provider',
      'carrier'
    ];

    // Check meta_data for carrier info
    for (const key of possibleKeys) {
      const meta = order.meta_data?.find((meta: any) => meta.key === key);
      if (meta?.value) {
        return meta.value;
      }
    }

    // Check shipment tracking items
    const shipmentItems = order.meta_data?.find((meta: any) => meta.key === '_wc_shipment_tracking_items');
    if (shipmentItems?.value && Array.isArray(shipmentItems.value)) {
      return shipmentItems.value[0]?.tracking_provider;
    }

    // Fallback: try to guess carrier from shipping method
    const shippingMethod = order.shipping_lines?.[0]?.method_title?.toLowerCase();
    if (shippingMethod) {
      if (shippingMethod.includes('ups')) return 'UPS';
      if (shippingMethod.includes('fedex')) return 'FedEx';
      if (shippingMethod.includes('usps') || shippingMethod.includes('postal')) return 'USPS';
      if (shippingMethod.includes('dhl')) return 'DHL';
    }

    return undefined;
  }

  private extractTrackingUrl(order: any, trackingNumber?: string): string | undefined {
    const possibleKeys = [
      '_tracking_url',
      '_shipment_tracking_url',
      'tracking_url'
    ];

    // Check meta_data for tracking URL
    for (const key of possibleKeys) {
      const meta = order.meta_data?.find((meta: any) => meta.key === key);
      if (meta?.value) {
        return meta.value;
      }
    }

    // If we have a tracking number but no URL, generate one based on carrier
    if (trackingNumber) {
      const carrier = this.extractShippingCarrier(order);
      return this.generateTrackingUrl(trackingNumber, carrier);
    }

    return undefined;
  }

  private generateTrackingUrl(trackingNumber: string, carrier?: string): string {
    if (!carrier) {
      // Try to guess carrier from tracking number format
      if (trackingNumber.startsWith('1Z')) {
        carrier = 'UPS';
      } else if (trackingNumber.length === 12 && /^\d+$/.test(trackingNumber)) {
        carrier = 'USPS';
      } else if (trackingNumber.length >= 12) {
        carrier = 'FedEx';
      }
    }

    const carrierLower = carrier?.toLowerCase();
    switch (carrierLower) {
      case 'ups':
        return `https://www.ups.com/track?tracknum=${trackingNumber}`;
      case 'fedex':
        return `https://www.fedex.com/apps/fedextrack/?tracknumber=${trackingNumber}`;
      case 'usps':
        return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${trackingNumber}`;
      case 'dhl':
      case 'dhl-global-mail':
        return `https://www.dhl.com/us-en/home/tracking/tracking-express.html?submit=1&tracking-id=${trackingNumber}`;
      default:
        // Generic Google search fallback
        return `https://www.google.com/search?q=track+package+${encodeURIComponent(trackingNumber)}`;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const auth = Buffer.from(`${this.config.consumerKey}:${this.config.consumerSecret}`).toString('base64');
      
      const response = await fetch(`${this.config.storeUrl}/wp-json/wc/v3/orders?per_page=1`, {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
      });

      return response.ok;
    } catch (error) {
      console.error('WooCommerce connection test failed:', error);
      return false;
    }
  }

  /**
   * Process refund through WooCommerce API
   */
  async updateOrderStatus(orderNumber: string, status: string): Promise<boolean> {
    try {
      const auth = Buffer.from(`${this.config.consumerKey}:${this.config.consumerSecret}`).toString('base64');
      
      const updateData = {
        status: status
      };

      const response = await fetch(`${this.config.storeUrl}/wp-json/wc/v3/orders/${orderNumber}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      if (response.ok) {
        console.log('WooCommerce order status updated:', orderNumber, 'to', status);
        return true;
      } else {
        const errorData = await response.text();
        console.error('WooCommerce order status update failed:', response.status, errorData);
        return false;
      }
    } catch (error) {
      console.error('Error updating WooCommerce order status:', error);
      return false;
    }
  }

  async processRefund(orderId: string, userId?: string): Promise<{ success: boolean; refundId?: string; amount?: number }> {
    try {
      const auth = Buffer.from(`${this.config.consumerKey}:${this.config.consumerSecret}`).toString('base64');
      
      // First get the order to validate and get total amount
      const orderResponse = await fetch(`${this.config.storeUrl}/wp-json/wc/v3/orders/${orderId}`, {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
      });

      if (!orderResponse.ok) {
        console.error('Failed to fetch order for refund:', orderResponse.status);
        return { success: false };
      }

      const order = await orderResponse.json();
      const refundAmount = parseFloat(order.total);

      // Create refund
      const refundData = {
        amount: refundAmount.toString(),
        api_refund: true, // Automatically refund via payment gateway if possible
      };

      const refundResponse = await fetch(`${this.config.storeUrl}/wp-json/wc/v3/orders/${orderId}/refunds`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(refundData),
      });

      if (refundResponse.ok) {
        const refund = await refundResponse.json();
        console.log('WooCommerce refund created:', refund.id, 'Amount:', refund.amount);
        return { 
          success: true, 
          refundId: refund.id?.toString(), 
          amount: parseFloat(refund.amount || refundAmount.toString()) 
        };
      } else {
        const errorData = await refundResponse.text();
        console.error('WooCommerce refund failed:', refundResponse.status, errorData);
        return { success: false };
      }
    } catch (error) {
      console.error('Error processing WooCommerce refund:', error);
      return { success: false };
    }
  }

  /**
   * Get refunds for an order
   */
  async getOrderRefunds(orderId: string): Promise<any[]> {
    try {
      const auth = Buffer.from(`${this.config.consumerKey}:${this.config.consumerSecret}`).toString('base64');
      
      const response = await fetch(`${this.config.storeUrl}/wp-json/wc/v3/orders/${orderId}/refunds`, {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        return await response.json();
      } else {
        console.error('Failed to fetch order refunds:', response.status);
        return [];
      }
    } catch (error) {
      console.error('Error fetching order refunds:', error);
      return [];
    }
  }
}