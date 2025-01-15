import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import {
  LineChart,
  BarChart,
  PieChart,
  ContributionGraph,
} from 'react-native-chart-kit';
import { ContentTemplateService } from '../../services/ContentTemplateService';
import { APIUsageService } from '../../services/APIUsageService';

interface TemplateAnalyticsProps {
  userId: string;
  templateId?: string; // Optional: for single template analytics
}

interface AnalyticsPeriod {
  startDate: Date;
  endDate: Date;
  label: string;
}

export function TemplateAnalytics({
  userId,
  templateId,
}: TemplateAnalyticsProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'year'>('week');
  const [metrics, setMetrics] = useState<any>(null);
  const [topTemplates, setTopTemplates] = useState<any[]>([]);
  const [usageByCategory, setUsageByCategory] = useState<any[]>([]);
  const [usageByType, setUsageByType] = useState<any[]>([]);
  const [usageOverTime, setUsageOverTime] = useState<any[]>([]);
  const [engagementData, setEngagementData] = useState<any[]>([]);

  const templateService = ContentTemplateService.getInstance();
  const apiUsageService = APIUsageService.getInstance();

  useEffect(() => {
    loadAnalytics();
  }, [period, templateId]);

  const getPeriodDates = (): AnalyticsPeriod => {
    const endDate = new Date();
    const startDate = new Date();

    switch (period) {
      case 'day':
        startDate.setDate(endDate.getDate() - 1);
        return { startDate, endDate, label: t('analytics.last24Hours') };
      case 'week':
        startDate.setDate(endDate.getDate() - 7);
        return { startDate, endDate, label: t('analytics.lastWeek') };
      case 'month':
        startDate.setMonth(endDate.getMonth() - 1);
        return { startDate, endDate, label: t('analytics.lastMonth') };
      case 'year':
        startDate.setFullYear(endDate.getFullYear() - 1);
        return { startDate, endDate, label: t('analytics.lastYear') };
      default:
        return { startDate, endDate, label: '' };
    }
  };

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const { startDate, endDate } = getPeriodDates();

      // Load usage report
      const report = await apiUsageService.generateUsageReport(
        userId,
        startDate,
        endDate
      );

      // Get top templates
      const templates = await templateService.listTemplates({
        userId: templateId ? undefined : userId,
        orderBy: 'usageCount',
        limit: 5,
      });

      // Process metrics
      const metrics = processMetrics(report);
      const categoryData = processCategoryData(report);
      const typeData = processTypeData(report);
      const timeData = processTimeData(report);
      const engagement = processEngagementData(templates);

      setMetrics(metrics);
      setTopTemplates(templates);
      setUsageByCategory(categoryData);
      setUsageByType(typeData);
      setUsageOverTime(timeData);
      setEngagementData(engagement);
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const processMetrics = (report: any) => ({
    totalUsage: report.summary.operationCount,
    totalCost: report.summary.totalCost,
    averageRating: calculateAverageRating(report),
    successRate: calculateSuccessRate(report),
  });

  const processCategoryData = (report: any) => {
    const categories: Record<string, number> = {};
    Object.values(report.providers).forEach((provider: any) => {
      Object.entries(provider.breakdown).forEach(([operation, stats]: [string, any]) => {
        const category = operation.split('_')[0];
        categories[category] = (categories[category] || 0) + stats.count;
      });
    });

    return Object.entries(categories).map(([name, count]) => ({
      name,
      count,
      color: getRandomColor(),
    }));
  };

  const processTypeData = (report: any) => {
    const types = {
      text: 0,
      image: 0,
      video: 0,
    };

    Object.values(report.providers).forEach((provider: any) => {
      Object.entries(provider.breakdown).forEach(([operation, stats]: [string, any]) => {
        const type = operation.includes('text')
          ? 'text'
          : operation.includes('image')
          ? 'image'
          : 'video';
        types[type] += stats.count;
      });
    });

    return Object.entries(types).map(([name, count]) => ({
      name,
      count,
      color: getRandomColor(),
    }));
  };

  const processTimeData = (report: any) => {
    // Process time series data based on period
    // Implementation depends on how the report data is structured
    return [];
  };

  const processEngagementData = (templates: any[]) => {
    return templates.map(template => ({
      template: template.name,
      usage: template.usageCount,
      rating: template.rating,
      engagement: calculateEngagement(template),
    }));
  };

  const calculateAverageRating = (report: any) => {
    // Calculate average rating from report data
    return 4.5; // Placeholder
  };

  const calculateSuccessRate = (report: any) => {
    // Calculate success rate from report data
    return 0.95; // Placeholder
  };

  const calculateEngagement = (template: any) => {
    // Calculate engagement score based on usage, ratings, and other factors
    return (template.usageCount * template.rating) / 100;
  };

  const getRandomColor = () => {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
      color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
  };

  const renderMetricsCards = () => (
    <View style={styles.metricsContainer}>
      <View style={styles.metricCard}>
        <Text style={styles.metricValue}>{metrics.totalUsage}</Text>
        <Text style={styles.metricLabel}>{t('analytics.totalUsage')}</Text>
      </View>
      <View style={styles.metricCard}>
        <Text style={styles.metricValue}>${metrics.totalCost.toFixed(2)}</Text>
        <Text style={styles.metricLabel}>{t('analytics.totalCost')}</Text>
      </View>
      <View style={styles.metricCard}>
        <Text style={styles.metricValue}>{metrics.averageRating.toFixed(1)}</Text>
        <Text style={styles.metricLabel}>{t('analytics.avgRating')}</Text>
      </View>
      <View style={styles.metricCard}>
        <Text style={styles.metricValue}>
          {(metrics.successRate * 100).toFixed(1)}%
        </Text>
        <Text style={styles.metricLabel}>{t('analytics.successRate')}</Text>
      </View>
    </View>
  );

  const renderUsageChart = () => (
    <View style={styles.chartContainer}>
      <Text style={styles.chartTitle}>{t('analytics.usageOverTime')}</Text>
      <LineChart
        data={{
          labels: usageOverTime.map(d => d.label),
          datasets: [
            {
              data: usageOverTime.map(d => d.value),
            },
          ],
        }}
        width={Dimensions.get('window').width - 32}
        height={220}
        chartConfig={{
          backgroundColor: '#ffffff',
          backgroundGradientFrom: '#ffffff',
          backgroundGradientTo: '#ffffff',
          decimalPlaces: 0,
          color: (opacity = 1) => `rgba(0, 122, 255, ${opacity})`,
          style: {
            borderRadius: 16,
          },
        }}
        bezier
        style={styles.chart}
      />
    </View>
  );

  const renderCategoryChart = () => (
    <View style={styles.chartContainer}>
      <Text style={styles.chartTitle}>{t('analytics.usageByCategory')}</Text>
      <PieChart
        data={usageByCategory}
        width={Dimensions.get('window').width - 32}
        height={220}
        chartConfig={{
          color: (opacity = 1) => `rgba(0, 122, 255, ${opacity})`,
        }}
        accessor="count"
        backgroundColor="transparent"
        paddingLeft="15"
      />
    </View>
  );

  const renderTypeChart = () => (
    <View style={styles.chartContainer}>
      <Text style={styles.chartTitle}>{t('analytics.usageByType')}</Text>
      <BarChart
        data={{
          labels: usageByType.map(d => d.name),
          datasets: [
            {
              data: usageByType.map(d => d.count),
            },
          ],
        }}
        width={Dimensions.get('window').width - 32}
        height={220}
        chartConfig={{
          backgroundColor: '#ffffff',
          backgroundGradientFrom: '#ffffff',
          backgroundGradientTo: '#ffffff',
          decimalPlaces: 0,
          color: (opacity = 1) => `rgba(0, 122, 255, ${opacity})`,
        }}
        style={styles.chart}
      />
    </View>
  );

  const renderEngagementChart = () => (
    <View style={styles.chartContainer}>
      <Text style={styles.chartTitle}>{t('analytics.templateEngagement')}</Text>
      <ContributionGraph
        values={engagementData.map(d => ({
          date: new Date().toISOString().split('T')[0],
          count: d.engagement,
        }))}
        width={Dimensions.get('window').width - 32}
        height={220}
        chartConfig={{
          backgroundColor: '#ffffff',
          backgroundGradientFrom: '#ffffff',
          backgroundGradientTo: '#ffffff',
          color: (opacity = 1) => `rgba(0, 122, 255, ${opacity})`,
        }}
        style={styles.chart}
      />
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {templateId
            ? t('analytics.templateAnalytics')
            : t('analytics.allTemplates')}
        </Text>
        <View style={styles.periodSelector}>
          <TouchableOpacity
            style={[styles.periodButton, period === 'day' && styles.periodButtonSelected]}
            onPress={() => setPeriod('day')}
          >
            <Text
              style={[
                styles.periodButtonText,
                period === 'day' && styles.periodButtonTextSelected,
              ]}
            >
              {t('analytics.day')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.periodButton,
              period === 'week' && styles.periodButtonSelected,
            ]}
            onPress={() => setPeriod('week')}
          >
            <Text
              style={[
                styles.periodButtonText,
                period === 'week' && styles.periodButtonTextSelected,
              ]}
            >
              {t('analytics.week')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.periodButton,
              period === 'month' && styles.periodButtonSelected,
            ]}
            onPress={() => setPeriod('month')}
          >
            <Text
              style={[
                styles.periodButtonText,
                period === 'month' && styles.periodButtonTextSelected,
              ]}
            >
              {t('analytics.month')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.periodButton,
              period === 'year' && styles.periodButtonSelected,
            ]}
            onPress={() => setPeriod('year')}
          >
            <Text
              style={[
                styles.periodButtonText,
                period === 'year' && styles.periodButtonTextSelected,
              ]}
            >
              {t('analytics.year')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {renderMetricsCards()}
      {renderUsageChart()}
      {renderCategoryChart()}
      {renderTypeChart()}
      {renderEngagementChart()}

      <View style={styles.topTemplates}>
        <Text style={styles.sectionTitle}>{t('analytics.topTemplates')}</Text>
        {topTemplates.map((template, index) => (
          <View key={template.id} style={styles.templateRow}>
            <Text style={styles.templateRank}>#{index + 1}</Text>
            <View style={styles.templateInfo}>
              <Text style={styles.templateName}>{template.name}</Text>
              <Text style={styles.templateStats}>
                {template.usageCount} {t('analytics.uses')} • {template.rating.toFixed(1)}{' '}
                {t('analytics.rating')}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
    borderRadius: 8,
    padding: 4,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  periodButtonSelected: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  periodButtonText: {
    fontSize: 14,
    color: '#666',
  },
  periodButtonTextSelected: {
    color: '#007AFF',
    fontWeight: '600',
  },
  metricsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 16,
  },
  metricCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 14,
    color: '#666',
  },
  chartContainer: {
    padding: 16,
    marginBottom: 16,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  chart: {
    borderRadius: 16,
  },
  topTemplates: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  templateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 8,
  },
  templateRank: {
    fontSize: 16,
    fontWeight: '600',
    width: 40,
  },
  templateInfo: {
    flex: 1,
  },
  templateName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  templateStats: {
    fontSize: 14,
    color: '#666',
  },
});
