# @lena/content

A powerful content processing package for handling images, videos, and audio files with advanced features like moderation, optimization, and transcoding.

## Features

- 🖼️ Image Processing
  - Optimization and resizing
  - Format conversion (JPEG, PNG, WebP)
  - Watermarking
  - Thumbnail generation
  - EXIF metadata extraction
  - Location data handling

- 🎥 Video Processing
  - Transcoding with multiple codecs
  - HLS streaming support
  - Multiple quality levels
  - Thumbnail extraction
  - Frame analysis
  - Duration and metadata extraction

- 🎵 Audio Processing
  - Format conversion
  - Bitrate optimization
  - Metadata preservation
  - Duration analysis

- 🛡️ Content Moderation
  - Integration with @lena/moderation
  - NSFW detection
  - Content classification
  - Object detection
  - Text extraction and analysis

- 📦 Storage
  - IPFS integration
  - Web3.Storage support
  - Supabase Storage integration
  - Metadata preservation

## Installation

```bash
pnpm add @lena/content
```

## Usage

### Basic Usage

```typescript
import { ContentProcessor, DEFAULT_PROCESSING_OPTIONS } from '@lena/content';

// Initialize the processor
const processor = new ContentProcessor(
  {
    perspectiveApiKey: 'your-perspective-api-key',
    supabaseUrl: 'your-supabase-url',
    supabaseKey: 'your-supabase-key'
  },
  {
    provider: 'ipfs',
    ipfsGateway: 'https://w3s.link'
  }
);

// Initialize (loads required models)
await processor.initialize();

// Process an image
const result = await processor.processContent(
  imageFile,
  {
    ...DEFAULT_PROCESSING_OPTIONS,
    type: 'image',
    quality: 80,
    maxWidth: 1920,
    maxHeight: 1080,
    generateThumbnail: true
  }
);

console.log(result);
// {
//   id: '...',
//   originalUrl: 'ipfs://...',
//   processedUrl: 'ipfs://...',
//   thumbnailUrl: 'ipfs://...',
//   metadata: {
//     dimensions: { width: 1920, height: 1080 },
//     size: 123456,
//     format: 'image/jpeg',
//     ...
//   },
//   status: 'success'
// }
```

### Progress Tracking

```typescript
const result = await processor.processContent(
  videoFile,
  {
    type: 'video',
    transcoding: {
      format: 'mp4',
      codec: 'libx264',
      bitrate: 2000,
      fps: 30
    }
  },
  {
    onProgress: (progress) => {
      console.log(`Stage: ${progress.stage}, Progress: ${progress.progress}%`);
    },
    onAnalysis: (analysis) => {
      console.log('Content Analysis:', analysis);
    },
    onModeration: (result) => {
      console.log('Moderation Result:', result);
    },
    onComplete: (result) => {
      console.log('Processing Complete:', result);
    }
  }
);
```

### HLS Streaming

```typescript
const result = await processor.processContent(
  videoFile,
  {
    type: 'video',
    transcoding: {
      format: 'hls',
      qualities: [
        { width: 1920, height: 1080, bitrate: 5000 }, // 1080p
        { width: 1280, height: 720, bitrate: 2500 },  // 720p
        { width: 854, height: 480, bitrate: 1000 }    // 480p
      ]
    }
  }
);

// Result includes HLS manifest and segments
console.log(result.processedUrl); // URL to master playlist
```

### Image Optimization with Watermark

```typescript
const result = await processor.processContent(
  imageFile,
  {
    type: 'image',
    quality: 80,
    watermark: {
      text: 'Copyright 2024',
      position: 'bottomRight',
      opacity: 0.5
    }
  }
);
```

### Audio Processing

```typescript
const result = await processor.processContent(
  audioFile,
  {
    type: 'audio',
    transcoding: {
      format: 'mp3',
      bitrate: 192
    }
  }
);
```

## API Reference

### ContentProcessor

The main class for processing content.

```typescript
class ContentProcessor {
  constructor(
    moderationConfig: {
      perspectiveApiKey: string;
      supabaseUrl: string;
      supabaseKey: string;
    },
    storageConfig: {
      provider: 'ipfs' | 'web3.storage' | 'supabase';
      ipfsGateway?: string;
      web3StorageToken?: string;
      supabaseUrl?: string;
      supabaseKey?: string;
    }
  );

  async initialize(): Promise<void>;

  async processContent(
    content: File | Blob,
    options: ProcessingOptions,
    hooks?: ProcessingHooks
  ): Promise<ProcessingResult>;
}
```

### ProcessingOptions

Configuration options for content processing.

```typescript
interface ProcessingOptions {
  type: 'image' | 'video' | 'audio';
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
    qualities?: Array<{
      width: number;
      height: number;
      bitrate: number;
    }>;
  };
}
```

### ProcessingResult

The result of content processing.

```typescript
interface ProcessingResult {
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
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details. 