import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { ContentProcessor, DEFAULT_PROCESSING_OPTIONS } from '../index';
import { ModerationService } from '@lena/moderation';
import { StorageService } from '@lena/storage';
import fs from 'fs/promises';
import path from 'path';

describe('ContentProcessor Integration Tests', () => {
  let contentProcessor: ContentProcessor;
  let testImageFile: File;
  let testVideoFile: File;
  let testAudioFile: File;

  beforeAll(async () => {
    // Initialize ContentProcessor with test configuration
    contentProcessor = new ContentProcessor(
      {
        perspectiveApiKey: process.env.TEST_PERSPECTIVE_API_KEY || 'test-key',
        supabaseUrl: process.env.TEST_SUPABASE_URL || 'http://localhost:54321',
        supabaseKey: process.env.TEST_SUPABASE_ANON_KEY || 'test-key'
      },
      {
        provider: 'ipfs',
        ipfsGateway: 'http://localhost:8080'
      }
    );

    await contentProcessor.initialize();

    // Load test files
    const imageBuffer = await fs.readFile(path.join(__dirname, 'fixtures/test-image.jpg'));
    const videoBuffer = await fs.readFile(path.join(__dirname, 'fixtures/test-video.mp4'));
    const audioBuffer = await fs.readFile(path.join(__dirname, 'fixtures/test-audio.mp3'));

    testImageFile = new File([imageBuffer], 'test-image.jpg', { type: 'image/jpeg' });
    testVideoFile = new File([videoBuffer], 'test-video.mp4', { type: 'video/mp4' });
    testAudioFile = new File([audioBuffer], 'test-audio.mp3', { type: 'audio/mpeg' });
  });

  afterAll(async () => {
    // Cleanup test files
    await fs.rm(path.join(__dirname, 'fixtures'), { recursive: true, force: true });
  });

  describe('Image Processing', () => {
    it('should process an image file successfully', async () => {
      const hooks = {
        onProgress: vi.fn(),
        onAnalysis: vi.fn(),
        onModeration: vi.fn(),
        onComplete: vi.fn()
      };

      const result = await contentProcessor.processContent(
        testImageFile,
        {
          ...DEFAULT_PROCESSING_OPTIONS,
          type: 'image',
          quality: 80,
          maxWidth: 1920,
          maxHeight: 1080,
          generateThumbnail: true
        },
        hooks
      );

      expect(result.status).toBe('success');
      expect(result.originalUrl).toBeDefined();
      expect(result.processedUrl).toBeDefined();
      expect(result.thumbnailUrl).toBeDefined();
      expect(result.metadata).toMatchObject({
        type: 'image',
        dimensions: {
          width: expect.any(Number),
          height: expect.any(Number)
        },
        size: expect.any(Number)
      });

      expect(hooks.onProgress).toHaveBeenCalled();
      expect(hooks.onAnalysis).toHaveBeenCalled();
      expect(hooks.onModeration).toHaveBeenCalled();
      expect(hooks.onComplete).toHaveBeenCalled();
    });

    it('should handle image optimization with watermark', async () => {
      const result = await contentProcessor.processContent(
        testImageFile,
        {
          ...DEFAULT_PROCESSING_OPTIONS,
          type: 'image',
          watermark: {
            text: 'Test Watermark',
            position: 'bottomRight',
            opacity: 0.5
          }
        }
      );

      expect(result.status).toBe('success');
      expect(result.processedUrl).toBeDefined();
    });
  });

  describe('Video Processing', () => {
    it('should process a video file successfully', async () => {
      const hooks = {
        onProgress: vi.fn(),
        onAnalysis: vi.fn(),
        onModeration: vi.fn(),
        onComplete: vi.fn()
      };

      const result = await contentProcessor.processContent(
        testVideoFile,
        {
          ...DEFAULT_PROCESSING_OPTIONS,
          type: 'video',
          transcoding: {
            format: 'mp4',
            codec: 'libx264',
            bitrate: 2000,
            fps: 30
          }
        },
        hooks
      );

      expect(result.status).toBe('success');
      expect(result.originalUrl).toBeDefined();
      expect(result.processedUrl).toBeDefined();
      expect(result.thumbnailUrl).toBeDefined();
      expect(result.metadata).toMatchObject({
        type: 'video',
        dimensions: {
          width: expect.any(Number),
          height: expect.any(Number)
        },
        duration: expect.any(Number),
        size: expect.any(Number)
      });

      expect(hooks.onProgress).toHaveBeenCalled();
      expect(hooks.onAnalysis).toHaveBeenCalled();
      expect(hooks.onModeration).toHaveBeenCalled();
      expect(hooks.onComplete).toHaveBeenCalled();
    });

    it('should generate HLS streams for video', async () => {
      const result = await contentProcessor.processContent(
        testVideoFile,
        {
          ...DEFAULT_PROCESSING_OPTIONS,
          type: 'video',
          transcoding: {
            format: 'hls',
            qualities: [
              { width: 1920, height: 1080, bitrate: 5000 },
              { width: 1280, height: 720, bitrate: 2500 },
              { width: 854, height: 480, bitrate: 1000 }
            ]
          }
        }
      );

      expect(result.status).toBe('success');
      expect(result.processedUrl).toMatch(/\.m3u8$/);
    });
  });

  describe('Audio Processing', () => {
    it('should process an audio file successfully', async () => {
      const hooks = {
        onProgress: vi.fn(),
        onAnalysis: vi.fn(),
        onModeration: vi.fn(),
        onComplete: vi.fn()
      };

      const result = await contentProcessor.processContent(
        testAudioFile,
        {
          ...DEFAULT_PROCESSING_OPTIONS,
          type: 'audio',
          transcoding: {
            format: 'mp3',
            bitrate: 192
          }
        },
        hooks
      );

      expect(result.status).toBe('success');
      expect(result.originalUrl).toBeDefined();
      expect(result.processedUrl).toBeDefined();
      expect(result.metadata).toMatchObject({
        type: 'audio',
        duration: expect.any(Number),
        size: expect.any(Number)
      });

      expect(hooks.onProgress).toHaveBeenCalled();
      expect(hooks.onAnalysis).toHaveBeenCalled();
      expect(hooks.onModeration).toHaveBeenCalled();
      expect(hooks.onComplete).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid file types', async () => {
      const invalidFile = new File(['invalid'], 'test.txt', { type: 'text/plain' });
      
      await expect(
        contentProcessor.processContent(
          invalidFile,
          {
            ...DEFAULT_PROCESSING_OPTIONS,
            type: 'image'
          }
        )
      ).rejects.toThrow();
    });

    it('should handle processing failures gracefully', async () => {
      const corruptedFile = new File([new Uint8Array(10)], 'corrupted.jpg', { type: 'image/jpeg' });
      
      const result = await contentProcessor.processContent(
        corruptedFile,
        {
          ...DEFAULT_PROCESSING_OPTIONS,
          type: 'image'
        }
      );

      expect(result.status).toBe('failed');
      expect(result.error).toBeDefined();
    });
  });

  describe('Moderation Integration', () => {
    it('should reject inappropriate content', async () => {
      // Mock the moderation service to simulate inappropriate content
      vi.spyOn(ModerationService.prototype, 'moderateContent').mockResolvedValueOnce({
        status: 'rejected',
        reason: 'adult',
        confidence: 0.95
      });

      const result = await contentProcessor.processContent(
        testImageFile,
        {
          ...DEFAULT_PROCESSING_OPTIONS,
          type: 'image'
        }
      );

      expect(result.status).toBe('failed');
      expect(result.moderationResult?.status).toBe('rejected');
    });
  });

  describe('Storage Integration', () => {
    it('should store content with correct metadata', async () => {
      // Mock the storage service
      vi.spyOn(StorageService.prototype, 'uploadFile').mockResolvedValueOnce({
        url: 'https://example.com/test.jpg',
        cid: 'test-cid',
        size: 1000,
        mimeType: 'image/jpeg'
      });

      const result = await contentProcessor.processContent(
        testImageFile,
        {
          ...DEFAULT_PROCESSING_OPTIONS,
          type: 'image'
        }
      );

      expect(result.status).toBe('success');
      expect(result.processedUrl).toBeDefined();
      expect(result.metadata).toBeDefined();
    });
  });
}); 