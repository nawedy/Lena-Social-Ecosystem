import { DataConsistencyService } from '../../scripts/deployment-automation/data-consistency';
import { MockMetricsService } from '../mocks/metrics-service';
import { TestContext } from '../utils/test-context';
import { AnomalyDetector } from '../../utils/anomaly-detector';

describe('Data Consistency Service Tests', () => {
  let consistencyService: DataConsistencyService;
  let testContext: TestContext;
  let mockMetrics: MockMetricsService;
  let anomalyDetector: AnomalyDetector;

  beforeEach(async () => {
    testContext = await TestContext.create({
      mockServices: true,
      recordMetrics: true
    });

    mockMetrics = new MockMetricsService();
    anomalyDetector = new AnomalyDetector();

    consistencyService = new DataConsistencyService({
      checkInterval: 300,
      batchSize: 1000,
      parallelChecks: 5,
      adaptiveScaling: {
        enabled: true,
        targetLatency: 100,
        maxParallelChecks: 10
      }
    });
  });

  afterEach(async () => {
    await testContext.cleanup();
  });

  describe('Consistency Checks', () => {
    test('should detect data inconsistencies across regions', async () => {
      // Arrange
      const testData = await testContext.setupInconsistentData({
        regions: ['us-east1', 'us-west1'],
        inconsistencyType: 'mismatch',
        dataSize: 1000
      });

      // Act
      const result = await consistencyService.checkDataConsistency();

      // Assert
      expect(result.status).toBe('inconsistent');
      expect(result.inconsistencies).toHaveLength(1);
      expect(result.inconsistencies[0]).toMatchObject({
        type: 'mismatch',
        source: 'us-east1',
        target: 'us-west1'
      });
    });

    test('should handle large datasets efficiently', async () => {
      // Arrange
      const largeDataset = await testContext.generateTestData({
        size: 1000000,
        complexity: 'high'
      });

      // Act
      const startTime = Date.now();
      const result = await consistencyService.checkDataConsistency();
      const duration = Date.now() - startTime;

      // Assert
      expect(duration).toBeLessThan(30000); // Should complete within 30 seconds
      expect(result.samplingRate).toBeGreaterThan(0.1); // At least 10% sampling
    });
  });

  describe('Adaptive Scaling', () => {
    test('should adjust batch size based on system load', async () => {
      // Arrange
      await mockMetrics.simulateSystemLoad(0.8); // 80% CPU load

      // Act
      const initialBatchSize = await consistencyService.calculateOptimalBatchSize();
      await mockMetrics.simulateSystemLoad(0.3); // 30% CPU load
      const adjustedBatchSize = await consistencyService.calculateOptimalBatchSize();

      // Assert
      expect(adjustedBatchSize).toBeGreaterThan(initialBatchSize);
      expect(adjustedBatchSize).toBeLessThanOrEqual(consistencyService.MAX_BATCH_SIZE);
    });

    test('should handle parallel checks efficiently', async () => {
      // Arrange
      const regions = ['us-east1', 'us-west1', 'eu-west1'];
      const checkPromises = regions.map(region => 
        consistencyService.checkRegionConsistency(region, 1000)
      );

      // Act
      const startTime = Date.now();
      const results = await Promise.all(checkPromises);
      const duration = Date.now() - startTime;

      // Assert
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      expect(results).toHaveLength(regions.length);
    });
  });

  describe('Anomaly Detection', () => {
    test('should identify abnormal inconsistency patterns', async () => {
      // Arrange
      const anomalousBehavior = {
        type: 'corruption',
        frequency: 'sudden_spike',
        pattern: 'systematic'
      };
      await testContext.simulateDataAnomalies(anomalousBehavior);

      // Act
      const result = await consistencyService.checkDataConsistency();
      const anomalyResult = await anomalyDetector.check({
        type: 'data_consistency',
        metrics: result
      });

      // Assert
      expect(anomalyResult.isAnomaly).toBe(true);
      expect(anomalyResult.confidence).toBeGreaterThan(0.8);
    });

    test('should trigger automatic resolution for known patterns', async () => {
      // Arrange
      const knownInconsistency = {
        type: 'missing',
        source: 'primary',
        target: 'replica',
        entity: 'user_preferences'
      };

      // Act
      const resolved = await consistencyService.attemptAutomaticResolution(
        knownInconsistency
      );

      // Assert
      expect(resolved).toBe(true);
      const verification = await consistencyService.verifyConsistency(
        knownInconsistency.entity
      );
      expect(verification.isConsistent).toBe(true);
    });
  });

  describe('Performance Monitoring', () => {
    test('should track consistency check performance metrics', async () => {
      // Arrange
      const monitoringPeriod = 5; // minutes
      const expectedChecks = Math.floor(monitoringPeriod * 60 / 300); // Based on check interval

      // Act
      await testContext.advanceTime(monitoringPeriod * 60 * 1000);
      const metrics = await mockMetrics.getMetrics('data_consistency');

      // Assert
      expect(metrics.checksPerformed).toBe(expectedChecks);
      expect(metrics.averageCheckDuration).toBeLessThan(1000); // Less than 1 second
      expect(metrics.successRate).toBeGreaterThan(0.99); // 99% success rate
    });

    test('should maintain performance under increased load', async () => {
      // Arrange
      await mockMetrics.simulateHighLoad({
        duration: 5 * 60 * 1000, // 5 minutes
        intensity: 0.9 // 90% load
      });

      // Act
      const results = [];
      for (let i = 0; i < 10; i++) {
        results.push(await consistencyService.checkDataConsistency());
      }

      // Assert
      const avgDuration = results.reduce((sum, r) => sum + r.checkDuration, 0) / results.length;
      expect(avgDuration).toBeLessThan(2000); // Less than 2 seconds average
      expect(Math.min(...results.map(r => r.samplingRate))).toBeGreaterThan(0.05); // Minimum 5% sampling
    });
  });

  describe('Error Handling', () => {
    test('should handle network partitions gracefully', async () => {
      // Arrange
      await testContext.simulateNetworkPartition({
        region: 'us-west1',
        duration: 30000 // 30 seconds
      });

      // Act
      const result = await consistencyService.checkDataConsistency();

      // Assert
      expect(result.status).not.toBe('error');
      expect(result.details).toContain('Partial check completed');
      expect(result.affectedRegions).toContain('us-west1');
    });

    test('should retry failed consistency checks', async () => {
      // Arrange
      const maxRetries = 3;
      let attempts = 0;
      mockMetrics.simulateTransientFailure(() => {
        attempts++;
        return attempts <= 2; // Fail first two attempts
      });

      // Act
      const result = await consistencyService.checkDataConsistency();

      // Assert
      expect(attempts).toBe(3); // Should have retried twice
      expect(result.status).toBe('consistent');
    });
  });
}); 