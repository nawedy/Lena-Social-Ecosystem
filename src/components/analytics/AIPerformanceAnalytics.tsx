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
  PieChart,
  ContributionGraph,
} from 'react-native-chart-kit';
import { AnalyticsService } from '../../services/AnalyticsService';

interface AIMetrics {
  provider: string;
  successRate: number;
  avgLatency: number;
  costPerToken: number;
  totalCost: number;
  tokenUsage: number;
  errorRate: number;
}

interface TimeSeriesData {
  timestamps: string[];
  values: number[];
}

export function AIPerformanceAnalytics() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('week');
  const [metrics, setMetrics] = useState<Record<string, AIMetrics>>({});
  const [timeSeriesData, setTimeSeriesData] = useState<
    Record<string, TimeSeriesData>
  >({});
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);

  const _analyticsService = AnalyticsService.getInstance();

  useEffect(() => {
    loadAnalytics();
  }, [period]);

  const _loadAnalytics = async () => {
    setLoading(true);
    try {
      const _data = await analyticsService.getAIMetrics(period);
      setMetrics(data.metrics);
      setTimeSeriesData(data.timeSeries);
    } catch (error) {
      console.error('Error loading AI analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const _renderProviderComparison = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>
        {t('analytics.providerComparison')}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <BarChart
          data={{
            labels: Object.keys(metrics),
            datasets: [
              {
                data: Object.values(metrics).map(m => m.successRate * 100),
              },
            ],
          }}
          width={Dimensions.get('window').width * 1.5}
          height={220}
          chartConfig={{
            backgroundColor: '#fff',
            backgroundGradientFrom: '#fff',
            backgroundGradientTo: '#fff',
            decimalPlaces: 1,
            color: (opacity = 1) => `rgba(0, 122, 255, ${opacity})`,
          }}
          style={styles.chart}
          showValuesOnTopOfBars
        />
      </ScrollView>
    </View>
  );

  const _renderCostAnalysis = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t('analytics.costAnalysis')}</Text>
      <PieChart
        data={Object.entries(metrics).map(([provider, data]) => ({
          name: provider,
          cost: data.totalCost,
          color: getProviderColor(provider),
          legendFontColor: '#7F7F7F',
        }))}
        width={Dimensions.get('window').width - 32}
        height={220}
        chartConfig={{
          color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
        }}
        accessor="cost"
        backgroundColor="transparent"
        paddingLeft="15"
        absolute
      />
    </View>
  );

  const _renderPerformanceMetrics = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t('analytics.performance')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {Object.entries(metrics).map(([provider, data]) => (
          <TouchableOpacity
            key={provider}
            style={[
              styles.providerCard,
              selectedProvider === provider && styles.selectedCard,
            ]}
            onPress={() => setSelectedProvider(provider)}
          >
            <Text style={styles.providerName}>{provider}</Text>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>
                {t('analytics.successRate')}
              </Text>
              <Text style={styles.metricValue}>
                {(data.successRate * 100).toFixed(1)}%
              </Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>
                {t('analytics.avgLatency')}
              </Text>
              <Text style={styles.metricValue}>
                {data.avgLatency.toFixed(0)}ms
              </Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>
                {t('analytics.costPerToken')}
              </Text>
              <Text style={styles.metricValue}>
                ${data.costPerToken.toFixed(5)}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const _renderUsageTrends = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t('analytics.usageTrends')}</Text>
      {selectedProvider && timeSeriesData[selectedProvider] && (
        <LineChart
          data={{
            labels: timeSeriesData[selectedProvider].timestamps,
            datasets: [
              {
                data: timeSeriesData[selectedProvider].values,
              },
            ],
          }}
          width={Dimensions.get('window').width - 32}
          height={220}
          chartConfig={{
            backgroundColor: '#fff',
            backgroundGradientFrom: '#fff',
            backgroundGradientTo: '#fff',
            decimalPlaces: 0,
            color: (opacity = 1) => getProviderColor(selectedProvider, opacity),
          }}
          bezier
          style={styles.chart}
        />
      )}
    </View>
  );

  const _renderErrorAnalysis = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t('analytics.errorAnalysis')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <BarChart
          data={{
            labels: Object.keys(metrics),
            datasets: [
              {
                data: Object.values(metrics).map(m => m.errorRate * 100),
              },
            ],
          }}
          width={Dimensions.get('window').width * 1.5}
          height={220}
          chartConfig={{
            backgroundColor: '#fff',
            backgroundGradientFrom: '#fff',
            backgroundGradientTo: '#fff',
            decimalPlaces: 1,
            color: (opacity = 1) => `rgba(220, 53, 69, ${opacity})`,
          }}
          style={styles.chart}
          showValuesOnTopOfBars
        />
      </ScrollView>
    </View>
  );

  const _getProviderColor = (provider: string, opacity: number = 1) => {
    const colors: Record<string, string> = {
      openai: `rgba(0, 122, 255, ${opacity})`,
      anthropic: `rgba(75, 192, 192, ${opacity})`,
      groq: `rgba(153, 102, 255, ${opacity})`,
      cohere: `rgba(255, 159, 64, ${opacity})`,
      runwayml: `rgba(255, 99, 132, ${opacity})`,
      stability: `rgba(54, 162, 235, ${opacity})`,
      replicate: `rgba(255, 206, 86, ${opacity})`,
    };
    return colors[provider] || `rgba(128, 128, 128, ${opacity})`;
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
        <Text style={styles.title}>{t('analytics.aiPerformance')}</Text>
        <View style={styles.periodSelector}>
          <TouchableOpacity
            style={[
              styles.periodButton,
              period === 'day' && styles.activePeriod,
            ]}
            onPress={() => setPeriod('day')}
          >
            <Text
              style={[
                styles.periodText,
                period === 'day' && styles.activePeriodText,
              ]}
            >
              {t('analytics.day')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.periodButton,
              period === 'week' && styles.activePeriod,
            ]}
            onPress={() => setPeriod('week')}
          >
            <Text
              style={[
                styles.periodText,
                period === 'week' && styles.activePeriodText,
              ]}
            >
              {t('analytics.week')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.periodButton,
              period === 'month' && styles.activePeriod,
            ]}
            onPress={() => setPeriod('month')}
          >
            <Text
              style={[
                styles.periodText,
                period === 'month' && styles.activePeriodText,
              ]}
            >
              {t('analytics.month')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content}>
        {renderProviderComparison()}
        {renderCostAnalysis()}
        {renderPerformanceMetrics()}
        {renderUsageTrends()}
        {renderErrorAnalysis()}
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
  periodSelector: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    borderRadius: 20,
    padding: 4,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 16,
  },
  activePeriod: {
    backgroundColor: '#007AFF',
  },
  periodText: {
    fontSize: 14,
    color: '#666',
  },
  activePeriodText: {
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
  providerCard: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    marginRight: 12,
    width: 200,
  },
  selectedCard: {
    backgroundColor: '#e3f2fd',
    borderColor: '#007AFF',
    borderWidth: 1,
  },
  providerName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  metricLabel: {
    fontSize: 14,
    color: '#666',
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '500',
  },
});
