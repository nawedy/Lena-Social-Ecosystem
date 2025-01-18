import { Ionicons } from '@expo/vector-icons';
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
import { LineChart, BarChart, PieChart, ContributionGraph } from 'react-native-chart-kit';

import { AnalyticsService } from '../../services/AnalyticsService';
import { TestReport } from '../../services/TemplateTestAutomation';

interface AnalyticsPeriod {
  startDate: Date;
  endDate: Date;
}

interface TestMetrics {
  totalRuns: number;
  passRate: number;
  avgExecutionTime: number;
  totalCost: number;
  failureRate: number;
  topFailures: Array<{
    testCaseId: string;
    failureCount: number;
    lastFailure: string;
  }>;
}

interface TimeSeriesData {
  labels: string[];
  datasets: Array<{
    data: number[];
    color?: (opacity: number) => string;
  }>;
}

export function TestingAnalyticsDashboard() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('week');
  const [metrics, setMetrics] = useState<TestMetrics | null>(null);
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesData | null>(null);
  const [_selectedTest, setSelectedTest] = useState<string | null>(null);
  const [testHistory, setTestHistory] = useState<TestReport[]>([]);

  const _analyticsService = AnalyticsService.getInstance();

  useEffect(() => {
    loadAnalytics();
  }, [period]);

  const _loadAnalytics = async () => {
    setLoading(true);
    try {
      const _dateRange = getDateRange(period);
      const [metricsData, timeSeriesData, history] = await Promise.all([
        fetchMetrics(dateRange),
        fetchTimeSeriesData(dateRange),
        fetchTestHistory(dateRange),
      ]);

      setMetrics(metricsData);
      setTimeSeriesData(timeSeriesData);
      setTestHistory(history);
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const _getDateRange = (period: 'day' | 'week' | 'month'): AnalyticsPeriod => {
    const _end = new Date();
    const _start = new Date();

    switch (period) {
      case 'day':
        start.setDate(end.getDate() - 1);
        break;
      case 'week':
        start.setDate(end.getDate() - 7);
        break;
      case 'month':
        start.setMonth(end.getMonth() - 1);
        break;
    }

    return { startDate: start, endDate: end };
  };

  const _fetchMetrics = async (period: AnalyticsPeriod): Promise<TestMetrics> => {
    const _data = await analyticsService.getTestMetrics(period.startDate, period.endDate);
    return data;
  };

  const _fetchTimeSeriesData = async (period: AnalyticsPeriod): Promise<TimeSeriesData> => {
    const _data = await analyticsService.getTestTimeSeries(period.startDate, period.endDate);
    return data;
  };

  const _fetchTestHistory = async (period: AnalyticsPeriod): Promise<TestReport[]> => {
    const _data = await analyticsService.getTestHistory(period.startDate, period.endDate);
    return data;
  };

  const _renderMetricsCards = () => (
    <View style={styles.metricsContainer}>
      <View style={styles.metricCard}>
        <Text style={styles.metricValue}>{metrics?.totalRuns?.toLocaleString()}</Text>
        <Text style={styles.metricLabel}>{t('analytics.totalRuns')}</Text>
      </View>
      <View style={styles.metricCard}>
        <Text style={styles.metricValue}>{(metrics?.passRate || 0).toFixed(1)}%</Text>
        <Text style={styles.metricLabel}>{t('analytics.passRate')}</Text>
      </View>
      <View style={styles.metricCard}>
        <Text style={styles.metricValue}>{(metrics?.avgExecutionTime || 0).toFixed(0)}ms</Text>
        <Text style={styles.metricLabel}>{t('analytics.avgTime')}</Text>
      </View>
      <View style={styles.metricCard}>
        <Text style={styles.metricValue}>${(metrics?.totalCost || 0).toFixed(2)}</Text>
        <Text style={styles.metricLabel}>{t('analytics.totalCost')}</Text>
      </View>
    </View>
  );

  const _renderCharts = () => (
    <View style={styles.chartsContainer}>
      {timeSeriesData && (
        <>
          <Text style={styles.chartTitle}>{t('analytics.executionTrend')}</Text>
          <LineChart
            data={timeSeriesData}
            width={Dimensions.get('window').width - 32}
            height={220}
            chartConfig={{
              backgroundColor: '#fff',
              backgroundGradientFrom: '#fff',
              backgroundGradientTo: '#fff',
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(0, 122, 255, ${opacity})`,
              style: {
                borderRadius: 16,
              },
            }}
            bezier
            style={styles.chart}
          />

          <Text style={styles.chartTitle}>{t('analytics.resultDistribution')}</Text>
          <PieChart
            data={[
              {
                name: t('analytics.passed'),
                population: metrics?.totalRuns * (metrics?.passRate / 100) || 0,
                color: '#28a745',
                legendFontColor: '#7F7F7F',
              },
              {
                name: t('analytics.failed'),
                population: metrics?.totalRuns * (metrics?.failureRate / 100) || 0,
                color: '#dc3545',
                legendFontColor: '#7F7F7F',
              },
            ]}
            width={Dimensions.get('window').width - 32}
            height={220}
            chartConfig={{
              backgroundColor: '#fff',
              backgroundGradientFrom: '#fff',
              backgroundGradientTo: '#fff',
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
            }}
            accessor='population'
            backgroundColor='transparent'
            paddingLeft='15'
            style={styles.chart}
          />
        </>
      )}
    </View>
  );

  const _renderFailureAnalysis = () => (
    <View style={styles.failuresContainer}>
      <Text style={styles.sectionTitle}>{t('analytics.topFailures')}</Text>
      {metrics?.topFailures?.map((failure) => (
        <TouchableOpacity
          key={failure.testCaseId}
          style={styles.failureItem}
          onPress={() => setSelectedTest(failure.testCaseId)}
        >
          <View style={styles.failureHeader}>
            <Text style={styles.failureId}>{failure.testCaseId}</Text>
            <Text style={styles.failureCount}>
              {failure.failureCount} {t('analytics.failures')}
            </Text>
          </View>
          <Text style={styles.failureTime}>
            {t('analytics.lastFailure')}: {new Date(failure.lastFailure).toLocaleString()}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const _renderTestHistory = () => (
    <View style={styles.historyContainer}>
      <Text style={styles.sectionTitle}>{t('analytics.testHistory')}</Text>
      {testHistory.map((report) => (
        <View key={report.runId} style={styles.historyItem}>
          <View style={styles.historyHeader}>
            <Text style={styles.historyId}>{report.runId}</Text>
            <Text
              style={[
                styles.historyStatus,
                report.summary.failed === 0 ? styles.statusSuccess : styles.statusFailure,
              ]}
            >
              {report.summary.failed === 0 ? t('analytics.passed') : t('analytics.failed')}
            </Text>
          </View>
          <View style={styles.historySummary}>
            <Text style={styles.summaryItem}>
              {t('analytics.total')}: {report.summary.total}
            </Text>
            <Text style={styles.summaryItem}>
              {t('analytics.passed')}: {report.summary.passed}
            </Text>
            <Text style={styles.summaryItem}>
              {t('analytics.failed')}: {report.summary.failed}
            </Text>
            <Text style={styles.summaryItem}>
              {t('analytics.time')}: {report.summary.totalTime}ms
            </Text>
          </View>
        </View>
      ))}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size='large' color='#007AFF' />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('analytics.title')}</Text>
        <View style={styles.periodSelector}>
          <TouchableOpacity
            style={[styles.periodButton, period === 'day' && styles.activePeriod]}
            onPress={() => setPeriod('day')}
          >
            <Text style={[styles.periodText, period === 'day' && styles.activePeriodText]}>
              {t('analytics.day')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.periodButton, period === 'week' && styles.activePeriod]}
            onPress={() => setPeriod('week')}
          >
            <Text style={[styles.periodText, period === 'week' && styles.activePeriodText]}>
              {t('analytics.week')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.periodButton, period === 'month' && styles.activePeriod]}
            onPress={() => setPeriod('month')}
          >
            <Text style={[styles.periodText, period === 'month' && styles.activePeriodText]}>
              {t('analytics.month')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content}>
        {renderMetricsCards()}
        {renderCharts()}
        {renderFailureAnalysis()}
        {renderTestHistory()}
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
  metricsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
  },
  metricCard: {
    width: '48%',
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    margin: '1%',
  },
  metricValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  metricLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  chartsContainer: {
    padding: 16,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  failuresContainer: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  failureItem: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  failureHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  failureId: {
    fontSize: 16,
    fontWeight: '500',
  },
  failureCount: {
    fontSize: 14,
    color: '#dc3545',
  },
  failureTime: {
    fontSize: 12,
    color: '#666',
  },
  historyContainer: {
    padding: 16,
  },
  historyItem: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  historyId: {
    fontSize: 16,
    fontWeight: '500',
  },
  historyStatus: {
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusSuccess: {
    backgroundColor: '#28a745',
    color: '#fff',
  },
  statusFailure: {
    backgroundColor: '#dc3545',
    color: '#fff',
  },
  historySummary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  summaryItem: {
    fontSize: 14,
    color: '#666',
    marginRight: 16,
  },
});
