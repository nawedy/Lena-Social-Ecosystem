import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  LineChart,
  BarChart,
  ContributionGraph,
  ProgressChart,
} from 'react-native-chart-kit';
import { AnalyticsService } from '../../services/AnalyticsService';

interface TokenUsageMetrics {
  provider: string;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  averageTokensPerRequest: number;
}

interface ModelPerformanceMetrics {
  model: string;
  provider: string;
  successRate: number;
  averageLatency: number;
  p95Latency: number;
  p99Latency: number;
  errorRate: number;
  costPerToken: number;
}

interface QualityMetrics {
  coherence: number;
  relevance: number;
  creativity: number;
  factualAccuracy: number;
  safety: number;
}

export function AIInsightsAnalytics() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d' | '90d'>(
    '7d'
  );
  const [tokenMetrics, setTokenMetrics] = useState<TokenUsageMetrics[]>([]);
  const [modelMetrics, setModelMetrics] = useState<ModelPerformanceMetrics[]>(
    []
  );
  const [qualityMetrics, setQualityMetrics] = useState<
    Record<string, QualityMetrics>
  >({});
  const [selectedModel, setSelectedModel] = useState<string | null>(null);

  useEffect(() => {
    loadInsights();
  }, [timeRange]);

  const _loadInsights = async () => {
    setLoading(true);
    try {
      const _analytics = AnalyticsService.getInstance();
      const _data = await analytics.getAIInsights(timeRange);
      setTokenMetrics(data.tokenMetrics);
      setModelMetrics(data.modelMetrics);
      setQualityMetrics(data.qualityMetrics);
      if (!selectedModel && data.modelMetrics.length > 0) {
        setSelectedModel(data.modelMetrics[0].model);
      }
    } catch (error) {
      console.error('Error loading AI insights:', error);
    } finally {
      setLoading(false);
    }
  };

  const _renderTokenUsage = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t('analytics.tokenUsage')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <BarChart
          data={{
            labels: tokenMetrics.map(m => m.provider),
            datasets: [
              {
                data: tokenMetrics.map(m => m.totalTokens / 1000), // Convert to K tokens
              },
            ],
          }}
          width={Dimensions.get('window').width * 1.5}
          height={220}
          yAxisLabel="K "
          chartConfig={{
            backgroundColor: '#fff',
            backgroundGradientFrom: '#fff',
            backgroundGradientTo: '#fff',
            decimalPlaces: 0,
            color: (opacity = 1) => `rgba(54, 162, 235, ${opacity})`,
          }}
          style={styles.chart}
          showValuesOnTopOfBars
        />
      </ScrollView>
    </View>
  );

  const _renderModelPerformance = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t('analytics.modelPerformance')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {modelMetrics.map(metric => (
          <TouchableOpacity
            key={metric.model}
            style={[
              styles.modelCard,
              selectedModel === metric.model && styles.selectedCard,
            ]}
            onPress={() => setSelectedModel(metric.model)}
          >
            <Text style={styles.modelName}>{metric.model}</Text>
            <View style={styles.metricGrid}>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>
                  {t('analytics.successRate')}
                </Text>
                <Text style={styles.metricValue}>
                  {(metric.successRate * 100).toFixed(1)}%
                </Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>
                  {t('analytics.avgLatency')}
                </Text>
                <Text style={styles.metricValue}>
                  {metric.averageLatency.toFixed(0)}ms
                </Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>
                  {t('analytics.p95Latency')}
                </Text>
                <Text style={styles.metricValue}>
                  {metric.p95Latency.toFixed(0)}ms
                </Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>
                  {t('analytics.errorRate')}
                </Text>
                <Text
                  style={[
                    styles.metricValue,
                    { color: getErrorColor(metric.errorRate) },
                  ]}
                >
                  {(metric.errorRate * 100).toFixed(1)}%
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const _renderQualityMetrics = () => {
    if (!selectedModel || !qualityMetrics[selectedModel]) return null;

    const _quality = qualityMetrics[selectedModel];
    const _data = {
      labels: [
        t('analytics.coherence'),
        t('analytics.relevance'),
        t('analytics.creativity'),
        t('analytics.factualAccuracy'),
        t('analytics.safety'),
      ],
      data: [
        quality.coherence,
        quality.relevance,
        quality.creativity,
        quality.factualAccuracy,
        quality.safety,
      ],
    };

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('analytics.qualityMetrics')}</Text>
        <ProgressChart
          data={data}
          width={Dimensions.get('window').width - 32}
          height={220}
          chartConfig={{
            backgroundColor: '#fff',
            backgroundGradientFrom: '#fff',
            backgroundGradientTo: '#fff',
            decimalPlaces: 1,
            color: (opacity = 1) => `rgba(75, 192, 192, ${opacity})`,
          }}
          style={styles.chart}
        />
      </View>
    );
  };

  const _renderUsageHeatmap = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t('analytics.usageHeatmap')}</Text>
      <ContributionGraph
        values={generateDummyContributions()}
        endDate={new Date()}
        numDays={timeRange === '90d' ? 90 : 30}
        width={Dimensions.get('window').width - 32}
        height={220}
        chartConfig={{
          backgroundColor: '#fff',
          backgroundGradientFrom: '#fff',
          backgroundGradientTo: '#fff',
          decimalPlaces: 0,
          color: (opacity = 1) => `rgba(153, 102, 255, ${opacity})`,
        }}
        style={styles.chart}
      />
    </View>
  );

  const _generateDummyContributions = () => {
    const _contributions = [];
    const _endDate = new Date();
    for (let i = 0; i < (timeRange === '90d' ? 90 : 30); i++) {
      const _date = new Date();
      date.setDate(endDate.getDate() - i);
      contributions.push({
        date: date.toISOString().split('T')[0],
        count: Math.floor(Math.random() * 50),
      });
    }
    return contributions;
  };

  const _getErrorColor = (errorRate: number) => {
    if (errorRate < 0.05) return '#28a745';
    if (errorRate < 0.1) return '#ffc107';
    return '#dc3545';
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('analytics.aiInsights')}</Text>
        <View style={styles.timeRangeSelector}>
          {(['24h', '7d', '30d', '90d'] as const).map(range => (
            <TouchableOpacity
              key={range}
              style={[
                styles.timeRangeButton,
                timeRange === range && styles.activeTimeRange,
              ]}
              onPress={() => setTimeRange(range)}
            >
              <Text
                style={[
                  styles.timeRangeText,
                  timeRange === range && styles.activeTimeRangeText,
                ]}
              >
                {t(`analytics.timeRange.${range}`)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView style={styles.content}>
        {renderTokenUsage()}
        {renderModelPerformance()}
        {renderQualityMetrics()}
        {renderUsageHeatmap()}
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
  timeRangeSelector: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    borderRadius: 20,
    padding: 4,
  },
  timeRangeButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 16,
  },
  activeTimeRange: {
    backgroundColor: '#007AFF',
  },
  timeRangeText: {
    fontSize: 14,
    color: '#666',
  },
  activeTimeRangeText: {
    color: '#fff',
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  modelCard: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    marginRight: 12,
    width: 280,
  },
  selectedCard: {
    backgroundColor: '#e3f2fd',
    borderColor: '#007AFF',
    borderWidth: 1,
  },
  modelName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  metricItem: {
    width: '50%',
    marginBottom: 8,
  },
  metricLabel: {
    fontSize: 12,
    color: '#666',
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '500',
  },
});
