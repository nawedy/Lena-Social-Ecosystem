import { performanceMonitor } from '../../utils/performance';
import LRU from 'lru-cache';
import { AsyncStorage } from '@react-native-async-storage/async-storage';

interface CacheOptions {
  maxAge?: number;
  maxSize?: number;
  persistKey?: string;
  compression?: boolean;
}

interface CacheStats {
  hits: number;
  misses: number;
  totalOperations: number;
  hitRate: number;
}

export class AdvancedCacheService {
  private static instance: AdvancedCacheService;
  private memoryCache: LRU<string, any>;
  private stats: CacheStats;
  private persistenceEnabled: boolean;

  private constructor() {
    this.memoryCache = new LRU({
      max: 500, // Maximum number of items
      maxSize: 5000, // Maximum cache size in bytes
      sizeCalculation: (value, key) => {
        return JSON.stringify(value).length + key.length;
      },
      ttl: 1000 * 60 * 60, // 1 hour default TTL
    });

    this.stats = {
      hits: 0,
      misses: 0,
      totalOperations: 0,
      hitRate: 0,
    };

    this.persistenceEnabled = true;
  }

  public static getInstance(): AdvancedCacheService {
    if (!AdvancedCacheService.instance) {
      AdvancedCacheService.instance = new AdvancedCacheService();
    }
    return AdvancedCacheService.instance;
  }

  public async set(
    key: string,
    value: any,
    options: CacheOptions = {}
  ): Promise<void> {
    const trace = await performanceMonitor.startTrace('cache_set');
    try {
      // Compress data if needed
      const processedValue = options.compression
        ? await this.compressData(value)
        : value;

      // Set in memory cache
      this.memoryCache.set(key, processedValue, {
        ttl: options.maxAge,
        size: options.maxSize,
      });

      // Persist to storage if needed
      if (options.persistKey && this.persistenceEnabled) {
        await this.persistToStorage(options.persistKey, processedValue);
      }

      trace.putMetric('success', 1);
    } catch (error) {
      trace.putMetric('error', 1);
      console.error('Cache set error:', error);
      throw error;
    } finally {
      await trace.stop();
    }
  }

  public async get<T>(
    key: string,
    options: CacheOptions = {}
  ): Promise<T | null> {
    const trace = await performanceMonitor.startTrace('cache_get');
    try {
      // Try memory cache first
      let value = this.memoryCache.get(key) as T;

      if (value) {
        this.updateStats(true);
        trace.putMetric('cache_hit', 1);
        return options.compression ? await this.decompressData(value) : value;
      }

      // Try persistent storage if enabled
      if (options.persistKey && this.persistenceEnabled) {
        value = await this.getFromStorage<T>(options.persistKey);
        if (value) {
          // Update memory cache
          this.memoryCache.set(key, value);
          this.updateStats(true);
          trace.putMetric('storage_hit', 1);
          return options.compression ? await this.decompressData(value) : value;
        }
      }

      this.updateStats(false);
      trace.putMetric('cache_miss', 1);
      return null;
    } catch (error) {
      trace.putMetric('error', 1);
      console.error('Cache get error:', error);
      return null;
    } finally {
      await trace.stop();
    }
  }

  public async invalidate(
    key: string,
    options: CacheOptions = {}
  ): Promise<void> {
    const trace = await performanceMonitor.startTrace('cache_invalidate');
    try {
      // Remove from memory cache
      this.memoryCache.delete(key);

      // Remove from persistent storage if needed
      if (options.persistKey && this.persistenceEnabled) {
        await AsyncStorage.removeItem(options.persistKey);
      }

      trace.putMetric('success', 1);
    } catch (error) {
      trace.putMetric('error', 1);
      console.error('Cache invalidate error:', error);
      throw error;
    } finally {
      await trace.stop();
    }
  }

  public async clear(): Promise<void> {
    const trace = await performanceMonitor.startTrace('cache_clear');
    try {
      // Clear memory cache
      this.memoryCache.clear();

      // Clear persistent storage
      if (this.persistenceEnabled) {
        await AsyncStorage.clear();
      }

      // Reset stats
      this.resetStats();

      trace.putMetric('success', 1);
    } catch (error) {
      trace.putMetric('error', 1);
      console.error('Cache clear error:', error);
      throw error;
    } finally {
      await trace.stop();
    }
  }

  public getStats(): CacheStats {
    return { ...this.stats };
  }

  private updateStats(hit: boolean): void {
    if (hit) {
      this.stats.hits++;
    } else {
      this.stats.misses++;
    }
    this.stats.totalOperations++;
    this.stats.hitRate = this.stats.hits / this.stats.totalOperations;
  }

  private resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      totalOperations: 0,
      hitRate: 0,
    };
  }

  private async compressData(data: any): Promise<any> {
    // Implement compression logic
    return data;
  }

  private async decompressData(data: any): Promise<any> {
    // Implement decompression logic
    return data;
  }

  private async persistToStorage(key: string, value: any): Promise<void> {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error('Storage persistence error:', error);
      throw error;
    }
  }

  private async getFromStorage<T>(key: string): Promise<T | null> {
    try {
      const value = await AsyncStorage.getItem(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Storage retrieval error:', error);
      return null;
    }
  }
}
