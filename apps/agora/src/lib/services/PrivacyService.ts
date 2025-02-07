import { ethers } from 'ethers';
import { supabase } from '$lib/supabaseClient';

interface EncryptedData {
  iv: string;
  data: string;
}

interface PrivacySettings {
  useProxyShipping: boolean;
  hideIdentity: boolean;
  useEncryptedCommunication: boolean;
  useZkProofs: boolean;
}

export class PrivacyService {
  private readonly PROXY_SERVICE_URL = import.meta.env.VITE_PROXY_SERVICE_URL;
  private readonly PROXY_SERVICE_KEY = import.meta.env.VITE_PROXY_SERVICE_KEY;

  // Initialize encryption key for the session
  private async getEncryptionKey(): Promise<CryptoKey> {
    return await window.crypto.subtle.generateKey(
      {
        name: 'AES-GCM',
        length: 256
      },
      true,
      ['encrypt', 'decrypt']
    );
  }

  // Encrypt data using AES-GCM
  private async encrypt(data: string, key: CryptoKey): Promise<EncryptedData> {
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encodedData = new TextEncoder().encode(data);

    const encryptedData = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv
      },
      key,
      encodedData
    );

    return {
      iv: Buffer.from(iv).toString('base64'),
      data: Buffer.from(encryptedData).toString('base64')
    };
  }

  // Decrypt data using AES-GCM
  private async decrypt(encryptedData: EncryptedData, key: CryptoKey): Promise<string> {
    const iv = Buffer.from(encryptedData.iv, 'base64');
    const data = Buffer.from(encryptedData.data, 'base64');

    const decryptedData = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv
      },
      key,
      data
    );

    return new TextDecoder().decode(decryptedData);
  }

  // Generate a zero-knowledge proof of funds
  async generateZkProofOfFunds(amount: number, currency: string): Promise<string> {
    try {
      const response = await fetch(`${this.PROXY_SERVICE_URL}/zk/proof`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.PROXY_SERVICE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ amount, currency })
      });

      if (!response.ok) throw new Error('Failed to generate ZK proof');
      const { proof } = await response.json();
      return proof;
    } catch (error) {
      console.error('Failed to generate ZK proof:', error);
      throw error;
    }
  }

  // Create a proxy shipping address
  async createProxyShippingAddress(
    userId: string,
    realAddress: {
      name: string;
      street: string;
      city: string;
      state: string;
      country: string;
      postalCode: string;
    }
  ) {
    try {
      // Encrypt the real address
      const key = await this.getEncryptionKey();
      const encryptedAddress = await this.encrypt(JSON.stringify(realAddress), key);

      // Store encrypted address and encryption key securely
      const { error: storeError } = await supabase
        .from('user_privacy_data')
        .insert({
          user_id: userId,
          encrypted_address: encryptedAddress,
          encryption_key: await crypto.subtle.exportKey('jwk', key)
        });

      if (storeError) throw storeError;

      // Get proxy address from proxy service
      const response = await fetch(`${this.PROXY_SERVICE_URL}/proxy-address`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.PROXY_SERVICE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId })
      });

      if (!response.ok) throw new Error('Failed to create proxy address');
      const { proxyAddress } = await response.json();
      return proxyAddress;
    } catch (error) {
      console.error('Failed to create proxy shipping address:', error);
      throw error;
    }
  }

  // Create an anonymous communication channel
  async createAnonymousChannel(orderId: string): Promise<string> {
    try {
      const response = await fetch(`${this.PROXY_SERVICE_URL}/channels`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.PROXY_SERVICE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ orderId })
      });

      if (!response.ok) throw new Error('Failed to create anonymous channel');
      const { channelId } = await response.json();

      // Update order with channel ID
      const { error } = await supabase
        .from('marketplace_orders')
        .update({ anonymous_channel_id: channelId })
        .eq('id', orderId);

      if (error) throw error;

      return channelId;
    } catch (error) {
      console.error('Failed to create anonymous channel:', error);
      throw error;
    }
  }

  // Send message through anonymous channel
  async sendAnonymousMessage(channelId: string, message: string) {
    try {
      const response = await fetch(`${this.PROXY_SERVICE_URL}/channels/${channelId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.PROXY_SERVICE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message })
      });

      if (!response.ok) throw new Error('Failed to send anonymous message');
      return response.json();
    } catch (error) {
      console.error('Failed to send anonymous message:', error);
      throw error;
    }
  }

  // Get user's privacy settings
  async getPrivacySettings(userId: string): Promise<PrivacySettings> {
    try {
      const { data, error } = await supabase
        .from('user_privacy_settings')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) throw error;

      return {
        useProxyShipping: data.use_proxy_shipping,
        hideIdentity: data.hide_identity,
        useEncryptedCommunication: data.use_encrypted_communication,
        useZkProofs: data.use_zk_proofs
      };
    } catch (error) {
      console.error('Failed to get privacy settings:', error);
      throw error;
    }
  }

  // Update user's privacy settings
  async updatePrivacySettings(userId: string, settings: PrivacySettings) {
    try {
      const { error } = await supabase
        .from('user_privacy_settings')
        .upsert({
          user_id: userId,
          use_proxy_shipping: settings.useProxyShipping,
          hide_identity: settings.hideIdentity,
          use_encrypted_communication: settings.useEncryptedCommunication,
          use_zk_proofs: settings.useZkProofs
        });

      if (error) throw error;
    } catch (error) {
      console.error('Failed to update privacy settings:', error);
      throw error;
    }
  }

  // Generate a stealth address for payments
  async generateStealthAddress(): Promise<{ publicKey: string; privateKey: string }> {
    try {
      const wallet = ethers.Wallet.createRandom();
      return {
        publicKey: wallet.address,
        privateKey: wallet.privateKey
      };
    } catch (error) {
      console.error('Failed to generate stealth address:', error);
      throw error;
    }
  }

  // Create a privacy-preserving order
  async createPrivateOrder(
    orderId: string,
    userId: string,
    settings: PrivacySettings
  ) {
    try {
      let updates: any = {};

      if (settings.useProxyShipping) {
        const { data: address } = await supabase
          .from('user_addresses')
          .select('*')
          .eq('user_id', userId)
          .single();

        const proxyAddress = await this.createProxyShippingAddress(userId, address);
        updates.shipping_address = proxyAddress;
      }

      if (settings.hideIdentity) {
        const stealthAddress = await this.generateStealthAddress();
        updates.payment_address = stealthAddress.publicKey;
        
        // Securely store the private key
        await supabase
          .from('user_private_keys')
          .insert({
            user_id: userId,
            order_id: orderId,
            private_key: stealthAddress.privateKey
          });
      }

      if (settings.useEncryptedCommunication) {
        const channelId = await this.createAnonymousChannel(orderId);
        updates.communication_channel = channelId;
      }

      // Update order with privacy features
      const { error } = await supabase
        .from('marketplace_orders')
        .update(updates)
        .eq('id', orderId);

      if (error) throw error;
    } catch (error) {
      console.error('Failed to create private order:', error);
      throw error;
    }
  }
} 