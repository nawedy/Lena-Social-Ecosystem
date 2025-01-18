import { Storage } from '@google-cloud/storage';
import { PubSub } from '@google-cloud/pubsub';
import { config } from '../config';
import { performanceMonitoring } from './performanceMonitoring';
import { completeAnalytics } from './completeAnalytics';

interface MediaConfig {
  maxFileSize: number;
  allowedTypes: string[];
  imageOptimization: {
    quality: number;
    maxWidth: number;
    maxHeight: number;
    formats: ('webp' | 'jpeg' | 'png')[];
  };
  videoOptimization: {
    maxBitrate: number;
    maxDuration: number;
    formats: ('mp4' | 'webm')[];
    thumbnailPoints: number[];
  };
  audioOptimization: {
    maxBitrate: number;
    maxDuration: number;
    formats: ('mp3' | 'ogg' | 'wav')[];
  };
}

interface ProcessedMedia {
  id: string;
  originalUrl: string;
  variants: Array<{
    url: string;
    type: string;
    width?: number;
    height?: number;
    bitrate?: number;
    size: number;
  }>;
  thumbnails?: string[];
  metadata: {
    type: string;
    size: number;
    duration?: number;
    width?: number;
    height?: number;
    createdAt: string;
  };
}

export class MediaHandlerService {
  private static instance: MediaHandlerService;
  private storage: Storage;
  private pubsub: PubSub;
  private config: MediaConfig = {
    maxFileSize: 100 * 1024 * 1024, // 100MB
    allowedTypes: [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'video/mp4',
      'video/webm',
      'audio/mp3',
      'audio/ogg',
      'audio/wav',
    ],
    imageOptimization: {
      quality: 85,
      maxWidth: 2048,
      maxHeight: 2048,
      formats: ['webp', 'jpeg'],
    },
    videoOptimization: {
      maxBitrate: 2500000, // 2.5 Mbps
      maxDuration: 300, // 5 minutes
      formats: ['mp4', 'webm'],
      thumbnailPoints: [0, 0.25, 0.5, 0.75],
    },
    audioOptimization: {
      maxBitrate: 192000, // 192 kbps
      maxDuration: 600, // 10 minutes
      formats: ['mp3', 'ogg'],
    },
  };

  private constructor() {
    this.storage = new Storage({
      projectId: config.gcp.projectId,
      keyFilename: config.gcp.keyFile,
    });
    this.pubsub = new PubSub({
      projectId: config.gcp.projectId,
      keyFilename: config.gcp.keyFile,
    });

    this.setupMediaProcessing();
  }

  public static getInstance(): MediaHandlerService {
    if (!MediaHandlerService.instance) {
      MediaHandlerService.instance = new MediaHandlerService();
    }
    return MediaHandlerService.instance;
  }

  async uploadMedia(file: File): Promise<ProcessedMedia> {
    try {
      // Validate file
      await this.validateFile(file);

      // Generate unique ID
      const mediaId = crypto.randomUUID();

      // Upload original file
      const bucket = this.storage.bucket(config.gcp.storageBucket);
      const originalPath = `media/original/${mediaId}/${file.name}`;
      const originalFile = bucket.file(originalPath);

      await originalFile.save(await file.arrayBuffer(), {
        metadata: {
          contentType: file.type,
          metadata: {
            originalName: file.name,
            uploadTime: new Date().toISOString(),
          },
        },
      });

      // Create signed URL for original file
      const [originalUrl] = await originalFile.getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 1 week
      });

      // Create initial media object
      const media: ProcessedMedia = {
        id: mediaId,
        originalUrl,
        variants: [],
        metadata: {
          type: file.type,
          size: file.size,
          createdAt: new Date().toISOString(),
        },
      };

      // Publish media processing event
      await this.publishMediaEvent('media_uploaded', {
        mediaId,
        originalPath,
        type: file.type,
        size: file.size,
      });

      // Track analytics
      await completeAnalytics.trackEvent({
        type: 'media_upload',
        data: {
          mediaId,
          type: file.type,
          size: file.size,
        },
        metadata: {
          service: 'media-handler',
          environment: config.app.env,
          version: '1.0.0',
        },
      });

      return media;
    } catch (error) {
      performanceMonitoring.recordError(error as Error, {
        operation: 'uploadMedia',
        fileType: file.type,
        fileSize: file.size,
      });
      throw error;
    }
  }

  async getMediaInfo(mediaId: string): Promise<ProcessedMedia> {
    try {
      const bucket = this.storage.bucket(config.gcp.storageBucket);
      const mediaPath = `media/processed/${mediaId}/info.json`;
      const mediaFile = bucket.file(mediaPath);

      const [exists] = await mediaFile.exists();
      if (!exists) {
        throw new Error('Media not found');
      }

      const [content] = await mediaFile.download();
      return JSON.parse(content.toString());
    } catch (error) {
      performanceMonitoring.recordError(error as Error, {
        operation: 'getMediaInfo',
        mediaId,
      });
      throw error;
    }
  }

  async deleteMedia(mediaId: string): Promise<void> {
    try {
      const bucket = this.storage.bucket(config.gcp.storageBucket);

      // Delete all files in the media directory
      await bucket.deleteFiles({
        prefix: `media/original/${mediaId}/`,
      });
      await bucket.deleteFiles({
        prefix: `media/processed/${mediaId}/`,
      });

      // Track deletion
      await completeAnalytics.trackEvent({
        type: 'media_deleted',
        data: { mediaId },
        metadata: {
          service: 'media-handler',
          environment: config.app.env,
          version: '1.0.0',
        },
      });
    } catch (error) {
      performanceMonitoring.recordError(error as Error, {
        operation: 'deleteMedia',
        mediaId,
      });
      throw error;
    }
  }

  private async validateFile(file: File): Promise<void> {
    if (file.size > this.config.maxFileSize) {
      throw new Error('File size exceeds maximum allowed size');
    }

    if (!this.config.allowedTypes.includes(file.type)) {
      throw new Error('File type not supported');
    }
  }

  private async processImage(file: File, mediaId: string): Promise<void> {
    const sharp = require('sharp');
    const bucket = this.storage.bucket(config.gcp.storageBucket);

    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const image = sharp(buffer);
      const metadata = await image.metadata();

      const variants: ProcessedMedia['variants'] = [];

      for (const format of this.config.imageOptimization.formats) {
        const processed = image
          .clone()
          .resize(
            this.config.imageOptimization.maxWidth,
            this.config.imageOptimization.maxHeight,
            { fit: 'inside', withoutEnlargement: true }
          )
          [format]({ quality: this.config.imageOptimization.quality });

        const outputPath = `media/processed/${mediaId}/${mediaId}.${format}`;
        const outputFile = bucket.file(outputPath);

        await outputFile.save(await processed.toBuffer());

        const [url] = await outputFile.getSignedUrl({
          version: 'v4',
          action: 'read',
          expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
        });

        variants.push({
          url,
          type: `image/${format}`,
          width: metadata.width,
          height: metadata.height,
          size: (await outputFile.getMetadata())[0].size,
        });
      }

      // Update media info
      await this.updateMediaInfo(mediaId, { variants });
    } catch (error) {
      performanceMonitoring.recordError(error as Error, {
        operation: 'processImage',
        mediaId,
        fileType: file.type,
      });
      throw error;
    }
  }

  private async processVideo(file: File, mediaId: string): Promise<void> {
    const ffmpeg = require('fluent-ffmpeg');
    const bucket = this.storage.bucket(config.gcp.storageBucket);

    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const inputPath = `/tmp/${mediaId}_input.mp4`;
      await require('fs').promises.writeFile(inputPath, buffer);

      // Generate thumbnails
      const thumbnails: string[] = [];
      for (const point of this.config.videoOptimization.thumbnailPoints) {
        const thumbnailPath = `media/processed/${mediaId}/thumbnail_${point}.jpg`;
        const thumbnailFile = bucket.file(thumbnailPath);

        await new Promise((resolve, reject) => {
          ffmpeg(inputPath)
            .screenshots({
              timestamps: [point],
              filename: thumbnailPath,
              folder: '/tmp',
            })
            .on('end', resolve)
            .on('error', reject);
        });

        await thumbnailFile.save(
          await require('fs').promises.readFile(`/tmp/${thumbnailPath}`)
        );

        const [url] = await thumbnailFile.getSignedUrl({
          version: 'v4',
          action: 'read',
          expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
        });

        thumbnails.push(url);
      }

      // Process video formats
      const variants: ProcessedMedia['variants'] = [];
      for (const format of this.config.videoOptimization.formats) {
        const outputPath = `media/processed/${mediaId}/${mediaId}.${format}`;
        const outputFile = bucket.file(outputPath);

        await new Promise((resolve, reject) => {
          ffmpeg(inputPath)
            .videoBitrate(this.config.videoOptimization.maxBitrate)
            .format(format)
            .output(`/tmp/${mediaId}.${format}`)
            .on('end', resolve)
            .on('error', reject);
        });

        await outputFile.save(
          await require('fs').promises.readFile(`/tmp/${mediaId}.${format}`)
        );

        const [url] = await outputFile.getSignedUrl({
          version: 'v4',
          action: 'read',
          expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
        });

        variants.push({
          url,
          type: `video/${format}`,
          bitrate: this.config.videoOptimization.maxBitrate,
          size: (await outputFile.getMetadata())[0].size,
        });
      }

      // Update media info
      await this.updateMediaInfo(mediaId, { variants, thumbnails });

      // Cleanup
      await require('fs').promises.unlink(inputPath);
      for (const format of this.config.videoOptimization.formats) {
        await require('fs').promises.unlink(`/tmp/${mediaId}.${format}`);
      }
    } catch (error) {
      performanceMonitoring.recordError(error as Error, {
        operation: 'processVideo',
        mediaId,
        fileType: file.type,
      });
      throw error;
    }
  }

  private async processAudio(file: File, mediaId: string): Promise<void> {
    const ffmpeg = require('fluent-ffmpeg');
    const bucket = this.storage.bucket(config.gcp.storageBucket);

    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const inputPath = `/tmp/${mediaId}_input.mp3`;
      await require('fs').promises.writeFile(inputPath, buffer);

      const variants: ProcessedMedia['variants'] = [];
      for (const format of this.config.audioOptimization.formats) {
        const outputPath = `media/processed/${mediaId}/${mediaId}.${format}`;
        const outputFile = bucket.file(outputPath);

        await new Promise((resolve, reject) => {
          ffmpeg(inputPath)
            .audioBitrate(this.config.audioOptimization.maxBitrate)
            .format(format)
            .output(`/tmp/${mediaId}.${format}`)
            .on('end', resolve)
            .on('error', reject);
        });

        await outputFile.save(
          await require('fs').promises.readFile(`/tmp/${mediaId}.${format}`)
        );

        const [url] = await outputFile.getSignedUrl({
          version: 'v4',
          action: 'read',
          expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
        });

        variants.push({
          url,
          type: `audio/${format}`,
          bitrate: this.config.audioOptimization.maxBitrate,
          size: (await outputFile.getMetadata())[0].size,
        });
      }

      // Update media info
      await this.updateMediaInfo(mediaId, { variants });

      // Cleanup
      await require('fs').promises.unlink(inputPath);
      for (const format of this.config.audioOptimization.formats) {
        await require('fs').promises.unlink(`/tmp/${mediaId}.${format}`);
      }
    } catch (error) {
      performanceMonitoring.recordError(error as Error, {
        operation: 'processAudio',
        mediaId,
        fileType: file.type,
      });
      throw error;
    }
  }

  private async updateMediaInfo(
    mediaId: string,
    updates: Partial<ProcessedMedia>
  ): Promise<void> {
    const bucket = this.storage.bucket(config.gcp.storageBucket);
    const infoPath = `media/processed/${mediaId}/info.json`;
    const infoFile = bucket.file(infoPath);

    try {
      let mediaInfo: ProcessedMedia;
      const [exists] = await infoFile.exists();

      if (exists) {
        const [content] = await infoFile.download();
        mediaInfo = {
          ...JSON.parse(content.toString()),
          ...updates,
        };
      } else {
        mediaInfo = {
          id: mediaId,
          originalUrl: '',
          variants: [],
          metadata: {
            type: '',
            size: 0,
            createdAt: new Date().toISOString(),
          },
          ...updates,
        };
      }

      await infoFile.save(JSON.stringify(mediaInfo, null, 2));
    } catch (error) {
      performanceMonitoring.recordError(error as Error, {
        operation: 'updateMediaInfo',
        mediaId,
      });
      throw error;
    }
  }

  private async publishMediaEvent(
    eventType: string,
    data: Record<string, any>
  ): Promise<void> {
    const topic = this.pubsub.topic('media-events');
    const messageData = {
      eventType,
      timestamp: new Date().toISOString(),
      ...data,
    };

    await topic.publish(Buffer.from(JSON.stringify(messageData)));
  }

  private setupMediaProcessing(): void {
    const subscription = this.pubsub
      .topic('media-events')
      .subscription('media-processor');

    subscription.on('message', async message => {
      try {
        const event = JSON.parse(message.data.toString());

        if (event.eventType === 'media_uploaded') {
          const bucket = this.storage.bucket(config.gcp.storageBucket);
          const file = bucket.file(event.originalPath);
          const [content] = await file.download();

          const mediaFile = new File(
            [content],
            event.originalPath.split('/').pop(),
            {
              type: event.type,
            }
          );

          if (event.type.startsWith('image/')) {
            await this.processImage(mediaFile, event.mediaId);
          } else if (event.type.startsWith('video/')) {
            await this.processVideo(mediaFile, event.mediaId);
          } else if (event.type.startsWith('audio/')) {
            await this.processAudio(mediaFile, event.mediaId);
          }

          message.ack();
        }
      } catch (error) {
        performanceMonitoring.recordError(error as Error, {
          operation: 'processMediaEvent',
          messageId: message.id,
        });
        message.nack();
      }
    });
  }
}

export const mediaHandler = MediaHandlerService.getInstance();
