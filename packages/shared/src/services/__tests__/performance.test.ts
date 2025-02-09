import { performanceService } from '../optimization/PerformanceService';
import { metricsService } from '../monitoring/MetricsService';

describe('Performance Service', () => {
  beforeEach(async () => {
    await performanceService.cleanup();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await performanceService.cleanup();
  });

  describe('Optimization Rules', () => {
    it('should add and execute optimization rules', async () => {
      const mockAction = jest.fn();
      performanceService.addOptimizationRule({
        name: 'test_rule',
        condition: () => true,
        action: mockAction,
        cooldown: 1000
      });

      await performanceService.startOptimization();
      expect(mockAction).toHaveBeenCalled();
    });

    it('should respect rule cooldown periods', async () => {
      const mockAction = jest.fn();
      performanceService.addOptimizationRule({
        name: 'test_rule',
        condition: () => true,
        action: mockAction,
        cooldown: 5000
      });

      await performanceService.startOptimization();
      await performanceService.startOptimization();

      expect(mockAction).toHaveBeenCalledTimes(1);
    });

    it('should handle rule execution errors', async () => {
      const mockAction = jest.fn().mockRejectedValue(new Error('Rule failed'));
      performanceService.addOptimizationRule({
        name: 'failing_rule',
        condition: () => true,
        action: mockAction,
        cooldown: 1000
      });

      await performanceService.startOptimization();
      expect(mockAction).toHaveBeenCalled();
      // Service should continue running despite rule failure
      expect(performanceService['isOptimizing']).toBe(true);
    });
  });

  describe('Cache Management', () => {
    it('should store and retrieve cached values', async () => {
      await performanceService.set('test_key', 'test_value');
      const value = await performanceService.get('test_key');
      expect(value).toBe('test_value');
    });

    it('should handle cache expiration', async () => {
      await performanceService.set('test_key', 'test_value', 100); // 100ms TTL
      await new Promise(resolve => setTimeout(resolve, 150));
      const value = await performanceService.get('test_key');
      expect(value).toBeNull();
    });

    it('should track cache hits', async () => {
      await performanceService.set('test_key', 'test_value');
      
      // Access the value multiple times
      await performanceService.get('test_key');
      await performanceService.get('test_key');
      await performanceService.get('test_key');

      const cache = performanceService['cache'];
      const entry = cache.get('test_key');
      expect(entry?.hits).toBe(3);
    });

    it('should optimize cache when size limit is exceeded', async () => {
      // Add more than 1000 entries
      for (let i = 0; i < 1100; i++) {
        await performanceService.set(`key_${i}`, `value_${i}`);
      }

      const cache = performanceService['cache'];
      expect(cache.size).toBeLessThanOrEqual(1000);
    });
  });

  describe('Compression', () => {
    it('should compress data above threshold', async () => {
      const data = Buffer.alloc(2048).fill('x');
      const compressed = await performanceService.compress(data);
      expect(compressed.length).toBeLessThanOrEqual(data.length);
    });

    it('should not compress small data', async () => {
      const data = Buffer.from('small');
      const compressed = await performanceService.compress(data);
      expect(compressed.length).toBe(data.length);
    });

    it('should handle compression configuration updates', async () => {
      performanceService.updateCompressionConfig({
        enabled: false
      });

      const data = Buffer.alloc(2048).fill('x');
      const compressed = await performanceService.compress(data);
      expect(compressed.length).toBe(data.length);
    });
  });

  describe('Resource Optimization', () => {
    beforeEach(() => {
      jest.spyOn(metricsService, 'getMetrics').mockReturnValue({
        system_cpu_usage: { value: 50 },
        system_memory_usage: { value: 60 },
        http_request_duration_seconds: {
          p95: 0.5
        }
      });
    });

    it('should monitor resource usage', async () => {
      const usage = await performanceService.getResourceUsage();
      expect(usage.cpu).toBe(50);
      expect(usage.memory).toBe(60);
    });

    it('should trigger memory optimization when threshold is exceeded', async () => {
      jest.spyOn(metricsService, 'getMetrics').mockReturnValue({
        system_memory_usage: { value: 90 }
      });

      const optimized = jest.fn();
      performanceService.on('memory_optimized', optimized);

      await performanceService.startOptimization();
      expect(optimized).toHaveBeenCalled();
    });

    it('should trigger network optimization when latency is high', async () => {
      jest.spyOn(metricsService, 'getMetrics').mockReturnValue({
        http_request_duration_seconds: {
          p95: 2.5
        }
      });

      const optimized = jest.fn();
      performanceService.on('network_optimized', optimized);

      await performanceService.startOptimization();
      expect(optimized).toHaveBeenCalled();
    });
  });

  describe('Configuration Management', () => {
    it('should update resource thresholds', () => {
      performanceService.updateResourceThresholds({
        cpu: 90,
        memory: 95
      });

      expect(performanceService['resourceThresholds'].cpu).toBe(90);
      expect(performanceService['resourceThresholds'].memory).toBe(95);
    });

    it('should update compression config', () => {
      performanceService.updateCompressionConfig({
        level: 9,
        threshold: 512
      });

      expect(performanceService['compressionConfig'].level).toBe(9);
      expect(performanceService['compressionConfig'].threshold).toBe(512);
    });
  });

  describe('Event Emission', () => {
    it('should emit optimization events', async () => {
      const optimizationExecuted = jest.fn();
      performanceService.on('optimization_executed', optimizationExecuted);

      performanceService.addOptimizationRule({
        name: 'test_rule',
        condition: () => true,
        action: async () => {},
        cooldown: 1000
      });

      await performanceService.startOptimization();
      expect(optimizationExecuted).toHaveBeenCalledWith(expect.objectContaining({
        rule: 'test_rule',
        timestamp: expect.any(Number)
      }));
    });

    it('should emit cache optimization events', async () => {
      const cacheOptimized = jest.fn();
      performanceService.on('cache_optimized', cacheOptimized);

      // Add many entries to trigger optimization
      for (let i = 0; i < 1100; i++) {
        await performanceService.set(`key_${i}`, `value_${i}`);
      }

      expect(cacheOptimized).toHaveBeenCalledWith(expect.objectContaining({
        timestamp: expect.any(Number),
        cacheSize: expect.any(Number)
      }));
    });

    it('should emit network optimization events', async () => {
      const networkOptimized = jest.fn();
      performanceService.on('network_optimized', networkOptimized);

      jest.spyOn(metricsService, 'getMetrics').mockReturnValue({
        http_request_duration_seconds: {
          p95: 2.5
        }
      });

      await performanceService.startOptimization();
      expect(networkOptimized).toHaveBeenCalledWith(expect.objectContaining({
        timestamp: expect.any(Number),
        compressionLevel: expect.any(Number),
        compressionThreshold: expect.any(Number)
      }));
    });
  });

  describe('Service Lifecycle', () => {
    it('should start and stop optimization', async () => {
      const mockAction = jest.fn();
      performanceService.addOptimizationRule({
        name: 'test_rule',
        condition: () => true,
        action: mockAction,
        cooldown: 1000
      });

      await performanceService.startOptimization();
      expect(performanceService['isOptimizing']).toBe(true);
      expect(performanceService['optimizationInterval']).toBeDefined();

      performanceService.stopOptimization();
      expect(performanceService['isOptimizing']).toBe(false);
      expect(performanceService['optimizationInterval']).toBeNull();
    });

    it('should cleanup resources', async () => {
      await performanceService.set('test_key', 'test_value');
      await performanceService.startOptimization();

      await performanceService.cleanup();
      expect(performanceService['cache'].size).toBe(0);
      expect(performanceService['isOptimizing']).toBe(false);
    });
  });

  describe('Performance', () => {
    it('should handle concurrent cache operations', async () => {
      const operations = Array.from({ length: 100 }, (_, i) => 
        performanceService.set(`key_${i}`, `value_${i}`)
      );

      await Promise.all(operations);
      expect(performanceService['cache'].size).toBeLessThanOrEqual(1000);
    });

    it('should handle rapid optimization rule execution', async () => {
      const mockAction = jest.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 50))
      );

      performanceService.addOptimizationRule({
        name: 'slow_rule',
        condition: () => true,
        action: mockAction,
        cooldown: 0
      });

      await performanceService.startOptimization();
      await performanceService.startOptimization();
      await performanceService.startOptimization();

      expect(mockAction).toHaveBeenCalledTimes(1); // Only one execution should be in progress
    });
  });
}); 