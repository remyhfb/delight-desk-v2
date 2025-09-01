import type { Request, Response } from 'express';
import { apiUsageTracker } from './api-usage-tracker';

interface AfterShipAddress {
  country: string;
  state?: string;
  city?: string;
  postal_code?: string;
}

interface AfterShipTracking {
  tracking_number: string;
  slug?: string; // Carrier code, auto-detected if not provided
  order_id?: string;
  origin?: AfterShipAddress;
  destination?: AfterShipAddress;
  title?: string;
  customer_name?: string;
  emails?: string[];
}

interface AfterShipCheckpoint {
  slug: string;
  city?: string;
  created_at: string;
  location?: string;
  country_name?: string;
  message: string;
  country_iso3?: string;
  tag: string;
  subtag?: string;
  subtag_message?: string;
  checkpoint_time: string;
  state?: string;
  zip?: string;
}

interface AfterShipEDD {
  estimated_delivery_date?: string;
  confidence_code?: string;
  source?: 'ai' | 'carrier' | 'promised' | 'custom';
}

interface AfterShipTrackingResponse {
  id: string;
  tracking_number: string;
  slug: string;
  tag: string;
  subtag?: string;
  title?: string;
  checkpoints: AfterShipCheckpoint[];
  expected_delivery?: string;
  shipment_delivery_date?: string;
  aftership_estimated_delivery_date?: AfterShipEDD;
  on_time_status?: boolean;
  on_time_difference?: number;
  customer_name?: string;
  order_id?: string;
  origin_country_iso3?: string;
  destination_country_iso3?: string;
  shipment_package_count?: number;
  shipment_weight?: number;
  shipment_weight_unit?: string;
  signed_by?: string;
  source?: string;
  tag_message?: string;
  tracked_count?: number;
  unique_token?: string;
  checkpoints_updated_at?: string;
  latest_estimated_delivery?: string;
}

interface AfterShipCreateResponse {
  meta: {
    code: number;
  };
  data: {
    tracking: AfterShipTrackingResponse;
  };
}

interface AfterShipGetResponse {
  meta: {
    code: number;
  };
  data: {
    tracking: AfterShipTrackingResponse;
  };
}

export class AfterShipService {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.AFTERSHIP_API_KEY || '';
    this.baseUrl = 'https://api.aftership.com/v4';
    
    if (!this.apiKey) {
      throw new Error('AFTERSHIP_API_KEY environment variable is required');
    }
  }

  private async makeRequest(endpoint: string, method: 'GET' | 'POST' | 'PUT' = 'GET', data?: any) {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers = {
      'as-api-key': this.apiKey,
      'Content-Type': 'application/json',
    };

    const options: RequestInit = {
      method,
      headers,
    };

    if (data && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(data);
    }

    try {
      console.log(`🌐 AfterShip API Request: ${method} ${url}`);
      if (data) {
        console.log(`📤 Request Body:`, JSON.stringify(data, null, 2));
      }
      
      const response = await fetch(url, options);
      
      if (!response.ok) {
        const errorBody = await response.text();
        console.log(`❌ AfterShip API Error Response:`, errorBody);
        throw new Error(`AfterShip API error: ${response.status} ${response.statusText} - ${errorBody}`);
      }

      const responseData = await response.json();
      console.log(`📥 AfterShip API Response:`, JSON.stringify(responseData, null, 2));
      return responseData;
    } catch (error) {
      console.error('AfterShip API request failed:', error);
      throw error;
    }
  }

  async createTracking(trackingData: AfterShipTracking): Promise<AfterShipTrackingResponse> {
    console.log('Creating AfterShip tracking with data:', trackingData);
    
    const payload = {
      tracking: trackingData
    };

    console.log('AfterShip API payload:', JSON.stringify(payload, null, 2));

    const response: AfterShipCreateResponse = await this.makeRequest('/trackings', 'POST', payload);
    return response.data.tracking;
  }

  async getTracking(slug: string, trackingNumber: string): Promise<AfterShipTrackingResponse> {
    const response: AfterShipGetResponse = await this.makeRequest(`/trackings/${slug}/${trackingNumber}`);
    return response.data.tracking;
  }

  async getTrackingById(id: string): Promise<AfterShipTrackingResponse> {
    const response: AfterShipGetResponse = await this.makeRequest(`/trackings/${id}`);
    return response.data.tracking;
  }

  async updateTracking(slug: string, trackingNumber: string, updateData: Partial<AfterShipTracking>): Promise<AfterShipTrackingResponse> {
    const payload = {
      tracking: updateData
    };

    const response: AfterShipCreateResponse = await this.makeRequest(`/trackings/${slug}/${trackingNumber}`, 'PUT', payload);
    return response.data.tracking;
  }

  // Enhanced tracking with AI predictions for email automation
  async getEnhancedTrackingForEmail(trackingNumber: string, carrierSlug?: string, userId?: string): Promise<{
    tracking: AfterShipTrackingResponse;
    aiPrediction?: {
      estimatedDeliveryDate: string;
      confidence: string;
      source: string;
    };
    formattedStatus: string;
    trackingUrl: string;
    limitExceeded?: boolean;
  }> {
    // Check API usage limits for free trial users
    if (userId) {
      const usageCheck = await apiUsageTracker.checkAndTrackUsage(
        userId, 
        'aftership', 
        'getEnhancedTrackingForEmail',
        { trackingNumber, carrierSlug }
      );

      if (!usageCheck.allowed) {
        console.log(`AfterShip API limit exceeded for user ${userId}:`, usageCheck);
        
        // Return a fallback response indicating limit exceeded
        return {
          tracking: {} as AfterShipTrackingResponse,
          formattedStatus: 'You are out of credits. Upgrade your plan to continue to get AI delivery predictions and enhanced shipping data.',
          trackingUrl: '',
          limitExceeded: true
        };
      }
    }

    let tracking: AfterShipTrackingResponse | null = null;

    try {
      // First, try to create the tracking - AfterShip will auto-detect carrier
      try {
        console.log(`Creating/retrieving tracking for ${trackingNumber} (auto-detect carrier)`);
        tracking = await this.createTracking({ 
          tracking_number: trackingNumber
        });
        console.log('Successfully created tracking with auto-detected carrier:', tracking.slug);
        
        // Force an immediate update to get latest tracking data from carrier
        console.log('Forcing immediate tracking update to get latest carrier data...');
        try {
          await this.updateTracking(tracking.slug, trackingNumber, {});
          // Retrieve the updated tracking data
          tracking = await this.getTracking(tracking.slug, trackingNumber);
          console.log('✅ Tracking updated with latest carrier data');
        } catch (updateError) {
          console.log('⚠️ Update failed, continuing with initial tracking data:', updateError);
        }
      } catch (createError: any) {
        // If tracking already exists, extract carrier and tracking number from error
        if (createError.message?.includes('4005') || createError.message?.includes('already exists')) {
          console.log('Tracking already exists, trying to retrieve it');
          
          // Try common carriers for existing tracking
          const carriers = ['usps', 'ups', 'fedex', 'dhl'];
          let found = false;
          
          for (const carrier of carriers) {
            try {
              tracking = await this.getTracking(carrier, trackingNumber);
              console.log(`Found existing tracking with carrier: ${carrier}`);
              found = true;
              break;
            } catch (getError) {
              // Continue trying other carriers
            }
          }
          
          if (!found) {
            throw new Error(`Tracking ${trackingNumber} exists but could not retrieve it`);
          }
        } else {
          throw createError;
        }
      }
    } catch (error) {
      console.error('AfterShip tracking error:', error);
      throw new Error(`Failed to get tracking information: ${error instanceof Error ? error.message : String(error)}`);
    }

    if (!tracking) {
      throw new Error('Failed to retrieve tracking information');
    }

    // Log the full tracking response to debug
    console.log('🔍 Full AfterShip tracking response:', JSON.stringify(tracking, null, 2));
    
    // Detailed analysis of delivery fields
    console.log('📋 DELIVERY DATA ANALYSIS:');
    console.log('  aftership_estimated_delivery_date:', tracking.aftership_estimated_delivery_date);
    console.log('  expected_delivery:', tracking.expected_delivery);
    console.log('  latest_estimated_delivery:', tracking.latest_estimated_delivery);
    console.log('  shipment_delivery_date:', tracking.shipment_delivery_date);
    console.log('  tag:', tracking.tag);
    console.log('  subtag:', tracking.subtag);
    console.log('  on_time_status:', tracking.on_time_status);
    console.log('  on_time_difference:', tracking.on_time_difference);
    
    // Extract delivery information (AI prediction or actual delivery)
    let aiPrediction;
    
    if (tracking.tag === 'Delivered' && tracking.shipment_delivery_date) {
      // Package already delivered - show actual delivery date
      console.log('✅ Package delivered on:', tracking.shipment_delivery_date);
      aiPrediction = {
        estimatedDeliveryDate: tracking.shipment_delivery_date,
        confidence: 'Delivered',
        source: 'actual_delivery'
      };
    } else if (tracking.aftership_estimated_delivery_date) {
      // AI prediction available
      const edd = tracking.aftership_estimated_delivery_date;
      console.log('✅ Found AI prediction:', edd);
      aiPrediction = {
        estimatedDeliveryDate: edd.estimated_delivery_date || '',
        confidence: this.getConfidenceDescription(edd.confidence_code),
        source: 'ai_prediction'
      };
    } else if (tracking.expected_delivery) {
      // Expected delivery available
      console.log('✅ Found expected delivery:', tracking.expected_delivery);
      aiPrediction = {
        estimatedDeliveryDate: tracking.expected_delivery,
        confidence: 'Expected',
        source: 'ai_prediction'
      };
    } else {
      console.log('❌ No delivery information found');
      console.log('Available delivery fields:', {
        aftership_estimated_delivery_date: tracking.aftership_estimated_delivery_date,
        expected_delivery: tracking.expected_delivery,
        shipment_delivery_date: tracking.shipment_delivery_date,
        tag: tracking.tag
      });
    }

    // Format delivery status for email
    const formattedStatus = this.formatDeliveryStatus(tracking);

    // Generate tracking URL
    const trackingUrl = this.generateTrackingUrl(tracking.slug, trackingNumber);

    return {
      tracking,
      aiPrediction,
      formattedStatus,
      trackingUrl
    };
  }



  private detectCarrier(trackingNumber: string): string | null {
    // Enhanced carrier detection based on tracking number format
    if (trackingNumber.match(/^1Z[0-9A-Z]{16}$/)) {
      return 'ups';
    } else if (trackingNumber.match(/^[0-9]{12}$/)) {
      return 'fedex';
    } else if (trackingNumber.match(/^9[0-9]{21,22}$/)) {
      return 'usps'; // USPS format: 9 + 21-22 digits
    } else if (trackingNumber.match(/^[0-9]{20,26}$/)) {
      return 'usps'; // Extended USPS range for various formats
    } else if (trackingNumber.match(/^[0-9]{15}$/)) {
      return 'dhl';
    } else if (trackingNumber.match(/^(TBA|TBX)[0-9A-Z]{9,12}$/)) {
      return 'amazon'; // Amazon tracking
    }
    
    // Default to USPS for long numeric strings (common fallback)
    if (trackingNumber.match(/^[0-9]{18,}$/)) {
      return 'usps';
    }
    
    return null;
  }

  private getConfidenceDescription(confidenceCode?: string): string {
    // Based on AfterShip confidence codes
    switch (confidenceCode) {
      case '10001':
        return 'High Confidence';
      case '10002':
        return 'Medium Confidence';
      case '10003':
        return 'Low Confidence';
      default:
        return 'Estimated';
    }
  }

  private formatDeliveryStatus(tracking: AfterShipTrackingResponse): string {
    console.log(`🔍 formatDeliveryStatus called with:`, {
      tag: tracking.tag,
      subtag: tracking.subtag,
      subtag_message: tracking.subtag_message
    });
    
    // All 9 official AfterShip delivery status tags
    const statusMap: Record<string, string> = {
      'Pending': 'Label Created',
      'InfoReceived': 'Information Received', 
      'InTransit': 'In Transit',
      'OutForDelivery': 'Out for Delivery',
      'AttemptFail': 'Delivery Attempted',
      'Delivered': 'Delivered',
      'AvailableForPickup': 'Available for Pickup',
      'Exception': 'Delivery Exception',
      'Expired': 'Tracking Expired'
    };

    // Handle sub-status for more detailed information
    let statusText = statusMap[tracking.tag] || tracking.tag;
    console.log(`🔍 Initial statusText from tag mapping: "${statusText}"`);
    
    // Add sub-status details for specific cases
    if (tracking.subtag && tracking.subtag_message) {
      const subStatusDetails = this.getSubStatusDetails(tracking.subtag, tracking.subtag_message);
      console.log(`🔍 subStatusDetails returned: "${subStatusDetails}"`);
      if (subStatusDetails) {
        statusText = subStatusDetails;
        console.log(`🔍 Final statusText: "${statusText}"`);
      }
    }

    return statusText;
  }

  private getSubStatusDetails(subtag: string, subtagMessage?: string): string | null {
    console.log(`🔍 getSubStatusDetails called with subtag: "${subtag}", subtagMessage: "${subtagMessage}"`);
    
    // Handle critical sub-statuses that customers need to know about
    const criticalSubStatuses: Record<string, string> = {
      // Delivery sub-statuses
      'Delivered_001': 'Delivered',
      'Delivered_002': 'Picked up by customer',
      'Delivered_003': 'Signed by customer',
      'Delivered_004': 'Delivered (safe place)',
      'Delivered_005': 'Delivered to neighbor',
      'Delivered_006': 'Delivered to receptionist',
      'Delivered_007': 'Left at door',
      'Delivered_008': 'Delivered to mail room',
      'Delivered_009': 'Delivered to security',
      'Delivered_010': 'Delivered (no signature required)',
      
      // Exception sub-statuses (important for customer communication)
      'Exception_001': 'Delivery exception occurred',
      'Exception_002': 'Damaged package',
      'Exception_003': 'Lost package',
      'Exception_004': 'Returned to sender',
      'Exception_005': 'Customs clearance delayed',
      'Exception_006': 'Weather delay',
      'Exception_007': 'Holiday delay',
      'Exception_008': 'Natural disaster delay',
      'Exception_009': 'Incorrect address',
      'Exception_010': 'Business closed',
      'Exception_011': 'Refused by customer',
      'Exception_012': 'Security delay',
      'Exception_013': 'Customs inspection',
      'Exception_014': 'Quarantine delay',
      
      // Attempt fail sub-statuses
      'AttemptFail_001': 'Delivery attempted - no one home',
      'AttemptFail_002': 'Delivery attempted - incorrect address',
      'AttemptFail_003': 'Delivery attempted - business closed',
      'AttemptFail_004': 'Delivery attempted - refused by customer',
      'AttemptFail_005': 'Delivery attempted - signature required',
      'AttemptFail_006': 'Delivery attempted - safe location not available',
      'AttemptFail_007': 'Delivery attempted - customer not available',
      
      // Out for delivery sub-statuses
      'OutForDelivery_001': 'Out for delivery',
      'OutForDelivery_002': 'Loaded on delivery vehicle',
      'OutForDelivery_003': 'On delivery route',
      
      // In transit sub-statuses (key ones)
      'InTransit_001': 'Package accepted',
      'InTransit_002': 'Package picked up',
      'InTransit_003': 'Package in transit',
      'InTransit_004': 'Package processed',
      'InTransit_005': 'Package sorted',
      'InTransit_006': 'Arrival scan',
      'InTransit_007': 'Departure scan',
      'InTransit_008': 'Customs clearance',
      'InTransit_009': 'Package forwarded',
      'InTransit_010': 'Package transferred',
      
      // Available for pickup sub-statuses
      'AvailableForPickup_001': 'Available for pickup',
      'AvailableForPickup_002': 'Pickup reminder sent',
      'AvailableForPickup_003': 'Final pickup notice',
      
      // Info received sub-statuses
      'InfoReceived_001': 'Shipping label created',
      'InfoReceived_002': 'Package information received',
      
      // Pending sub-statuses
      'Pending_001': 'Pending shipment',
      'Pending_002': 'Pre-shipment information',
      
      // Expired sub-statuses
      'Expired_001': 'Tracking expired',
      'Expired_002': 'Package unclaimed'
    };

    return criticalSubStatuses[subtag] || subtagMessage || null;
  }

  private generateTrackingUrl(slug: string, trackingNumber: string): string {
    // Generate carrier-specific tracking URLs
    const carrierUrls: Record<string, string> = {
      'ups': `https://www.ups.com/track?tracknum=${trackingNumber}`,
      'fedex': `https://www.fedex.com/fedextrack/?tracknumbers=${trackingNumber}`,
      'usps': `https://tools.usps.com/go/TrackConfirmAction_input?qtc_tLabels1=${trackingNumber}`,
      'dhl': `https://www.dhl.com/en/express/tracking.html?AWB=${trackingNumber}`,
      'amazon': `https://track.amazon.com/tracking/${trackingNumber}`,
    };

    return carrierUrls[slug] || `https://track.aftership.com/${trackingNumber}`;
  }

  // Helper method to format AI prediction for email templates
  formatAIPredictionForEmail(aiPrediction?: {
    estimatedDeliveryDate: string;
    confidence: string;
    source: string;
  }): string {
    if (!aiPrediction || !aiPrediction.estimatedDeliveryDate) {
      return '';
    }

    const date = new Date(aiPrediction.estimatedDeliveryDate);
    const formattedDate = date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    return `Our AI estimates your package will arrive on ${formattedDate} (${aiPrediction.confidence} prediction based on current shipping patterns and conditions).`;
  }

  // Helper method to determine if a status requires immediate customer attention
  requiresCustomerAction(tracking: AfterShipTrackingResponse): boolean {
    const actionRequiredStates = [
      'AttemptFail',
      'AvailableForPickup', 
      'Exception'
    ];

    const actionRequiredSubtags = [
      'AttemptFail_001', // No one home
      'AttemptFail_002', // Incorrect address  
      'AttemptFail_004', // Refused by customer
      'AttemptFail_005', // Signature required
      'AvailableForPickup_001', // Available for pickup
      'AvailableForPickup_003', // Final pickup notice
      'Exception_002', // Damaged package
      'Exception_003', // Lost package
      'Exception_009', // Incorrect address
      'Exception_011', // Refused by customer
      'Expired_002' // Package unclaimed
    ];

    return actionRequiredStates.includes(tracking.tag) || 
           (tracking.subtag && actionRequiredSubtags.includes(tracking.subtag));
  }

  // Helper method to get customer action message
  getCustomerActionMessage(tracking: AfterShipTrackingResponse): string {
    if (!this.requiresCustomerAction(tracking)) {
      return '';
    }

    const actionMessages: Record<string, string> = {
      'AttemptFail_001': 'Please ensure someone is available to receive your package during the next delivery attempt.',
      'AttemptFail_002': 'Please verify and update your delivery address.',
      'AttemptFail_004': 'Please contact the carrier if you no longer wish to refuse this package.',
      'AttemptFail_005': 'Please ensure someone is available to sign for your package.',
      'AvailableForPickup_001': 'Your package is ready for pickup. Please visit the pickup location with valid ID.',
      'AvailableForPickup_003': 'This is your final pickup notice. Please collect your package to avoid return to sender.',
      'Exception_002': 'Your package may have been damaged during transit. Please contact customer service.',
      'Exception_003': 'Your package appears to be lost. We will investigate and provide an update soon.',
      'Exception_009': 'There is an issue with your delivery address. Please provide the correct address.',
      'Exception_011': 'Your package was refused. Please contact us if this was in error.',
      'Expired_002': 'Your package was not collected and may be returned to sender. Please contact us immediately.'
    };

    if (tracking.subtag && actionMessages[tracking.subtag]) {
      return actionMessages[tracking.subtag];
    }

    // Default messages for main status tags
    switch (tracking.tag) {
      case 'AttemptFail':
        return 'Delivery was attempted but unsuccessful. Please check the tracking details and ensure availability for the next attempt.';
      case 'AvailableForPickup':
        return 'Your package is available for pickup. Please collect it at your earliest convenience.';
      case 'Exception':
        return 'There is an exception with your package delivery. Please check the tracking details or contact customer service.';
      default:
        return 'Your package requires attention. Please check the tracking details.';
    }
  }
}

export const aftershipService = new AfterShipService();