import { format } from 'date-fns';
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { LineChart } from 'react-native-chart-kit';

import { useATProto } from '../../contexts/ATProtoContext';
import { atprotoBeta } from '../../services/atproto-beta';

interface BetaMetrics {
  post_views: number;
  feed_views: number;
  unique_repos_interacted: number;
  event_counts: Record<string, number>;
  last_activity: string;
}

interface FeedbackStats {
  total: number;
  byType: Record<string, number>;
  byPriority: Record<string, number>;
  averageRating: number;
}

export function FeedbackDashboard() {
  const { session } = useATProto();
  const [metrics, setMetrics] = useState<BetaMetrics | null>(null);
  const [feedbackStats, setFeedbackStats] = useState<FeedbackStats | null>(null);
  const [engagementData, setEngagementData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTimeRange, setSelectedTimeRange] = useState<'week' | 'month'>('week');

  useEffect(() => {
    if (session?.did) {
      loadDashboardData();
    }
  }, [session?.did, selectedTimeRange]);

  const _loadDashboardData = async () => {
    setIsLoading(true);
    try {
      // Load AT Protocol metrics
      const _betaMetrics = await atprotoBeta.getBetaMetrics(session?.did);
      setMetrics(betaMetrics);

      // Load feedback statistics
      const _response = await fetch('/api/beta/feedback/stats', {
        headers: {
          Authorization: `Bearer ${session?.accessJwt}`,
        },
      });
      const _stats = await response.json();
      setFeedbackStats(stats);

      // Load engagement data
      const _engagementResponse = await fetch(
        `/api/beta/analytics/engagement?timeRange=${selectedTimeRange}`,
        {
          headers: {
            Authorization: `Bearer ${session?.accessJwt}`,
          },
        }
      );
      const _engagementStats = await engagementResponse.json();
      setEngagementData(engagementStats.data);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const _renderMetricsCard = () => (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>AT Protocol Metrics</Text>
      {metrics && (
        <>
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Post Views:</Text>
            <Text style={styles.metricValue}>{metrics.post_views}</Text>
          </View>
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Feed Views:</Text>
            <Text style={styles.metricValue}>{metrics.feed_views}</Text>
          </View>
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Unique Repos:</Text>
            <Text style={styles.metricValue}>{metrics.unique_repos_interacted}</Text>
          </View>
          <Text style={styles.lastActivity}>
            Last Activity: {format(new Date(metrics.last_activity), 'PPp')}
          </Text>
        </>
      )}
    </View>
  );

  const _renderFeedbackStats = () => (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Feedback Overview</Text>
      {feedbackStats && (
        <>
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Total Feedback:</Text>
            <Text style={styles.metricValue}>{feedbackStats.total?.toLocaleString() || '0'}</Text>
          </View>
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Average Rating:</Text>
            <Text style={styles.metricValue}>
              {feedbackStats.averageRating?.toFixed(1) || '0.0'} ⭐
            </Text>
          </View>
          <View style={styles.typeBreakdown}>
            <Text style={styles.subTitle}>By Type:</Text>
            {Object.entries(feedbackStats.byType).map(([type, count]) => (
              <View key={type} style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>{type}:</Text>
                <Text style={styles.breakdownValue}>{count}</Text>
              </View>
            ))}
          </View>
        </>
      )}
    </View>
  );

  const _renderEngagementChart = () => (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Engagement Trends</Text>
      <View style={styles.timeRangeSelector}>
        <TouchableOpacity
          style={[
            styles.timeRangeButton,
            selectedTimeRange === 'week' && styles.timeRangeButtonActive,
          ]}
          onPress={() => setSelectedTimeRange('week')}
        >
          <Text
            style={[
              styles.timeRangeButtonText,
              selectedTimeRange === 'week' && styles.timeRangeButtonTextActive,
            ]}
          >
            Week
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.timeRangeButton,
            selectedTimeRange === 'month' && styles.timeRangeButtonActive,
          ]}
          onPress={() => setSelectedTimeRange('month')}
        >
          <Text
            style={[
              styles.timeRangeButtonText,
              selectedTimeRange === 'month' && styles.timeRangeButtonTextActive,
            ]}
          >
            Month
          </Text>
        </TouchableOpacity>
      </View>
      {engagementData.length > 0 && (
        <LineChart
          data={{
            labels: engagementData.map((d) => format(new Date(d.date), 'MMM d')),
            datasets: [
              {
                data: engagementData.map((d) => d.engagementCount),
              },
            ],
          }}
          width={styles.chart.width}
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
          style={styles.chart}
        />
      )}
    </View>
  );

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={loadDashboardData} />}
    >
      {renderMetricsCard()}
      {renderFeedbackStats()}
      {renderEngagementChart()}
    </ScrollView>
  );
}

const _styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 15,
    margin: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  metricLabel: {
    fontSize: 16,
    color: '#666',
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  lastActivity: {
    fontSize: 14,
    color: '#666',
    marginTop: 10,
    fontStyle: 'italic',
  },
  typeBreakdown: {
    marginTop: 15,
  },
  subTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  breakdownLabel: {
    fontSize: 14,
    color: '#666',
    textTransform: 'capitalize',
  },
  breakdownValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  timeRangeSelector: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 15,
  },
  timeRangeButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    marginHorizontal: 5,
  },
  timeRangeButtonActive: {
    backgroundColor: '#007AFF',
  },
  timeRangeButtonText: {
    color: '#666',
  },
  timeRangeButtonTextActive: {
    color: '#ffffff',
  },
  chart: {
    width: 350,
    marginVertical: 8,
    borderRadius: 16,
  },
});
