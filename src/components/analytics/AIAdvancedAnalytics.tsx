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
  StackedBarChart,
  RadarChart,
} from 'react-native-chart-kit';
import { AnalyticsService } from '../../services/AnalyticsService';

interface PromptAnalytics {
  averageLength: number;
  complexity: number;
  topKeywords: string[];
  effectiveness: number;
}

interface ResponseAnalytics {
  averageLength: number;
  sentiment: number;
  creativity: number;
  relevance: number;
  coherence: number;
}

interface CostBreakdown {
  promptCost: number;
  completionCost: number;
  totalCost: number;
  savingsOpportunity: number;
}

interface ErrorAnalytics {
  type: string;
  count: number;
  impact: number;
  resolution: string;
}

type ViewType = 'prompts' | 'responses' | 'costs' | 'errors';
type TimeframeType = 'hour' | 'day' | 'week' | 'month';

export function AIAdvancedAnalytics() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewType>('prompts');
  const [timeframe, setTimeframe] = useState<TimeframeType>('day');
  const [promptAnalytics, setPromptAnalytics] = useState<PromptAnalytics[]>([]);
  const [responseAnalytics, setResponseAnalytics] = useState<
    ResponseAnalytics[]
  >([]);
  const [costBreakdown, setCostBreakdown] = useState<CostBreakdown[]>([]);
  const [errorAnalytics, setErrorAnalytics] = useState<ErrorAnalytics[]>([]);

  useEffect(() => {
    loadAnalytics();
  }, [view, timeframe]);

  const _loadAnalytics = async () => {
    setLoading(true);
    try {
      const _analytics = AnalyticsService.getInstance();
      const _data = await analytics.getAdvancedAnalytics();

      switch (view) {
        case 'prompts':
          setPromptAnalytics(data.prompts || []);
          break;
        case 'responses':
          setResponseAnalytics(data.responses || []);
          break;
        case 'costs':
          setCostBreakdown(data.costs || []);
          break;
        case 'errors':
          setErrorAnalytics(data.errors || []);
          break;
      }
    } catch (error) {
      console.error('Error loading advanced analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const _chartConfig = {
    backgroundColor: '#ffffff',
    backgroundGradientFrom: '#ffffff',
    backgroundGradientTo: '#ffffff',
    decimalPlaces: 2,
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

  const _renderPromptAnalytics = () => (
    <ScrollView>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {t('analytics.promptEffectiveness')}
        </Text>
        <LineChart
          data={{
            labels: promptAnalytics.map((_, i) => i.toString()),
            datasets: [
              {
                data: promptAnalytics.map(p => p.effectiveness),
              },
            ],
          }}
          width={Dimensions.get('window').width - 32}
          height={220}
          chartConfig={chartConfig}
          bezier
          style={styles.chart}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('analytics.promptMetrics')}</Text>
        <RadarChart
          data={{
            labels: ['Length', 'Complexity', 'Keywords', 'Effect'],
            data: [
              promptAnalytics.map(p => [
                p.averageLength / 100,
                p.complexity,
                p.topKeywords.length / 10,
                p.effectiveness,
              ])[0] || [0, 0, 0, 0],
            ],
          }}
          width={Dimensions.get('window').width - 32}
          height={220}
          chartConfig={chartConfig}
          style={styles.chart}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('analytics.topKeywords')}</Text>
        <StackedBarChart
          data={{
            labels: promptAnalytics
              .flatMap(p => p.topKeywords)
              .reduce((acc: Record<string, number>, keyword) => {
                acc[keyword] = (acc[keyword] || 0) + 1;
                return acc;
              }, {})
              .entries()
              .sort((a: [string, number], b: [string, number]) => b[1] - a[1])
              .slice(0, 5)
              .map(([keyword]) => keyword),
            legend: ['Frequency'],
            data: [
              promptAnalytics
                .flatMap(p => p.topKeywords)
                .reduce((acc: Record<string, number>, keyword) => {
                  acc[keyword] = (acc[keyword] || 0) + 1;
                  return acc;
                }, {})
                .entries()
                .sort((a: [string, number], b: [string, number]) => b[1] - a[1])
                .slice(0, 5)
                .map(([, count]) => [count]),
            ],
            barColors: ['#dfe4ea'],
          }}
          width={Dimensions.get('window').width - 32}
          height={220}
          chartConfig={chartConfig}
          style={styles.chart}
        />
      </View>
    </ScrollView>
  );

  const _renderResponseAnalytics = () => (
    <ScrollView>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {t('analytics.responseSentiment')}
        </Text>
        <StackedBarChart
          data={{
            labels: Object.keys(
              responseAnalytics.reduce((acc: Record<number, number>, r) => {
                acc[r.sentiment] = (acc[r.sentiment] || 0) + 1;
                return acc;
              }, {})
            ).sort((a, b) => Number(a) - Number(b)),
            legend: ['Count'],
            data: [
              Object.values(
                responseAnalytics.reduce((acc: Record<number, number>, r) => {
                  acc[r.sentiment] = (acc[r.sentiment] || 0) + 1;
                  return acc;
                }, {})
              ),
            ],
            barColors: ['#dfe4ea'],
          }}
          width={Dimensions.get('window').width - 32}
          height={220}
          chartConfig={chartConfig}
          style={styles.chart}
        />
      </View>
    </ScrollView>
  );

  const _renderCostBreakdown = () => (
    <ScrollView>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('analytics.costBreakdown')}</Text>
        <StackedBarChart
          data={{
            labels: ['Prompts', 'Completions', 'Total', 'Savings'],
            legend: ['Cost'],
            data: [
              costBreakdown.map(c => [
                c.promptCost,
                c.completionCost,
                c.totalCost,
                c.savingsOpportunity,
              ])[0] || [0, 0, 0, 0],
            ],
            barColors: ['#dfe4ea'],
          }}
          width={Dimensions.get('window').width - 32}
          height={220}
          chartConfig={chartConfig}
          style={styles.chart}
        />
      </View>
    </ScrollView>
  );

  const _renderErrorAnalytics = () => (
    <ScrollView>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {t('analytics.errorDistribution')}
        </Text>
        <StackedBarChart
          data={{
            labels: errorAnalytics.map(e => e.type),
            legend: ['Count'],
            data: [errorAnalytics.map(e => e.count)],
            barColors: ['#dfe4ea'],
          }}
          width={Dimensions.get('window').width - 32}
          height={220}
          chartConfig={chartConfig}
          style={styles.chart}
        />
      </View>
    </ScrollView>
  );

  const _renderContent = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0000ff" />
        </View>
      );
    }

    switch (view) {
      case 'prompts':
        return renderPromptAnalytics();
      case 'responses':
        return renderResponseAnalytics();
      case 'costs':
        return renderCostBreakdown();
      case 'errors':
        return renderErrorAnalytics();
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {(['prompts', 'responses', 'costs', 'errors'] as ViewType[]).map(
            v => (
              <TouchableOpacity
                key={v}
                style={[styles.tab, view === v && styles.activeTab]}
                onPress={() => setView(v)}
              >
                <Text
                  style={[styles.tabText, view === v && styles.activeTabText]}
                >
                  {t(`analytics.${v}`)}
                </Text>
              </TouchableOpacity>
            )
          )}
        </ScrollView>
      </View>

      <View style={styles.timeframeContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {(['hour', 'day', 'week', 'month'] as TimeframeType[]).map(t => (
            <TouchableOpacity
              key={t}
              style={[
                styles.timeframeButton,
                timeframe === t && styles.activeTimeframe,
              ]}
              onPress={() => setTimeframe(t)}
            >
              <Text
                style={[
                  styles.timeframeText,
                  timeframe === t && styles.activeTimeframeText,
                ]}
              >
                {t(`analytics.timeframe.${t}`)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {renderContent()}
    </View>
  );
}

const _styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e1e1',
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 4,
    borderRadius: 16,
  },
  activeTab: {
    backgroundColor: '#e1e1e1',
  },
  tabText: {
    fontSize: 14,
    color: '#666',
  },
  activeTabText: {
    color: '#000',
    fontWeight: 'bold',
  },
  timeframeContainer: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e1e1',
  },
  timeframeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginHorizontal: 4,
    borderRadius: 12,
  },
  activeTimeframe: {
    backgroundColor: '#e1e1e1',
  },
  timeframeText: {
    fontSize: 12,
    color: '#666',
  },
  activeTimeframeText: {
    color: '#000',
    fontWeight: 'bold',
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e1e1',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
