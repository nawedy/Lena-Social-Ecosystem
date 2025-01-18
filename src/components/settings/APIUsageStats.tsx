import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';

import { APIUsageService } from '../../services/APIUsageService';


interface UsageData {
  provider: string;
  operation: string;
  count: number;
  tokens: number;
  cost: number;
}

export function APIUsageStats({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<'daily' | 'monthly'>('daily');
  const [loading, setLoading] = useState(true);
  const [usageData, setUsageData] = useState<UsageData[]>([]);
  const [selectedProvider, setSelectedProvider] = useState('all');
  const _apiUsageService = APIUsageService.getInstance();

  useEffect(() => {
    loadUsageData();
  }, [period, selectedProvider]);

  const _loadUsageData = async () => {
    setLoading(true);
    try {
      const _providers = ['openai', 'stability', 'replicate'];
      let allUsage: UsageData[] = [];

      for (const provider of providers) {
        const _stats = await apiUsageService.getUsageStats(userId, provider, period);

        Object.entries(stats).forEach(([operation, data]) => {
          allUsage.push({
            provider,
            operation,
            ...data,
          });
        });
      }

      if (selectedProvider !== 'all') {
        allUsage = allUsage.filter((usage) => usage.provider === selectedProvider);
      }

      setUsageData(allUsage);
    } catch (error) {
      console.error('Error loading usage data:', error);
    } finally {
      setLoading(false);
    }
  };

  const _renderUsageChart = () => {
    const _chartData = {
      labels: usageData.map((data) => data.operation.substring(0, 8)),
      datasets: [
        {
          data: usageData.map((data) => data.tokens),
          color: (opacity = 1) => `rgba(0, 122, 255, ${opacity})`,
          strokeWidth: 2,
        },
      ],
    };

    return (
      <LineChart
        data={chartData}
        width={350}
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
    );
  };

  const _getTotalUsage = () => {
    return usageData.reduce(
      (acc, curr) => ({
        tokens: acc.tokens + curr.tokens,
        cost: acc.cost + curr.cost,
        count: acc.count + curr.count,
      }),
      { tokens: 0, cost: 0, count: 0 }
    );
  };

  const _renderProviderSelector = () => {
    const _providers = ['all', 'openai', 'stability', 'replicate'];

    return (
      <View style={styles.providerSelector}>
        {providers.map((provider) => (
          <TouchableOpacity
            key={provider}
            style={[
              styles.providerButton,
              selectedProvider === provider && styles.providerButtonSelected,
            ]}
            onPress={() => setSelectedProvider(provider)}
          >
            <Text
              style={[
                styles.providerButtonText,
                selectedProvider === provider && styles.providerButtonTextSelected,
              ]}
            >
              {provider === 'all' ? t('all') : provider}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const _renderPeriodSelector = () => (
    <View style={styles.periodSelector}>
      <TouchableOpacity
        style={[styles.periodButton, period === 'daily' && styles.periodButtonSelected]}
        onPress={() => setPeriod('daily')}
      >
        <Text
          style={[styles.periodButtonText, period === 'daily' && styles.periodButtonTextSelected]}
        >
          {t('daily')}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.periodButton, period === 'monthly' && styles.periodButtonSelected]}
        onPress={() => setPeriod('monthly')}
      >
        <Text
          style={[styles.periodButtonText, period === 'monthly' && styles.periodButtonTextSelected]}
        >
          {t('monthly')}
        </Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size='large' color='#007AFF' />
      </View>
    );
  }

  const _totals = getTotalUsage();

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>{t('settings.apiUsageStats')}</Text>

      {renderPeriodSelector()}
      {renderProviderSelector()}

      <View style={styles.statsContainer}>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>{t('settings.totalRequests')}</Text>
          <Text style={styles.statValue}>{totals.count}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>{t('settings.totalTokens')}</Text>
          <Text style={styles.statValue}>{totals.tokens.toLocaleString()}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>{t('settings.totalCost')}</Text>
          <Text style={styles.statValue}>${totals.cost.toFixed(2)}</Text>
        </View>
      </View>

      {usageData.length > 0 && renderUsageChart()}

      <View style={styles.detailsContainer}>
        <Text style={styles.sectionTitle}>{t('settings.usageDetails')}</Text>
        {usageData.map((data, index) => (
          <View key={index} style={styles.detailRow}>
            <View style={styles.detailHeader}>
              <Text style={styles.detailProvider}>{data.provider}</Text>
              <Text style={styles.detailOperation}>{data.operation}</Text>
            </View>
            <View style={styles.detailStats}>
              <Text style={styles.detailText}>
                {data.count} {t('settings.requests')}
              </Text>
              <Text style={styles.detailText}>
                {data.tokens.toLocaleString()} {t('settings.tokens')}
              </Text>
              <Text style={styles.detailText}>${data.cost.toFixed(2)}</Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const _styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  periodSelector: {
    flexDirection: 'row',
    marginBottom: 20,
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
    fontSize: 16,
    color: '#666',
  },
  periodButtonTextSelected: {
    color: '#007AFF',
    fontWeight: '600',
  },
  providerSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
    gap: 8,
  },
  providerButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f8f9fa',
  },
  providerButtonSelected: {
    backgroundColor: '#007AFF',
  },
  providerButtonText: {
    fontSize: 14,
    color: '#666',
  },
  providerButtonTextSelected: {
    color: '#fff',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  chart: {
    marginVertical: 20,
    borderRadius: 16,
  },
  detailsContainer: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  detailRow: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailProvider: {
    fontSize: 16,
    fontWeight: '600',
  },
  detailOperation: {
    fontSize: 14,
    color: '#666',
  },
  detailStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailText: {
    fontSize: 14,
    color: '#666',
  },
});
