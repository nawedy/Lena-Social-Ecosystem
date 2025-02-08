import { create } from 'ipfs-http-client';
import { Web3Storage } from 'web3.storage';
import { contentEncryption } from '$lib/services/encryption/ContentEncryption';
import { supabase } from '$lib/supabaseClient';

interface StorageConfig {
  ipfs: {
    gateway: string;
    pinningService: 'web3.storage' | 'pinata' | 'infura';
  };
  encryption: {
    enabled: boolean;
    algorithm: 'AES-GCM';
    keySize: 256;
  };
  chunks: {
    maxSize: number; // in bytes
    concurrent: number;
  };
  cache: {
    enabled: boolean;
    maxAge: number; // in seconds
  };
}

interface UploadResult {
  cid: string;
  url: string;
  size: number;
  mimeType: string;
  encryption?: {
    key: string;
    iv: string;
  };
  metadata: Record<string, any>;
}

interface StorageMetadata {
  id: string;
  cid: string;
  name: string;
  size: number;
  mimeType: string;
  encryption: {
    enabled: boolean;
    key?: string;
    iv?: string;
  };
  ipfs: {
    gateway: string;
    pinningService: string;
  };
  metadata: Record<string, any>;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

class StorageService {
  private ipfs: any;
  private web3Storage: Web3Storage;
  private config: StorageConfig = {
    ipfs: {
      gateway: import.meta.env.VITE_IPFS_GATEWAY || 'https://ipfs.io',
      pinningService: 'web3.storage'
    },
    encryption: {
      enabled: true,
      algorithm: 'AES-GCM',
      keySize: 256
    },
    chunks: {
      maxSize: 1024 * 1024 * 50, // 50MB
      concurrent: 3
    },
    cache: {
      enabled: true,
      maxAge: 3600 // 1 hour
    }
  };

  constructor() {
    // Initialize IPFS client
    this.ipfs = create({
      host: 'ipfs.infura.io',
      port: 5001,
      protocol: 'https'
    });

    // Initialize Web3.Storage client
    this.web3Storage = new Web3Storage({
      token: import.meta.env.VITE_WEB3_STORAGE_TOKEN || ''
    });
  }

  async uploadFile(
    file: File,
    options: {
      encrypt?: boolean;
      metadata?: Record<string, any>;
      onProgress?: (progress: number) => void;
    } = {}
  ): Promise<UploadResult> {
    try {
      const { encrypt = this.config.encryption.enabled, metadata = {}, onProgress } = options;

      // Split large files into chunks
      const chunks = await this.splitFileIntoChunks(file);

      // Process chunks
      const processedChunks = await Promise.all(
        chunks.map(async (chunk, index) => {
          // Encrypt chunk if needed
          let processedChunk = chunk;
          let encryptionData;

          if (encrypt) {
            const recipientKeys = await this.getRecipientKeys();
            const encrypted = await contentEncryption.encryptFile(
              new File([chunk], file.name),
              recipientKeys
            );
            processedChunk = await encrypted.encryptedFile.arrayBuffer();
            encryptionData = {
              key: encrypted.encryptedKey,
              iv: encrypted.iv
            };
          }

          // Upload chunk to IPFS
          const cid = await this.uploadToIPFS(processedChunk);

          // Report progress
          if (onProgress) {
            onProgress((index + 1) / chunks.length * 100);
          }

          return {
            cid,
            encryptionData
          };
        })
      );

      // Combine chunk metadata
      const result: UploadResult = {
        cid: processedChunks[0].cid, // Use first chunk's CID as main reference
        url: `${this.config.ipfs.gateway}/ipfs/${processedChunks[0].cid}`,
        size: file.size,
        mimeType: file.type,
        metadata: {
          ...metadata,
          originalName: file.name,
          chunks: processedChunks.map(chunk => chunk.cid),
          totalChunks: chunks.length
        }
      };

      // Add encryption data if encrypted
      if (encrypt && processedChunks[0].encryptionData) {
        result.encryption = processedChunks[0].encryptionData;
      }

      // Store metadata
      await this.storeMetadata({
        id: crypto.randomUUID(),
        ...result,
        encryption: {
          enabled: encrypt,
          key: result.encryption?.key,
          iv: result.encryption?.iv
        },
        ipfs: {
          gateway: this.config.ipfs.gateway,
          pinningService: this.config.ipfs.pinningService
        },
        userId: (await supabase.auth.getUser()).data.user?.id || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      return result;
    } catch (error) {
      console.error('Error uploading file:', error);
      throw new Error('Failed to upload file');
    }
  }

  async downloadFile(
    cid: string,
    options: {
      decrypt?: boolean;
      filename?: string;
      onProgress?: (progress: number) => void;
    } = {}
  ): Promise<Blob> {
    try {
      const { decrypt = this.config.encryption.enabled, filename, onProgress } = options;

      // Get metadata
      const metadata = await this.getMetadata(cid);
      if (!metadata) {
        throw new Error('File metadata not found');
      }

      // Download chunks
      const chunks = await Promise.all(
        metadata.metadata.chunks.map(async (chunkCid: string, index: number) => {
          // Download chunk
          const chunk = await this.downloadFromIPFS(chunkCid);

          // Report progress
          if (onProgress) {
            onProgress((index + 1) / metadata.metadata.totalChunks * 100);
          }

          return chunk;
        })
      );

      // Combine chunks
      const combinedData = new Blob(chunks, { type: metadata.mimeType });

      // Decrypt if needed
      if (decrypt && metadata.encryption.enabled) {
        const { key, iv } = metadata.encryption;
        if (!key || !iv) {
          throw new Error('Encryption data missing');
        }

        const privateKey = await this.getUserPrivateKey();
        return await contentEncryption.decryptFile(
          combinedData,
          key,
          iv,
          privateKey
        );
      }

      return combinedData;
    } catch (error) {
      console.error('Error downloading file:', error);
      throw new Error('Failed to download file');
    }
  }

  async deleteFile(cid: string): Promise<void> {
    try {
      // Get metadata
      const metadata = await this.getMetadata(cid);
      if (!metadata) {
        throw new Error('File metadata not found');
      }

      // Unpin all chunks
      await Promise.all(
        metadata.metadata.chunks.map(async (chunkCid: string) => {
          await this.unpinFromIPFS(chunkCid);
        })
      );

      // Delete metadata
      await this.deleteMetadata(cid);
    } catch (error) {
      console.error('Error deleting file:', error);
      throw new Error('Failed to delete file');
    }
  }

  private async splitFileIntoChunks(file: File): Promise<ArrayBuffer[]> {
    const chunks: ArrayBuffer[] = [];
    const chunkSize = this.config.chunks.maxSize;
    const totalChunks = Math.ceil(file.size / chunkSize);

    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, file.size);
      const chunk = await file.slice(start, end).arrayBuffer();
      chunks.push(chunk);
    }

    return chunks;
  }

  private async uploadToIPFS(data: ArrayBuffer): Promise<string> {
    try {
      const file = new File([data], 'chunk', { type: 'application/octet-stream' });
      const cid = await this.web3Storage.put([file], {
        name: 'chunk',
        maxRetries: 3
      });
      return cid;
    } catch (error) {
      console.error('Error uploading to IPFS:', error);
      throw new Error('Failed to upload to IPFS');
    }
  }

  private async downloadFromIPFS(cid: string): Promise<ArrayBuffer> {
    try {
      const res = await this.web3Storage.get(cid);
      if (!res?.ok) {
        throw new Error('Failed to download from IPFS');
      }

      const files = await res.files();
      return await files[0].arrayBuffer();
    } catch (error) {
      console.error('Error downloading from IPFS:', error);
      throw new Error('Failed to download from IPFS');
    }
  }

  private async unpinFromIPFS(cid: string): Promise<void> {
    try {
      await this.web3Storage.delete(cid);
    } catch (error) {
      console.error('Error unpinning from IPFS:', error);
      throw new Error('Failed to unpin from IPFS');
    }
  }

  private async storeMetadata(metadata: StorageMetadata): Promise<void> {
    const { error } = await supabase
      .from('storage_metadata')
      .insert(metadata);

    if (error) {
      throw error;
    }
  }

  private async getMetadata(cid: string): Promise<StorageMetadata | null> {
    const { data, error } = await supabase
      .from('storage_metadata')
      .select('*')
      .eq('cid', cid)
      .single();

    if (error) {
      return null;
    }

    return data;
  }

  private async deleteMetadata(cid: string): Promise<void> {
    const { error } = await supabase
      .from('storage_metadata')
      .delete()
      .eq('cid', cid);

    if (error) {
      throw error;
    }
  }

  private async getRecipientKeys(): Promise<JsonWebKey[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const publicKey = await contentEncryption.getUserPublicKey(user.id);
    return [publicKey];
  }

  private async getUserPrivateKey(): Promise<JsonWebKey> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    return await contentEncryption.getUserPrivateKey(user.id);
  }
}

export const storage = new StorageService(); 