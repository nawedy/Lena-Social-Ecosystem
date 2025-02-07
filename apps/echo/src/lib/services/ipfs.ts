import { create } from 'ipfs-http-client';
import { Web3Storage } from 'web3.storage';
import { supabase } from '$lib/supabaseClient';

// Types
export interface IPFSConfig {
  gateway: string;
  pinningService: 'web3.storage' | 'pinata' | 'infura';
  encryption: boolean;
}

export interface IPFSUploadResult {
  cid: string;
  url: string;
  size: number;
  encryptionKey?: string;
}

// Configuration
const config: IPFSConfig = {
  gateway: import.meta.env.VITE_IPFS_GATEWAY || 'https://ipfs.io',
  pinningService: 'web3.storage',
  encryption: true
};

// Initialize Web3.Storage client
const web3Storage = new Web3Storage({
  token: import.meta.env.VITE_WEB3_STORAGE_TOKEN || ''
});

// Initialize IPFS client
const ipfs = create({
  host: 'ipfs.infura.io',
  port: 5001,
  protocol: 'https'
});

// Encryption utilities
async function generateEncryptionKey(): Promise<string> {
  const key = await window.crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
  const exported = await window.crypto.subtle.exportKey('raw', key);
  return Buffer.from(exported).toString('hex');
}

async function encryptContent(content: ArrayBuffer, key: string): Promise<ArrayBuffer> {
  const importedKey = await window.crypto.subtle.importKey(
    'raw',
    Buffer.from(key, 'hex'),
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    importedKey,
    content
  );
  const result = new Uint8Array(iv.length + encrypted.byteLength);
  result.set(iv);
  result.set(new Uint8Array(encrypted), iv.length);
  return result;
}

async function decryptContent(encrypted: ArrayBuffer, key: string): Promise<ArrayBuffer> {
  const importedKey = await window.crypto.subtle.importKey(
    'raw',
    Buffer.from(key, 'hex'),
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );
  const iv = encrypted.slice(0, 12);
  const data = encrypted.slice(12);
  return window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    importedKey,
    data
  );
}

// IPFS service
export const ipfsService = {
  // Upload content to IPFS
  async upload(
    content: File | Blob | ArrayBuffer,
    options: { encrypt?: boolean; metadata?: any } = {}
  ): Promise<IPFSUploadResult> {
    try {
      let encryptionKey: string | undefined;
      let data = content;

      // Encrypt content if needed
      if (options.encrypt ?? config.encryption) {
        encryptionKey = await generateEncryptionKey();
        if (content instanceof File || content instanceof Blob) {
          data = await content.arrayBuffer();
        }
        data = await encryptContent(data as ArrayBuffer, encryptionKey);
      }

      // Upload to IPFS using Web3.Storage
      const files = [
        new File(
          [data],
          'content',
          { type: content instanceof File ? content.type : 'application/octet-stream' }
        )
      ];
      const cid = await web3Storage.put(files, {
        name: 'Echo Content',
        maxRetries: 3,
        ...options.metadata
      });

      // Store metadata in Supabase
      const { error } = await supabase.from('ipfs_content').insert({
        ipfs_hash: cid,
        encryption_key: encryptionKey,
        metadata: options.metadata
      });

      if (error) throw error;

      return {
        cid,
        url: `${config.gateway}/ipfs/${cid}`,
        size: files[0].size,
        encryptionKey
      };
    } catch (error) {
      console.error('IPFS upload error:', error);
      throw new Error('Failed to upload content to IPFS');
    }
  },

  // Get content from IPFS
  async get(cid: string, encryptionKey?: string): Promise<ArrayBuffer> {
    try {
      const response = await fetch(`${config.gateway}/ipfs/${cid}`);
      const content = await response.arrayBuffer();

      if (encryptionKey) {
        return decryptContent(content, encryptionKey);
      }

      return content;
    } catch (error) {
      console.error('IPFS get error:', error);
      throw new Error('Failed to get content from IPFS');
    }
  },

  // Pin content to ensure persistence
  async pin(cid: string): Promise<void> {
    try {
      await web3Storage.pin(cid);
    } catch (error) {
      console.error('IPFS pin error:', error);
      throw new Error('Failed to pin content');
    }
  },

  // Unpin content
  async unpin(cid: string): Promise<void> {
    try {
      await web3Storage.unpin(cid);
    } catch (error) {
      console.error('IPFS unpin error:', error);
      throw new Error('Failed to unpin content');
    }
  },

  // Get status of content
  async status(cid: string): Promise<any> {
    try {
      return await web3Storage.status(cid);
    } catch (error) {
      console.error('IPFS status error:', error);
      throw new Error('Failed to get content status');
    }
  }
}; 