import { CapacityPlanningService } from '../../scripts/deployment-automation/capacity-planning';
import { MockMetricsService } from '../mocks/metrics-service';
import { TestContext } from '../utils/test-context';
import { MachineLearningService } from '../../utils/ml-service';

describe('Capacity Planning Service Tests', () => {
  let capacityService: CapacityPlanningService;
  let testContext: TestContext;
  let mockMetrics: MockMetricsService;
  let mlService: MachineLearningService;

  beforeEach(async () => {
    testContext = await TestContext.create({
      mockServices: true,
      recordMetrics: true
    });

    mockMetrics = new MockMetricsService();
    mlService = new MachineLearningService();

    capacityService = new CapacityPlanningService({
      predictionWindow: 24,
      updateInterval: 15,
      thresholds: {
        cpu: 80,
        memory: 75,
        storage: 85,
        network: 70
      },
      autoScaling: {
        enabled: true,
        maxScaleUp: 200,
        cooldownPeriod: 15
      },
      costOptimization: {
        enabled: true,
        budgetLimit: 10000,
        savingsTarget: 20
      }
    });
  });

  afterEach(async () => {
    await testContext.cleanup();
  });

  describe('Resource Prediction', () => {
    test('should accurately predict resource needs', async () => {
      // Arrange
      const historicalData = await testContext.generateHistoricalMetrics({
        days: 30,
        pattern: 'daily_spike'
      });

      // Act
      const predictions = await capacityService.predictResourceNeeds(historicalData);

      // Assert
      expect(predictions).toHaveLength(24); // 24-hour window
      expect(predictions[0].confidence).toBeGreaterThan(0.8);
      expect(predictions[0].resources).toMatchObject({
        cpu: expect.any(Number),
        memory: expect.any(Number),
        storage: expect.any(Number),
        network: expect.any(Number)
      });
    });

    test('should adapt predictions to seasonal patterns', async () => {
      // Arrange
      await testContext.simulateSeasonalPattern({
        pattern: 'weekly_cycle',
        duration: 90 // days
      });

      // Act
      const predictions = await capacityService.analyzeFutureCapacity();

      // Assert
      const weekdayPredictions = predictions.filter(p => 
        new Date(p.timestamp).getDay() !== 0 && 
        new Date(p.timestamp).getDay() !== 6
      );
      const weekendPredictions = predictions.filter(p => 
        new Date(p.timestamp).getDay() === 0 || 
        new Date(p.timestamp).getDay() === 6
      );

      expect(weekdayPredictions[0].resources.cpu)
        .toBeGreaterThan(weekendPredictions[0].resources.cpu);
    });
  });

  describe('Scaling Recommendations', () => {
    test('should generate appropriate scaling recommendations', async () => {
      // Arrange
      await mockMetrics.simulateResourceUtilization({
        cpu: 85,
        memory: 60,
        storage: 90,
        network: 45
      });

      // Act
      const recommendations = await capacityService.generateRecommendations(
        await capacityService.predictResourceNeeds([])
      );

      // Assert
      expect(recommendations).toContainEqual(expect.objectContaining({
        resource: 'storage',
        action: 'scale_up',
        priority: expect.any(Number)
      }));
      expect(recommendations).toContainEqual(expect.objectContaining({
        resource: 'network',
        action: 'scale_down',
        priority: expect.any(Number)
      }));
    });

    test('should respect cooldown periods', async () => {
      // Arrange
      const resource = 'cpu';
      await capacityService.executeScaling({
        resource,
        action: 'scale_up',
        amount: 50,
        priority: 1,
        reason: 'test',
        estimatedCost: 100
      });

      // Act
      const canScale = await capacityService.canScaleResource(resource);

      // Assert
      expect(canScale).toBe(false);
      const cooldownEnd = await capacityService.getCooldownEnd(resource);
      expect(cooldownEnd).toBeGreaterThan(Date.now());
    });
  });

  describe('Cost Optimization', () => {
    test('should identify cost optimization opportunities', async () => {
      // Arrange
      await mockMetrics.simulateResourceCosts({
        duration: 30, // days
        overProvisionedResources: ['memory', 'network']
      });

      // Act
      const opportunities = await capacityService.findCostOptimizations(
        await mockMetrics.getCurrentCosts(),
        await mockMetrics.getResourceUtilization()
      );

      // Assert
      expect(opportunities).toHaveLength(2);
      expect(opportunities[0].savings).toBeGreaterThan(0);
      expect(opportunities[0].risk).toBeLessThan(0.2);
    });

    test('should maintain performance while optimizing costs', async () => {
      // Arrange
      const initialPerformance = await testContext.measurePerformance();
      
      // Act
      await capacityService.optimizeCosts();
      const optimizedPerformance = await testContext.measurePerformance();

      // Assert
      expect(optimizedPerformance.latency)
        .toBeLessThanOrEqual(initialPerformance.latency * 1.1); // Max 10% degradation
      expect(optimizedPerformance.throughput)
        .toBeGreaterThanOrEqual(initialPerformance.throughput * 0.9); // Max 10% reduction
    });
  });

  describe('ML Model Integration', () => {
    test('should improve prediction accuracy over time', async () => {
      // Arrange
      const initialPredictions = await capacityService.predictResourceNeeds([]);
      
      // Simulate system running for a period
      await testContext.simulateSystemOperation({ duration: '7d' });
      
      // Act
      const updatedPredictions = await capacityService.predictResourceNeeds([]);

      // Assert
      expect(updatedPredictions[0].confidence)
        .toBeGreaterThan(initialPredictions[0].confidence);
      expect(await mlService.getModelAccuracy())
        .toBeGreaterThan(0.85);
    });

    test('should handle anomalous patterns', async () => {
      // Arrange
      await testContext.simulateAnomaly({
        type: 'sudden_spike',
        magnitude: 3, // 3x normal usage
        duration: '1h'
      });

      // Act
      const predictions = await capacityService.predictResourceNeeds([]);
      const anomalyResponse = await capacityService.handleAnomalousPattern(predictions);

      // Assert
      expect(anomalyResponse.detected).toBe(true);
      expect(anomalyResponse.mitigationApplied).toBe(true);
      expect(predictions[0].confidence).toBeGreaterThan(0.7);
    });
  });

  describe('Error Handling', () => {
    test('should handle prediction service failures', async () => {
      // Arrange
      mlService.simulateFailure(true);

      // Act
      const result = await capacityService.analyzeFutureCapacity();

      // Assert
      expect(result.status).toBe('completed');
      expect(result.usedFallback).toBe(true);
      expect(result.predictions).toBeDefined();
    });

    test('should validate recommendations before applying', async () => {
      // Arrange
      const invalidRecommendation = {
        resource: 'cpu',
        action: 'scale_up',
        amount: 500, // Exceeds maxScaleUp
        priority: 1,
        reason: 'test',
        estimatedCost: 1000
      };

      // Act & Assert
      await expect(
        capacityService.applyRecommendations([invalidRecommendation])
      ).rejects.toThrow('Exceeds maximum scale up limit');
    });
  });
}); 