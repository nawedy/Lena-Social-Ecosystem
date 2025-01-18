import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { LineChart, BarChart } from 'react-native-chart-kit';
import { format, subDays } from 'date-fns';
import { _admin } from '../../services/admin';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

interface FeedbackData {
  date: string;
  counts: Record<string, number>;
  ratings: Record<string, number>;
}

interface Props {
  data: FeedbackData[];
}

export function FeedbackAnalytics({ data }: Props) {
  const [timeRange, setTimeRange] = useState<'week' | 'month'>('week');
  const [isExporting, setIsExporting] = useState(false);

  const processData = () => {
    const days = timeRange === 'week' ? 7 : 30;
    const dates = Array.from({ length: days }, (_, i) =>
      format(subDays(new Date(), i), 'yyyy-MM-dd')
    ).reverse();

    const feedbackTypes = Array.from(
      new Set(data.flatMap(d => Object.keys(d.counts)))
    );

    const datasets = feedbackTypes.map(type => ({
      type,
      data: dates.map(date => {
        const dayData = data.find(d => d.date.startsWith(date));
        return dayData?.counts[type] || 0;
      }),
    }));

    const ratings = dates.map(date => {
      const dayData = data.find(d => d.date.startsWith(date));
      if (!dayData) return 0;

      const totalRatings = Object.values(dayData.ratings).reduce(
        (a, b) => a + b,
        0
      );
      const count = Object.values(dayData.counts).reduce((a, b) => a + b, 0);
      return count ? totalRatings / count : 0;
    });

    return {
      dates: dates.map(d => format(new Date(d), 'MMM d')),
      datasets,
      ratings,
    };
  };

  const exportData = async () => {
    setIsExporting(true);
    try {
      const dataToExport = {
        timeRange,
        data,
        exportDate: new Date().toISOString(),
      };

      const fileName = `feedback_analytics_${timeRange}.json`;
      const filePath = `${FileSystem.documentDirectory}${fileName}`;

      await FileSystem.writeAsStringAsync(
        filePath,
        JSON.stringify(dataToExport, null, 2)
      );

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(filePath);
      }
    } catch (error) {
      console.error('Error exporting data:', error);
      Alert.alert('Error', 'Failed to export data');
    } finally {
      setIsExporting(false);
    }
  };

  const { dates, datasets, ratings } = processData();

  const chartConfig = {
    backgroundColor: '#ffffff',
    backgroundGradientFrom: '#ffffff',
    backgroundGradientTo: '#ffffff',
    decimalPlaces: 1,
    color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: '6',
      strokeWidth: '2',
      stroke: '#ffa726',
    },
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Feedback Analytics</Text>
        <View style={styles.timeRangeContainer}>
          <TouchableOpacity
            style={[
              styles.timeRangeButton,
              timeRange === 'week' && styles.activeTimeRange,
            ]}
            onPress={() => setTimeRange('week')}
          >
            <Text
              style={[
                styles.timeRangeText,
                timeRange === 'week' && styles.activeTimeRangeText,
              ]}
            >
              Week
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.timeRangeButton,
              timeRange === 'month' && styles.activeTimeRange,
            ]}
            onPress={() => setTimeRange('month')}
          >
            <Text
              style={[
                styles.timeRangeText,
                timeRange === 'month' && styles.activeTimeRangeText,
              ]}
            >
              Month
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>Feedback Distribution</Text>
        <BarChart
          data={{
            labels: dates,
            datasets: datasets.map((dataset, index) => ({
              data: dataset.data,
              color: (opacity = 1) =>
                `rgba(${index * 50}, ${255 - index * 50}, ${
                  index * 100
                }, ${opacity})`,
            })),
          }}
          width={styles.chart.width}
          height={220}
          chartConfig={chartConfig}
          style={styles.chart}
          verticalLabelRotation={30}
        />
        <View style={styles.legend}>
          {datasets.map((dataset, index) => (
            <View key={dataset.type} style={styles.legendItem}>
              <View
                style={[
                  styles.legendColor,
                  {
                    backgroundColor: `rgba(${index * 50}, ${255 - index * 50}, ${
                      index * 100
                    }, 1)`,
                  },
                ]}
              />
              <Text style={styles.legendText}>{dataset.type}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>Average Ratings</Text>
        <LineChart
          data={{
            labels: dates,
            datasets: [{ data: ratings }],
          }}
          width={styles.chart.width}
          height={220}
          chartConfig={chartConfig}
          style={styles.chart}
          bezier
        />
      </View>

      <View style={styles.exportContainer}>
        <TouchableOpacity
          style={[styles.exportButton, isExporting && styles.exportingButton]}
          onPress={exportData}
          disabled={isExporting}
        >
          {isExporting ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.exportButtonText}>Export Data</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  timeRangeContainer: {
    flexDirection: 'row',
    backgroundColor: '#e0e0e0',
    borderRadius: 8,
    padding: 4,
  },
  timeRangeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  activeTimeRange: {
    backgroundColor: '#ffffff',
  },
  timeRangeText: {
    fontSize: 14,
    color: '#666',
  },
  activeTimeRangeText: {
    color: '#333',
    fontWeight: '600',
  },
  chartContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  chart: {
    width: 350,
    marginVertical: 8,
    borderRadius: 16,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 8,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  legendText: {
    fontSize: 12,
    color: '#666',
  },
  exportContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  exportButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 150,
    alignItems: 'center',
  },
  exportingButton: {
    opacity: 0.7,
  },
  exportButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
