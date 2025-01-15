import { AIAnalyticsService } from '../../services/AIAnalyticsService';
import { RBACService, Role } from '../../services/RBACService';

describe('AIAnalyticsService', () => {
  let aiAnalytics: AIAnalyticsService;
  let rbac: RBACService;
  const testUserId = 'test_user';
  const testAccounts = ['account1', 'account2'];

  beforeEach(async () => {
    aiAnalytics = AIAnalyticsService.getInstance();
    rbac = RBACService.getInstance();

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

      const insights = await aiAnalytics.generateInsights(
        testUserId,
        testAccounts,
        {
          timeframe,
          threshold: 0.8,
        }
      );

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

      const highThresholdInsights = await aiAnalytics.generateInsights(
        testUserId,
        testAccounts,
        {
          timeframe,
          threshold: 0.9,
        }
      );

      const lowThresholdInsights = await aiAnalytics.generateInsights(
        testUserId,
        testAccounts,
        {
          timeframe,
          threshold: 0.5,
        }
      );

      expect(highThresholdInsights.length).toBeLessThanOrEqual(
        lowThresholdInsights.length
      );
    });

    it('should generate different types of insights', async () => {
      const timeframe = {
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        end: new Date(),
      };

      const insights = await aiAnalytics.generateInsights(
        testUserId,
        testAccounts,
        {
          timeframe,
          threshold: 0.5, // Lower threshold to get more insights
        }
      );

      const insightTypes = new Set(insights.map(i => i.type));
      
      // Should have multiple types of insights
      expect(insightTypes.size).toBeGreaterThan(1);
      
      // Check for specific insight types
      const expectedTypes = ['trend', 'anomaly', 'cluster', 'segment', 'strategy'];
      expectedTypes.forEach(type => {
        const hasType = insights.some(i => i.type === type);
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

      const insights = await aiAnalytics.generateInsights(
        testUserId,
        testAccounts,
        {
          timeframe,
          metrics: ['views', 'engagement', 'followers'],
        }
      );

      const trendInsights = insights.filter(i => i.type === 'trend');
      expect(trendInsights.length).toBeGreaterThan(0);

      // Verify trend insights have required properties
      trendInsights.forEach(insight => {
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

      const insights = await aiAnalytics.generateInsights(
        testUserId,
        testAccounts,
        {
          timeframe,
          threshold: 0.5,
        }
      );

      const anomalyInsights = insights.filter(i => i.type === 'anomaly');
      
      anomalyInsights.forEach(insight => {
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

      const insights = await aiAnalytics.generateInsights(
        testUserId,
        testAccounts,
        {
          timeframe,
        }
      );

      const clusterInsights = insights.filter(i => i.type === 'cluster');
      
      clusterInsights.forEach(insight => {
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

      const insights = await aiAnalytics.generateInsights(
        testUserId,
        testAccounts,
        {
          timeframe,
        }
      );

      const segmentInsights = insights.filter(i => i.type === 'segment');
      
      segmentInsights.forEach(insight => {
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

      const insights = await aiAnalytics.generateInsights(
        testUserId,
        testAccounts,
        {
          timeframe,
        }
      );

      const strategyInsights = insights.filter(i => i.type === 'strategy');
      
      strategyInsights.forEach(insight => {
        expect(insight.recommendations.length).toBeGreaterThan(0);
        
        insight.recommendations.forEach(recommendation => {
          expect(recommendation).toHaveProperty('action');
          expect(recommendation).toHaveProperty('impact');
          expect(recommendation).toHaveProperty('effort');
          expect(recommendation).toHaveProperty('priority');
          expect(recommendation).toHaveProperty('implementation');
        });
      });
    });
  });
});
