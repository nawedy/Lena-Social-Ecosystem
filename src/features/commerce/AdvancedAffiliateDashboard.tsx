import { format } from 'date-fns';
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';

import { useATProto } from '../../contexts/ATProtoContext';
import {
  ATProtocolAdvancedAffiliate,
  AdvancedAnalytics,
  CollaborationCampaign,
} from '../../services/atProtocolAdvancedAffiliate';

const _screenWidth = Dimensions.get('window').width;

export const AdvancedAffiliateDashboard: React.FC = () => {
  const { agent } = useATProto();
  const [analytics, setAnalytics] = useState<AdvancedAnalytics | null>(null);
  const [_campaigns, setCampaigns] = useState<CollaborationCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const _affiliate = new ATProtocolAdvancedAffiliate(agent);

  useEffect(() => {
    loadData();
  }, []);

  const _loadData = async () => {
    try {
      const [analyticsData, campaignsData] = await Promise.all([
        affiliate.getAdvancedAnalytics({
          timeframe: {
            start: format(
              new Date().setDate(new Date().getDate() - 30),
              'yyyy-MM-dd'
            ),
            end: format(new Date(), 'yyyy-MM-dd'),
          },
          granularity: 'day',
        }),
        // Assume we have a method to get campaigns
        Promise.resolve([]), // Replace with actual API call
      ]);

      setAnalytics(analyticsData);
      setCampaigns(campaignsData);
    } catch (error) {
      console.error('Error loading advanced analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !analytics) {
    return (
      <View className="flex-1 justify-center items-center">
        <Text className="text-lg dark:text-white">
          Loading advanced analytics...
        </Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-gray-100 dark:bg-gray-900">
      {/* Revenue Forecast */}
      <View className="bg-white dark:bg-gray-800 m-4 p-4 rounded-lg">
        <Text className="text-lg font-semibold mb-4 dark:text-white">
          Revenue Forecast
        </Text>
        <LineChart
          data={{
            labels: analytics.revenue.forecast
              .slice(-7)
              .map(day => format(new Date(day.date), 'MM/dd')),
            datasets: [
              {
                data: analytics.revenue.forecast
                  .slice(-7)
                  .map(day => day.predicted),
              },
            ],
          }}
          width={screenWidth - 40}
          height={220}
          chartConfig={{
            backgroundColor: '#ffffff',
            backgroundGradientFrom: '#ffffff',
            backgroundGradientTo: '#ffffff',
            decimalPlaces: 2,
            color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
            style: { borderRadius: 16 },
          }}
          bezier
          style={{
            marginVertical: 8,
            borderRadius: 16,
          }}
        />
      </View>

      {/* Audience Demographics */}
      <View className="bg-white dark:bg-gray-800 m-4 p-4 rounded-lg">
        <Text className="text-lg font-semibold mb-4 dark:text-white">
          Audience Demographics
        </Text>
        <PieChart
          data={Object.entries(analytics.audience.demographics).map(
            ([key, value]) => ({
              name: key,
              population: value,
              color: `#${Math.floor(Math.random() * 16777215).toString(16)}`,
              legendFontColor: '#7F7F7F',
            })
          )}
          width={screenWidth - 40}
          height={220}
          chartConfig={{
            backgroundColor: '#ffffff',
            backgroundGradientFrom: '#ffffff',
            backgroundGradientTo: '#ffffff',
            color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
          }}
          accessor="population"
          backgroundColor="transparent"
          paddingLeft="15"
        />
      </View>

      {/* Content Performance */}
      <View className="bg-white dark:bg-gray-800 m-4 p-4 rounded-lg">
        <Text className="text-lg font-semibold mb-4 dark:text-white">
          Content Performance
        </Text>
        {analytics.content.topPerforming.slice(0, 5).map(content => (
          <View
            key={content.uri}
            className="mb-4 border-b border-gray-200 pb-4"
          >
            <Text className="font-semibold dark:text-white">
              {content.type.charAt(0).toUpperCase() + content.type.slice(1)}
            </Text>
            <View className="flex-row justify-between mt-2">
              <Text className="text-gray-600 dark:text-gray-400">
                Views: {content.metrics.views.toLocaleString()}
              </Text>
              <Text className="text-gray-600 dark:text-gray-400">
                Revenue: ${content.metrics.revenue.toLocaleString()}
              </Text>
            </View>
            <View className="mt-2">
              <Text className="text-gray-600 dark:text-gray-400">
                Topics: {content.attributes.topics.join(', ')}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* Trending Topics */}
      <View className="bg-white dark:bg-gray-800 m-4 p-4 rounded-lg">
        <Text className="text-lg font-semibold mb-4 dark:text-white">
          Trending Topics
        </Text>
        {analytics.content.trends.map(trend => (
          <View
            key={trend.topic}
            className="mb-4 border-b border-gray-200 pb-4"
          >
            <Text className="font-semibold dark:text-white">{trend.topic}</Text>
            <View className="flex-row justify-between mt-2">
              <Text className="text-gray-600 dark:text-gray-400">
                Growth: {(trend.growth * 100).toFixed(1)}%
              </Text>
              <Text className="text-gray-600 dark:text-gray-400">
                Potential: {(trend.potential * 100).toFixed(1)}%
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* Best Posting Times */}
      <View className="bg-white dark:bg-gray-800 m-4 p-4 rounded-lg">
        <Text className="text-lg font-semibold mb-4 dark:text-white">
          Best Posting Times
        </Text>
        <View className="flex-row flex-wrap">
          {analytics.audience.engagementTimes
            .sort((a, b) => b.engagement - a.engagement)
            .slice(0, 5)
            .map(time => (
              <View
                key={`${time.dayOfWeek}-${time.hourOfDay}`}
                className="bg-blue-100 dark:bg-blue-900 rounded-lg p-2 m-1"
              >
                <Text className="dark:text-white">
                  {format(new Date().setHours(time.hourOfDay), 'ha')} on{' '}
                  {format(new Date().setDate(time.dayOfWeek), 'EEEE')}
                </Text>
              </View>
            ))}
        </View>
      </View>

      {/* Quick Actions */}
      <View className="flex-row flex-wrap p-4">
        <TouchableOpacity
          className="w-1/2 p-2"
          onPress={() => {
            /* Navigate to content optimization */
          }}
        >
          <View className="bg-blue-500 rounded-lg p-4">
            <Text className="text-white font-semibold">Optimize Content</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          className="w-1/2 p-2"
          onPress={() => {
            /* Navigate to campaign management */
          }}
        >
          <View className="bg-blue-500 rounded-lg p-4">
            <Text className="text-white font-semibold">Manage Campaigns</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          className="w-1/2 p-2"
          onPress={() => {
            /* Navigate to content strategy */
          }}
        >
          <View className="bg-blue-500 rounded-lg p-4">
            <Text className="text-white font-semibold">Content Strategy</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          className="w-1/2 p-2"
          onPress={() => {
            /* Navigate to performance predictions */
          }}
        >
          <View className="bg-blue-500 rounded-lg p-4">
            <Text className="text-white font-semibold">
              Predict Performance
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};
