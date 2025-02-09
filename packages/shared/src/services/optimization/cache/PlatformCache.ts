interface CacheEntry<T> {
  key: string;
  value: T;
  size: number;
  lastAccessed: number;
  accessCount: number;
  createdAt: number;
}

interface CacheConfig {
  maxSize: number;
  maxAge?: number;
  evictionPolicy: 'lru' | 'lfu' | 'fifo';
}

export class PlatformCache<T> {
  private entries: Map<string, CacheEntry<T>> = new Map();
  private currentSize = 0;

  constructor(private config: CacheConfig) {}

  async set(key: string, value: T, size: number): Promise<void> {
    // Check if we need to evict entries
    if (this.currentSize + size > this.config.maxSize) {
      await this.evict(size);
    }

    const entry: CacheEntry<T> = {
      key,
      value,
      size,
      lastAccessed: Date.now(),
      accessCount: 0,
      createdAt: Date.now()
    };

    this.entries.set(key, entry);
    this.currentSize += size;
  }

  async get(key: string): Promise<T | undefined> {
    const entry = this.entries.get(key);
    if (!entry) return undefined;

    // Check if entry has expired
    if (this.config.maxAge && Date.now() - entry.createdAt > this.config.maxAge) {
      this.entries.delete(key);
      this.currentSize -= entry.size;
      return undefined;
    }

    // Update access metrics
    entry.lastAccessed = Date.now();
    entry.accessCount++;

    return entry.value;
  }

  private async evict(requiredSize: number): Promise<void> {
    while (this.currentSize + requiredSize > this.config.maxSize) {
      const entryToEvict = this.selectEntryForEviction();
      if (!entryToEvict) break;

      this.entries.delete(entryToEvict.key);
      this.currentSize -= entryToEvict.size;
    }
  }

  private selectEntryForEviction(): CacheEntry<T> | undefined {
    const entries = Array.from(this.entries.values());
    if (entries.length === 0) return undefined;

    switch (this.config.evictionPolicy) {
      case 'lru':
        // Least Recently Used
        return entries.reduce((oldest, current) => 
          current.lastAccessed < oldest.lastAccessed ? current : oldest
        );

      case 'lfu':
        // Least Frequently Used
        return entries.reduce((leastUsed, current) => 
          current.accessCount < leastUsed.accessCount ? current : leastUsed
        );

      case 'fifo':
        // First In First Out
        return entries.reduce((oldest, current) => 
          current.createdAt < oldest.createdAt ? current : oldest
        );

      default:
        return entries[0];
    }
  }

  clear(): void {
    this.entries.clear();
    this.currentSize = 0;
  }

  getMetrics() {
    return {
      entryCount: this.entries.size,
      currentSize: this.currentSize,
      maxSize: this.config.maxSize,
      utilization: (this.currentSize / this.config.maxSize) * 100,
      oldestEntry: Math.min(...Array.from(this.entries.values()).map(e => e.createdAt)),
      newestEntry: Math.max(...Array.from(this.entries.values()).map(e => e.createdAt)),
      averageAccessCount: Array.from(this.entries.values())
        .reduce((sum, entry) => sum + entry.accessCount, 0) / this.entries.size
    };
  }
}

// Platform-specific cache configurations
export const VIDEO_CACHE_CONFIG: CacheConfig = {
  maxSize: 2048 * 1024 * 1024, // 2GB
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
  evictionPolicy: 'lru' // Videos benefit from LRU as users often rewatch recent content
};

export const IMAGE_CACHE_CONFIG: CacheConfig = {
  maxSize: 512 * 1024 * 1024, // 512MB
  maxAge: 12 * 60 * 60 * 1000, // 12 hours
  evictionPolicy: 'lfu' // Images benefit from LFU as popular images are accessed frequently
};

export const AUDIO_CACHE_CONFIG: CacheConfig = {
  maxSize: 1024 * 1024 * 1024, // 1GB
  maxAge: 48 * 60 * 60 * 1000, // 48 hours
  evictionPolicy: 'lru' // Audio benefits from LRU similar to video
};

export const SOCIAL_CACHE_CONFIG: CacheConfig = {
  maxSize: 256 * 1024 * 1024, // 256MB
  maxAge: 6 * 60 * 60 * 1000, // 6 hours
  evictionPolicy: 'lfu' // Social content benefits from LFU due to viral content patterns
}; 