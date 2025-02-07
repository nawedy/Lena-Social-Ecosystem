export { ContentProcessor } from './lib/services/content-processor';
export type {
  ContentMetadata,
  ProcessingOptions,
  ProcessingResult,
  ContentAnalysis,
  ProcessingProgress,
  ProcessingHooks,
  StorageConfig
} from './lib/types';

// Default processing options
export const DEFAULT_PROCESSING_OPTIONS: Partial<ProcessingOptions> = {
  quality: 80,
  maxWidth: 1920,
  maxHeight: 1080,
  maxDuration: 300, // 5 minutes
  maxSize: 100 * 1024 * 1024, // 100MB
  preserveMetadata: true,
  generateThumbnail: true,
  thumbnailOptions: {
    width: 320,
    height: 180,
    quality: 70
  },
  transcoding: {
    format: 'mp4',
    codec: 'libx264',
    bitrate: 2000, // 2Mbps
    fps: 30
  }
};

// Content type validators
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
export const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/ogg'];
export const ALLOWED_AUDIO_TYPES = ['audio/mpeg', 'audio/ogg', 'audio/wav'];

// Re-export utility functions
export { isToxicContent, analyzeContentSimilarity } from '@lena/moderation';
export { validateContent } from './lib/utils/validation';
export { extractMetadata } from './lib/utils/metadata';
export { generateThumbnail } from './lib/utils/thumbnails';
export { transcodeVideo } from './lib/utils/transcoding';
export { optimizeImage } from './lib/utils/optimization'; 