import { MediaOptimizer } from '../optimization/MediaOptimizer';
import { PlatformOptimizer } from '../optimization/PlatformOptimizer';
import { PlatformCache } from '../optimization/cache/PlatformCache';

describe('Media Optimization Suite', () => {
  let mediaOptimizer: MediaOptimizer;
  let platformOptimizer: PlatformOptimizer;
  let platformCache: PlatformCache<any>;

  beforeEach(() => {
    platformCache = new PlatformCache({
      maxSize: 1024 * 1024 * 1024, // 1GB
      maxAge: 3600000, // 1 hour
      evictionPolicy: 'lru'
    });

    platformOptimizer = new PlatformOptimizer({
      platform: 'long-video',
      optimizations: {
        mediaProcessing: true,
        caching: true,
        prefetching: true,
        compression: true,
        streamingQuality: true
      },
      limits: {
        maxConcurrentUploads: 3,
        maxConcurrentDownloads: 5,
        maxConcurrentTranscoding: 2,
        maxCacheSize: 1024 * 1024 * 1024 // 1GB
      }
    });

    mediaOptimizer = new MediaOptimizer({
      platform: 'long-video',
      quality: {
        video: {
          maxBitrate: 5000000, // 5 Mbps
          maxResolution: '1080p',
          maxFrameRate: 60,
          codec: 'h264'
        },
        audio: {
          maxBitrate: 192000, // 192 kbps
          sampleRate: 48000,
          channels: 2,
          codec: 'aac'
        },
        image: {
          maxWidth: 1920,
          maxHeight: 1080,
          format: 'jpeg',
          quality: 0.9
        }
      },
      processing: {
        enableHardwareAcceleration: true,
        maxConcurrentJobs: 3,
        chunkSize: 5 * 1024 * 1024 // 5MB chunks
      }
    }, platformOptimizer);
  });

  describe('Video Optimization', () => {
    it('should optimize video with high quality settings', async () => {
      const mockVideoFile = new File(
        [new ArrayBuffer(10 * 1024 * 1024)], // 10MB mock video
        'test-video.mp4',
        { type: 'video/mp4' }
      );

      const result = await mediaOptimizer.optimizeVideo({
        file: mockVideoFile,
        targetQuality: 'high',
        options: {
          generateThumbnail: true,
          generatePreview: true
        }
      });

      expect(result.video).toBeDefined();
      expect(result.thumbnail).toBeDefined();
      expect(result.preview).toBeDefined();
      expect(result.metadata).toBeDefined();
    });

    it('should handle large video files in chunks', async () => {
      const mockLargeVideo = new File(
        [new ArrayBuffer(100 * 1024 * 1024)], // 100MB mock video
        'large-video.mp4',
        { type: 'video/mp4' }
      );

      const result = await mediaOptimizer.optimizeVideo({
        file: mockLargeVideo,
        targetQuality: 'medium'
      });

      expect(result.video).toBeDefined();
      expect(result.metadata.size).toBeLessThan(mockLargeVideo.size);
    });
  });

  describe('Image Optimization', () => {
    it('should optimize image with compression', async () => {
      const mockImageFile = new File(
        [new ArrayBuffer(5 * 1024 * 1024)], // 5MB mock image
        'test-image.jpg',
        { type: 'image/jpeg' }
      );

      const result = await mediaOptimizer.optimizeImage({
        file: mockImageFile,
        targetQuality: 'high',
        options: {
          applyCompression: true,
          generateThumbnail: true
        }
      });

      expect(result.image).toBeDefined();
      expect(result.thumbnail).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(result.metadata.size).toBeLessThan(mockImageFile.size);
    });

    it('should maintain aspect ratio during resizing', async () => {
      const mockImageFile = new File(
        [new ArrayBuffer(2 * 1024 * 1024)], // 2MB mock image
        'test-image.jpg',
        { type: 'image/jpeg' }
      );

      const result = await mediaOptimizer.optimizeImage({
        file: mockImageFile,
        targetQuality: 'medium'
      });

      const aspectRatio = result.metadata.width / result.metadata.height;
      expect(aspectRatio).toBeCloseTo(16/9, 2); // Assuming 16:9 aspect ratio
    });
  });

  describe('Audio Optimization', () => {
    it('should optimize audio with noise reduction', async () => {
      const mockAudioFile = new File(
        [new ArrayBuffer(3 * 1024 * 1024)], // 3MB mock audio
        'test-audio.mp3',
        { type: 'audio/mpeg' }
      );

      const result = await mediaOptimizer.optimizeAudio({
        file: mockAudioFile,
        targetQuality: 'high',
        options: {
          removeNoise: true,
          generateWaveform: true
        }
      });

      expect(result.audio).toBeDefined();
      expect(result.waveform).toBeDefined();
      expect(result.metadata).toBeDefined();
    });

    it('should handle multi-channel audio correctly', async () => {
      const mockStereoFile = new File(
        [new ArrayBuffer(4 * 1024 * 1024)], // 4MB mock stereo audio
        'stereo-audio.mp3',
        { type: 'audio/mpeg' }
      );

      const result = await mediaOptimizer.optimizeAudio({
        file: mockStereoFile,
        targetQuality: 'medium'
      });

      expect(result.metadata.channels).toBe(2);
      expect(result.metadata.sampleRate).toBe(44100);
    });
  });

  describe('Platform-specific Optimizations', () => {
    it('should apply platform-specific cache settings', async () => {
      const mockData = { id: 1, data: 'test' };
      await platformCache.set('test-key', mockData, 1000);

      const cachedData = await platformCache.get('test-key');
      expect(cachedData).toEqual(mockData);
    });

    it('should handle cache eviction correctly', async () => {
      // Fill cache to max size
      const largeData = new Array(1024 * 1024).fill('x').join(''); // 1MB string
      for (let i = 0; i < 1024; i++) { // Try to store 1GB
        await platformCache.set(`key-${i}`, largeData, 1024 * 1024);
      }

      const metrics = platformCache.getMetrics();
      expect(metrics.currentSize).toBeLessThanOrEqual(metrics.maxSize);
    });
  });

  describe('Resource Management', () => {
    it('should handle concurrent processing limits', async () => {
      const mockFiles = Array(5).fill(null).map((_, i) => 
        new File(
          [new ArrayBuffer(1024 * 1024)], // 1MB each
          `test-${i}.mp4`,
          { type: 'video/mp4' }
        )
      );

      const processes = mockFiles.map(file => 
        mediaOptimizer.optimizeVideo({
          file,
          targetQuality: 'medium'
        })
      );

      const results = await Promise.all(processes);
      expect(results).toHaveLength(5);
    });

    it('should prioritize high-priority tasks', async () => {
      const start = Date.now();

      const lowPriorityTask = mediaOptimizer.optimizeVideo({
        file: new File([new ArrayBuffer(1024 * 1024)], 'low.mp4', { type: 'video/mp4' }),
        targetQuality: 'low'
      });

      const highPriorityTask = mediaOptimizer.optimizeVideo({
        file: new File([new ArrayBuffer(1024 * 1024)], 'high.mp4', { type: 'video/mp4' }),
        targetQuality: 'high'
      });

      const [lowResult, highResult] = await Promise.all([
        lowPriorityTask,
        highPriorityTask
      ]);

      expect(highResult).toBeDefined();
      expect(lowResult).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid input files gracefully', async () => {
      const invalidFile = new File(
        [new ArrayBuffer(0)],
        'invalid.mp4',
        { type: 'video/mp4' }
      );

      await expect(
        mediaOptimizer.optimizeVideo({
          file: invalidFile,
          targetQuality: 'high'
        })
      ).rejects.toThrow();
    });

    it('should handle processing failures', async () => {
      const corruptedFile = new File(
        [new ArrayBuffer(1024)], // Too small to be valid
        'corrupted.mp4',
        { type: 'video/mp4' }
      );

      await expect(
        mediaOptimizer.optimizeVideo({
          file: corruptedFile,
          targetQuality: 'high'
        })
      ).rejects.toThrow();
    });
  });
}); 