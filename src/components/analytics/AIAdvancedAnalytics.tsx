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

export function AIAdvancedAnalytics() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'prompts' | 'responses' | 'costs' | 'errors'>('prompts');
  const [timeframe, setTimeframe] = useState<'hour' | 'day' | 'week' | 'month'>('day');
  const [promptAnalytics, setPromptAnalytics] = useState<PromptAnalytics[]>([]);
  const [responseAnalytics, setResponseAnalytics] = useState<ResponseAnalytics[]>([]);
  const [costBreakdown, setCostBreakdown] = useState<CostBreakdown[]>([]);
  const [errorAnalytics, setErrorAnalytics] = useState<ErrorAnalytics[]>([]);

  useEffect(() => {
    loadAnalytics();
  }, [view, timeframe]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const analytics = AnalyticsService.getInstance();
      const data = await analytics.getAdvancedAnalytics(view, timeframe);
      switch (view) {
        case 'prompts':
          setPromptAnalytics(data);
          break;
        case 'responses':
          setResponseAnalytics(data);
          break;
        case 'costs':
          setCostBreakdown(data);
          break;
        case 'errors':
          setErrorAnalytics(data);
          break;
      }
    } catch (error) {
      console.error('Error loading advanced analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderPromptAnalytics = () => (
    <ScrollView>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('analytics.promptEffectiveness')}</Text>
        <LineChart
          data={{
            labels: promptAnalytics.map((_, i) => i.toString()),
            datasets: [{
              data: promptAnalytics.map(p => p.effectiveness),
            }],
          }}
          width={Dimensions.get('window').width - 32}
          height={220}
          chartConfig={{
            backgroundColor: '#fff',
            backgroundGradientFrom: '#fff',
            backgroundGradientTo: '#fff',
            decimalPlaces: 2,
            color: (opacity = 1) => `rgba(54, 162, 235, ${opacity})`,
          }}
          bezier
          style={styles.chart}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('analytics.promptComplexity')}</Text>
        <RadarChart
          data={{
            labels: ['Length', 'Keywords', 'Structure', 'Context', 'Clarity'],
            datasets: [{
              data: promptAnalytics.map(p => [
                p.averageLength / 100,
                p.topKeywords.length / 10,
                p.complexity,
                p.effectiveness,
                p.complexity * p.effectiveness,
              ]),
            }],
          }}
          width={Dimensions.get('window').width - 32}
          height={300}
          chartConfig={{
            backgroundColor: '#fff',
            backgroundGradientFrom: '#fff',
            backgroundGradientTo: '#fff',
            decimalPlaces: 2,
            color: (opacity = 1) => `rgba(75, 192, 192, ${opacity})`,
          }}
          style={styles.chart}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('analytics.topKeywords')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {promptAnalytics.flatMap(p => p.topKeywords)
            .reduce((acc, keyword) => {
              acc[keyword] = (acc[keyword] || 0) + 1;
              return acc;
            }, {} as Record<string, number>)
            .entries()
            .sort(([, a], [, b]) => b - a)
            .slice(0, 10)
            .map(([keyword, count]) => (
              <View key={keyword} style={styles.keywordCard}>
                <Text style={styles.keywordText}>{keyword}</Text>
                <Text style={styles.keywordCount}>{count}</Text>
              </View>
            ))
          }
        </ScrollView>
      </View>
    </ScrollView>
  );

  const renderResponseAnalytics = () => (
    <ScrollView>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('analytics.responseQuality')}</Text>
        <StackedBarChart
          data={{
            labels: responseAnalytics.map((_, i) => i.toString()),
            legend: ['Relevance', 'Coherence', 'Creativity'],
            data: responseAnalytics.map(r => [
              r.relevance,
              r.coherence,
              r.creativity,
            ]),
          }}
          width={Dimensions.get('window').width - 32}
          height={220}
          chartConfig={{
            backgroundColor: '#fff',
            backgroundGradientFrom: '#fff',
            backgroundGradientTo: '#fff',
            decimalPlaces: 2,
            color: (opacity = 1) => `rgba(153, 102, 255, ${opacity})`,
          }}
          style={styles.chart}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('analytics.sentimentDistribution')}</Text>
        <View style={styles.sentimentContainer}>
          {responseAnalytics.reduce((acc, r) => {
            const sentiment = Math.round(r.sentiment * 2) / 2;
            acc[sentiment] = (acc[sentiment] || 0) + 1;
            return acc;
          }, {} as Record<number, number>)
            .entries()
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([sentiment, count]) => (
              <View key={sentiment} style={styles.sentimentBar}>
                <Text style={styles.sentimentLabel}>
                  {getSentimentLabel(Number(sentiment))}
                </Text>
                <View
                  style={[
                    styles.sentimentFill,
                    { width: `${(count / responseAnalytics.length) * 100}%` },
                    { backgroundColor: getSentimentColor(Number(sentiment)) },
                  ]}
                />
                <Text style={styles.sentimentCount}>{count}</Text>
              </View>
            ))
          }
        </View>
      </View>
    </ScrollView>
  );

  const renderCostAnalytics = () => (
    <ScrollView>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('analytics.costBreakdown')}</Text>
        <StackedBarChart
          data={{
            labels: costBreakdown.map((_, i) => i.toString()),
            legend: ['Prompt', 'Completion'],
            data: costBreakdown.map(c => [c.promptCost, c.completionCost]),
          }}
          width={Dimensions.get('window').width - 32}
          height={220}
          chartConfig={{
            backgroundColor: '#fff',
            backgroundGradientFrom: '#fff',
            backgroundGradientTo: '#fff',
            decimalPlaces: 2,
            color: (opacity = 1) => `rgba(255, 99, 132, ${opacity})`,
          }}
          style={styles.chart}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('analytics.savingsOpportunities')}</Text>
        <View style={styles.savingsContainer}>
          {costBreakdown.map((c, i) => (
            <View key={i} style={styles.savingsCard}>
              <Text style={styles.savingsLabel}>
                {t('analytics.opportunity')} #{i + 1}
              </Text>
              <Text style={styles.savingsAmount}>
                ${c.savingsOpportunity.toFixed(2)}
              </Text>
              <View style={styles.savingsBar}>
                <View
                  style={[
                    styles.savingsFill,
                    {
                      width: `${(c.savingsOpportunity / c.totalCost) * 100}%`,
                    },
                  ]}
                />
              </View>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );

  const renderErrorAnalytics = () => (
    <ScrollView>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('analytics.errorDistribution')}</Text>
        <BarChart
          data={{
            labels: errorAnalytics.map(e => e.type),
            datasets: [{
              data: errorAnalytics.map(e => e.count),
            }],
          }}
          width={Dimensions.get('window').width - 32}
          height={220}
          chartConfig={{
            backgroundColor: '#fff',
            backgroundGradientFrom: '#fff',
            backgroundGradientTo: '#fff',
            decimalPlaces: 0,
            color: (opacity = 1) => `rgba(220, 53, 69, ${opacity})`,
          }}
          style={styles.chart}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('analytics.errorImpact')}</Text>
        {errorAnalytics.map((error, i) => (
          <View key={i} style={styles.errorCard}>
            <View style={styles.errorHeader}>
              <Text style={styles.errorType}>{error.type}</Text>
              <Text style={styles.errorCount}>{error.count}</Text>
            </View>
            <View style={styles.errorImpactBar}>
              <View
                style={[
                  styles.errorImpactFill,
                  { width: `${error.impact * 100}%` },
                ]}
              />
            </View>
            <Text style={styles.errorResolution}>{error.resolution}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );

  const getSentimentLabel = (sentiment: number): string => {
    if (sentiment < -0.5) return t('analytics.sentiment.negative');
    if (sentiment > 0.5) return t('analytics.sentiment.positive');
    return t('analytics.sentiment.neutral');
  };

  const getSentimentColor = (sentiment: number): string => {
    if (sentiment < -0.5) return '#dc3545';
    if (sentiment > 0.5) return '#28a745';
    return '#ffc107';
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
        <Text style={styles.title}>{t('analytics.advanced')}</Text>
        <View style={styles.viewSelector}>
          {(['prompts', 'responses', 'costs', 'errors'] as const).map(v => (
            <TouchableOpacity
              key={v}
              style={[styles.viewButton, view === v && styles.activeView]}
              onPress={() => setView(v)}
            >
              <Text
                style={[
                  styles.viewButtonText,
                  view === v && styles.activeViewText,
                ]}
              >
                {t(`analytics.views.${v}`)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.timeframeSelector}>
          {(['hour', 'day', 'week', 'month'] as const).map(t => (
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
        </View>
      </View>

      <View style={styles.content}>
        {view === 'prompts' && renderPromptAnalytics()}
        {view === 'responses' && renderResponseAnalytics()}
        {view === 'costs' && renderCostAnalytics()}
        {view === 'errors' && renderErrorAnalytics()}
      </View>
    </View>
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
  viewSelector: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  viewButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
    marginHorizontal: 4,
    backgroundColor: '#f8f9fa',
  },
  activeView: {
    backgroundColor: '#007AFF',
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
    backgroundColor: '#007AFF',
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
  keywordCard: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginRight: 8,
    alignItems: 'center',
  },
  keywordText: {
    fontSize: 14,
    fontWeight: '500',
  },
  keywordCount: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  sentimentContainer: {
    marginTop: 16,
  },
  sentimentBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sentimentLabel: {
    width: 80,
    fontSize: 12,
  },
  sentimentFill: {
    height: 20,
    borderRadius: 4,
  },
  sentimentCount: {
    marginLeft: 8,
    fontSize: 12,
    color: '#666',
  },
  savingsContainer: {
    marginTop: 16,
  },
  savingsCard: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  savingsLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  savingsAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#28a745',
    marginVertical: 8,
  },
  savingsBar: {
    height: 4,
    backgroundColor: '#e9ecef',
    borderRadius: 2,
  },
  savingsFill: {
    height: '100%',
    backgroundColor: '#28a745',
    borderRadius: 2,
  },
  errorCard: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  errorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  errorType: {
    fontSize: 14,
    fontWeight: '500',
  },
  errorCount: {
    fontSize: 12,
    color: '#dc3545',
    fontWeight: '500',
  },
  errorImpactBar: {
    height: 4,
    backgroundColor: '#e9ecef',
    borderRadius: 2,
    marginBottom: 8,
  },
  errorImpactFill: {
    height: '100%',
    backgroundColor: '#dc3545',
    borderRadius: 2,
  },
  errorResolution: {
    fontSize: 12,
    color: '#666',
  },
});
