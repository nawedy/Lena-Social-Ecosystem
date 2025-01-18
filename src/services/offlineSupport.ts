import { openDB, IDBPDatabase } from 'idb';
import { config } from '../config';
import { performanceMonitoring } from './performanceMonitoring';
import { completeAnalytics } from './completeAnalytics';

interface CacheConfig {
  name: string;
  version: number;
  stores: Array<{
    name: string;
    keyPath: string;
    indexes?: Array<{
      name: string;
      keyPath: string;
      options?: IDBIndexParameters;
    }>;
  }>;
}

interface SyncOperation {
  id: string;
  type: string;
  data: any;
  timestamp: string;
  retries: number;
  status: 'pending' | 'processing' | 'failed' | 'completed';
  error?: string;
}

interface OfflineData {
  key: string;
  value: any;
  timestamp: string;
  expiresAt?: string;
}

export class OfflineSupportService {
  private static instance: OfflineSupportService;
  private db: IDBPDatabase | null = null;
  private syncInProgress = false;
  private readonly MAX_RETRIES = 3;
  private readonly SYNC_INTERVAL = 60000; // 1 minute
  private readonly DB_CONFIG: CacheConfig = {
    name: 'tiktotoe-offline',
    version: 1,
    stores: [
      {
        name: 'cache',
        keyPath: 'key',
        indexes: [
          {
            name: 'timestamp',
            keyPath: 'timestamp',
          },
          {
            name: 'expiresAt',
            keyPath: 'expiresAt',
          },
        ],
      },
      {
        name: 'syncQueue',
        keyPath: 'id',
        indexes: [
          {
            name: 'status',
            keyPath: 'status',
          },
          {
            name: 'timestamp',
            keyPath: 'timestamp',
          },
        ],
      },
    ],
  };

  private constructor() {
    this.initializeDB();
    this.startPeriodicSync();
  }

  public static getInstance(): OfflineSupportService {
    if (!OfflineSupportService.instance) {
      OfflineSupportService.instance = new OfflineSupportService();
    }
    return OfflineSupportService.instance;
  }

  // Cache Management
  async cacheData(key: string, value: any, ttl?: number): Promise<void> {
    try {
      if (!this.db) {
        throw new Error('Database not initialized');
      }

      const data: OfflineData = {
        key,
        value,
        timestamp: new Date().toISOString(),
        expiresAt: ttl
          ? new Date(Date.now() + ttl * 1000).toISOString()
          : undefined,
      };

      await this.db.put('cache', data);

      // Track cache operation
      await completeAnalytics.trackEvent({
        type: 'offline_cache_write',
        data: {
          key,
          hasTTL: !!ttl,
        },
        metadata: {
          service: 'offline-support',
          environment: config.app.env,
          version: '1.0.0',
        },
      });
    } catch (error) {
      performanceMonitoring.recordError(error as Error, {
        operation: 'cacheData',
        key,
      });
      throw error;
    }
  }

  async getCachedData<T>(key: string): Promise<T | null> {
    try {
      if (!this.db) {
        throw new Error('Database not initialized');
      }

      const data = (await this.db.get('cache', key)) as OfflineData | undefined;

      if (!data) {
        return null;
      }

      // Check expiration
      if (data.expiresAt && new Date(data.expiresAt) <= new Date()) {
        await this.db.delete('cache', key);
        return null;
      }

      // Track cache hit/miss
      await completeAnalytics.trackEvent({
        type: 'offline_cache_read',
        data: {
          key,
          hit: !!data,
        },
        metadata: {
          service: 'offline-support',
          environment: config.app.env,
          version: '1.0.0',
        },
      });

      return data.value as T;
    } catch (error) {
      performanceMonitoring.recordError(error as Error, {
        operation: 'getCachedData',
        key,
      });
      throw error;
    }
  }

  async clearCache(): Promise<void> {
    try {
      if (!this.db) {
        throw new Error('Database not initialized');
      }

      await this.db.clear('cache');

      // Track cache clear
      await completeAnalytics.trackEvent({
        type: 'offline_cache_cleared',
        metadata: {
          service: 'offline-support',
          environment: config.app.env,
          version: '1.0.0',
        },
      });
    } catch (error) {
      performanceMonitoring.recordError(error as Error, {
        operation: 'clearCache',
      });
      throw error;
    }
  }

  // Sync Queue Management
  async queueSync(type: string, data: any): Promise<void> {
    try {
      if (!this.db) {
        throw new Error('Database not initialized');
      }

      const syncOp: SyncOperation = {
        id: crypto.randomUUID(),
        type,
        data,
        timestamp: new Date().toISOString(),
        retries: 0,
        status: 'pending',
      };

      await this.db.add('syncQueue', syncOp);

      // Attempt immediate sync if online
      if (navigator.onLine) {
        this.processSync();
      }

      // Track sync operation
      await completeAnalytics.trackEvent({
        type: 'offline_sync_queued',
        data: {
          syncType: type,
        },
        metadata: {
          service: 'offline-support',
          environment: config.app.env,
          version: '1.0.0',
        },
      });
    } catch (error) {
      performanceMonitoring.recordError(error as Error, {
        operation: 'queueSync',
        syncType: type,
      });
      throw error;
    }
  }

  // Background Sync
  async registerBackgroundSync(): Promise<void> {
    try {
      if ('serviceWorker' in navigator && 'sync' in registration) {
        const registration = await navigator.serviceWorker.ready;
        await registration.sync.register('sync-data');
      }
    } catch (error) {
      performanceMonitoring.recordError(error as Error, {
        operation: 'registerBackgroundSync',
      });
      throw error;
    }
  }

  // Private Methods
  private async initializeDB(): Promise<void> {
    try {
      this.db = await openDB(this.DB_CONFIG.name, this.DB_CONFIG.version, {
        upgrade: db => {
          this.DB_CONFIG.stores.forEach(store => {
            if (!db.objectStoreNames.contains(store.name)) {
              const objectStore = db.createObjectStore(store.name, {
                keyPath: store.keyPath,
              });

              store.indexes?.forEach(index => {
                objectStore.createIndex(
                  index.name,
                  index.keyPath,
                  index.options
                );
              });
            }
          });
        },
      });

      // Set up online/offline listeners
      window.addEventListener('online', () => this.processSync());
      window.addEventListener('offline', () => {
        completeAnalytics.trackEvent({
          type: 'offline_mode_entered',
          metadata: {
            service: 'offline-support',
            environment: config.app.env,
            version: '1.0.0',
          },
        });
      });
    } catch (error) {
      performanceMonitoring.recordError(error as Error, {
        operation: 'initializeDB',
      });
      throw error;
    }
  }

  private async processSync(): Promise<void> {
    if (this.syncInProgress || !this.db) {
      return;
    }

    this.syncInProgress = true;

    try {
      const tx = this.db.transaction('syncQueue', 'readwrite');
      const index = tx.store.index('status');
      let cursor = await index.openCursor('pending');

      while (cursor) {
        const syncOp = cursor.value;

        try {
          // Update status to processing
          await this.db.put('syncQueue', {
            ...syncOp,
            status: 'processing',
          });

          // Process the sync operation
          await this.processSyncOperation(syncOp);

          // Mark as completed
          await this.db.put('syncQueue', {
            ...syncOp,
            status: 'completed',
          });

          // Track successful sync
          await completeAnalytics.trackEvent({
            type: 'offline_sync_completed',
            data: {
              syncId: syncOp.id,
              syncType: syncOp.type,
            },
            metadata: {
              service: 'offline-support',
              environment: config.app.env,
              version: '1.0.0',
            },
          });
        } catch (error) {
          const updatedOp = {
            ...syncOp,
            retries: syncOp.retries + 1,
            status:
              syncOp.retries + 1 >= this.MAX_RETRIES ? 'failed' : 'pending',
            error: error.message,
          };

          await this.db.put('syncQueue', updatedOp);

          // Track failed sync
          await completeAnalytics.trackEvent({
            type: 'offline_sync_failed',
            data: {
              syncId: syncOp.id,
              syncType: syncOp.type,
              error: error.message,
              retries: updatedOp.retries,
            },
            metadata: {
              service: 'offline-support',
              environment: config.app.env,
              version: '1.0.0',
            },
          });
        }

        cursor = await cursor.continue();
      }

      await tx.done;
    } catch (error) {
      performanceMonitoring.recordError(error as Error, {
        operation: 'processSync',
      });
    } finally {
      this.syncInProgress = false;
    }
  }

  private async processSyncOperation(syncOp: SyncOperation): Promise<void> {
    // Implementation depends on sync operation type
    switch (syncOp.type) {
      case 'create_post':
        // Handle post creation
        break;
      case 'update_profile':
        // Handle profile update
        break;
      case 'delete_comment':
        // Handle comment deletion
        break;
      default:
        throw new Error(`Unknown sync operation type: ${syncOp.type}`);
    }
  }

  private startPeriodicSync(): void {
    setInterval(() => {
      if (navigator.onLine) {
        this.processSync();
      }
    }, this.SYNC_INTERVAL);
  }
}

export const offlineSupport = OfflineSupportService.getInstance();
