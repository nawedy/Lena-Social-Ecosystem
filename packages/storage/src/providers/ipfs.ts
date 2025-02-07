import { create } from 'ipfs-http-client';
import { toString as uint8ArrayToString } from 'uint8arrays/to-string';
import type { StorageFile, UploadOptions, UploadResult } from '../types';

export class IpfsProvider {
  private client: any;
  private gateway: string;

  constructor(gateway: string = 'https://ipfs.io/ipfs') {
    this.client = create({
      host: 'ipfs.infura.io',
      port: 5001,
      protocol: 'https'
    });
    this.gateway = gateway;
  }

  async upload(
    file: File | Blob,
    options: UploadOptions = { provider: 'ipfs' }
  ): Promise<UploadResult> {
    try {
      const buffer = await file.arrayBuffer();
      const { onProgress } = options;

      // Add the file to IPFS
      const result = await this.client.add(buffer, {
        progress: (prog: number) => onProgress?.(Math.round((prog / file.size) * 100))
      });

      const url = `${this.gateway}/${result.path}`;
      
      return {
        cid: result.path,
        url,
        size: file.size,
        mimeType: file.type,
        metadata: options.metadata
      };
    } catch (error) {
      throw new Error(`IPFS upload failed: ${error.message}`);
    }
  }

  async uploadDirectory(
    files: File[],
    options: UploadOptions = { provider: 'ipfs' }
  ): Promise<UploadResult[]> {
    try {
      const results: UploadResult[] = [];
      let totalSize = 0;
      files.forEach(file => totalSize += file.size);
      let uploadedSize = 0;

      for (const file of files) {
        const result = await this.upload(file, {
          ...options,
          onProgress: (progress) => {
            const fileProgress = (progress * file.size) / totalSize;
            options.onProgress?.(Math.round((uploadedSize / totalSize * 100) + fileProgress));
          }
        });
        results.push(result);
        uploadedSize += file.size;
      }

      return results;
    } catch (error) {
      throw new Error(`IPFS directory upload failed: ${error.message}`);
    }
  }

  async download(cid: string): Promise<Uint8Array> {
    try {
      const chunks = [];
      for await (const chunk of this.client.cat(cid)) {
        chunks.push(chunk);
      }
      return new Uint8Array(Buffer.concat(chunks));
    } catch (error) {
      throw new Error(`IPFS download failed: ${error.message}`);
    }
  }

  async getFile(cid: string): Promise<StorageFile> {
    try {
      const stat = await this.client.files.stat(`/ipfs/${cid}`);
      
      return {
        cid,
        name: stat.name || cid,
        size: stat.size,
        mimeType: stat.type,
        url: `${this.gateway}/${cid}`,
        createdAt: new Date(stat.ctime),
        updatedAt: new Date(stat.mtime)
      };
    } catch (error) {
      throw new Error(`Failed to get IPFS file info: ${error.message}`);
    }
  }

  async pin(cid: string): Promise<void> {
    try {
      await this.client.pin.add(cid);
    } catch (error) {
      throw new Error(`Failed to pin IPFS file: ${error.message}`);
    }
  }

  async unpin(cid: string): Promise<void> {
    try {
      await this.client.pin.rm(cid);
    } catch (error) {
      throw new Error(`Failed to unpin IPFS file: ${error.message}`);
    }
  }

  async isAvailable(cid: string): Promise<boolean> {
    try {
      const pins = await this.client.pin.ls({ paths: [cid] });
      return pins.length > 0;
    } catch {
      return false;
    }
  }
} 