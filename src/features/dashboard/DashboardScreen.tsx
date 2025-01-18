import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { useATProto } from '../../contexts/ATProtoContext';
import {
  ATProtocolDashboard,
  MultiAccountDashboard,
} from '../../services/atProtocolDashboard';

export const DashboardScreen: React.FC = () => {
  const { agent } = useATProto();
  const [dashboardData, setDashboardData] =
    useState<MultiAccountDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const _dashboard = new ATProtocolDashboard(agent);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const _loadDashboardData = async () => {
    try {
      // For now, we'll just use the current user's DID
      const _data = await dashboard.getMultiAccountDashboard([
        agent.session?.did || '',
      ]);
      setDashboardData(data);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center">
        <Text className="text-lg dark:text-white">Loading dashboard...</Text>
      </View>
    );
  }

  if (!dashboardData) {
    return (
      <View className="flex-1 justify-center items-center">
        <Text className="text-lg dark:text-white">No data available</Text>
      </View>
    );
  }

  const _account = dashboardData.accounts[0];
  const _reachData = account.metrics.reachByDay;

  return (
    <ScrollView className="flex-1 bg-gray-100 dark:bg-gray-900">
      {/* Overview Cards */}
      <View className="flex-row flex-wrap p-4">
        <View className="w-1/2 p-2">
          <View className="bg-white dark:bg-gray-800 rounded-lg p-4">
            <Text className="text-gray-600 dark:text-gray-400">Followers</Text>
            <Text className="text-2xl font-bold dark:text-white">
              {account.metrics.followers.toLocaleString()}
            </Text>
          </View>
        </View>
        <View className="w-1/2 p-2">
          <View className="bg-white dark:bg-gray-800 rounded-lg p-4">
            <Text className="text-gray-600 dark:text-gray-400">Engagement</Text>
            <Text className="text-2xl font-bold dark:text-white">
              {account.metrics.engagement.toFixed(2)}%
            </Text>
          </View>
        </View>
        <View className="w-1/2 p-2">
          <View className="bg-white dark:bg-gray-800 rounded-lg p-4">
            <Text className="text-gray-600 dark:text-gray-400">Revenue</Text>
            <Text className="text-2xl font-bold dark:text-white">
              ${account.monetization.revenue.toLocaleString()}
            </Text>
          </View>
        </View>
        <View className="w-1/2 p-2">
          <View className="bg-white dark:bg-gray-800 rounded-lg p-4">
            <Text className="text-gray-600 dark:text-gray-400">Orders</Text>
            <Text className="text-2xl font-bold dark:text-white">
              {account.monetization.orders.toLocaleString()}
            </Text>
          </View>
        </View>
      </View>

      {/* Reach Chart */}
      <View className="bg-white dark:bg-gray-800 m-4 p-4 rounded-lg">
        <Text className="text-lg font-semibold mb-4 dark:text-white">
          Reach Trend
        </Text>
        <LineChart
          data={{
            labels: reachData.slice(-7).map(day => day.date.slice(5)),
            datasets: [
              {
                data: reachData.slice(-7).map(day => day.reach),
              },
            ],
          }}
          width={350}
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
          bezier
          style={{
            marginVertical: 8,
            borderRadius: 16,
          }}
        />
      </View>

      {/* Content Performance */}
      <View className="bg-white dark:bg-gray-800 m-4 p-4 rounded-lg">
        <Text className="text-lg font-semibold mb-4 dark:text-white">
          Content Performance
        </Text>
        <View className="space-y-4">
          <View className="flex-row justify-between">
            <Text className="dark:text-white">Total Posts</Text>
            <Text className="font-semibold dark:text-white">
              {account.content.totalPosts.toLocaleString()}
            </Text>
          </View>
          <View className="flex-row justify-between">
            <Text className="dark:text-white">Total Views</Text>
            <Text className="font-semibold dark:text-white">
              {account.content.totalViews.toLocaleString()}
            </Text>
          </View>
          <View className="flex-row justify-between">
            <Text className="dark:text-white">Avg. Engagement</Text>
            <Text className="font-semibold dark:text-white">
              {account.content.averageEngagement.toFixed(2)}%
            </Text>
          </View>
        </View>
      </View>

      {/* Quick Actions */}
      <View className="flex-row flex-wrap p-4">
        <TouchableOpacity
          className="w-1/2 p-2"
          onPress={() => {
            /* Navigate to content scheduler */
          }}
        >
          <View className="bg-blue-500 rounded-lg p-4">
            <Text className="text-white font-semibold">Schedule Content</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          className="w-1/2 p-2"
          onPress={() => {
            /* Navigate to analytics */
          }}
        >
          <View className="bg-blue-500 rounded-lg p-4">
            <Text className="text-white font-semibold">View Analytics</Text>
          </View>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};
