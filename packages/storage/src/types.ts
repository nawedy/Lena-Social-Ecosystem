export type StorageProvider = 'ipfs' | 'web3.storage' | 'supabase';

export interface StorageConfig {
  ipfsGateway?: string;
  web3StorageToken?: string;
  supabaseUrl?: string;
  supabaseKey?: string;
}

export interface UploadOptions {
  provider: StorageProvider;
  encrypt?: boolean;
  compress?: boolean;
  metadata?: Record<string, any>;
  onProgress?: (progress: number) => void;
}

export interface UploadResult {
  cid: string;
  url: string;
  size: number;
  mimeType: string;
  metadata?: Record<string, any>;
  encryptionKey?: string;
}

export interface StorageFile {
  cid: string;
  name: string;
  size: number;
  mimeType: string;
  url: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface StorageStats {
  totalSize: number;
  fileCount: number;
  bandwidthUsed: number;
}

export type StorageEventType = 
  | 'UPLOAD_STARTED'
  | 'UPLOAD_PROGRESS'
  | 'UPLOAD_COMPLETED'
  | 'UPLOAD_FAILED'
  | 'DOWNLOAD_STARTED'
  | 'DOWNLOAD_COMPLETED'
  | 'DOWNLOAD_FAILED';

export interface StorageEventPayload {
  type: StorageEventType;
  file?: StorageFile;
  progress?: number;
  error?: Error;
} 