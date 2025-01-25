import { BigQuery } from '@google-cloud/bigquery';
import { Redis } from 'ioredis';

import { config } from '../config';

import { advancedAnalytics } from './advancedAnalytics';
import { performanceMonitoring } from './performanceMonitoring';

interface CachePattern {
  pattern: string;
  ttl: number;
  priority: number;
  warmingStrategy: 'preemptive' | 'lazy' | 'scheduled';
  schedule?: string;
  analyticsEnabled: boolean;
}

interface CacheAnalytics {
  pattern: string;
  hitRate: number;
  missRate: number;
  avgLatency: number;
  size: number;
  lastWarmed: string;
  warmingDuration: number;
}

export class CacheWarmingService {
  private static instance: CacheWarmingService;
  private redis: Redis;
  private bigquery: BigQuery;
  private patterns: Map<string, CachePattern>;
  private analytics: Map<string, CacheAnalytics>;
  private warmingQueue: string[];
  private isWarming: boolean;
  private readonly ANALYTICS_INTERVAL = 300000; // 5 minutes
  private readonly WARMING_CONCURRENCY = 5;

  private constructor() {
    this.redis = new Redis(config.REDIS_URL);
    this.bigquery = new BigQuery({
      projectId: config.gcp.projectId,
      keyFilename: config.gcp.keyFile,
    });
    this.patterns = new Map();
    this.analytics = new Map();
    this.warmingQueue = [];
    this.isWarming = false;

    this.initializePatterns();
    this.startAnalyticsCollection();
    this.startScheduledWarming();
  }

  public static getInstance(): CacheWarmingService {
    if (!CacheWarmingService.instance) {
      CacheWarmingService.instance = new CacheWarmingService();
    }
    return CacheWarmingService.instance;
  }

  private async initializePatterns(): Promise<void> {
    // User profiles pattern
    this.patterns.set('user:*', {
      pattern: 'user:*',
      ttl: 3600, // 1 hour
      priority: 1,
      warmingStrategy: 'scheduled',
      schedule: '0 */1 * * *', // Every hour
      analyticsEnabled: true,
    });

    // Post feed pattern
    this.patterns.set('feed:*', {
      pattern: 'feed:*',
      ttl: 300, // 5 minutes
      priority: 2,
      warmingStrategy: 'preemptive',
      analyticsEnabled: true,
    });

    // Search results pattern
    this.patterns.set('search:*', {
      pattern: 'search:*',
      ttl: 1800, // 30 minutes
      priority: 3,
      warmingStrategy: 'lazy',
      analyticsEnabled: true,
    });

    // Configuration pattern
    this.patterns.set('config:*', {
      pattern: 'config:*',
      ttl: 86400, // 24 hours
      priority: 1,
      warmingStrategy: 'scheduled',
      schedule: '0 0 * * *', // Daily
      analyticsEnabled: true,
    });
  }

  // Cache Warming Methods
  async warmCache(pattern: string): Promise<void> {
    const cachePattern = this.patterns.get(pattern);
    if (!cachePattern) {
      throw new Error('Cache pattern not found');
    }

    const startTime = Date.now();
    const keys = await this.redis.keys(pattern);

    try {
      await Promise.all(
        keys.map(async key => {
          const value = await this.redis.get(key);
          if (value) {
            await this.redis.setex(key, cachePattern.ttl, value);
          }
        })
      );

      const duration = Date.now() - startTime;
      await this.updateAnalytics(pattern, {
        lastWarmed: new Date().toISOString(),
        warmingDuration: duration,
      });

      // Record metrics
      performanceMonitoring.recordCustomMetric({
        name: 'cache-warming-duration',
        value: duration,
        labels: { pattern },
      });
    } catch (error) {
      performanceMonitoring.recordError(error as Error, {
        operation: 'warmCache',
        pattern,
      });
      throw error;
    }
  }

  async warmCacheByQuery(params: {
    pattern: string;
    query: string;
    params?: unknown[];
  }): Promise<void> {
    const startTime = Date.now();
    try {
      const [rows] = await this.bigquery.query({
        query: params.query,
        params: params.params,
      });

      await Promise.all(
        rows.map(async row => {
          const key = this.generateCacheKey(params.pattern, row);
          await this.redis.setex(
            key,
            this.patterns.get(params.pattern)?.ttl || 3600,
            JSON.stringify(row)
          );
        })
      );

      const duration = Date.now() - startTime;
      await this.updateAnalytics(params.pattern, {
        lastWarmed: new Date().toISOString(),
        warmingDuration: duration,
      });
    } catch (error) {
      performanceMonitoring.recordError(error as Error, {
        operation: 'warmCacheByQuery',
        params,
      });
      throw error;
    }
  }

  // Cache Analytics Methods
  async getCacheAnalytics(
    pattern: string
  ): Promise<CacheAnalytics | undefined> {
    return this.analytics.get(pattern);
  }

  async getAllCacheAnalytics(): Promise<CacheAnalytics[]> {
    return Array.from(this.analytics.values());
  }

  // Cache Management Methods
  async addPattern(pattern: CachePattern): Promise<void> {
    this.patterns.set(pattern.pattern, pattern);
    this.analytics.set(pattern.pattern, {
      pattern: pattern.pattern,
      hitRate: 0,
      missRate: 0,
      avgLatency: 0,
      size: 0,
      lastWarmed: new Date().toISOString(),
      warmingDuration: 0,
    });
  }

  async removePattern(pattern: string): Promise<void> {
    this.patterns.delete(pattern);
    this.analytics.delete(pattern);
  }

  // Cache Optimization Methods
  async optimizeCacheTTL(pattern: string): Promise<void> {
    const analytics = this.analytics.get(pattern);
    if (!analytics) return;

    const cachePattern = this.patterns.get(pattern);
    if (!cachePattern) return;

    // Adjust TTL based on hit rate
    if (analytics.hitRate > 0.8) {
      // High hit rate - increase TTL
      cachePattern.ttl = Math.min(cachePattern.ttl * 1.5, 86400); // Max 24 hours
    } else if (analytics.hitRate < 0.2) {
      // Low hit rate - decrease TTL
      cachePattern.ttl = Math.max(cachePattern.ttl * 0.5, 60); // Min 1 minute
    }

    this.patterns.set(pattern, cachePattern);
  }

  async optimizeWarmingStrategy(pattern: string): Promise<void> {
    const analytics = this.analytics.get(pattern);
    if (!analytics) return;

    const cachePattern = this.patterns.get(pattern);
    if (!cachePattern) return;

    // Adjust warming strategy based on analytics
    if (analytics.missRate > 0.5 && analytics.avgLatency > 1000) {
      // High miss rate and high latency - switch to preemptive
      cachePattern.warmingStrategy = 'preemptive';
    } else if (analytics.hitRate > 0.8 && analytics.avgLatency < 100) {
      // High hit rate and low latency - switch to lazy
      cachePattern.warmingStrategy = 'lazy';
    }

    this.patterns.set(pattern, cachePattern);
  }

  // Private Methods
  private startAnalyticsCollection(): void {
    setInterval(async () => {
      for (const [pattern, cachePattern] of this.patterns.entries()) {
        if (!cachePattern.analyticsEnabled) continue;

        try {
          const keys = await this.redis.keys(pattern);
          const pipeline = this.redis.pipeline();

          keys.forEach(key => {
            pipeline.object('IDLETIME', key);
            pipeline.memory('USAGE', key);
          });

          const results = await pipeline.exec();
          if (!results) continue;

          const idleTimes = results
            .filter((_, i) => i % 2 === 0)
            .map(r => r?.[1]);
          const memorySizes = results
            .filter((_, i) => i % 2 === 1)
            .map(r => r?.[1]);

          const totalSize = memorySizes.reduce(
            (sum, size) => sum + ((size as number) || 0),
            0
          );
          const avgIdleTime =
            idleTimes.reduce((sum, time) => sum + ((time as number) || 0), 0) /
            idleTimes.length;

          const analytics = this.analytics.get(pattern) || {
            pattern,
            hitRate: 0,
            missRate: 0,
            avgLatency: 0,
            size: 0,
            lastWarmed: new Date().toISOString(),
            warmingDuration: 0,
          };

          analytics.size = totalSize;
          this.analytics.set(pattern, analytics);

          // Record metrics
          advancedAnalytics.writeMetricData({
            name: 'cache-analytics',
            value: totalSize,
            timestamp: new Date().toISOString(),
            labels: {
              pattern,
              metric: 'size',
            },
          });

          advancedAnalytics.writeMetricData({
            name: 'cache-analytics',
            value: avgIdleTime,
            timestamp: new Date().toISOString(),
            labels: {
              pattern,
              metric: 'idle-time',
            },
          });
        } catch (error) {
          performanceMonitoring.recordError(error as Error, {
            operation: 'collectAnalytics',
            pattern,
          });
        }
      }
    }, this.ANALYTICS_INTERVAL);
  }

  private startScheduledWarming(): void {
    setInterval(async () => {
      for (const [pattern, cachePattern] of this.patterns.entries()) {
        if (cachePattern.warmingStrategy === 'scheduled') {
          if (!this.shouldWarmPattern(pattern)) continue;

          this.warmingQueue.push(pattern);
          if (!this.isWarming) {
            this.processWarmingQueue();
          }
        }
      }
    }, 60000); // Check every minute
  }

  private async processWarmingQueue(): Promise<void> {
    if (this.isWarming || this.warmingQueue.length === 0) return;

    this.isWarming = true;
    const concurrentPatterns = this.warmingQueue.splice(
      0,
      this.WARMING_CONCURRENCY
    );

    try {
      await Promise.all(
        concurrentPatterns.map(pattern => this.warmCache(pattern))
      );
    } catch (error) {
      performanceMonitoring.recordError(error as Error, {
        operation: 'processWarmingQueue',
      });
    } finally {
      this.isWarming = false;
      if (this.warmingQueue.length > 0) {
        this.processWarmingQueue();
      }
    }
  }

  private shouldWarmPattern(pattern: string): boolean {
    const cachePattern = this.patterns.get(pattern);
    if (!cachePattern || !cachePattern.schedule) return false;

    const analytics = this.analytics.get(pattern);
    if (!analytics) return true;

    const lastWarmed = new Date(analytics.lastWarmed);
    const now = new Date();

    // Parse cron-like schedule
    const [minute, hour, , ,] = cachePattern.schedule.split(' ');

    if (minute === '*' && hour === '*') {
      return true;
    }

    const scheduleHour = parseInt(hour.replace('*/', ''));
    return now.getTime() - lastWarmed.getTime() >= scheduleHour * 3600000;
  }

  private generateCacheKey(
    pattern: string,
    data: Record<string, unknown>
  ): string {
    // Replace wildcards with actual values from data
    return pattern.replace(/\*/g, (match, offset) => {
      const field = pattern.substring(0, offset).split(':').pop();
      return data[field] || match;
    });
  }

  private async updateAnalytics(
    pattern: string,
    updates: Partial<CacheAnalytics>
  ): Promise<void> {
    const analytics = this.analytics.get(pattern);
    if (!analytics) return;

    this.analytics.set(pattern, {
      ...analytics,
      ...updates,
    });

    // Record to advanced analytics
    Object.entries(updates).forEach(([key, value]) => {
      if (typeof value === 'number') {
        advancedAnalytics.writeMetricData({
          name: 'cache-analytics',
          value,
          timestamp: new Date().toISOString(),
          labels: {
            pattern,
            metric: key,
          },
        });
      }
    });
  }
}

export const cacheWarming = CacheWarmingService.getInstance();
