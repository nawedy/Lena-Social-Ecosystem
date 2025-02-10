import { Web3Storage } from 'web3.storage';
import { EncryptionService } from '../security/EncryptionService';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export class SecureStorageService {
  private web3Storage: Web3Storage;
  private encryptionService: EncryptionService;

  constructor() {
    this.web3Storage = new Web3Storage({ 
      token: import.meta.env.VITE_WEB3_STORAGE_TOKEN 
    });
    this.encryptionService = new EncryptionService();
  }

  // Store encrypted data on IPFS
  async storeEncryptedData(data: any, userId: string): Promise<{ cid: string, encryptionKey: string }> {
    try {
      // Generate encryption key
      const key = await this.encryptionService.generateEncryptionKey();
      const keyString = await crypto.subtle.exportKey('raw', key);
      const keyBase64 = btoa(String.fromCharCode(...new Uint8Array(keyString)));

      // Encrypt the data
      const encryptedData = await this.encryptionService.encryptData(data, keyBase64);

      // Prepare file for IPFS
      const blob = new Blob([encryptedData], { type: 'application/encrypted' });
      const files = [new File([blob], `${Date.now()}.encrypted`)];

      // Upload to IPFS
      const cid = await this.web3Storage.put(files, {
        name: `encrypted-${userId}-${Date.now()}`,
        maxRetries: 3
      });

      // Store encryption key securely
      await this.encryptionService.storeEncryptionKey(userId, keyBase64);

      // Store IPFS reference
      await this.storeIPFSReference(userId, cid, keyBase64);

      return { cid, encryptionKey: keyBase64 };
    } catch (error) {
      console.error('Error storing encrypted data:', error);
      throw new Error('Failed to store encrypted data');
    }
  }

  // Retrieve and decrypt data from IPFS
  async retrieveEncryptedData(cid: string, userId: string): Promise<any> {
    try {
      // Get the encryption key
      const key = await this.encryptionService.getEncryptionKey(userId);
      if (!key) throw new Error('Encryption key not found');

      // Retrieve from IPFS
      const res = await this.web3Storage.get(cid);
      if (!res) throw new Error('Data not found on IPFS');

      const files = await res.files();
      if (!files.length) throw new Error('No files found');

      // Read the encrypted data
      const encryptedData = await files[0].text();

      // Decrypt the data
      return await this.encryptionService.decryptData(encryptedData, key);
    } catch (error) {
      console.error('Error retrieving encrypted data:', error);
      throw new Error('Failed to retrieve encrypted data');
    }
  }

  // Store IPFS reference in database
  private async storeIPFSReference(userId: string, cid: string, keyReference: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('ipfs_storage')
        .insert({
          user_id: userId,
          cid,
          key_reference: keyReference,
          metadata: {
            stored_at: new Date().toISOString(),
            storage_type: 'web3.storage'
          }
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error storing IPFS reference:', error);
      throw new Error('Failed to store IPFS reference');
    }
  }

  // Delete data from IPFS (Note: Data on IPFS is permanent, this just removes our reference)
  async deleteData(cid: string, userId: string): Promise<void> {
    try {
      // Remove database reference
      const { error } = await supabase
        .from('ipfs_storage')
        .delete()
        .match({ user_id: userId, cid });

      if (error) throw error;

      // Note: The data will still exist on IPFS but will eventually be garbage collected
      // if no other nodes are pinning it
    } catch (error) {
      console.error('Error deleting data reference:', error);
      throw new Error('Failed to delete data reference');
    }
  }

  // List all stored files for a user
  async listStoredFiles(userId: string): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('ipfs_storage')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error listing stored files:', error);
      throw new Error('Failed to list stored files');
    }
  }

  // Verify data integrity
  async verifyDataIntegrity(cid: string): Promise<boolean> {
    try {
      const res = await this.web3Storage.get(cid);
      return !!res;
    } catch (error) {
      console.error('Error verifying data integrity:', error);
      return false;
    }
  }
} 