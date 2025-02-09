// packages/shared/src/services/cache/MultiLevelCache.ts
interface CacheConfig {
    l1: {
      maxSize: number;
      ttl: number;
    };
    l2: {
      maxSize: number;
      ttl: number;
    };
    persistence: {
      enabled: boolean;
      storage: 'indexedDB' | 'localStorage';
    };
  }
  
  export class MultiLevelCache {
    private l1Cache: Map<string, CacheEntry>;
    private l2Cache: LRUCache<string, CacheEntry>;
    private persistentStorage: PersistentStorage;
  
    constructor(private config: CacheConfig) {
      this.l1Cache = new Map();
      this.l2Cache = new LRUCache(config.l2);
      this.persistentStorage = new PersistentStorage(config.persistence);
    }
  
    async get<T>(
      key: string,
      fetchFn: () => Promise<T>,
      options?: CacheOptions
    ): Promise<T> {
      // Try L1 cache
      const l1Result = this.l1Cache.get(key);
      if (l1Result && !this.isExpired(l1Result)) {
        return l1Result.data as T;
      }
  
      // Try L2 cache
      const l2Result = this.l2Cache.get(key);
      if (l2Result && !this.isExpired(l2Result)) {
        // Promote to L1
        this.l1Cache.set(key, l2Result);
        return l2Result.data as T;
      }
  
      // Try persistent storage
      const persistentResult = await this.persistentStorage.get(key);
      if (persistentResult) {
        this.promoteToCache(key, persistentResult);
        return persistentResult as T;
      }
  
      // Fetch and cache
      const data = await fetchFn();
      await this.set(key, data, options);
      return data;
    }
  }