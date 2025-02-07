import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import sharp from 'sharp';
import * as mobilenet from '@tensorflow-models/mobilenet';
import * as tf from '@tensorflow/tfjs-node';
import { ModerationService } from '@lena/moderation';
import { StorageService } from '@lena/storage';
import type {
  ContentMetadata,
  ProcessingOptions,
  ProcessingResult,
  ContentAnalysis,
  ProcessingProgress,
  ProcessingHooks,
  StorageConfig
} from '../types';

export class ContentProcessor {
  private ffmpeg: FFmpeg;
  private moderationService: ModerationService;
  private storageService: StorageService;
  private model: mobilenet.MobileNet | null = null;

  constructor(
    moderationConfig: {
      perspectiveApiKey: string;
      supabaseUrl: string;
      supabaseKey: string;
    },
    storageConfig: StorageConfig
  ) {
    this.ffmpeg = new FFmpeg();
    this.moderationService = new ModerationService(
      moderationConfig.perspectiveApiKey,
      moderationConfig.supabaseUrl,
      moderationConfig.supabaseKey
    );
    this.storageService = new StorageService(
      storageConfig.web3StorageToken || '',
      storageConfig.ipfsGateway || 'https://w3s.link'
    );
  }

  async initialize() {
    // Load FFmpeg
    await this.ffmpeg.load();
    
    // Load TensorFlow model
    await tf.ready();
    this.model = await mobilenet.load();
    
    // Initialize moderation service
    await this.moderationService.initialize();
  }

  async processContent(
    content: File | Blob,
    options: ProcessingOptions,
    hooks: ProcessingHooks = {}
  ): Promise<ProcessingResult> {
    const { onProgress, onAnalysis, onModeration, onComplete, onError } = hooks;
    
    try {
      // Upload original content
      onProgress?.({ stage: 'upload', progress: 0 });
      const originalUrl = await this.storageService.uploadFile(content, progress => {
        onProgress?.({ stage: 'upload', progress });
      });

      // Analyze content
      onProgress?.({ stage: 'analysis', progress: 0 });
      const analysis = await this.analyzeContent(content, options.type);
      onAnalysis?.(analysis);
      onProgress?.({ stage: 'analysis', progress: 100 });

      // Moderate content
      onProgress?.({ stage: 'moderation', progress: 0 });
      const moderationResult = await this.moderateContent(content, options.type, analysis);
      onModeration?.(moderationResult);
      onProgress?.({ stage: 'moderation', progress: 100 });

      // Process content if moderation passed
      let processedUrl = originalUrl;
      let thumbnailUrl: string | undefined;

      if (moderationResult.status === 'approved') {
        onProgress?.({ stage: 'processing', progress: 0 });
        const processed = await this.processFile(content, options);
        processedUrl = processed.url;
        thumbnailUrl = processed.thumbnailUrl;
        onProgress?.({ stage: 'processing', progress: 100 });
      }

      // Prepare result
      const result: ProcessingResult = {
        id: crypto.randomUUID(),
        originalUrl,
        processedUrl,
        thumbnailUrl,
        metadata: await this.extractMetadata(content),
        status: moderationResult.status === 'approved' ? 'success' : 'failed',
        moderationResult
      };

      onComplete?.(result);
      return result;
    } catch (error) {
      onError?.(error as Error);
      throw error;
    }
  }

  private async analyzeContent(content: File | Blob, type: ProcessingOptions['type']): Promise<ContentAnalysis> {
    const analysis: ContentAnalysis = { type };

    if (type === 'image') {
      // Convert image to tensor
      const img = await createImageBitmap(content);
      const tensor = tf.browser.fromPixels(img);
      
      // Classify image
      if (this.model) {
        const predictions = await this.model.classify(tensor);
        analysis.classification = predictions.map(p => ({
          label: p.className,
          confidence: p.probability
        }));
      }

      // Object detection would go here
      // Face detection would go here
    } else if (type === 'video') {
      // Video analysis would go here
      // Could extract frames and analyze them
    } else if (type === 'audio') {
      // Audio analysis would go here
      // Speech recognition, music detection, etc.
    }

    return analysis;
  }

  private async moderateContent(
    content: File | Blob,
    type: ProcessingOptions['type'],
    analysis: ContentAnalysis
  ): Promise<ProcessingResult['moderationResult']> {
    const result = await this.moderationService.moderateContent(content, type, {
      analysis,
      nsfw: analysis.nsfw
    });

    return {
      status: result.status === 'rejected' ? 'rejected' : 'approved',
      reason: result.reason,
      confidence: result.confidence
    };
  }

  private async processFile(content: File | Blob, options: ProcessingOptions): Promise<{
    url: string;
    thumbnailUrl?: string;
  }> {
    let processed: Blob = content;
    let thumbnail: Blob | undefined;

    if (options.type === 'image') {
      // Process image with Sharp
      const buffer = await content.arrayBuffer();
      let pipeline = sharp(buffer);

      // Resize if needed
      if (options.maxWidth || options.maxHeight) {
        pipeline = pipeline.resize(options.maxWidth, options.maxHeight, {
          fit: 'inside',
          withoutEnlargement: true
        });
      }

      // Adjust quality
      if (options.quality) {
        pipeline = pipeline.jpeg({ quality: options.quality });
      }

      // Generate thumbnail if requested
      if (options.generateThumbnail && options.thumbnailOptions) {
        const { width, height, quality } = options.thumbnailOptions;
        const thumbnailBuffer = await sharp(buffer)
          .resize(width, height, { fit: 'cover' })
          .jpeg({ quality })
          .toBuffer();
        thumbnail = new Blob([thumbnailBuffer], { type: 'image/jpeg' });
      }

      processed = new Blob([await pipeline.toBuffer()], { type: content.type });
    } else if (options.type === 'video') {
      // Process video with FFmpeg
      const inputPath = 'input' + this.getFileExtension(content);
      const outputPath = 'output.mp4';

      await this.ffmpeg.writeFile(inputPath, await fetchFile(content));

      // Build FFmpeg command
      let command = `-i ${inputPath} `;
      if (options.transcoding?.codec) {
        command += `-c:v ${options.transcoding.codec} `;
      }
      if (options.transcoding?.bitrate) {
        command += `-b:v ${options.transcoding.bitrate}k `;
      }
      if (options.transcoding?.fps) {
        command += `-r ${options.transcoding.fps} `;
      }
      command += outputPath;

      await this.ffmpeg.exec(command.split(' '));
      const data = await this.ffmpeg.readFile(outputPath);
      processed = new Blob([data], { type: 'video/mp4' });

      // Generate thumbnail if requested
      if (options.generateThumbnail) {
        await this.ffmpeg.exec([
          '-i', inputPath,
          '-ss', '00:00:01',
          '-vframes', '1',
          'thumbnail.jpg'
        ]);
        const thumbnailData = await this.ffmpeg.readFile('thumbnail.jpg');
        thumbnail = new Blob([thumbnailData], { type: 'image/jpeg' });
      }
    }

    // Upload processed file and thumbnail
    const [processedUrl, thumbnailUrl] = await Promise.all([
      this.storageService.uploadFile(processed),
      thumbnail ? this.storageService.uploadFile(thumbnail) : Promise.resolve(undefined)
    ]);

    return {
      url: processedUrl,
      thumbnailUrl
    };
  }

  private async extractMetadata(content: File | Blob): Promise<ContentMetadata> {
    const metadata: ContentMetadata = {
      size: content.size,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    if (content instanceof File) {
      metadata.title = content.name;
    }

    // Extract more metadata based on file type
    // This would involve reading file headers, EXIF data, etc.

    return metadata;
  }

  private getFileExtension(file: File | Blob): string {
    if (file instanceof File) {
      return '.' + file.name.split('.').pop();
    }
    const type = file.type.split('/')[1];
    return type ? '.' + type : '';
  }
} 