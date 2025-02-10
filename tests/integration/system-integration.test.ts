import { EmergencyResponseHandler } from '../../scripts/deployment-automation/emergency';
import { DisasterRecoveryService } from '../../scripts/deployment-automation/disaster-recovery';
import { DataConsistencyService } from '../../scripts/deployment-automation/data-consistency';
import { DataSyncService } from '../../scripts/deployment-automation/data-sync';
import { CapacityPlanningService } from '../../scripts/deployment-automation/capacity-planning';
import { TestDeployment } from '../deployment/setup';
import { TestContext } from '../utils/test-context';

describe('System Integration Tests', () => {
  let testContext: TestContext;
  let testDeployment: TestDeployment;
  let emergencyHandler: EmergencyResponseHandler;
  let disasterRecovery: DisasterRecoveryService;
  let consistencyService: DataConsistencyService;
  let syncService: DataSyncService;
  let capacityService: CapacityPlanningService;

  beforeAll(async () => {
    // Set up full test environment
    testDeployment = new TestDeployment({
      name: 'integration-test',
      region: 'us-east1',
      scale: 'medium',
      features: ['emergency', 'dr', 'sync', 'capacity']
    });

    await testDeployment.deploy();

    testContext = await TestContext.create({
      mockServices: false, // Use real services for integration tests
      recordMetrics: true
    });

    // Initialize all services
    emergencyHandler = new EmergencyResponseHandler();
    disasterRecovery = new DisasterRecoveryService();
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
      adaptiveSync: { enabled: true, targetLatency: 50, maxBandwidth: 500 }
    }, consistencyService);
    capacityService = new CapacityPlanningService({
      predictionWindow: 24,
      updateInterval: 15,
      thresholds: { cpu: 80, memory: 75, storage: 85, network: 70 }
    });
  });

  afterAll(async () => {
    await testDeployment.cleanup();
    await testContext.cleanup();
  });

  describe('Emergency Response and Disaster Recovery Integration', () => {
    test('should handle catastrophic failure with data recovery', async () => {
      // Arrange
      await testContext.setupCatastrophicFailure({
        regions: ['us-east1'],
        services: ['database', 'cache'],
        dataCorruption: true
      });

      // Act
      const emergencyResponse = await emergencyHandler.handleDeploymentFailure({
        status: 'failure',
        details: ['Complete region failure with data corruption'],
        errors: [new Error('Region failure')]
      });

      // Assert
      expect(emergencyResponse.actions).toContain('Disaster recovery initiated');
      
      // Verify DR was successful
      const drStatus = await disasterRecovery.getStatus();
      expect(drStatus.isActive).toBe(false);
      expect(drStatus.lastRecovery.successful).toBe(true);

      // Verify data consistency after recovery
      const consistencyCheck = await consistencyService.checkDataConsistency();
      expect(consistencyCheck.status).toBe('consistent');
    });
  });

  describe('Data Sync and Consistency Integration', () => {
    test('should maintain consistency during large-scale sync', async () => {
      // Arrange
      const largeDataChange = await testContext.generateLargeDataChange({
        size: '10GB',
        regions: ['us-east1', 'us-west1'],
        changeRate: '1000/s'
      });

      // Act
      await syncService.startSync();

      // Monitor consistency during sync
      const consistencyResults = [];
      for (let i = 0; i < 5; i++) {
        consistencyResults.push(await consistencyService.checkDataConsistency());
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Assert
      expect(consistencyResults.every(r => r.status === 'consistent')).toBe(true);
      const finalSync = await syncService.getSyncStatus();
      expect(finalSync.completedChanges).toBe(largeDataChange.totalChanges);
    });
  });

  describe('Capacity Planning and Emergency Response Integration', () => {
    test('should handle resource exhaustion scenarios', async () => {
      // Arrange
      await testContext.simulateResourceExhaustion({
        resource: 'memory',
        rate: 'rapid', // Quick exhaustion
        duration: '5m'
      });

      // Act
      const predictions = await capacityService.analyzeFutureCapacity();
      
      // Verify emergency response triggers before actual exhaustion
      const emergencyEvents = await testContext.getEmergencyEvents();
      const scalingEvents = await testContext.getScalingEvents();

      // Assert
      expect(emergencyEvents).toHaveLength(1);
      expect(emergencyEvents[0].type).toBe('preventive_action');
      expect(scalingEvents).toHaveLength(1);
      expect(scalingEvents[0].action).toBe('scale_up');
    });
  });

  describe('Full System Recovery Test', () => {
    test('should recover from multi-component failure', async () => {
      // Arrange
      const failureScenario = {
        database: 'corruption',
        network: 'partition',
        compute: 'overload',
        storage: 'failure'
      };

      await testContext.simulateMultiComponentFailure(failureScenario);

      // Act
      const startTime = Date.now();
      const recoveryResult = await emergencyHandler.handleMultiComponentFailure(failureScenario);

      // Assert
      expect(recoveryResult.success).toBe(true);
      expect(Date.now() - startTime).toBeLessThan(300000); // Recovery within 5 minutes

      // Verify system health
      const healthCheck = await testContext.performSystemHealthCheck();
      expect(healthCheck.allComponentsHealthy).toBe(true);
      expect(healthCheck.dataConsistency).toBe(100);
    });
  });

  describe('Performance Under Load', () => {
    test('should maintain performance during high load with multiple incidents', async () => {
      // Arrange
      const baselineMetrics = await testContext.capturePerformanceMetrics();
      
      // Simulate high load with incidents
      await Promise.all([
        testContext.simulateHighLoad({ duration: '10m', intensity: 0.9 }),
        testContext.simulateRandomIncidents({ count: 5, interval: '1m' }),
        testContext.simulateDataSync({ size: '5GB', regions: ['us-east1', 'eu-west1'] })
      ]);

      // Act
      const loadMetrics = await testContext.capturePerformanceMetrics();
      const incidents = await testContext.getIncidentLog();

      // Assert
      expect(loadMetrics.latency).toBeLessThan(baselineMetrics.latency * 2);
      expect(loadMetrics.throughput).toBeGreaterThan(baselineMetrics.throughput * 0.7);
      expect(incidents.every(i => i.resolved)).toBe(true);
    });
  });

  describe('Cross-Service Communication', () => {
    test('should maintain service communication during recovery', async () => {
      // Arrange
      const serviceMap = await testContext.mapServiceDependencies();
      
      // Simulate partial system failure
      await testContext.simulateServiceFailures({
        failureRate: 0.3, // 30% of services fail
        duration: '5m'
      });

      // Act
      const communicationLog = await testContext.monitorServiceCommunication('5m');
      const recoveryActions = await testContext.getRecoveryActions();

      // Assert
      expect(communicationLog.failedCalls).toBeLessThan(
        communicationLog.totalCalls * 0.01 // Max 1% failed calls
      );
      expect(recoveryActions.every(a => a.completed)).toBe(true);
    });
  });
}); 