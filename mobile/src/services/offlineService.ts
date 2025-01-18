import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import BackgroundFetch from 'react-native-background-fetch';

import { store } from '../store';
import { refreshSession } from '../store/slices/auth';

interface CacheConfig {
  key: string;
  data: any;
  timestamp: number;
  expiresIn?: number;
}

interface SyncOperation {
  id: string;
  type: string;
  data: any;
  timestamp: number;
  retries: number;
}

class OfflineService {
  private static instance: OfflineService;
  private isOnline = true;
  private syncQueue: SyncOperation[] = [];
  private readonly SYNC_QUEUE_KEY = '@sync_queue';
  private readonly MAX_RETRIES = 3;

  private constructor() {
    this.initialize();
  }

  public static getInstance(): OfflineService {
    if (!OfflineService.instance) {
      OfflineService.instance = new OfflineService();
    }
    return OfflineService.instance;
  }

  private async initialize() {
    // Initialize network monitoring
    NetInfo.addEventListener(state => {
      const wasOffline = !this.isOnline;
      this.isOnline = state.isConnected ?? false;

      if (wasOffline && this.isOnline) {
        this.processSyncQueue();
      }
    });

    // Initialize background fetch
    try {
      await BackgroundFetch.configure(
        {
          minimumFetchInterval: 15, // minutes
          stopOnTerminate: false,
          enableHeadless: true,
          startOnBoot: true,
          requiredNetworkType: BackgroundFetch.NETWORK_TYPE_ANY,
        },
        async taskId => {
          await this.backgroundSync();
          BackgroundFetch.finish(taskId);
        },
        error => {
          console.error('Background fetch failed to configure:', error);
        }
      );
    } catch (error) {
      console.error('Error configuring background fetch:', error);
    }

    // Load sync queue from storage
    await this.loadSyncQueue();
  }

  async cacheData({
    key,
    data,
    timestamp,
    expiresIn,
  }: CacheConfig): Promise<void> {
    try {
      const cacheItem = {
        data,
        timestamp,
        expiresIn,
      };

      await AsyncStorage.setItem(`@cache_${key}`, JSON.stringify(cacheItem));
    } catch (error) {
      console.error('Error caching data:', error);
      throw error;
    }
  }

  async getCachedData<T>(key: string): Promise<T | null> {
    try {
      const cached = await AsyncStorage.getItem(`@cache_${key}`);

      if (!cached) {
        return null;
      }

      const { data, timestamp, expiresIn } = JSON.parse(cached);

      if (expiresIn && Date.now() - timestamp > expiresIn) {
        await AsyncStorage.removeItem(`@cache_${key}`);
        return null;
      }

      return data as T;
    } catch (error) {
      console.error('Error getting cached data:', error);
      return null;
    }
  }

  async queueSync(type: string, data: any): Promise<void> {
    const syncOp: SyncOperation = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      data,
      timestamp: Date.now(),
      retries: 0,
    };

    this.syncQueue.push(syncOp);
    await this.saveSyncQueue();

    if (this.isOnline) {
      this.processSyncQueue();
    }
  }

  private async loadSyncQueue(): Promise<void> {
    try {
      const queue = await AsyncStorage.getItem(this.SYNC_QUEUE_KEY);
      if (queue) {
        this.syncQueue = JSON.parse(queue);
      }
    } catch (error) {
      console.error('Error loading sync queue:', error);
    }
  }

  private async saveSyncQueue(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        this.SYNC_QUEUE_KEY,
        JSON.stringify(this.syncQueue)
      );
    } catch (error) {
      console.error('Error saving sync queue:', error);
    }
  }

  private async processSyncQueue(): Promise<void> {
    if (!this.isOnline || this.syncQueue.length === 0) {
      return;
    }

    const pendingOps = [...this.syncQueue];
    this.syncQueue = [];
    await this.saveSyncQueue();

    for (const op of pendingOps) {
      try {
        await this.processSyncOperation(op);
      } catch (error) {
        if (op.retries < this.MAX_RETRIES) {
          op.retries += 1;
          this.syncQueue.push(op);
        } else {
          console.error('Max retries reached for sync operation:', op);
        }
      }
    }

    if (this.syncQueue.length > 0) {
      await this.saveSyncQueue();
    }
  }

  private async processSyncOperation(op: SyncOperation): Promise<void> {
    switch (op.type) {
      case 'CREATE_POST':
        // Handle post creation
        break;
      case 'UPDATE_PROFILE':
        // Handle profile update
        break;
      case 'LIKE_POST':
        // Handle post like
        break;
      default:
        console.warn('Unknown sync operation type:', op.type);
    }
  }

  private async backgroundSync(): Promise<void> {
    try {
      // Refresh session if needed
      await store.dispatch(refreshSession()).unwrap();

      // Process sync queue
      await this.processSyncQueue();

      // Update cached data
      // Add your cache update logic here
    } catch (error) {
      console.error('Background sync failed:', error);
    }
  }

  async clearCache(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith('@cache_'));
      await AsyncStorage.multiRemove(cacheKeys);
    } catch (error) {
      console.error('Error clearing cache:', error);
      throw error;
    }
  }
}

export const offlineService = OfflineService.getInstance();
