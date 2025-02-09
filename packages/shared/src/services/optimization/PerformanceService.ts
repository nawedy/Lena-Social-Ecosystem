import { EventEmitter } from 'events';
import { configService } from '../config/GlobalConfig';
import { errorService } from '../error/ErrorService';
import { loggingService } from '../logging/LoggingService';
import { metricsService } from '../monitoring/MetricsService';
import { tracingService } from '../monitoring/TracingService';

interface CacheConfig {
  maxSize: number;
  ttl: number;
  strategy: 'lru' | 'lfu' | 'fifo';
}

interface CompressionConfig {
  enabled: boolean;
  level: number;
  threshold: number;
}

interface OptimizationRule {
  name: string;
  condition: (metrics: any) => boolean;
  action: () => Promise<void>;
  cooldown: number;
  lastExecuted?: number;
}

interface ResourceUsage {
  cpu: number;
  memory: number;
  network: {
    rx: number;
    tx: number;
  };
  storage: {
    used: number;
    total: number;
  };
}

class PerformanceService extends EventEmitter {
  private static instance: PerformanceService;
  private cache: Map<string, { value: any; expires: number; hits: number }> = new Map();
  private compressionConfig: CompressionConfig;
  private optimizationRules: OptimizationRule[] = [];
  private resourceThresholds: {
    cpu: number;
    memory: number;
    network: number;
    storage: number;
  };
  private isOptimizing = false;
  private optimizationInterval: NodeJS.Timer | null = null;

  private constructor() {
    super();
    this.setupDefaultConfig();
    this.setupOptimizationRules();
  }

  static getInstance(): PerformanceService {
    if (!PerformanceService.instance) {
      PerformanceService.instance = new PerformanceService();
    }
    return PerformanceService.instance;
  }

  private setupDefaultConfig() {
    this.compressionConfig = {
      enabled: true,
      level: 6,
      threshold: 1024 // 1KB
    };

    this.resourceThresholds = {
      cpu: 80,
      memory: 85,
      network: 90,
      storage: 85
    };
  }

  private setupOptimizationRules() {
    // Memory optimization rule
    this.addOptimizationRule({
      name: 'memory_optimization',
      condition: (metrics) => metrics.system_memory_usage?.value > this.resourceThresholds.memory,
      action: async () => {
        await this.optimizeMemory();
      },
      cooldown: 5 * 60 * 1000 // 5 minutes
    });

    // Cache optimization rule
    this.addOptimizationRule({
      name: 'cache_optimization',
      condition: (metrics) => this.cache.size > 1000,
      action: async () => {
        await this.optimizeCache();
      },
      cooldown: 60 * 1000 // 1 minute
    });

    // Network optimization rule
    this.addOptimizationRule({
      name: 'network_optimization',
      condition: (metrics) => 
        metrics.http_request_duration_seconds?.p95 > 1.0 ||
        metrics.http_error_rate?.value > 0.05,
      action: async () => {
        await this.optimizeNetwork();
      },
      cooldown: 10 * 60 * 1000 // 10 minutes
    });
  }

  addOptimizationRule(rule: OptimizationRule) {
    this.optimizationRules.push(rule);
  }

  async startOptimization() {
    if (this.isOptimizing) return;

    this.isOptimizing = true;
    this.optimizationInterval = setInterval(async () => {
      await this.runOptimizations();
    }, 60 * 1000); // Run every minute

    await this.runOptimizations(); // Run immediately
  }

  stopOptimization() {
    if (this.optimizationInterval) {
      clearInterval(this.optimizationInterval);
      this.optimizationInterval = null;
    }
    this.isOptimizing = false;
  }

  private async runOptimizations() {
    return tracingService.trace('performance.optimize', async (span) => {
      try {
        const metrics = metricsService.getMetrics();
        span.setAttributes({
          'optimization.rules': this.optimizationRules.length
        });

        for (const rule of this.optimizationRules) {
          if (await this.shouldRunRule(rule, metrics)) {
            span.addEvent(`running_rule_${rule.name}`);
            
            try {
              await rule.action();
              rule.lastExecuted = Date.now();

              this.emit('optimization_executed', {
                rule: rule.name,
                timestamp: Date.now()
              });
            } catch (error) {
              errorService.handleError(error, {
                component: 'PerformanceService',
                action: 'runOptimizations',
                rule: rule.name
              });
            }
          }
        }
      } catch (error) {
        span.setStatus('error', error.message);
        errorService.handleError(error, {
          component: 'PerformanceService',
          action: 'runOptimizations'
        });
      }
    });
  }

  private async shouldRunRule(rule: OptimizationRule, metrics: any): Promise<boolean> {
    if (rule.lastExecuted && Date.now() - rule.lastExecuted < rule.cooldown) {
      return false;
    }
    return rule.condition(metrics);
  }

  // Cache management
  async get<T>(key: string): Promise<T | null> {
    return tracingService.trace('performance.cache.get', async () => {
      const entry = this.cache.get(key);
      if (!entry) return null;

      if (entry.expires < Date.now()) {
        this.cache.delete(key);
        return null;
      }

      entry.hits++;
      return entry.value as T;
    });
  }

  async set(key: string, value: any, ttl: number = 3600000): Promise<void> {
    return tracingService.trace('performance.cache.set', async () => {
      this.cache.set(key, {
        value,
        expires: Date.now() + ttl,
        hits: 0
      });

      if (this.cache.size > 1000) {
        await this.optimizeCache();
      }
    });
  }

  // Compression
  async compress(data: string | Buffer): Promise<Buffer> {
    return tracingService.trace('performance.compress', async () => {
      if (!this.compressionConfig.enabled) return Buffer.from(data);

      const input = Buffer.from(data);
      if (input.length < this.compressionConfig.threshold) {
        return input;
      }

      // Implementation would use actual compression library
      // For now, return original data
      return input;
    });
  }

  async decompress(data: Buffer): Promise<Buffer> {
    return tracingService.trace('performance.decompress', async () => {
      if (!this.compressionConfig.enabled) return data;

      // Implementation would use actual compression library
      // For now, return original data
      return data;
    });
  }

  // Resource optimization
  private async optimizeMemory() {
    return tracingService.trace('performance.optimize.memory', async () => {
      // Clear expired cache entries
      const now = Date.now();
      for (const [key, entry] of this.cache.entries()) {
        if (entry.expires < now) {
          this.cache.delete(key);
        }
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      this.emit('memory_optimized', {
        timestamp: Date.now(),
        cacheSize: this.cache.size
      });
    });
  }

  private async optimizeCache() {
    return tracingService.trace('performance.optimize.cache', async () => {
      const entries = Array.from(this.cache.entries());
      const now = Date.now();

      // Remove expired entries
      entries
        .filter(([_, entry]) => entry.expires < now)
        .forEach(([key]) => this.cache.delete(key));

      if (this.cache.size > 1000) {
        // Sort by hits and keep top 1000
        entries.sort((a, b) => b[1].hits - a[1].hits);
        this.cache.clear();
        entries.slice(0, 1000).forEach(([key, entry]) => {
          this.cache.set(key, entry);
        });
      }

      this.emit('cache_optimized', {
        timestamp: Date.now(),
        cacheSize: this.cache.size
      });
    });
  }

  private async optimizeNetwork() {
    return tracingService.trace('performance.optimize.network', async () => {
      // Adjust compression settings based on network conditions
      const metrics = metricsService.getMetrics();
      const networkLatency = metrics.http_request_duration_seconds?.p95 || 0;

      if (networkLatency > 2.0) {
        this.compressionConfig.level = 9; // Max compression
        this.compressionConfig.threshold = 512; // Lower threshold
      } else if (networkLatency > 1.0) {
        this.compressionConfig.level = 6; // Medium compression
        this.compressionConfig.threshold = 1024;
      } else {
        this.compressionConfig.level = 4; // Light compression
        this.compressionConfig.threshold = 2048;
      }

      this.emit('network_optimized', {
        timestamp: Date.now(),
        compressionLevel: this.compressionConfig.level,
        compressionThreshold: this.compressionConfig.threshold
      });
    });
  }

  // Resource monitoring
  async getResourceUsage(): Promise<ResourceUsage> {
    return tracingService.trace('performance.resources', async () => {
      const metrics = metricsService.getMetrics();

      return {
        cpu: metrics.system_cpu_usage?.value || 0,
        memory: metrics.system_memory_usage?.value || 0,
        network: {
          rx: 0, // Would be implemented with actual metrics
          tx: 0
        },
        storage: {
          used: 0, // Would be implemented with actual metrics
          total: 0
        }
      };
    });
  }

  // Configuration
  updateCompressionConfig(config: Partial<CompressionConfig>) {
    this.compressionConfig = {
      ...this.compressionConfig,
      ...config
    };
  }

  updateResourceThresholds(thresholds: Partial<typeof this.resourceThresholds>) {
    this.resourceThresholds = {
      ...this.resourceThresholds,
      ...thresholds
    };
  }

  // Cleanup
  async cleanup() {
    this.stopOptimization();
    this.cache.clear();
  }
}

// Export singleton instance
export const performanceService = PerformanceService.getInstance(); 