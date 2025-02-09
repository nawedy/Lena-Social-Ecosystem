import { PerformanceMonitor } from '../monitoring/PerformanceMonitor';
import { ResourceOptimizer } from '../optimization/ResourceOptimizer';
import { ConnectionPool } from '../database/ConnectionPool';

describe('Performance Optimization Suite', () => {
  let performanceMonitor: PerformanceMonitor;
  let resourceOptimizer: ResourceOptimizer;
  let connectionPool: ConnectionPool;

  beforeEach(() => {
    performanceMonitor = new PerformanceMonitor({
      cpu: 70,
      memory: 75,
      latency: 500,
      errorRate: 3
    });

    resourceOptimizer = new ResourceOptimizer({
      autoScale: true,
      resourceLimits: {
        maxMemory: 512 * 1024 * 1024, // 512MB
        maxConcurrentRequests: 100,
        maxBatchSize: 50
      },
      throttling: {
        enabled: true,
        threshold: 500,
        cooldown: 2000
      }
    }, performanceMonitor);

    connectionPool = new ConnectionPool(
      {
        minSize: 5,
        maxSize: 20,
        acquireTimeout: 5000,
        idleTimeout: 30000,
        validateOnBorrow: true
      },
      async () => ({ id: Math.random() }), // Mock connection creation
      async (conn) => {}, // Mock connection destruction
      resourceOptimizer
    );
  });

  afterEach(async () => {
    performanceMonitor.stop();
    await connectionPool.close();
  });

  describe('CPU Bottleneck Handling', () => {
    it('should throttle requests when CPU usage is high', async () => {
      // Simulate high CPU usage
      const cpuEvent = { type: 'cpu', value: 85 };
      performanceMonitor.emit('bottleneck', cpuEvent);

      // Try to execute tasks
      const tasks = Array(10).fill(null).map(() => 
        resourceOptimizer.executeWithOptimization(
          () => Promise.resolve(true)
        )
      );

      const results = await Promise.all(tasks);
      const metrics = resourceOptimizer.getMetrics();

      expect(metrics.isThrottling).toBe(true);
      expect(results.filter(Boolean).length).toBe(10);
    });

    it('should reduce batch size under extreme CPU load', async () => {
      // Simulate critical CPU usage
      const cpuEvent = { type: 'cpu', value: 95 };
      performanceMonitor.emit('bottleneck', cpuEvent);

      // Execute batch operations
      const batchTasks = Array(100).fill(null).map(() => 
        resourceOptimizer.executeWithOptimization(
          () => Promise.resolve(true),
          'low'
        )
      );

      await Promise.all(batchTasks);
      const metrics = resourceOptimizer.getMetrics();

      expect(metrics.queueLength).toBeGreaterThan(0);
    });
  });

  describe('Memory Bottleneck Handling', () => {
    it('should clear cache when memory usage is critical', async () => {
      // Simulate critical memory usage
      const memoryEvent = { type: 'memory', value: 92 };
      performanceMonitor.emit('bottleneck', memoryEvent);

      // Try to execute memory-intensive tasks
      const tasks = Array(5).fill(null).map(() => 
        resourceOptimizer.executeWithOptimization(
          () => Promise.resolve(true),
          'high'
        )
      );

      await Promise.all(tasks);
      const metrics = resourceOptimizer.getMetrics();

      expect(metrics.isThrottling).toBe(true);
    });
  });

  describe('Connection Pool Management', () => {
    it('should handle connection limits correctly', async () => {
      // Request more connections than maxSize
      const connectionRequests = Array(25).fill(null).map(() => 
        connectionPool.acquire()
      );

      const connections = await Promise.all(connectionRequests);
      const metrics = connectionPool.getMetrics();

      expect(connections.length).toBe(25);
      expect(metrics.totalCreated).toBeLessThanOrEqual(20); // maxSize
      expect(metrics.activeConnections).toBeLessThanOrEqual(20);
    });

    it('should reuse connections efficiently', async () => {
      // Acquire and release connections repeatedly
      for (let i = 0; i < 10; i++) {
        const conn = await connectionPool.acquire();
        await connectionPool.release(conn);
      }

      const metrics = connectionPool.getMetrics();
      expect(metrics.totalCreated).toBeLessThanOrEqual(10);
      expect(metrics.idleConnections).toBeGreaterThan(0);
    });
  });

  describe('Latency Handling', () => {
    it('should optimize connections under high latency', async () => {
      // Simulate high latency
      const latencyEvent = { type: 'latency', value: 1200 };
      performanceMonitor.emit('bottleneck', latencyEvent);

      // Execute requests
      const requests = Array(10).fill(null).map(() => 
        resourceOptimizer.executeWithOptimization(
          () => Promise.resolve(true)
        )
      );

      await Promise.all(requests);
      const metrics = resourceOptimizer.getMetrics();

      expect(metrics.isThrottling).toBe(true);
    });
  });

  describe('Error Rate Handling', () => {
    it('should enable circuit breaker under high error rates', async () => {
      // Simulate high error rate
      const errorEvent = { type: 'error_rate', value: 15 };
      performanceMonitor.emit('bottleneck', errorEvent);

      // Try to execute potentially failing tasks
      const tasks = Array(5).fill(null).map(() => 
        resourceOptimizer.executeWithOptimization(
          () => Promise.resolve(true)
        )
      );

      await Promise.all(tasks);
      const metrics = resourceOptimizer.getMetrics();

      expect(metrics.isThrottling).toBe(true);
    });
  });

  describe('Integration Tests', () => {
    it('should handle multiple bottlenecks simultaneously', async () => {
      // Simulate multiple bottlenecks
      performanceMonitor.emit('bottleneck', { type: 'cpu', value: 88 });
      performanceMonitor.emit('bottleneck', { type: 'memory', value: 87 });
      performanceMonitor.emit('bottleneck', { type: 'latency', value: 800 });

      // Execute mixed priority tasks
      const tasks = [
        ...Array(5).fill(null).map(() => 
          resourceOptimizer.executeWithOptimization(
            () => Promise.resolve(true),
            'high'
          )
        ),
        ...Array(10).fill(null).map(() => 
          resourceOptimizer.executeWithOptimization(
            () => Promise.resolve(true),
            'medium'
          )
        ),
        ...Array(15).fill(null).map(() => 
          resourceOptimizer.executeWithOptimization(
            () => Promise.resolve(true),
            'low'
          )
        )
      ];

      const results = await Promise.all(tasks);
      const metrics = resourceOptimizer.getMetrics();

      expect(results.length).toBe(30);
      expect(metrics.isThrottling).toBe(true);
      expect(metrics.queueLength).toBeGreaterThan(0);
    });

    it('should recover from bottlenecks', async () => {
      // Simulate and then resolve bottlenecks
      performanceMonitor.emit('bottleneck', { type: 'cpu', value: 92 });
      
      // Wait for throttling cooldown
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Execute new tasks
      const tasks = Array(5).fill(null).map(() => 
        resourceOptimizer.executeWithOptimization(
          () => Promise.resolve(true)
        )
      );

      await Promise.all(tasks);
      const metrics = resourceOptimizer.getMetrics();

      expect(metrics.isThrottling).toBe(false);
    });
  });
}); 