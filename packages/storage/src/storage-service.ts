import { IpfsProvider } from './providers/ipfs';
import { Web3StorageProvider } from './providers/web3storage';
import imageCompression from 'browser-image-compression';
import type {
  StorageConfig,
  StorageProvider,
  StorageFile,
  UploadOptions,
  UploadResult,
  StorageEventType,
  StorageEventPayload
} from './types';

export class StorageService {
  private ipfsProvider?: IpfsProvider;
  private web3StorageProvider?: Web3StorageProvider;
  private eventListeners: Map<StorageEventType, Set<(payload: StorageEventPayload) => void>> = new Map();

  constructor(config: StorageConfig) {
    if (config.ipfsGateway) {
      this.ipfsProvider = new IpfsProvider(config.ipfsGateway);
    }

    if (config.web3StorageToken) {
      this.web3StorageProvider = new Web3StorageProvider(config.web3StorageToken);
    }
  }

  async upload(
    file: File | Blob,
    options: UploadOptions
  ): Promise<UploadResult> {
    try {
      this.emitEvent('UPLOAD_STARTED', { file: { name: file.name, size: file.size } as StorageFile });

      let processedFile = file;

      // Handle compression if needed
      if (options.compress && file.type.startsWith('image/')) {
        processedFile = await imageCompression(file as File, {
          maxSizeMB: 1,
          maxWidthOrHeight: 1920,
          useWebWorker: true
        });
      }

      let result: UploadResult;

      switch (options.provider) {
        case 'ipfs':
          if (!this.ipfsProvider) {
            throw new Error('IPFS provider not configured');
          }
          result = await this.ipfsProvider.upload(processedFile, {
            ...options,
            onProgress: (progress) => {
              this.emitEvent('UPLOAD_PROGRESS', { progress });
              options.onProgress?.(progress);
            }
          });
          break;

        case 'web3.storage':
          if (!this.web3StorageProvider) {
            throw new Error('Web3.Storage provider not configured');
          }
          result = await this.web3StorageProvider.upload(processedFile, {
            ...options,
            onProgress: (progress) => {
              this.emitEvent('UPLOAD_PROGRESS', { progress });
              options.onProgress?.(progress);
            }
          });
          break;

        default:
          throw new Error(`Unsupported storage provider: ${options.provider}`);
      }

      this.emitEvent('UPLOAD_COMPLETED', {
        file: {
          ...result,
          name: file.name,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      return result;
    } catch (error) {
      this.emitEvent('UPLOAD_FAILED', { error });
      throw error;
    }
  }

  async uploadDirectory(
    files: File[],
    options: UploadOptions
  ): Promise<UploadResult[]> {
    try {
      const provider = this.getProvider(options.provider);
      const results = await provider.uploadDirectory(files, {
        ...options,
        onProgress: (progress) => {
          this.emitEvent('UPLOAD_PROGRESS', { progress });
          options.onProgress?.(progress);
        }
      });

      this.emitEvent('UPLOAD_COMPLETED', {
        file: {
          ...results[0],
          name: 'directory',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      return results;
    } catch (error) {
      this.emitEvent('UPLOAD_FAILED', { error });
      throw error;
    }
  }

  async getFile(cid: string, provider: StorageProvider): Promise<StorageFile> {
    try {
      return await this.getProvider(provider).getFile(cid);
    } catch (error) {
      throw new Error(`Failed to get file info: ${error.message}`);
    }
  }

  async listFiles(provider: StorageProvider, options: { before?: string; maxResults?: number } = {}): Promise<StorageFile[]> {
    try {
      if (provider === 'web3.storage' && this.web3StorageProvider) {
        return await this.web3StorageProvider.list(options);
      }
      throw new Error(`Listing files not supported for provider: ${provider}`);
    } catch (error) {
      throw new Error(`Failed to list files: ${error.message}`);
    }
  }

  async deleteFile(cid: string, provider: StorageProvider): Promise<void> {
    try {
      if (provider === 'web3.storage' && this.web3StorageProvider) {
        await this.web3StorageProvider.delete(cid);
      } else if (provider === 'ipfs' && this.ipfsProvider) {
        await this.ipfsProvider.unpin(cid);
      } else {
        throw new Error(`Deletion not supported for provider: ${provider}`);
      }
    } catch (error) {
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  }

  onStorageEvent(type: StorageEventType, callback: (payload: StorageEventPayload) => void): () => void {
    if (!this.eventListeners.has(type)) {
      this.eventListeners.set(type, new Set());
    }

    this.eventListeners.get(type)!.add(callback);

    return () => {
      this.eventListeners.get(type)?.delete(callback);
    };
  }

  private getProvider(provider: StorageProvider): IpfsProvider | Web3StorageProvider {
    switch (provider) {
      case 'ipfs':
        if (!this.ipfsProvider) {
          throw new Error('IPFS provider not configured');
        }
        return this.ipfsProvider;

      case 'web3.storage':
        if (!this.web3StorageProvider) {
          throw new Error('Web3.Storage provider not configured');
        }
        return this.web3StorageProvider;

      default:
        throw new Error(`Unsupported storage provider: ${provider}`);
    }
  }

  private emitEvent(type: StorageEventType, payload: Partial<StorageEventPayload>) {
    const listeners = this.eventListeners.get(type);
    if (listeners) {
      const fullPayload = { type, ...payload };
      listeners.forEach(callback => callback(fullPayload));
    }
  }
} 