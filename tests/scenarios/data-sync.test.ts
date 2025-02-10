import { DataSyncService } from '../../scripts/deployment-automation/data-sync';
import { DataConsistencyService } from '../../scripts/deployment-automation/data-consistency';
import { MockMetricsService } from '../mocks/metrics-service';
import { TestContext } from '../utils/test-context';
import { AnomalyDetector } from '../../utils/anomaly-detector';

describe('Data Synchronization Service Tests', () => {
  let syncService: DataSyncService;
  let consistencyService: DataConsistencyService;
  let testContext: TestContext;
  let mockMetrics: MockMetricsService;

  beforeEach(async () => {
    testContext = await TestContext.create({
      mockServices: true,
      recordMetrics: true,
      regions: ['us-east1', 'us-west1', 'eu-west1']
    });

    mockMetrics = new MockMetricsService();
    consistencyService = new DataConsistencyService({
      checkInterval: 300,
      batchSize: 1000,
      parallelChecks: 5,
      adaptiveScaling: { enabled: true, targetLatency: 100, maxParallelChecks: 10 }
    });

    syncService = new DataSyncService({
      syncInterval: 60,
      maxConcurrentTransfers: 5,
      bandwidthLimit: 100,
      adaptiveSync: {
        enabled: true,
        targetLatency: 50,
        maxBandwidth: 500
      },
      prioritization: {
        enabled: true,
        rules: [
          { pattern: 'user_.*', priority: 1, maxLatency: 100 },
          { pattern: 'transaction_.*', priority: 2, maxLatency: 50 }
        ]
      }
    }, consistencyService);
  });

  afterEach(async () => {
    await testContext.cleanup();
  });

  describe('Region Pair Management', () => {
    test('should calculate optimal sync pairs based on network conditions', async () => {
      // Arrange
      await testContext.setupNetworkConditions({
        'us-east1-us-west1': { latency: 50, bandwidth: 1000 },
        'us-east1-eu-west1': { latency: 100, bandwidth: 500 },
        'us-west1-eu-west1': { latency: 150, bandwidth: 300 }
      });

      // Act
      const pairs = await syncService.calculateOptimalSyncPairs(['us-east1', 'us-west1', 'eu-west1']);

      // Assert
      expect(pairs).toHaveLength(3);
      expect(pairs[0]).toMatchObject({
        source: 'us-east1',
        target: 'us-west1',
        latency: 50
      });
    });

    test('should adapt to changing network conditions', async () => {
      // Arrange
      const initialPairs = await syncService.calculateOptimalSyncPairs(['us-east1', 'us-west1']);
      
      // Simulate network degradation
      await testContext.simulateNetworkDegradation({
        region: 'us-west1',
        latencyIncrease: 200,
        bandwidthReduction: 0.5
      });

      // Act
      const updatedPairs = await syncService.calculateOptimalSyncPairs(['us-east1', 'us-west1']);

      // Assert
      expect(updatedPairs[0].latency).toBeGreaterThan(initialPairs[0].latency);
      expect(updatedPairs[0].bandwidth).toBeLessThan(initialPairs[0].bandwidth);
    });
  });

  describe('Sync Operations', () => {
    test('should synchronize data with priority handling', async () => {
      // Arrange
      const changes = [
        { path: 'user_profile', size: 1000, priority: 1 },
        { path: 'transaction_log', size: 500, priority: 2 },
        { path: 'analytics_data', size: 5000, priority: 3 }
      ];

      // Act
      const syncStart = Date.now();
      await syncService.syncRegionPair({
        source: 'us-east1',
        target: 'us-west1',
        changes
      });
      const syncDuration = Date.now() - syncStart;

      // Assert
      const metrics = await mockMetrics.getSyncMetrics();
      expect(metrics.completedChanges).toEqual(changes.length);
      expect(metrics.syncOrder).toEqual(['transaction_log', 'user_profile', 'analytics_data']);
    });

    test('should handle large-scale data synchronization', async () => {
      // Arrange
      const largeDataset = await testContext.generateLargeDataset({
        size: '1GB',
        changeRate: '10%'
      });

      // Act
      const result = await syncService.startSync();

      // Assert
      expect(result.bytesTransferred).toBeGreaterThan(0);
      expect(result.conflicts).toBe(0);
      expect(result.bandwidth).toBeLessThanOrEqual(syncService.config.adaptiveSync.maxBandwidth);
    });
  });

  describe('Conflict Resolution', () => {
    test('should detect and resolve sync conflicts automatically', async () => {
      // Arrange
      const conflictingChanges = await testContext.setupConflictingChanges({
        source: 'us-east1',
        target: 'us-west1',
        entity: 'user_123',
        changeType: 'concurrent_modification'
      });

      // Act
      const result = await syncService.handleSyncConflict(conflictingChanges);

      // Assert
      expect(result.resolved).toBe(true);
      expect(result.resolutionStrategy).toBe('last_write_wins');
      const verification = await consistencyService.verifyConsistency('user_123');
      expect(verification.isConsistent).toBe(true);
    });

    test('should queue unresolvable conflicts for manual review', async () => {
      // Arrange
      const complexConflict = await testContext.setupComplexConflict({
        entity: 'transaction_456',
        type: 'semantic_conflict'
      });

      // Act
      const result = await syncService.handleSyncConflict(complexConflict);

      // Assert
      expect(result.resolved).toBe(false);
      expect(result.queuedForReview).toBe(true);
      const queuedItems = await syncService.getManualReviewQueue();
      expect(queuedItems).toContainEqual(expect.objectContaining({
        entityId: 'transaction_456'
      }));
    });
  });

  describe('Performance and Scaling', () => {
    test('should adjust sync parameters based on system load', async () => {
      // Arrange
      await mockMetrics.simulateSystemLoad(0.8); // 80% CPU load
      const initialParams = await syncService.getSyncParameters();

      // Act
      await syncService.adjustSyncParameters();
      const adjustedParams = await syncService.getSyncParameters();

      // Assert
      expect(adjustedParams.maxConcurrentTransfers).toBeLessThan(initialParams.maxConcurrentTransfers);
      expect(adjustedParams.bandwidthLimit).toBeLessThan(initialParams.bandwidthLimit);
    });

    test('should maintain sync performance under load', async () => {
      // Arrange
      const syncOperations = Array.from({ length: 10 }, (_, i) => ({
        id: `sync_${i}`,
        size: 1000 * (i + 1)
      }));

      // Act
      const results = await Promise.all(
        syncOperations.map(op => syncService.syncChange(op))
      );

      // Assert
      const successRate = results.filter(r => r.success).length / results.length;
      expect(successRate).toBeGreaterThan(0.95); // 95% success rate
      const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
      expect(avgDuration).toBeLessThan(1000); // Less than 1 second average
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle network interruptions gracefully', async () => {
      // Arrange
      const syncOperation = testContext.setupLongRunningSyncOperation();
      
      // Simulate network interruption mid-sync
      setTimeout(() => {
        testContext.simulateNetworkOutage({
          duration: 5000, // 5 seconds
          regions: ['us-west1']
        });
      }, 1000);

      // Act
      const result = await syncService.startSync();

      // Assert
      expect(result.status).toBe('completed');
      expect(result.retryAttempts).toBeGreaterThan(0);
      expect(result.dataIntegrity).toBe(100);
    });

    test('should implement progressive backoff for failed syncs', async () => {
      // Arrange
      const failureCondition = testContext.simulateIntermittentFailures({
        probability: 0.5,
        maxDuration: 10000
      });

      // Act
      const startTime = Date.now();
      const result = await syncService.startSync();
      const duration = Date.now() - startTime;

      // Assert
      expect(result.status).toBe('completed');
      expect(duration).toBeGreaterThan(1000); // Should have attempted retries
      expect(result.backoffIntervals).toEqual(
        expect.arrayContaining([1000, 2000, 4000]) // Progressive backoff
      );
    });
  });
}); 