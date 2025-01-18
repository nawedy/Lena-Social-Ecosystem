import { Request, Response, NextFunction } from 'express';
import { createClient } from 'redis';

import { config } from '../config';

interface CacheOptions {
  duration: number;
  tags?: string[];
  compression?: boolean;
}

type CacheableData = string | number | boolean | object | null;

class CacheService {
  private client: ReturnType<typeof createClient>;
  private static instance: CacheService;

  private constructor() {
    this.client = createClient({
      url: config.redis.url,
      password: config.redis.password,
    });

    this.client.on('error', (err) => console.error('Redis Cache Error:', err));
    this.client.connect().catch(console.error);
  }

  public static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }

  // Multi-level caching strategy
  private async getFromMultiLevel(key: string): Promise<string | null> {
    try {
      // Check memory cache first (Redis)
      const result = await this.client.get(key);
      if (result) {
        return result;
      }

      return null;
    } catch (error) {
      console.error('Cache retrieval error:', error);
      return null;
    }
  }

  // Cache middleware for Express
  public cacheMiddleware(duration: number): (req: Request, res: Response, next: NextFunction) => Promise<void> {
    return async (req: Request, res: Response, next: NextFunction) => {
      if (req.method !== 'GET') {
        return next();
      }

      const key = `cache:${req.originalUrl || req.url}`;
      try {
        const cachedResponse = await this.getFromMultiLevel(key);

        if (cachedResponse) {
          return res.json(JSON.parse(cachedResponse));
        }

        // Store the original send function
        const originalSend = res.send;

        // Override send
        res.send = async function (body: CacheableData) {
          try {
            // Cache the response
            await CacheService.instance.client.setEx(
              key,
              duration,
              typeof body === 'string' ? body : JSON.stringify(body)
            );
          } catch (error) {
            console.error('Cache storage error:', error);
          }

          // Call the original send function
          return originalSend.call(this, body);
        };

        next();
      } catch (error) {
        console.error('Cache middleware error:', error);
        next();
      }
    };
  }

  // Cache specific data with custom key
  public async cache(
    key: string,
    data: CacheableData,
    duration: number,
    options?: CacheOptions
  ): Promise<void> {
    try {
      const value = JSON.stringify(data);

      // Store in Redis
      await this.client.setEx(key, duration, value);

      // If tags are provided, store the key in tag sets
      if (options?.tags) {
        await Promise.all(options.tags.map((tag) => this.client.sAdd(`cache:tag:${tag}`, key)));
      }
    } catch (error) {
      console.error('Cache storage error:', error);
      throw error;
    }
  }

  // Retrieve cached data
  public async get<T extends CacheableData>(key: string): Promise<T | null> {
    try {
      const data = await this.getFromMultiLevel(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Cache retrieval error:', error);
      return null;
    }
  }

  // Invalidate cache by key
  public async invalidate(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (error) {
      console.error('Cache invalidation error:', error);
      throw error;
    }
  }

  // Invalidate cache by tag
  public async invalidateByTag(tag: string): Promise<void> {
    try {
      // Get all keys associated with the tag
      const keys = await this.client.sMembers(`cache:tag:${tag}`);

      if (keys.length > 0) {
        // Delete all keys and the tag set
        await Promise.all([this.client.del(keys), this.client.del(`cache:tag:${tag}`)]);
      }
    } catch (error) {
      console.error('Cache tag invalidation error:', error);
      throw error;
    }
  }

  // Clear entire cache
  public async clear(): Promise<void> {
    try {
      await this.client.flushAll();
    } catch (error) {
      console.error('Cache clear error:', error);
      throw error;
    }
  }

  // Cache warming for frequently accessed data
  public async warmCache(
    key: string,
    dataFetcher: () => Promise<CacheableData>,
    duration: number
  ): Promise<void> {
    try {
      const data = await dataFetcher();
      await this.cache(key, data, duration);
    } catch (error) {
      console.error('Cache warming error:', error);
      throw error;
    }
  }

  // Batch cache operations
  public async batchGet<T extends CacheableData>(keys: string[]): Promise<(T | null)[]> {
    try {
      const results = await this.client.mGet(keys);
      return results.map((result) => (result ? JSON.parse(result) : null));
    } catch (error) {
      console.error('Batch cache retrieval error:', error);
      throw error;
    }
  }
}

export const cacheService = CacheService.getInstance();
