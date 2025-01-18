import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { LineChart, BarChart } from 'react-native-chart-kit';
import { useATProto } from '../../contexts/ATProtoContext';
import {
  ATProtocolAffiliate,
  ProductShare,
  AffiliateEarning,
} from '../../services/atProtocolAffiliate';
import { format } from 'date-fns';

const _screenWidth = Dimensions.get('window').width;

export const AffiliateDashboard: React.FC = () => {
  const { agent } = useATProto();
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const _affiliate = new ATProtocolAffiliate(agent);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const _loadAnalytics = async () => {
    try {
      const _data = await affiliate.getAffiliateAnalytics({
        start: format(
          new Date().setDate(new Date().getDate() - 30),
          'yyyy-MM-dd'
        ),
        end: format(new Date(), 'yyyy-MM-dd'),
      });
      setAnalytics(data);
    } catch (error) {
      console.error('Error loading affiliate analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !analytics) {
    return (
      <View className="flex-1 justify-center items-center">
        <Text className="text-lg dark:text-white">Loading analytics...</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-gray-100 dark:bg-gray-900">
      {/* Overview Cards */}
      <View className="flex-row flex-wrap p-4">
        <View className="w-1/2 p-2">
          <View className="bg-white dark:bg-gray-800 rounded-lg p-4">
            <Text className="text-gray-600 dark:text-gray-400">
              Total Earnings
            </Text>
            <Text className="text-2xl font-bold dark:text-white">
              ${analytics.overview.totalEarnings.toLocaleString()}
            </Text>
          </View>
        </View>
        <View className="w-1/2 p-2">
          <View className="bg-white dark:bg-gray-800 rounded-lg p-4">
            <Text className="text-gray-600 dark:text-gray-400">
              Pending Earnings
            </Text>
            <Text className="text-2xl font-bold dark:text-white">
              ${analytics.overview.pendingEarnings.toLocaleString()}
            </Text>
          </View>
        </View>
        <View className="w-1/2 p-2">
          <View className="bg-white dark:bg-gray-800 rounded-lg p-4">
            <Text className="text-gray-600 dark:text-gray-400">
              Conversion Rate
            </Text>
            <Text className="text-2xl font-bold dark:text-white">
              {(analytics.overview.conversionRate * 100).toFixed(2)}%
            </Text>
          </View>
        </View>
        <View className="w-1/2 p-2">
          <View className="bg-white dark:bg-gray-800 rounded-lg p-4">
            <Text className="text-gray-600 dark:text-gray-400">
              Active Shares
            </Text>
            <Text className="text-2xl font-bold dark:text-white">
              {analytics.overview.activeShares}
            </Text>
          </View>
        </View>
      </View>

      {/* Revenue Chart */}
      <View className="bg-white dark:bg-gray-800 m-4 p-4 rounded-lg">
        <Text className="text-lg font-semibold mb-4 dark:text-white">
          Daily Revenue
        </Text>
        <LineChart
          data={{
            labels: analytics.performance.dailyStats
              .slice(-7)
              .map((stat: any) => format(new Date(stat.date), 'MM/dd')),
            datasets: [
              {
                data: analytics.performance.dailyStats
                  .slice(-7)
                  .map((stat: any) => stat.revenue),
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
            style: {
              borderRadius: 16,
            },
          }}
          bezier
          style={{
            marginVertical: 8,
            borderRadius: 16,
          }}
        />
      </View>

      {/* Top Products */}
      <View className="bg-white dark:bg-gray-800 m-4 p-4 rounded-lg">
        <Text className="text-lg font-semibold mb-4 dark:text-white">
          Top Performing Products
        </Text>
        {analytics.performance.topProducts.map((product: any) => (
          <View
            key={product.uri}
            className="mb-4 border-b border-gray-200 pb-4"
          >
            <Text className="font-semibold dark:text-white">
              {product.name}
            </Text>
            <View className="flex-row justify-between mt-2">
              <Text className="text-gray-600 dark:text-gray-400">
                Sales: {product.sales}
              </Text>
              <Text className="text-gray-600 dark:text-gray-400">
                Revenue: ${product.revenue.toLocaleString()}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* Performance Metrics */}
      <View className="bg-white dark:bg-gray-800 m-4 p-4 rounded-lg">
        <Text className="text-lg font-semibold mb-4 dark:text-white">
          Performance Metrics
        </Text>
        <BarChart
          data={{
            labels: ['Clicks', 'Conversions', 'Sales'],
            datasets: [
              {
                data: [
                  analytics.performance.dailyStats.reduce(
                    (sum: number, stat: any) => sum + stat.clicks,
                    0
                  ),
                  analytics.performance.dailyStats.reduce(
                    (sum: number, stat: any) => sum + stat.conversions,
                    0
                  ),
                  analytics.performance.dailyStats.reduce(
                    (sum: number, stat: any) => sum + stat.sales,
                    0
                  ),
                ],
              },
            ],
          }}
          width={screenWidth - 40}
          height={220}
          chartConfig={{
            backgroundColor: '#ffffff',
            backgroundGradientFrom: '#ffffff',
            backgroundGradientTo: '#ffffff',
            decimalPlaces: 0,
            color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
            style: {
              borderRadius: 16,
            },
          }}
          style={{
            marginVertical: 8,
            borderRadius: 16,
          }}
        />
      </View>

      {/* Recent Shares */}
      <View className="bg-white dark:bg-gray-800 m-4 p-4 rounded-lg">
        <Text className="text-lg font-semibold mb-4 dark:text-white">
          Recent Shares
        </Text>
        {analytics.performance.shares.slice(0, 5).map((share: ProductShare) => (
          <View key={share.uri} className="mb-4 border-b border-gray-200 pb-4">
            <Text className="font-semibold dark:text-white">
              {share.type.charAt(0).toUpperCase() + share.type.slice(1)}
            </Text>
            <View className="flex-row justify-between mt-2">
              <Text className="text-gray-600 dark:text-gray-400">
                Views: {share.performance.views}
              </Text>
              <Text className="text-gray-600 dark:text-gray-400">
                Revenue: ${share.performance.revenue.toLocaleString()}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* Quick Actions */}
      <View className="flex-row flex-wrap p-4">
        <TouchableOpacity
          className="w-1/2 p-2"
          onPress={() => {
            /* Navigate to share creation */
          }}
        >
          <View className="bg-blue-500 rounded-lg p-4">
            <Text className="text-white font-semibold">Create Share</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          className="w-1/2 p-2"
          onPress={() => {
            /* Navigate to earnings */
          }}
        >
          <View className="bg-blue-500 rounded-lg p-4">
            <Text className="text-white font-semibold">View Earnings</Text>
          </View>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};
