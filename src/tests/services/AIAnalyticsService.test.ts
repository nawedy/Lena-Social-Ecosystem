/// <reference types="jest" />

import { AIAnalyticsService } from '../../services/AIAnalyticsService';
import { AnalyticsService } from '../../services/AnalyticsService';
import { NotificationService } from '../../services/NotificationService';
import { RBACService, Role } from '../../services/RBACService';

jest.mock('../../services/AnalyticsService');
jest.mock('../../services/NotificationService');
jest.mock('../../services/RBACService');

describe('AIAnalyticsService', () => {
  let aiAnalytics: AIAnalyticsService;
  let rbac: RBACService;
  let mockAnalytics: jest.Mocked<AnalyticsService>;
  let mockRBAC: jest.Mocked<RBACService>;
  const testUserId = 'test_user';
  const testAccounts = ['account1', 'account2'];

  beforeEach(async () => {
    // Reset all mocks
    jest.clearAllMocks();

    // Initialize service and mocks
    aiAnalytics = AIAnalyticsService.getInstance();
    rbac = RBACService.getInstance();
    mockAnalytics = AnalyticsService.getInstance() as jest.Mocked<AnalyticsService>;
    mockRBAC = RBACService.getInstance() as jest.Mocked<RBACService>;

    // Setup default mock implementations
    mockRBAC.hasPermission.mockResolvedValue(true);
    mockAnalytics.trackEvent.mockResolvedValue();

    // Setup test user with analyst role
    await rbac.assignRole('system', testUserId, Role.ANALYST, {
      accounts: testAccounts,
    });
  });

  describe('Insight Generation', () => {
    it('should generate insights for valid timeframe', async () => {
      const timeframe = {
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        end: new Date(),
      };

      const insights = await aiAnalytics.generateInsights(testUserId, testAccounts, {
        timeframe,
        threshold: 0.8,
      });

      expect(insights).toBeDefined();
      expect(Array.isArray(insights)).toBe(true);

      // Verify insight structure
      if (insights.length > 0) {
        const insight = insights[0];
        expect(insight).toHaveProperty('type');
        expect(insight).toHaveProperty('confidence');
        expect(insight).toHaveProperty('impact');
        expect(insight).toHaveProperty('description');
        expect(insight).toHaveProperty('recommendations');
        expect(Array.isArray(insight.recommendations)).toBe(true);
      }
    });

    it('should filter insights by threshold', async () => {
      const timeframe = {
        start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
        end: new Date(),
      };

      const highThresholdInsights = await aiAnalytics.generateInsights(testUserId, testAccounts, {
        timeframe,
        threshold: 0.9,
      });

      const lowThresholdInsights = await aiAnalytics.generateInsights(testUserId, testAccounts, {
        timeframe,
        threshold: 0.5,
      });

      expect(highThresholdInsights.length).toBeLessThanOrEqual(lowThresholdInsights.length);
    });

    it('should generate different types of insights', async () => {
      const timeframe = {
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        end: new Date(),
      };

      const insights = await aiAnalytics.generateInsights(testUserId, testAccounts, {
        timeframe,
        threshold: 0.5, // Lower threshold to get more insights
      });

      const insightTypes = new Set(insights.map((i) => i.type));

      // Should have multiple types of insights
      expect(insightTypes.size).toBeGreaterThan(1);

      // Check for specific insight types
      const expectedTypes = ['trend', 'anomaly', 'cluster', 'segment', 'strategy'];
      expectedTypes.forEach((type) => {
        const hasType = insights.some((i) => i.type === type);
        expect(hasType).toBe(true);
      });
    });
  });

  describe('Trend Analysis', () => {
    it('should detect significant trends', async () => {
      const timeframe = {
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        end: new Date(),
      };

      const insights = await aiAnalytics.generateInsights(testUserId, testAccounts, {
        timeframe,
        metrics: ['views', 'engagement', 'followers'],
      });

      const trendInsights = insights.filter((i) => i.type === 'trend');
      expect(trendInsights.length).toBeGreaterThan(0);

      // Verify trend insights have required properties
      trendInsights.forEach((insight) => {
        expect(insight.data).toHaveProperty('metric');
        expect(insight.data).toHaveProperty('trend');
        expect(insight.data).toHaveProperty('significance');
        expect(insight.data).toHaveProperty('forecast');
      });
    });
  });

  describe('Anomaly Detection', () => {
    it('should detect anomalies with proper severity levels', async () => {
      const timeframe = {
        start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        end: new Date(),
      };

      const insights = await aiAnalytics.generateInsights(testUserId, testAccounts, {
        timeframe,
        threshold: 0.5,
      });

      const anomalyInsights = insights.filter((i) => i.type === 'anomaly');

      anomalyInsights.forEach((insight) => {
        expect(insight.data).toHaveProperty('severity');
        expect(['low', 'medium', 'high']).toContain(insight.data.severity);
      });
    });
  });

  describe('Content Clustering', () => {
    it('should generate meaningful content clusters', async () => {
      const timeframe = {
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        end: new Date(),
      };

      const insights = await aiAnalytics.generateInsights(testUserId, testAccounts, {
        timeframe,
      });

      const clusterInsights = insights.filter((i) => i.type === 'cluster');

      clusterInsights.forEach((insight) => {
        expect(insight.data).toHaveProperty('characteristics');
        expect(insight.data).toHaveProperty('performance');
        expect(insight.data.performance).toHaveProperty('engagement');
        expect(insight.data.performance).toHaveProperty('growth');
      });
    });
  });

  describe('Audience Segmentation', () => {
    it('should identify valuable audience segments', async () => {
      const timeframe = {
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        end: new Date(),
      };

      const insights = await aiAnalytics.generateInsights(testUserId, testAccounts, {
        timeframe,
      });

      const segmentInsights = insights.filter((i) => i.type === 'segment');

      segmentInsights.forEach((insight) => {
        expect(insight.data).toHaveProperty('demographics');
        expect(insight.data).toHaveProperty('behaviors');
        expect(insight.data).toHaveProperty('preferences');
        expect(insight.data).toHaveProperty('engagement');
      });
    });
  });

  describe('Optimization Strategies', () => {
    it('should generate actionable recommendations', async () => {
      const timeframe = {
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        end: new Date(),
      };

      const insights = await aiAnalytics.generateInsights(testUserId, testAccounts, {
        timeframe,
      });

      const strategyInsights = insights.filter((i) => i.type === 'strategy');

      strategyInsights.forEach((insight) => {
        expect(insight.recommendations.length).toBeGreaterThan(0);

        insight.recommendations.forEach((recommendation) => {
          expect(recommendation).toHaveProperty('action');
          expect(recommendation).toHaveProperty('impact');
          expect(recommendation).toHaveProperty('effort');
          expect(recommendation).toHaveProperty('priority');
          expect(recommendation).toHaveProperty('implementation');
        });
      });
    });
  });

  describe('Analytics Service Mock', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should track AI model performance', () => {
      const modelName = 'gpt-4';
      const latency = 500;
      const success = true;

      AIAnalyticsService.trackModelPerformance(modelName, latency, success);

      expect(mockAnalytics.trackMetric).toHaveBeenCalledWith('ai_model_latency', latency, {
        model: modelName,
      });
      expect(mockAnalytics.trackEvent).toHaveBeenCalledWith('ai_model_invocation', {
        model: modelName,
        success,
        latency,
      });
    });

    it('should track AI model errors', () => {
      const modelName = 'gpt-4';
      const error = new Error('Model timeout');

      AIAnalyticsService.trackModelError(modelName, error);

      expect(mockAnalytics.trackError).toHaveBeenCalledWith(error, {
        model: modelName,
        errorType: 'ai_model_error',
      });
    });

    it('should track AI feature usage', () => {
      const featureName = 'smart_suggestions';
      const userId = 'user123';

      AIAnalyticsService.trackFeatureUsage(featureName, userId);

      expect(mockAnalytics.trackEvent).toHaveBeenCalledWith('ai_feature_usage', {
        feature: featureName,
        userId,
      });
    });

    it('should track model training progress', () => {
      const modelName = 'custom_model';
      const progress = 75;
      const epoch = 3;

      AIAnalyticsService.trackTrainingProgress(modelName, progress, epoch);

      expect(mockAnalytics.trackMetric).toHaveBeenCalledWith(
        'model_training_progress',
        progress,
        {
          model: modelName,
          epoch: epoch.toString(),
        }
      );
    });
  });

  describe('getInstance', () => {
    it('should create a singleton instance', () => {
      const instance1 = AIAnalyticsService.getInstance();
      const instance2 = AIAnalyticsService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('initialize', () => {
    it('should initialize with default settings', async () => {
      const instance = AIAnalyticsService.getInstance();
      await instance.initialize();
      expect(instance.isInitialized()).toBe(true);
    });
  });

  describe('setConfiguration', () => {
    it('should update configuration', () => {
      const instance = AIAnalyticsService.getInstance();
      const config = {
        modelType: 'trend',
        dataSource: 'realtime',
        threshold: 0.85,
      };
      instance.setConfiguration(config);
      expect(instance.getConfiguration()).toEqual(config);
    });
  });

  describe('trackAIEvent', () => {
    const testEvent = {
      eventType: 'ai_prediction',
      modelName: 'test-model',
      confidence: 0.95,
      duration: 150,
      success: true,
    };

    it('should track AI events successfully', async () => {
      await aiAnalytics.trackAIEvent(testEvent);

      expect(mockAnalytics.trackEvent).toHaveBeenCalledWith({
        category: 'AI',
        action: testEvent.eventType,
        label: testEvent.modelName,
        value: testEvent.confidence,
        metadata: {
          duration: testEvent.duration,
          success: testEvent.success,
        },
      });
    });

    it('should handle errors gracefully', async () => {
      mockAnalytics.trackEvent.mockRejectedValue(new Error('Test error'));

      await expect(aiAnalytics.trackAIEvent(testEvent)).resolves.not.toThrow();
      expect(mockAnalytics.trackEvent).toHaveBeenCalled();
    });
  });

  describe('getAIMetrics', () => {
    const testMetrics = {
      totalPredictions: 100,
      averageConfidence: 0.85,
      successRate: 0.95,
    };

    beforeEach(() => {
      mockAnalytics.getMetrics.mockResolvedValue(testMetrics);
    });

    it('should return AI metrics when user has permission', async () => {
      const metrics = await aiAnalytics.getAIMetrics();

      expect(mockRBAC.hasPermission).toHaveBeenCalled();
      expect(metrics).toEqual(testMetrics);
    });

    it('should throw error when user lacks permission', async () => {
      mockRBAC.hasPermission.mockResolvedValue(false);

      await expect(aiAnalytics.getAIMetrics()).rejects.toThrow('Unauthorized');
      expect(mockAnalytics.getMetrics).not.toHaveBeenCalled();
    });
  });
});
