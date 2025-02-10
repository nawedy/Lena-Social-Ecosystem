import { logger } from '../utils/logger';
import { exec } from 'child_process';
import { promisify } from 'util';
import { MetricsService } from '../utils/metrics';
import { DataConsistencyService } from './data-consistency';
import { AnomalyDetector } from '../utils/anomaly-detector';

const execAsync = promisify(exec);

interface SyncConfig {
  syncInterval: number;
  maxConcurrentTransfers: number;
  bandwidthLimit: number; // MB/s
  adaptiveSync: {
    enabled: boolean;
    targetLatency: number;
    maxBandwidth: number;
  };
  prioritization: {
    enabled: boolean;
    rules: PriorityRule[];
  };
}

interface PriorityRule {
  pattern: string;
  priority: number;
  maxLatency: number;
}

interface SyncMetrics {
  bytesTransferred: number;
  syncDuration: number;
  successRate: number;
  conflicts: number;
  bandwidth: number;
}

interface RegionPair {
  source: string;
  target: string;
  latency: number;
  bandwidth: number;
  reliability: number;
}

export class DataSyncService {
  private config: SyncConfig;
  private metrics: MetricsService;
  private consistencyService: DataConsistencyService;
  private anomalyDetector: AnomalyDetector;
  private activeSyncs: Map<string, SyncMetrics>;

  constructor(config: SyncConfig, consistencyService: DataConsistencyService) {
    this.config = config;
    this.metrics = new MetricsService('data_sync');
    this.consistencyService = consistencyService;
    this.anomalyDetector = new AnomalyDetector();
    this.activeSyncs = new Map();
    this.initializeAdaptiveSync();
  }

  private async initializeAdaptiveSync(): Promise<void> {
    if (!this.config.adaptiveSync.enabled) return;

    setInterval(async () => {
      await this.adjustSyncParameters();
    }, 60000); // Adjust every minute
  }

  async startSync(): Promise<void> {
    try {
      // Get all active regions
      const regions = await this.getActiveRegions();
      
      // Create optimal sync pairs based on network topology
      const syncPairs = await this.calculateOptimalSyncPairs(regions);
      
      // Start sync for each pair with priority
      for (const pair of syncPairs) {
        await this.syncRegionPair(pair);
      }
    } catch (error) {
      logger.error('Data sync failed:', error);
      throw error;
    }
  }

  private async calculateOptimalSyncPairs(regions: string[]): Promise<RegionPair[]> {
    const pairs: RegionPair[] = [];
    const metrics = await this.getRegionMetrics(regions);

    for (let i = 0; i < regions.length; i++) {
      for (let j = i + 1; j < regions.length; j++) {
        const latency = await this.measureLatency(regions[i], regions[j]);
        const bandwidth = await this.measureBandwidth(regions[i], regions[j]);
        const reliability = await this.calculateReliability(regions[i], regions[j]);

        pairs.push({
          source: regions[i],
          target: regions[j],
          latency,
          bandwidth,
          reliability
        });
      }
    }

    // Sort pairs by optimal sync path
    return this.optimizeSyncPairs(pairs);
  }

  private async syncRegionPair(pair: RegionPair): Promise<void> {
    const syncId = `${pair.source}-${pair.target}`;
    
    try {
      // Initialize sync metrics
      const metrics: SyncMetrics = {
        bytesTransferred: 0,
        syncDuration: 0,
        successRate: 0,
        conflicts: 0,
        bandwidth: 0
      };

      this.activeSyncs.set(syncId, metrics);
      const startTime = Date.now();

      // Get changes since last sync
      const changes = await this.getChanges(pair.source, pair.target);
      
      // Apply prioritization rules
      const prioritizedChanges = this.prioritizeChanges(changes);
      
      // Sync each change with adaptive batch size
      for (const change of prioritizedChanges) {
        await this.syncChange(change, pair, metrics);
        await this.updateSyncMetrics(syncId, metrics);
      }

      // Verify sync consistency
      await this.verifySyncConsistency(pair);
      
      // Update final metrics
      metrics.syncDuration = Date.now() - startTime;
      metrics.successRate = this.calculateSuccessRate(metrics);
      await this.metrics.recordSync(pair, metrics);

    } catch (error) {
      logger.error(`Sync failed for ${syncId}:`, error);
      await this.handleSyncFailure(pair, error);
    } finally {
      this.activeSyncs.delete(syncId);
    }
  }

  private async adjustSyncParameters(): Promise<void> {
    const metrics = await this.metrics.getLastNMinutes(5);
    const load = await this.getCurrentSystemLoad();
    
    // Adjust bandwidth based on system load and sync performance
    const newBandwidth = this.calculateOptimalBandwidth(load, metrics);
    
    // Adjust concurrent transfers based on success rate
    const newConcurrency = this.calculateOptimalConcurrency(metrics);
    
    await this.applyNewParameters({
      maxConcurrentTransfers: newConcurrency,
      bandwidthLimit: newBandwidth
    });
  }

  private async syncChange(
    change: any, 
    pair: RegionPair, 
    metrics: SyncMetrics
  ): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Apply bandwidth limiting
      const throttle = this.calculateThrottle(pair.bandwidth, metrics);
      
      // Sync the change with throttling
      await this.transferData(change, pair, throttle);
      
      // Update metrics
      metrics.bytesTransferred += change.size;
      metrics.bandwidth = this.calculateCurrentBandwidth(
        change.size, 
        Date.now() - startTime
      );
      
    } catch (error) {
      metrics.conflicts++;
      await this.handleSyncConflict(change, pair);
    }
  }

  private async handleSyncConflict(change: any, pair: RegionPair): Promise<void> {
    // Record conflict for analysis
    await this.metrics.recordConflict({
      change,
      pair,
      timestamp: new Date()
    });

    // Check if it's an anomaly
    const isAnomaly = await this.anomalyDetector.check({
      type: 'sync_conflict',
      source: pair.source,
      target: pair.target,
      details: change
    });

    if (isAnomaly) {
      // Trigger automatic conflict resolution
      await this.resolveConflict(change, pair);
    } else {
      // Queue for manual review
      await this.queueForManualReview(change, pair);
    }
  }

  private calculateOptimalBandwidth(load: number, metrics: any[]): number {
    const baseLimit = this.config.bandwidthLimit;
    const successRate = this.calculateAverageSuccessRate(metrics);
    
    // Adjust bandwidth based on success rate and system load
    let optimalBandwidth = baseLimit * (successRate / 100) * (1 - load / 100);
    
    // Ensure we stay within configured limits
    return Math.min(
      this.config.adaptiveSync.maxBandwidth,
      Math.max(1, optimalBandwidth)
    );
  }

  private calculateOptimalConcurrency(metrics: any[]): number {
    const avgLatency = this.calculateAverageLatency(metrics);
    const targetLatency = this.config.adaptiveSync.targetLatency;
    
    // Adjust concurrency based on latency
    const latencyRatio = targetLatency / avgLatency;
    let newConcurrency = this.config.maxConcurrentTransfers * latencyRatio;
    
    // Ensure we maintain reasonable limits
    return Math.max(1, Math.min(50, Math.round(newConcurrency)));
  }

  private prioritizeChanges(changes: any[]): any[] {
    if (!this.config.prioritization.enabled) return changes;

    return changes.sort((a, b) => {
      const priorityA = this.calculateChangePriority(a);
      const priorityB = this.calculateChangePriority(b);
      return priorityB - priorityA;
    });
  }

  private calculateChangePriority(change: any): number {
    let priority = 0;
    
    for (const rule of this.config.prioritization.rules) {
      if (new RegExp(rule.pattern).test(change.path)) {
        priority = Math.max(priority, rule.priority);
      }
    }
    
    return priority;
  }
} 