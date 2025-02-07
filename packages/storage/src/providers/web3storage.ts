import { Web3Storage } from 'web3.storage';
import type { StorageFile, UploadOptions, UploadResult } from '../types';

export class Web3StorageProvider {
  private client: Web3Storage;

  constructor(token: string) {
    this.client = new Web3Storage({ token });
  }

  async upload(
    file: File | Blob,
    options: UploadOptions = { provider: 'web3.storage' }
  ): Promise<UploadResult> {
    try {
      const { onProgress } = options;
      
      // Create a File object if we got a Blob
      const fileToUpload = file instanceof File ? file : new File([file], 'file', { type: file.type });
      
      // Upload file
      const cid = await this.client.put([fileToUpload], {
        onRootCidReady: (localCid) => {
          onProgress?.(10); // Upload starting
        },
        onStoredChunk: (size) => {
          onProgress?.(Math.min(90, Math.round((size / file.size) * 100)));
        }
      });

      const url = `https://${cid}.ipfs.w3s.link/${fileToUpload.name}`;
      
      onProgress?.(100); // Upload complete
      
      return {
        cid,
        url,
        size: file.size,
        mimeType: file.type,
        metadata: options.metadata
      };
    } catch (error) {
      throw new Error(`Web3.Storage upload failed: ${error.message}`);
    }
  }

  async uploadDirectory(
    files: File[],
    options: UploadOptions = { provider: 'web3.storage' }
  ): Promise<UploadResult[]> {
    try {
      const { onProgress } = options;
      let totalSize = 0;
      files.forEach(file => totalSize += file.size);

      // Upload all files together
      const cid = await this.client.put(files, {
        onRootCidReady: (localCid) => {
          onProgress?.(10);
        },
        onStoredChunk: (size) => {
          onProgress?.(Math.min(90, Math.round((size / totalSize) * 100)));
        }
      });

      onProgress?.(100);

      // Create result for each file
      return files.map(file => ({
        cid,
        url: `https://${cid}.ipfs.w3s.link/${file.name}`,
        size: file.size,
        mimeType: file.type,
        metadata: options.metadata
      }));
    } catch (error) {
      throw new Error(`Web3.Storage directory upload failed: ${error.message}`);
    }
  }

  async getFile(cid: string): Promise<StorageFile> {
    try {
      const res = await this.client.get(cid);
      if (!res) throw new Error('File not found');

      const files = await res.files();
      if (files.length === 0) throw new Error('No files found');

      const file = files[0];
      
      return {
        cid,
        name: file.name,
        size: file.size,
        mimeType: file.type || 'application/octet-stream',
        url: `https://${cid}.ipfs.w3s.link/${file.name}`,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    } catch (error) {
      throw new Error(`Failed to get Web3.Storage file info: ${error.message}`);
    }
  }

  async list(options: { before?: string; maxResults?: number } = {}): Promise<StorageFile[]> {
    try {
      const files = [];
      for await (const upload of this.client.list(options)) {
        const file = await this.getFile(upload.cid);
        files.push(file);
      }
      return files;
    } catch (error) {
      throw new Error(`Failed to list Web3.Storage files: ${error.message}`);
    }
  }

  async delete(cid: string): Promise<void> {
    try {
      // Note: Web3.Storage doesn't support deletion, but we can unpin
      await this.client.delete(cid);
    } catch (error) {
      throw new Error(`Failed to delete Web3.Storage file: ${error.message}`);
    }
  }
} 