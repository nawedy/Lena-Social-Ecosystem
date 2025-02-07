import type { ContentType } from '@lena/moderation';

export interface ContentMetadata {
  title?: string;
  description?: string;
  tags?: string[];
  language?: string;
  duration?: number;
  dimensions?: {
    width: number;
    height: number;
  };
  format?: string;
  size: number;
  encoding?: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface ProcessingOptions {
  type: ContentType;
  quality?: number;
  maxWidth?: number;
  maxHeight?: number;
  maxDuration?: number;
  maxSize?: number;
  preserveMetadata?: boolean;
  generateThumbnail?: boolean;
  thumbnailOptions?: {
    width: number;
    height: number;
    quality: number;
  };
  watermark?: {
    text?: string;
    image?: string;
    position?: 'center' | 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';
    opacity?: number;
  };
  transcoding?: {
    format?: string;
    codec?: string;
    bitrate?: number;
    fps?: number;
  };
}

export interface ProcessingResult {
  id: string;
  originalUrl: string;
  processedUrl: string;
  thumbnailUrl?: string;
  metadata: ContentMetadata;
  status: 'success' | 'failed' | 'processing';
  error?: string;
  moderationResult?: {
    status: 'approved' | 'rejected' | 'flagged';
    reason?: string;
    confidence: number;
  };
}

export interface ContentAnalysis {
  type: ContentType;
  classification?: {
    label: string;
    confidence: number;
  }[];
  nsfw?: {
    isNSFW: boolean;
    confidence: number;
  };
  objects?: {
    label: string;
    confidence: number;
    bbox?: [number, number, number, number];
  }[];
  text?: {
    content: string;
    confidence: number;
  }[];
  faces?: {
    bbox: [number, number, number, number];
    landmarks?: Record<string, [number, number]>;
    attributes?: Record<string, string | number>;
    confidence: number;
  }[];
  audio?: {
    speech?: {
      text: string;
      confidence: number;
      timestamp: [number, number];
    }[];
    music?: boolean;
    noise?: boolean;
  };
}

export interface ProcessingProgress {
  stage: 'upload' | 'analysis' | 'moderation' | 'processing' | 'storage';
  progress: number;
  message?: string;
}

export interface ProcessingHooks {
  onProgress?: (progress: ProcessingProgress) => void;
  onAnalysis?: (analysis: ContentAnalysis) => void;
  onModeration?: (result: ProcessingResult['moderationResult']) => void;
  onComplete?: (result: ProcessingResult) => void;
  onError?: (error: Error) => void;
}

export interface StorageConfig {
  provider: 'ipfs' | 'web3.storage' | 'supabase';
  ipfsGateway?: string;
  web3StorageToken?: string;
  supabaseUrl?: string;
  supabaseKey?: string;
} 