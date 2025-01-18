import { BskyAgent } from '@atproto/api';

interface CacheConfig {
  ttl: number; // Time to live in milliseconds
  maxSize: number; // Maximum number of items
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

export class ATProtocolCache {
  private agent: BskyAgent;
  private cache: Map<string, CacheEntry<any>>;
  private rateLimits: Map<string, RateLimitEntry>;
  private cacheConfig: CacheConfig;
  private rateLimitConfig: RateLimitConfig;

  constructor(
    agent: BskyAgent,
    cacheConfig: Partial<CacheConfig> = {},
    rateLimitConfig: Partial<RateLimitConfig> = {}
  ) {
    this.agent = agent;
    this.cache = new Map();
    this.rateLimits = new Map();

    this.cacheConfig = {
      ttl: cacheConfig.ttl || 5 * 60 * 1000, // 5 minutes default
      maxSize: cacheConfig.maxSize || 1000,
    };

    this.rateLimitConfig = {
      maxRequests: rateLimitConfig.maxRequests || 100,
      windowMs: rateLimitConfig.windowMs || 60 * 1000, // 1 minute default
    };

    // Start cache cleanup interval
    setInterval(() => this.cleanupCache(), 60 * 1000);
  }

  // Cache Operations
  public async getCached<T>(
    key: string,
    fetchFn: () => Promise<T>,
    options: Partial<CacheConfig> = {}
  ): Promise<T> {
    const cacheKey = this.generateCacheKey(key);
    const cached = this.cache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now()) {
      return cached.data as T;
    }

    // Check rate limit before making the request
    await this.checkRateLimit(key);

    const data = await fetchFn();
    this.setCached(key, data, options);
    return data;
  }

  public setCached<T>(
    key: string,
    data: T,
    options: Partial<CacheConfig> = {}
  ): void {
    const cacheKey = this.generateCacheKey(key);
    const now = Date.now();
    const ttl = options.ttl || this.cacheConfig.ttl;

    this.cache.set(cacheKey, {
      data,
      timestamp: now,
      expiresAt: now + ttl,
    });

    // Ensure cache doesn't exceed max size
    if (this.cache.size > this.cacheConfig.maxSize) {
      const oldestKey = Array.from(this.cache.entries()).sort(
        ([, a], [, b]) => a.timestamp - b.timestamp
      )[0][0];
      this.cache.delete(oldestKey);
    }
  }

  public invalidateCache(key?: string): void {
    if (key) {
      const cacheKey = this.generateCacheKey(key);
      this.cache.delete(cacheKey);
    } else {
      this.cache.clear();
    }
  }

  // Rate Limiting
  private async checkRateLimit(key: string): Promise<void> {
    const rateLimitKey = this.generateRateLimitKey(key);
    const now = Date.now();
    const entry = this.rateLimits.get(rateLimitKey);

    if (!entry || now - entry.windowStart > this.rateLimitConfig.windowMs) {
      // Start new window
      this.rateLimits.set(rateLimitKey, {
        count: 1,
        windowStart: now,
      });
      return;
    }

    if (entry.count >= this.rateLimitConfig.maxRequests) {
      const waitTime = entry.windowStart + this.rateLimitConfig.windowMs - now;
      throw new Error(
        `Rate limit exceeded. Please wait ${Math.ceil(waitTime / 1000)} seconds.`
      );
    }

    // Increment counter
    entry.count++;
    this.rateLimits.set(rateLimitKey, entry);
  }

  // Offline Support
  public async getOfflineData<T>(
    key: string,
    fetchFn: () => Promise<T>
  ): Promise<T> {
    const cacheKey = this.generateCacheKey(key);
    const cached = this.cache.get(cacheKey);

    if (cached) {
      return cached.data as T;
    }

    if (!navigator.onLine) {
      throw new Error('No cached data available and device is offline');
    }

    return this.getCached(key, fetchFn);
  }

  // Real-time Updates
  public async subscribeToUpdates(
    key: string,
    callback: (data: any) => void
  ): Promise<() => void> {
    // Subscribe to real-time updates using AT Protocol's subscription mechanism
    const subscription = await this.agent.api.app.bsky.feed.subscribeToUpdates({
      filter: { key },
    });

    subscription.on('update', data => {
      // Update cache
      this.setCached(key, data);
      // Notify callback
      callback(data);
    });

    // Return unsubscribe function
    return () => {
      subscription.close();
    };
  }

  // Helper Methods
  private generateCacheKey(key: string): string {
    return `${this.agent.session?.did}:${key}`;
  }

  private generateRateLimitKey(key: string): string {
    return `${this.agent.session?.did}:${key}:ratelimit`;
  }

  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt <= now) {
        this.cache.delete(key);
      }
    }
  }

  // Cache Statistics
  public getCacheStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    missRate: number;
  } {
    const totalRequests = Array.from(this.cache.values()).reduce(
      (sum, entry) => sum + (entry.data.requestCount || 0),
      0
    );
    const cacheHits = Array.from(this.cache.values()).reduce(
      (sum, entry) => sum + (entry.data.hitCount || 0),
      0
    );

    return {
      size: this.cache.size,
      maxSize: this.cacheConfig.maxSize,
      hitRate: totalRequests ? cacheHits / totalRequests : 0,
      missRate: totalRequests ? (totalRequests - cacheHits) / totalRequests : 0,
    };
  }

  // Rate Limit Statistics
  public getRateLimitStats(): {
    activeWindows: number;
    totalRequests: number;
    throttledRequests: number;
  } {
    const now = Date.now();
    let totalRequests = 0;
    let throttledRequests = 0;
    let activeWindows = 0;

    for (const entry of this.rateLimits.values()) {
      if (now - entry.windowStart <= this.rateLimitConfig.windowMs) {
        activeWindows++;
        totalRequests += entry.count;
        if (entry.count >= this.rateLimitConfig.maxRequests) {
          throttledRequests++;
        }
      }
    }

    return {
      activeWindows,
      totalRequests,
      throttledRequests,
    };
  }
}
