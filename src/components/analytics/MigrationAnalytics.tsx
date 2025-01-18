import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { LineChart, BarChart, PieChart, ProgressChart } from 'react-native-chart-kit';

import { AnalyticsService } from '../../services/AnalyticsService';

interface MigrationStats {
  totalMigrations: number;
  successfulMigrations: number;
  failedMigrations: number;
  averageDuration: number;
  totalUsersReached: number;
  totalContentMigrated: number;
  retentionRate: number;
  engagementChange: number;
}

interface MigrationTrend {
  date: string;
  migrations: number;
  success: number;
  failed: number;
}

interface ContentStats {
  type: string;
  count: number;
  successRate: number;
  averageEngagement: number;
}

export function MigrationAnalytics() {
  const { t } = useTranslation();
  const [timeframe, setTimeframe] = useState<'day' | 'week' | 'month'>('week');
  const [stats, setStats] = useState<MigrationStats | null>(null);
  const [trends, setTrends] = useState<MigrationTrend[]>([]);
  const [contentStats, setContentStats] = useState<ContentStats[]>([]);

  useEffect(() => {
    loadAnalytics();
  }, [timeframe]);

  const _loadAnalytics = async () => {
    const _analytics = AnalyticsService.getInstance();

    // Load migration statistics
    const _migrationStats = await analytics.getMigrationStats(timeframe);
    setStats(migrationStats);

    // Load migration trends
    const _migrationTrends = await analytics.getMigrationTrends(timeframe);
    setTrends(migrationTrends);

    // Load content statistics
    const _contentStatistics = await analytics.getContentStats(timeframe);
    setContentStats(contentStatistics);
  };

  const _renderSuccessRate = () => {
    if (!stats) return null;

    const _data = {
      labels: [t('analytics.migration.success')],
      data: [stats.successfulMigrations / stats.totalMigrations],
    };

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('analytics.migration.successRate')}</Text>
        <ProgressChart
          data={data}
          width={Dimensions.get('window').width - 32}
          height={200}
          chartConfig={{
            backgroundColor: '#fff',
            backgroundGradientFrom: '#fff',
            backgroundGradientTo: '#fff',
            decimalPlaces: 2,
            color: (opacity = 1) => `rgba(40, 167, 69, ${opacity})`,
          }}
          style={styles.chart}
        />
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>{t('analytics.migration.total')}</Text>
            <Text style={styles.statValue}>{stats.totalMigrations}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>{t('analytics.migration.successful')}</Text>
            <Text style={[styles.statValue, styles.successText]}>{stats.successfulMigrations}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>{t('analytics.migration.failed')}</Text>
            <Text style={[styles.statValue, styles.errorText]}>{stats.failedMigrations}</Text>
          </View>
        </View>
      </View>
    );
  };

  const _renderMigrationTrends = () => {
    if (trends.length === 0) return null;

    const _data = {
      labels: trends.map((t) => t.date),
      datasets: [
        {
          data: trends.map((t) => t.migrations),
          color: (opacity = 1) => `rgba(0, 123, 255, ${opacity})`,
          strokeWidth: 2,
        },
        {
          data: trends.map((t) => t.success),
          color: (opacity = 1) => `rgba(40, 167, 69, ${opacity})`,
          strokeWidth: 2,
        },
      ],
      legend: [t('analytics.migration.total'), t('analytics.migration.successful')],
    };

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('analytics.migration.trends')}</Text>
        <LineChart
          data={data}
          width={Dimensions.get('window').width - 32}
          height={220}
          chartConfig={{
            backgroundColor: '#fff',
            backgroundGradientFrom: '#fff',
            backgroundGradientTo: '#fff',
            decimalPlaces: 0,
            color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
          }}
          bezier
          style={styles.chart}
        />
      </View>
    );
  };

  const _renderContentStats = () => {
    if (contentStats.length === 0) return null;

    const _data = {
      labels: contentStats.map((s) => s.type),
      datasets: [
        {
          data: contentStats.map((s) => s.count),
        },
      ],
    };

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('analytics.migration.contentStats')}</Text>
        <BarChart
          data={data}
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
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {contentStats.map((stat) => (
            <View key={stat.type} style={styles.contentCard}>
              <Text style={styles.contentType}>{stat.type}</Text>
              <Text style={styles.contentCount}>
                {stat.count} {t('analytics.migration.items')}
              </Text>
              <View style={styles.contentMetrics}>
                <Text style={styles.contentMetric}>
                  {(stat.successRate * 100).toFixed(1)}% {t('analytics.migration.success')}
                </Text>
                <Text style={styles.contentMetric}>
                  {stat.averageEngagement.toFixed(1)}x {t('analytics.migration.engagement')}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
    );
  };

  const _renderEngagementMetrics = () => {
    if (!stats) return null;

    const _data = {
      name: t('analytics.migration.engagement'),
      color: 'rgba(0, 123, 255, 1)',
      legendFontColor: '#7F7F7F',
      legendFontSize: 15,
      data: [
        {
          name: t('analytics.migration.retention'),
          population: stats.retentionRate * 100,
          color: 'rgba(40, 167, 69, 1)',
          legendFontColor: '#7F7F7F',
        },
        {
          name: t('analytics.migration.engagement'),
          population: stats.engagementChange * 100,
          color: 'rgba(255, 193, 7, 1)',
          legendFontColor: '#7F7F7F',
        },
      ],
    };

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('analytics.migration.metrics')}</Text>
        <PieChart
          data={[data]}
          width={Dimensions.get('window').width - 32}
          height={220}
          chartConfig={{
            color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
          }}
          accessor='population'
          backgroundColor='transparent'
          paddingLeft='15'
          style={styles.chart}
        />
      </View>
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('analytics.migration.title')}</Text>
        <View style={styles.timeframeSelector}>
          {(['day', 'week', 'month'] as const).map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.timeframeButton, timeframe === t && styles.activeTimeframe]}
              onPress={() => setTimeframe(t)}
            >
              <Text style={[styles.timeframeText, timeframe === t && styles.activeTimeframeText]}>
                {t(`analytics.timeframe.${t}`)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {renderSuccessRate()}
      {renderMigrationTrends()}
      {renderContentStats()}
      {renderEngagementMetrics()}
    </ScrollView>
  );
}

const _styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
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
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  successText: {
    color: '#28a745',
  },
  errorText: {
    color: '#dc3545',
  },
  contentCard: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    marginRight: 12,
    width: 200,
  },
  contentType: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  contentCount: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  contentMetrics: {
    borderTopWidth: 1,
    borderTopColor: '#dee2e6',
    paddingTop: 12,
  },
  contentMetric: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
});
