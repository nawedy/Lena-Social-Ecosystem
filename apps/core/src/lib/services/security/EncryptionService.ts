import { AES, enc } from 'crypto-js';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export class EncryptionService {
  private readonly KEY_SIZE = 256;
  private readonly ITERATION_COUNT = 100000;

  // Generate a new encryption key
  async generateEncryptionKey(): Promise<CryptoKey> {
    return await crypto.subtle.generateKey(
      {
        name: 'AES-GCM',
        length: this.KEY_SIZE
      },
      true,
      ['encrypt', 'decrypt']
    );
  }

  // Encrypt data with AES-256
  async encryptData(data: any, key: string): Promise<string> {
    try {
      // Convert data to string if it's not already
      const dataString = typeof data === 'string' ? data : JSON.stringify(data);
      
      // Generate a random IV
      const iv = crypto.getRandomValues(new Uint8Array(12));
      
      // Encrypt the data
      const encrypted = AES.encrypt(dataString, key, {
        iv: this.arrayBufferToBase64(iv),
        mode: enc.CBC,
        padding: enc.Pkcs7
      });

      // Combine IV and encrypted data
      return JSON.stringify({
        iv: this.arrayBufferToBase64(iv),
        data: encrypted.toString()
      });
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  // Decrypt data
  async decryptData(encryptedData: string, key: string): Promise<any> {
    try {
      const { iv, data } = JSON.parse(encryptedData);
      
      // Decrypt the data
      const decrypted = AES.decrypt(data, key, {
        iv: this.base64ToArrayBuffer(iv),
        mode: enc.CBC,
        padding: enc.Pkcs7
      });

      const decryptedString = decrypted.toString(enc.Utf8);
      
      // Try to parse as JSON if possible
      try {
        return JSON.parse(decryptedString);
      } catch {
        return decryptedString;
      }
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  // Store encrypted key in user's settings
  async storeEncryptionKey(userId: string, encryptedKey: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('encryption_keys')
        .upsert({
          user_id: userId,
          key_type: 'AES-256',
          encrypted_private_key: encryptedKey,
          key_metadata: {
            algorithm: 'AES-GCM',
            key_size: this.KEY_SIZE,
            created_at: new Date().toISOString()
          }
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error storing encryption key:', error);
      throw new Error('Failed to store encryption key');
    }
  }

  // Retrieve encrypted key from user's settings
  async getEncryptionKey(userId: string): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from('encryption_keys')
        .select('encrypted_private_key')
        .eq('user_id', userId)
        .eq('key_type', 'AES-256')
        .single();

      if (error) throw error;
      return data?.encrypted_private_key || null;
    } catch (error) {
      console.error('Error retrieving encryption key:', error);
      throw new Error('Failed to retrieve encryption key');
    }
  }

  // Helper methods
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    return btoa(String.fromCharCode(...new Uint8Array(buffer)));
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  // Key rotation
  async rotateEncryptionKey(userId: string): Promise<void> {
    try {
      // Generate new key
      const newKey = await this.generateEncryptionKey();
      
      // Get old encrypted data
      const { data: oldData, error: fetchError } = await supabase
        .from('user_security_settings')
        .select('encryption_keys')
        .eq('user_id', userId)
        .single();

      if (fetchError) throw fetchError;

      // Re-encrypt data with new key
      if (oldData?.encryption_keys) {
        const reencryptedData = await this.reencryptData(oldData.encryption_keys, newKey);
        
        // Store new encrypted data
        const { error: updateError } = await supabase
          .from('user_security_settings')
          .update({
            encryption_keys: reencryptedData,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId);

        if (updateError) throw updateError;
      }
    } catch (error) {
      console.error('Error rotating encryption key:', error);
      throw new Error('Failed to rotate encryption key');
    }
  }

  private async reencryptData(data: any, newKey: CryptoKey): Promise<any> {
    // Implementation would decrypt with old key and re-encrypt with new key
    // This is a placeholder that should be implemented based on your specific needs
    return data;
  }
} 