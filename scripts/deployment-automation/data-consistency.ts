import { logger } from '../utils/logger';
import { exec } from 'child_process';
import { promisify } from 'util';
import { MetricsService } from '../utils/metrics';
import { AnomalyDetector } from '../utils/anomaly-detector';

const execAsync = promisify(exec);

interface ConsistencyConfig {
  checkInterval: number;
  batchSize: number;
  parallelChecks: number;
  adaptiveScaling: {
    enabled: boolean;
    targetLatency: number;
    maxParallelChecks: number;
  };
}

interface DataCheckResult {
  status: 'consistent' | 'inconsistent' | 'error';
  inconsistencies: DataInconsistency[];
  checkDuration: number;
  samplingRate: number;
}

interface DataInconsistency {
  type: 'missing' | 'mismatch' | 'corruption';
  source: string;
  target: string;
  entity: string;
  severity: 'high' | 'medium' | 'low';
  details: Record<string, any>;
}

export class DataConsistencyService {
  private config: ConsistencyConfig;
  private metrics: MetricsService;
  private anomalyDetector: AnomalyDetector;
  private readonly MIN_BATCH_SIZE = 100;
  private readonly MAX_BATCH_SIZE = 10000;

  constructor(config: ConsistencyConfig) {
    this.config = config;
    this.metrics = new MetricsService('data_consistency');
    this.anomalyDetector = new AnomalyDetector();
    this.startAdaptiveScaling();
  }

  private async startAdaptiveScaling(): Promise<void> {
    if (!this.config.adaptiveScaling.enabled) return;

    setInterval(async () => {
      const metrics = await this.metrics.getLastNMinutes(15);
      const shouldScale = await this.evaluateScaling(metrics);
      if (shouldScale) {
        await this.adjustResources();
      }
    }, 5 * 60 * 1000); // Check every 5 minutes
  }

  async checkDataConsistency(): Promise<DataCheckResult> {
    const startTime = Date.now();
    const inconsistencies: DataInconsistency[] = [];

    try {
      // Dynamically determine optimal batch size based on system load
      const batchSize = await this.calculateOptimalBatchSize();
      
      // Get all regions for cross-region checks
      const regions = await this.getActiveRegions();
      
      // Run parallel consistency checks across regions
      await Promise.all(
        regions.map(region => this.checkRegionConsistency(region, batchSize))
      );

      const checkDuration = Date.now() - startTime;
      await this.updateMetrics(checkDuration, inconsistencies.length);

      return {
        status: inconsistencies.length === 0 ? 'consistent' : 'inconsistent',
        inconsistencies,
        checkDuration,
        samplingRate: this.calculateSamplingRate(batchSize)
      };
    } catch (error) {
      logger.error('Data consistency check failed:', error);
      throw error;
    }
  }

  private async calculateOptimalBatchSize(): Promise<number> {
    try {
      // Get system metrics
      const metrics = await this.metrics.getCurrentMetrics();
      const load = metrics.systemLoad;
      const memory = metrics.availableMemory;
      
      // Calculate base batch size based on available resources
      let optimalSize = Math.floor(
        this.MIN_BATCH_SIZE * (1 + (memory / 100)) * (1 - (load / 100))
      );

      // Clamp to min/max values
      optimalSize = Math.max(this.MIN_BATCH_SIZE, 
                           Math.min(this.MAX_BATCH_SIZE, optimalSize));

      return optimalSize;
    } catch (error) {
      logger.warn('Failed to calculate optimal batch size:', error);
      return this.config.batchSize;
    }
  }

  private async checkRegionConsistency(
    region: string, 
    batchSize: number
  ): Promise<void> {
    const checks = [
      this.checkDatabaseConsistency(region, batchSize),
      this.checkFileStorageConsistency(region, batchSize),
      this.checkCacheConsistency(region, batchSize),
      this.checkMessageQueueConsistency(region, batchSize)
    ];

    await Promise.all(checks);
  }

  private async checkDatabaseConsistency(
    region: string, 
    batchSize: number
  ): Promise<void> {
    const tables = await this.getTablesList();
    
    for (const table of tables) {
      const checksums = await this.getTableChecksums(table, region);
      if (!this.checksumsMatch(checksums)) {
        await this.handleInconsistency({
          type: 'mismatch',
          source: 'database',
          target: region,
          entity: table,
          severity: 'high',
          details: { checksums }
        });
      }
    }
  }

  private async handleInconsistency(inconsistency: DataInconsistency): Promise<void> {
    // Record the inconsistency
    await this.metrics.recordInconsistency(inconsistency);

    // Check if it's a known pattern
    const isAnomaly = await this.anomalyDetector.check(inconsistency);
    
    if (isAnomaly) {
      // Trigger automatic resolution if possible
      await this.attemptAutomaticResolution(inconsistency);
    }

    // Update adaptive scaling parameters based on inconsistency patterns
    await this.updateAdaptiveParameters(inconsistency);
  }

  private async attemptAutomaticResolution(
    inconsistency: DataInconsistency
  ): Promise<boolean> {
    try {
      switch (inconsistency.type) {
        case 'missing':
          return await this.resolveMissingData(inconsistency);
        case 'mismatch':
          return await this.resolveMismatch(inconsistency);
        case 'corruption':
          return await this.resolveCorruption(inconsistency);
        default:
          return false;
      }
    } catch (error) {
      logger.error('Automatic resolution failed:', error);
      return false;
    }
  }

  private async evaluateScaling(metrics: any[]): Promise<boolean> {
    const avgLatency = this.calculateAverageLatency(metrics);
    const targetLatency = this.config.adaptiveScaling.targetLatency;
    
    // Determine if we need to scale based on latency trends
    if (avgLatency > targetLatency * 1.2) {
      // Need to scale up
      return true;
    } else if (avgLatency < targetLatency * 0.8) {
      // Can scale down
      return true;
    }
    
    return false;
  }

  private async adjustResources(): Promise<void> {
    try {
      const currentMetrics = await this.metrics.getCurrentMetrics();
      const newConfig = this.calculateNewConfig(currentMetrics);
      
      // Apply new configuration
      await this.applyNewConfig(newConfig);
      
      // Record configuration change
      await this.metrics.recordConfigChange({
        oldConfig: this.config,
        newConfig,
        timestamp: new Date()
      });
      
      this.config = newConfig;
    } catch (error) {
      logger.error('Failed to adjust resources:', error);
    }
  }

  private calculateNewConfig(metrics: any): ConsistencyConfig {
    const currentLoad = metrics.systemLoad;
    const currentLatency = metrics.avgLatency;
    
    // Calculate new values based on current performance
    const newParallelChecks = Math.min(
      this.config.parallelChecks * (this.config.adaptiveScaling.targetLatency / currentLatency),
      this.config.adaptiveScaling.maxParallelChecks
    );
    
    return {
      ...this.config,
      parallelChecks: Math.round(newParallelChecks),
      batchSize: this.calculateOptimalBatchSizeForLoad(currentLoad)
    };
  }

  private calculateOptimalBatchSizeForLoad(load: number): number {
    // Adjust batch size inversely to system load
    const scaleFactor = Math.max(0.5, 1 - (load / 100));
    return Math.max(
      this.MIN_BATCH_SIZE,
      Math.min(
        this.MAX_BATCH_SIZE,
        Math.round(this.config.batchSize * scaleFactor)
      )
    );
  }
} 