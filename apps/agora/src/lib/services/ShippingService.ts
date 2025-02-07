import { supabase } from '$lib/supabaseClient';

interface ShippingRate {
  carrier: string;
  service: string;
  rate: number;
  currency: string;
  estimatedDays: number;
}

interface TrackingInfo {
  carrier: string;
  trackingNumber: string;
  status: string;
  location?: string;
  timestamp: string;
  details?: string;
}

interface ShippingAddress {
  name: string;
  street: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  phone?: string;
}

export class ShippingService {
  private readonly API_KEY = import.meta.env.VITE_SHIPPING_API_KEY;
  private readonly API_URL = 'https://api.shipping-provider.com/v1';

  private async makeRequest(endpoint: string, method: string = 'GET', data?: any) {
    const response = await fetch(`${this.API_URL}${endpoint}`, {
      method,
      headers: {
        'Authorization': `Bearer ${this.API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: data ? JSON.stringify(data) : undefined
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Shipping API request failed');
    }

    return response.json();
  }

  async getShippingRates(
    fromAddress: ShippingAddress,
    toAddress: ShippingAddress,
    packageDetails: {
      weight: number;
      dimensions: { length: number; width: number; height: number };
      value: number;
    }
  ): Promise<ShippingRate[]> {
    try {
      const response = await this.makeRequest('/rates', 'POST', {
        from: fromAddress,
        to: toAddress,
        package: packageDetails
      });

      return response.rates.map((rate: any) => ({
        carrier: rate.carrier,
        service: rate.service,
        rate: rate.total_charge,
        currency: rate.currency,
        estimatedDays: rate.estimated_days
      }));
    } catch (error) {
      console.error('Failed to get shipping rates:', error);
      throw error;
    }
  }

  async createShipment(
    orderId: string,
    fromAddress: ShippingAddress,
    toAddress: ShippingAddress,
    selectedRate: ShippingRate,
    packageDetails: any
  ) {
    try {
      // Create shipment with carrier
      const shipment = await this.makeRequest('/shipments', 'POST', {
        from: fromAddress,
        to: toAddress,
        service: selectedRate.service,
        carrier: selectedRate.carrier,
        package: packageDetails
      });

      // Update order with shipping information
      const { error } = await supabase
        .from('marketplace_orders')
        .update({
          shipping_carrier: selectedRate.carrier,
          tracking_number: shipment.tracking_number,
          shipping_label_url: shipment.label_url,
          status: 'shipped'
        })
        .eq('id', orderId);

      if (error) throw error;

      return shipment;
    } catch (error) {
      console.error('Failed to create shipment:', error);
      throw error;
    }
  }

  async getTrackingInfo(carrier: string, trackingNumber: string): Promise<TrackingInfo> {
    try {
      const tracking = await this.makeRequest(`/tracking/${carrier}/${trackingNumber}`);

      return {
        carrier: tracking.carrier,
        trackingNumber: tracking.tracking_number,
        status: tracking.status,
        location: tracking.current_location,
        timestamp: tracking.last_update,
        details: tracking.status_details
      };
    } catch (error) {
      console.error('Failed to get tracking info:', error);
      throw error;
    }
  }

  async validateAddress(address: ShippingAddress): Promise<{
    isValid: boolean;
    suggestions?: ShippingAddress[];
  }> {
    try {
      const response = await this.makeRequest('/address/validate', 'POST', { address });
      return {
        isValid: response.is_valid,
        suggestions: response.suggestions
      };
    } catch (error) {
      console.error('Failed to validate address:', error);
      throw error;
    }
  }

  async generateReturnLabel(
    orderId: string,
    fromAddress: ShippingAddress,
    toAddress: ShippingAddress
  ) {
    try {
      const { data: order } = await supabase
        .from('marketplace_orders')
        .select('*')
        .eq('id', orderId)
        .single();

      if (!order) throw new Error('Order not found');

      // Create return shipment
      const returnShipment = await this.makeRequest('/returns', 'POST', {
        from: fromAddress,
        to: toAddress,
        original_tracking_number: order.tracking_number
      });

      // Update order with return shipping information
      const { error } = await supabase
        .from('marketplace_orders')
        .update({
          return_tracking_number: returnShipment.tracking_number,
          return_label_url: returnShipment.label_url,
          status: 'returning'
        })
        .eq('id', orderId);

      if (error) throw error;

      return returnShipment;
    } catch (error) {
      console.error('Failed to generate return label:', error);
      throw error;
    }
  }

  async estimateDeliveryTime(
    fromAddress: ShippingAddress,
    toAddress: ShippingAddress,
    carrier: string,
    service: string
  ): Promise<{ 
    estimatedDays: number;
    guaranteedDate?: string;
  }> {
    try {
      const response = await this.makeRequest('/delivery-estimate', 'POST', {
        from: fromAddress,
        to: toAddress,
        carrier,
        service
      });

      return {
        estimatedDays: response.estimated_days,
        guaranteedDate: response.guaranteed_date
      };
    } catch (error) {
      console.error('Failed to estimate delivery time:', error);
      throw error;
    }
  }

  async getShippingRestrictions(
    fromCountry: string,
    toCountry: string,
    items: Array<{
      category: string;
      description: string;
      value: number;
    }>
  ) {
    try {
      const response = await this.makeRequest('/restrictions', 'POST', {
        from_country: fromCountry,
        to_country: toCountry,
        items
      });

      return {
        isShippingAllowed: response.is_allowed,
        restrictions: response.restrictions,
        requiredDocuments: response.required_documents,
        customsFees: response.estimated_customs_fees
      };
    } catch (error) {
      console.error('Failed to get shipping restrictions:', error);
      throw error;
    }
  }
} 