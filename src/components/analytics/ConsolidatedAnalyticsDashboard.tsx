import { MaterialIcons } from '@expo/vector-icons';
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import {
  LineChart,
  _BarChart,
  _PieChart,
  _ProgressChart,
  _ContributionGraph,
  _StackedBarChart,
} from 'react-native-chart-kit';

import { EnhancedAnalyticsService } from '../../services/EnhancedAnalyticsService';
import { RBACService, Permission } from '../../services/RBACService';

interface DashboardState {
  timeframe: {
    start: Date;
    end: Date;
    granularity: 'hour' | 'day' | 'week' | 'month';
  };
  filter: {
    accounts: string[];
    contentTypes: string[];
    tags: string[];
    categories: string[];
    campaigns: string[];
  };
  view: 'overview' | 'content' | 'audience' | 'competitors' | 'predictions';
}

export function ConsolidatedAnalyticsDashboard() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<DashboardState>({
    timeframe: {
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      end: new Date(),
      granularity: 'day',
    },
    filter: {
      accounts: [],
      contentTypes: [],
      tags: [],
      categories: [],
      campaigns: [],
    },
    view: 'overview',
  });
  const [data, setData] = useState<any>(null);
  const [accessibleAccounts, setAccessibleAccounts] = useState<string[]>([]);

  const _analytics = EnhancedAnalyticsService.getInstance();
  const _rbac = RBACService.getInstance();

  useEffect(() => {
    loadAccessibleAccounts();
  }, []);

  useEffect(() => {
    if (accessibleAccounts.length > 0) {
      loadAnalytics();
    }
  }, [accessibleAccounts, state.timeframe, state.filter, state.view]);

  const _loadAccessibleAccounts = async () => {
    try {
      const _accounts = await rbac.getAccessibleAccounts(
        'current_user_id',
        Permission.VIEW_ANALYTICS
      );
      setAccessibleAccounts(accounts);
      setState(prev => ({
        ...prev,
        filter: {
          ...prev.filter,
          accounts,
        },
      }));
    } catch (error) {
      console.error('Error loading accessible accounts:', error);
    }
  };

  const _loadAnalytics = async () => {
    setLoading(true);
    try {
      const _analyticsData = await analytics.getConsolidatedAnalytics(
        'current_user_id',
        state.timeframe,
        state.filter
      );
      setData(analyticsData);
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const _renderOverview = () => {
    if (!data) return null;

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('analytics.overview.title')}</Text>

        {/* Key Metrics */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.metricsScroll}
        >
          {data.metrics.map((metric: any, index: number) => (
            <View key={index} style={styles.metricCard}>
              <Text style={styles.metricName}>{metric.name}</Text>
              <Text style={styles.metricValue}>
                {formatMetricValue(metric.value)}
              </Text>
              <Text
                style={[
                  styles.metricChange,
                  metric.change > 0
                    ? styles.positiveChange
                    : styles.negativeChange,
                ]}
              >
                {formatPercentage(metric.change)}
              </Text>
            </View>
          ))}
        </ScrollView>

        {/* Performance Trend */}
        <View style={styles.chart}>
          <Text style={styles.chartTitle}>
            {t('analytics.overview.performanceTrend')}
          </Text>
          <LineChart
            data={{
              labels: generateTimeLabels(state.timeframe),
              datasets: data.metrics.map((metric: any) => ({
                data: metric.trend,
              })),
            }}
            width={Dimensions.get('window').width - 32}
            height={220}
            chartConfig={{
              backgroundColor: '#fff',
              backgroundGradientFrom: '#fff',
              backgroundGradientTo: '#fff',
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(0, 123, 255, ${opacity})`,
            }}
            bezier
            style={styles.chartStyle}
          />
        </View>

        {/* Top Content */}
        <View style={styles.topContent}>
          <Text style={styles.subsectionTitle}>
            {t('analytics.overview.topContent')}
          </Text>
          {data.content
            .sort(
              (a: any, b: any) => b.metrics.engagement - a.metrics.engagement
            )
            .slice(0, 5)
            .map((content: any, index: number) => (
              <View key={index} style={styles.contentItem}>
                <Text style={styles.contentTitle}>{content.title}</Text>
                <View style={styles.contentMetrics}>
                  <Text style={styles.contentMetric}>
                    👁️ {formatNumber(content.metrics.views)}
                  </Text>
                  <Text style={styles.contentMetric}>
                    ❤️ {formatNumber(content.metrics.likes)}
                  </Text>
                  <Text style={styles.contentMetric}>
                    💬 {formatNumber(content.metrics.comments)}
                  </Text>
                </View>
              </View>
            ))}
        </View>

        {/* Audience Insights */}
        <View style={styles.audienceInsights}>
          <Text style={styles.subsectionTitle}>
            {t('analytics.overview.audienceInsights')}
          </Text>
          {data.audience.slice(0, 3).map((insight: any, index: number) => (
            <View key={index} style={styles.insightItem}>
              <MaterialIcons
                name="lightbulb"
                size={24}
                color="#ffc107"
                style={styles.insightIcon}
              />
              <View style={styles.insightContent}>
                <Text style={styles.insightTitle}>{insight.metric}</Text>
                <Text style={styles.insightText}>{insight.recommendation}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Predictions */}
        <View style={styles.predictions}>
          <Text style={styles.subsectionTitle}>
            {t('analytics.overview.predictions')}
          </Text>
          {data.predictions
            .slice(0, 3)
            .map((prediction: any, index: number) => (
              <View key={index} style={styles.predictionItem}>
                <View style={styles.predictionHeader}>
                  <Text style={styles.predictionTitle}>
                    {prediction.metric}
                  </Text>
                  <Text style={styles.predictionConfidence}>
                    {formatPercentage(prediction.confidence)}{' '}
                    {t('analytics.confidence')}
                  </Text>
                </View>
                <View style={styles.predictionChart}>
                  <LineChart
                    data={{
                      labels: generateForecastLabels(),
                      datasets: [
                        {
                          data: prediction.forecast,
                        },
                      ],
                    }}
                    width={Dimensions.get('window').width - 64}
                    height={100}
                    chartConfig={{
                      backgroundColor: '#fff',
                      backgroundGradientFrom: '#fff',
                      backgroundGradientTo: '#fff',
                      decimalPlaces: 0,
                      color: (opacity = 1) => `rgba(0, 123, 255, ${opacity})`,
                    }}
                    bezier
                    withDots={false}
                    withInnerLines={false}
                    style={styles.predictionChartStyle}
                  />
                </View>
                <View style={styles.recommendations}>
                  {prediction.recommendations.map(
                    (rec: any, recIndex: number) => (
                      <View key={recIndex} style={styles.recommendation}>
                        <Text style={styles.recommendationText}>
                          {rec.action}
                        </Text>
                        <View style={styles.recommendationMetrics}>
                          <Text style={styles.recommendationMetric}>
                            💪 {formatImpact(rec.impact)}
                          </Text>
                          <Text style={styles.recommendationMetric}>
                            ⏱️ {formatEffort(rec.effort)}
                          </Text>
                        </View>
                      </View>
                    )
                  )}
                </View>
              </View>
            ))}
        </View>
      </View>
    );
  };

  const _renderContent = () => {
    // Implementation for content view
    return null;
  };

  const _renderAudience = () => {
    // Implementation for audience view
    return null;
  };

  const _renderCompetitors = () => {
    // Implementation for competitors view
    return null;
  };

  const _renderPredictions = () => {
    // Implementation for predictions view
    return null;
  };

  // Helper functions
  const _formatMetricValue = (_value: number): string => {
    // Implementation
    return '';
  };

  const _formatPercentage = (_value: number): string => {
    // Implementation
    return '';
  };

  const _formatNumber = (_value: number): string => {
    // Implementation
    return '';
  };

  const _formatImpact = (_value: number): string => {
    // Implementation
    return '';
  };

  const _formatEffort = (_value: number): string => {
    // Implementation
    return '';
  };

  const _generateTimeLabels = (
    _timeframe: DashboardState['timeframe']
  ): string[] => {
    // Implementation
    return [];
  };

  const _generateForecastLabels = (): string[] => {
    // Implementation
    return [];
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007bff" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{t('analytics.consolidated.title')}</Text>

        {/* View Selector */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.viewSelector}
        >
          {(
            [
              'overview',
              'content',
              'audience',
              'competitors',
              'predictions',
            ] as const
          ).map(view => (
            <TouchableOpacity
              key={view}
              style={[
                styles.viewButton,
                state.view === view && styles.activeView,
              ]}
              onPress={() => setState(prev => ({ ...prev, view }))}
            >
              <Text
                style={[
                  styles.viewButtonText,
                  state.view === view && styles.activeViewText,
                ]}
              >
                {t(`analytics.views.${view}`)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Timeframe Selector */}
        <View style={styles.timeframeSelector}>
          {(['hour', 'day', 'week', 'month'] as const).map(granularity => (
            <TouchableOpacity
              key={granularity}
              style={[
                styles.timeframeButton,
                state.timeframe.granularity === granularity &&
                  styles.activeTimeframe,
              ]}
              onPress={() =>
                setState(prev => ({
                  ...prev,
                  timeframe: {
                    ...prev.timeframe,
                    granularity,
                  },
                }))
              }
            >
              <Text
                style={[
                  styles.timeframeText,
                  state.timeframe.granularity === granularity &&
                    styles.activeTimeframeText,
                ]}
              >
                {t(`analytics.timeframe.${granularity}`)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Content */}
      <ScrollView style={styles.content}>
        {state.view === 'overview' && renderOverview()}
        {state.view === 'content' && renderContent()}
        {state.view === 'audience' && renderAudience()}
        {state.view === 'competitors' && renderCompetitors()}
        {state.view === 'predictions' && renderPredictions()}
      </ScrollView>
    </View>
  );
}

const _styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  viewSelector: {
    marginBottom: 16,
  },
  viewButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    backgroundColor: '#f8f9fa',
  },
  activeView: {
    backgroundColor: '#007bff',
  },
  viewButtonText: {
    fontSize: 14,
    color: '#666',
  },
  activeViewText: {
    color: '#fff',
  },
  timeframeSelector: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    borderRadius: 20,
    padding: 4,
  },
  timeframeButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 16,
  },
  activeTimeframe: {
    backgroundColor: '#007bff',
  },
  timeframeText: {
    fontSize: 14,
    color: '#666',
  },
  activeTimeframeText: {
    color: '#fff',
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  metricsScroll: {
    marginBottom: 24,
  },
  metricCard: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    marginRight: 12,
    width: 160,
  },
  metricName: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  metricChange: {
    fontSize: 14,
    fontWeight: '500',
  },
  positiveChange: {
    color: '#28a745',
  },
  negativeChange: {
    color: '#dc3545',
  },
  chart: {
    marginBottom: 24,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  chartStyle: {
    borderRadius: 16,
  },
  topContent: {
    marginBottom: 24,
  },
  subsectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  contentItem: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  contentTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  contentMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  contentMetric: {
    fontSize: 14,
    color: '#666',
  },
  audienceInsights: {
    marginBottom: 24,
  },
  insightItem: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  insightIcon: {
    marginRight: 12,
  },
  insightContent: {
    flex: 1,
  },
  insightTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  insightText: {
    fontSize: 14,
    color: '#666',
  },
  predictions: {
    marginBottom: 24,
  },
  predictionItem: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  predictionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  predictionTitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  predictionConfidence: {
    fontSize: 14,
    color: '#28a745',
  },
  predictionChart: {
    marginBottom: 12,
  },
  predictionChartStyle: {
    borderRadius: 8,
  },
  recommendations: {
    borderTopWidth: 1,
    borderTopColor: '#dee2e6',
    paddingTop: 12,
  },
  recommendation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  recommendationText: {
    flex: 1,
    fontSize: 14,
    marginRight: 12,
  },
  recommendationMetrics: {
    flexDirection: 'row',
  },
  recommendationMetric: {
    fontSize: 14,
    color: '#666',
    marginLeft: 12,
  },
});
