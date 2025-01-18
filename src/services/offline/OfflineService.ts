import NetInfo from '@react-native-community/netinfo';
import SQLite from 'react-native-sqlite-storage';

import { performanceMonitor } from '../../utils/performance';
import { Queue } from '../../utils/queue';
import { AdvancedCacheService } from '../cache/AdvancedCacheService';

interface OfflineAction {
  type: string;
  payload: Record<string, unknown>;
  timestamp: number;
  retryCount: number;
}

export class OfflineService {
  private static instance: OfflineService;
  private cache: AdvancedCacheService;
  private db: SQLite.SQLiteDatabase;
  private actionQueue: Queue<OfflineAction>;
  private isOnline: boolean;
  private syncInProgress: boolean;

  private constructor() {
    this.cache = AdvancedCacheService.getInstance();
    this.actionQueue = new Queue();
    this.isOnline = true;
    this.syncInProgress = false;
    this.initialize();
  }

  public static getInstance(): OfflineService {
    if (!OfflineService.instance) {
      OfflineService.instance = new OfflineService();
    }
    return OfflineService.instance;
  }

  private async initialize(): Promise<void> {
    try {
      // Initialize SQLite
      this.db = await SQLite.openDatabase({
        name: 'offlineData.db',
        location: 'default',
      });

      // Create necessary tables
      await this.createTables();

      // Set up network monitoring
      this.setupNetworkMonitoring();

      // Load pending actions from storage
      await this.loadPendingActions();

      // Start sync process
      this.startSync();
    } catch (error) {
      console.error('Failed to initialize offline service:', error);
      throw error;
    }
  }

  private async createTables(): Promise<void> {
    await this.db.executeSql(`
      CREATE TABLE IF NOT EXISTS offline_actions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        payload TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        retry_count INTEGER DEFAULT 0
      );
    `);

    await this.db.executeSql(`
      CREATE TABLE IF NOT EXISTS offline_data (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      );
    `);
  }

  private setupNetworkMonitoring(): void {
    NetInfo.addEventListener((state) => {
      const wasOffline = !this.isOnline;
      this.isOnline = state.isConnected;

      if (wasOffline && this.isOnline) {
        this.startSync();
      }
    });
  }

  private async loadPendingActions(): Promise<void> {
    const [results] = await this.db.executeSql(
      'SELECT * FROM offline_actions ORDER BY timestamp ASC'
    );

    for (let i = 0; i < results.rows.length; i++) {
      const row = results.rows.item(i);
      this.actionQueue.enqueue({
        type: row.type,
        payload: JSON.parse(row.payload),
        timestamp: row.timestamp,
        retryCount: row.retry_count,
      });
    }
  }

  public async queueAction(type: string, payload: Record<string, unknown>): Promise<void> {
    const trace = await performanceMonitor.startTrace('offline_queue_action');
    try {
      const action: OfflineAction = {
        type,
        payload,
        timestamp: Date.now(),
        retryCount: 0,
      };

      // Save to SQLite
      await this.db.executeSql(
        'INSERT INTO offline_actions (type, payload, timestamp) VALUES (?, ?, ?)',
        [action.type, JSON.stringify(action.payload), action.timestamp]
      );

      // Add to queue
      this.actionQueue.enqueue(action);

      if (this.isOnline && !this.syncInProgress) {
        this.startSync();
      }

      trace.putMetric('success', 1);
    } catch (error) {
      trace.putMetric('error', 1);
      console.error('Failed to queue offline action:', error);
      throw error;
    } finally {
      await trace.stop();
    }
  }

  private async startSync(): Promise<void> {
    if (this.syncInProgress || !this.isOnline) return;

    const trace = await performanceMonitor.startTrace('offline_sync');
    this.syncInProgress = true;

    try {
      while (!this.actionQueue.isEmpty()) {
        const action = this.actionQueue.peek();

        try {
          await this.processAction(action);
          this.actionQueue.dequeue();

          // Remove from SQLite
          await this.db.executeSql('DELETE FROM offline_actions WHERE type = ? AND timestamp = ?', [
            action.type,
            action.timestamp,
          ]);
        } catch (_error) {
          action.retryCount++;

          if (action.retryCount >= 3) {
            // Move to failed actions or handle differently
            this.actionQueue.dequeue();
            await this.handleFailedAction(action);
          }

          // Update retry count in SQLite
          await this.db.executeSql(
            'UPDATE offline_actions SET retry_count = ? WHERE type = ? AND timestamp = ?',
            [action.retryCount, action.type, action.timestamp]
          );

          break; // Stop processing on error
        }
      }

      trace.putMetric('success', 1);
    } catch (error) {
      trace.putMetric('error', 1);
      console.error('Sync process failed:', error);
    } finally {
      this.syncInProgress = false;
      await trace.stop();
    }
  }

  private async processAction(action: OfflineAction): Promise<void> {
    // Implement action processing based on type
    switch (action.type) {
      case 'CREATE_POST':
        // Process post creation
        break;
      case 'UPDATE_PROFILE':
        // Process profile update
        break;
      case 'SEND_MESSAGE':
        // Process message sending
        break;
      default:
        console.warn('Unknown action type:', action.type);
    }
  }

  private async handleFailedAction(action: OfflineAction): Promise<void> {
    // Implement failed action handling
    console.error('Action failed after max retries:', action);
  }

  public async saveOfflineData(key: string, value: Record<string, unknown>): Promise<void> {
    const trace = await performanceMonitor.startTrace('offline_save_data');
    try {
      const timestamp = Date.now();

      // Save to SQLite
      await this.db.executeSql(
        'INSERT OR REPLACE INTO offline_data (key, value, timestamp) VALUES (?, ?, ?)',
        [key, JSON.stringify(value), timestamp]
      );

      // Save to cache
      await this.cache.set(key, value, {
        persistKey: `offline_${key}`,
        compression: true,
      });

      trace.putMetric('success', 1);
    } catch (error) {
      trace.putMetric('error', 1);
      console.error('Failed to save offline data:', error);
      throw error;
    } finally {
      await trace.stop();
    }
  }

  public async getOfflineData<T>(key: string): Promise<T | null> {
    const trace = await performanceMonitor.startTrace('offline_get_data');
    try {
      // Try cache first
      const cachedData = await this.cache.get<T>(`offline_${key}`);
      if (cachedData) {
        trace.putMetric('cache_hit', 1);
        return cachedData;
      }

      // Try SQLite
      const [results] = await this.db.executeSql('SELECT value FROM offline_data WHERE key = ?', [
        key,
      ]);

      if (results.rows.length > 0) {
        const data = JSON.parse(results.rows.item(0).value);

        // Update cache
        await this.cache.set(`offline_${key}`, data, {
          compression: true,
        });

        trace.putMetric('db_hit', 1);
        return data;
      }

      trace.putMetric('miss', 1);
      return null;
    } catch (error) {
      trace.putMetric('error', 1);
      console.error('Failed to get offline data:', error);
      return null;
    } finally {
      await trace.stop();
    }
  }

  public async clearOfflineData(): Promise<void> {
    const trace = await performanceMonitor.startTrace('offline_clear_data');
    try {
      // Clear SQLite tables
      await this.db.executeSql('DELETE FROM offline_actions');
      await this.db.executeSql('DELETE FROM offline_data');

      // Clear cache
      await this.cache.clear();

      // Clear queue
      this.actionQueue.clear();

      trace.putMetric('success', 1);
    } catch (error) {
      trace.putMetric('error', 1);
      console.error('Failed to clear offline data:', error);
      throw error;
    } finally {
      await trace.stop();
    }
  }
}
