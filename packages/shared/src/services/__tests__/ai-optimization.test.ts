import { AIOptimizer } from '../optimization/AIOptimizer';
import { AdaptiveResourceManager } from '../optimization/AdaptiveResourceManager';
import { ResourceOptimizer } from '../optimization/ResourceOptimizer';
import { PlatformCache } from '../optimization/cache/PlatformCache';
import { PlatformOptimizer } from '../optimization/PlatformOptimizer';

describe('AI Optimization Suite', () => {
  let aiOptimizer: AIOptimizer;
  let adaptiveManager: AdaptiveResourceManager;
  let resourceOptimizer: ResourceOptimizer;
  let platformCache: PlatformCache<any>;
  let platformOptimizer: PlatformOptimizer;

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

    resourceOptimizer = new ResourceOptimizer({
      autoScale: true,
      resourceLimits: {
        maxMemory: 2048 * 1024 * 1024,
        maxConcurrentRequests: 50,
        maxBatchSize: 10
      },
      throttling: {
        enabled: true,
        threshold: 2000,
        cooldown: 5000
      }
    });

    aiOptimizer = new AIOptimizer({
      enableQualityPrediction: true,
      enableCachePrediction: true,
      enableResourcePrediction: true,
      modelUpdateInterval: 60000,
      minDataPoints: 100
    }, platformOptimizer, resourceOptimizer, platformCache);

    adaptiveManager = new AdaptiveResourceManager({
      enabled: true,
      updateInterval: 5000,
      scalingFactor: 1.5,
      cooldownPeriod: 30000,
      thresholds: {
        cpu: { warning: 0.7, critical: 0.9 },
        memory: { warning: 0.8, critical: 0.95 },
        network: { warning: 0.7, critical: 0.9 },
        storage: { warning: 0.8, critical: 0.95 },
        connections: { warning: 1000, critical: 2000 }
      }
    }, aiOptimizer, resourceOptimizer, platformCache);
  });

  describe('Quality Prediction', () => {
    it('should predict optimal quality settings based on context', async () => {
      const prediction = await aiOptimizer.predictQuality({
        contentType: 'video',
        fileSize: 100 * 1024 * 1024, // 100MB
        networkSpeed: 5000000, // 5 Mbps
        deviceCapabilities: {
          memory: 8 * 1024 * 1024 * 1024, // 8GB
          cpu: 0.7,
          gpu: true
        },
        userHistory: {
          preferredQuality: 'high',
          averageWatchTime: 300, // 5 minutes
          completionRate: 0.8
        }
      });

      expect(prediction.suggestedQuality).toBeDefined();
      expect(prediction.confidence).toBeGreaterThan(0);
      expect(prediction.factors).toBeDefined();
    });

    it('should fallback to default quality on prediction failure', async () => {
      // Simulate prediction failure by passing invalid context
      const prediction = await aiOptimizer.predictQuality({
        contentType: 'video',
        fileSize: -1, // Invalid size
        networkSpeed: 0,
        deviceCapabilities: {
          memory: 0,
          cpu: 0,
          gpu: false
        }
      });

      expect(prediction.suggestedQuality).toBe('medium');
      expect(prediction.confidence).toBe(0.5);
    });
  });

  describe('Cache Prediction', () => {
    it('should predict caching strategy based on access patterns', async () => {
      const prediction = await aiOptimizer.predictCaching({
        contentId: 'test-video-1',
        contentType: 'video',
        accessPattern: {
          frequency: 100, // 100 accesses
          lastAccessed: Date.now(),
          totalAccesses: 1000
        },
        size: 50 * 1024 * 1024, // 50MB
        popularity: 0.8
      });

      expect(prediction.shouldCache).toBeDefined();
      expect(prediction.ttl).toBeGreaterThan(0);
      expect(prediction.priority).toBeGreaterThan(0);
      expect(prediction.confidence).toBeGreaterThan(0);
    });

    it('should optimize cache eviction based on predictions', async () => {
      // Fill cache with test data
      for (let i = 0; i < 10; i++) {
        await platformCache.set(`key-${i}`, { data: `test-${i}` }, 1024 * 1024);
      }

      const prediction = await aiOptimizer.predictCaching({
        contentId: 'new-content',
        contentType: 'video',
        accessPattern: {
          frequency: 200,
          lastAccessed: Date.now(),
          totalAccesses: 2000
        },
        size: 100 * 1024 * 1024,
        popularity: 0.9
      });

      expect(prediction.shouldCache).toBe(true);
      expect(prediction.priority).toBeGreaterThan(0.8);
    });
  });

  describe('Resource Prediction', () => {
    it('should predict resource needs based on usage patterns', async () => {
      const prediction = await aiOptimizer.predictResourceNeeds({
        currentLoad: 0.7,
        timeOfDay: 14, // 2 PM
        dayOfWeek: 3, // Wednesday
        activeUsers: 1000,
        queueLength: 50
      });

      expect(prediction.estimatedLoad).toBeGreaterThan(0);
      expect(prediction.suggestedLimits).toBeDefined();
      expect(prediction.confidence).toBeGreaterThan(0);
    });

    it('should adapt resource limits based on predictions', async () => {
      // Simulate high load
      const prediction = await aiOptimizer.predictResourceNeeds({
        currentLoad: 0.9,
        timeOfDay: 12,
        dayOfWeek: 1,
        activeUsers: 2000,
        queueLength: 100
      });

      expect(prediction.suggestedLimits.maxConcurrent).toBeLessThan(10);
      expect(prediction.suggestedLimits.timeout).toBeGreaterThan(1000);
    });
  });

  describe('Adaptive Resource Management', () => {
    it('should handle CPU critical scenarios', async () => {
      // Simulate CPU critical condition
      const metrics = await adaptiveManager.getMetrics();
      expect(metrics.currentUsage.cpu).toBeDefined();
      
      // Trigger CPU critical handling
      const criticalMetrics = {
        cpuUsage: 0.95,
        memoryUsage: 0.6,
        networkUsage: 0.5,
        storageUsage: 0.7,
        activeConnections: 100
      };

      // @ts-ignore: Accessing private method for testing
      await adaptiveManager['handleCPUCritical']();
      
      const updatedMetrics = await adaptiveManager.getMetrics();
      expect(updatedMetrics.isScaling).toBe(false);
    });

    it('should optimize resource allocation during peak times', async () => {
      // Simulate peak time conditions
      const peakPrediction = await aiOptimizer.predictResourceNeeds({
        currentLoad: 0.8,
        timeOfDay: 13, // Peak hour
        dayOfWeek: 3,
        activeUsers: 1500,
        queueLength: 75
      });

      expect(peakPrediction.suggestedLimits.maxConcurrent).toBeDefined();
      expect(peakPrediction.suggestedLimits.batchSize).toBeDefined();
      expect(peakPrediction.confidence).toBeGreaterThan(0.7);
    });

    it('should maintain performance under heavy load', async () => {
      // Simulate heavy load
      const heavyLoadMetrics = {
        cpuUsage: 0.85,
        memoryUsage: 0.9,
        networkUsage: 0.8,
        storageUsage: 0.85,
        activeConnections: 1800
      };

      // @ts-ignore: Accessing private method for testing
      await adaptiveManager['updateResourceUsage']();
      
      const metrics = await adaptiveManager.getMetrics();
      expect(metrics.currentUsage).toBeDefined();
      expect(metrics.historicalUsage.length).toBeGreaterThan(0);
    });
  });

  describe('Integration Tests', () => {
    it('should coordinate AI predictions with resource management', async () => {
      // Simulate resource usage pattern
      const prediction = await aiOptimizer.predictResourceNeeds({
        currentLoad: 0.75,
        timeOfDay: 15,
        dayOfWeek: 2,
        activeUsers: 1200,
        queueLength: 60
      });

      expect(prediction.suggestedLimits).toBeDefined();

      // Verify adaptive management response
      const metrics = await adaptiveManager.getMetrics();
      expect(metrics.predictions).toBeDefined();
    });

    it('should handle multiple critical resources simultaneously', async () => {
      // Simulate multiple critical conditions
      const criticalMetrics = {
        cpuUsage: 0.95,
        memoryUsage: 0.96,
        networkUsage: 0.92,
        storageUsage: 0.97,
        activeConnections: 2500
      };

      // @ts-ignore: Accessing private method for testing
      await adaptiveManager['handleCriticalResources']([
        'cpu',
        'memory',
        'network'
      ]);

      const metrics = await adaptiveManager.getMetrics();
      expect(metrics.isScaling).toBe(false);
    });
  });
}); 