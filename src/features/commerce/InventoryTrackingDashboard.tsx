import { format } from 'date-fns';
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { LineChart, BarChart } from 'react-native-chart-kit';

import { useATProto } from '../../contexts/ATProtoContext';
import {
  ATProtocolInventoryTracking,
  InventorySnapshot,
  InventoryAlert,
  InventoryForecast,
} from '../../services/atProtocolInventoryTracking';

export const InventoryTrackingDashboard: React.FC = () => {
  const { agent } = useATProto();
  const [snapshots, setSnapshots] = useState<InventorySnapshot[]>([]);
  const [alerts, setAlerts] = useState<InventoryAlert[]>([]);
  const [forecasts, setForecasts] = useState<Record<string, InventoryForecast>>({});
  const [analytics, setAnalytics] = useState<{
    turnoverRate: number;
    stockoutRate: number;
    accuracyRate: number;
    valueByProduct: Record<string, number>;
  } | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const _inventoryTracking = new ATProtocolInventoryTracking(agent);

  useEffect(() => {
    loadData();
  }, []);

  const _loadData = async () => {
    try {
      const [snapshotsData, alertsData, analyticsData] = await Promise.all([
        // Get all inventory snapshots
        agent.api.app.bsky.commerce.listInventorySnapshots({}),
        // Get active alerts
        agent.api.app.bsky.commerce.listInventoryAlerts({
          resolved: false,
        }),
        // Get analytics
        inventoryTracking.getInventoryAnalytics({
          timeframe: {
            start: format(new Date().setDate(new Date().getDate() - 30), 'yyyy-MM-dd'),
            end: format(new Date(), 'yyyy-MM-dd'),
          },
        }),
      ]);

      setSnapshots(snapshotsData.data.snapshots);
      setAlerts(alertsData.data.alerts);
      setAnalytics(analyticsData);

      // Load forecasts for products with alerts
      const _alertedProducts = new Set(alertsData.data.alerts.map((alert) => alert.productId));
      const forecastsData: Record<string, InventoryForecast> = {};

      await Promise.all(
        Array.from(alertedProducts).map(async (productId) => {
          const _forecast = await inventoryTracking.generateForecast({
            productId,
            locationId: 'default', // You might want to make this dynamic
            days: 30,
          });
          forecastsData[productId] = forecast;
        })
      );

      setForecasts(forecastsData);
      setLoading(false);
    } catch (error) {
      console.error('Error loading inventory data:', error);
      setLoading(false);
    }
  };

  const _getAlertSeverityColor = (severity: InventoryAlert['severity']) => {
    switch (severity) {
      case 'high':
        return 'text-red-500';
      case 'medium':
        return 'text-yellow-500';
      case 'low':
        return 'text-blue-500';
      default:
        return 'text-gray-500';
    }
  };

  if (loading) {
    return (
      <View className='flex-1 justify-center items-center'>
        <Text className='text-lg dark:text-white'>Loading inventory tracking...</Text>
      </View>
    );
  }

  return (
    <ScrollView className='flex-1 bg-gray-100 dark:bg-gray-900'>
      {/* Search Bar */}
      <View className='bg-white dark:bg-gray-800 m-4 p-4 rounded-lg'>
        <TextInput
          className='bg-gray-100 dark:bg-gray-700 p-2 rounded-lg'
          placeholder='Search inventory...'
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor='#666'
        />
      </View>

      {/* Alerts */}
      <View className='bg-white dark:bg-gray-800 m-4 p-4 rounded-lg'>
        <Text className='text-xl font-bold mb-4 dark:text-white'>Active Alerts</Text>
        {alerts.map((alert) => (
          <View key={alert.uri} className='mb-4 border-b border-gray-200 pb-4'>
            <View className='flex-row justify-between'>
              <Text className='font-semibold dark:text-white'>
                {alert.type
                  .split('_')
                  .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                  .join(' ')}
              </Text>
              <Text className={getAlertSeverityColor(alert.severity)}>
                {alert.severity.toUpperCase()}
              </Text>
            </View>
            <Text className='text-gray-600 dark:text-gray-400 mt-1'>{alert.message}</Text>
            {alert.recommendation && (
              <Text className='text-blue-500 mt-1'>Recommendation: {alert.recommendation}</Text>
            )}
          </View>
        ))}
      </View>

      {/* Inventory Overview */}
      <View className='bg-white dark:bg-gray-800 m-4 p-4 rounded-lg'>
        <Text className='text-xl font-bold mb-4 dark:text-white'>Inventory Overview</Text>
        {snapshots
          .filter((snapshot) =>
            snapshot.productId.toLowerCase().includes(searchQuery.toLowerCase())
          )
          .map((snapshot) => (
            <TouchableOpacity
              key={snapshot.uri}
              onPress={() =>
                setSelectedProduct(
                  selectedProduct === snapshot.productId ? null : snapshot.productId
                )
              }
              className='mb-4 border-b border-gray-200 pb-4'
            >
              <View className='flex-row justify-between'>
                <Text className='font-semibold dark:text-white'>Product #{snapshot.productId}</Text>
                <Text
                  className={`${
                    snapshot.quantity <= snapshot.lowStockThreshold
                      ? 'text-red-500'
                      : 'text-green-500'
                  }`}
                >
                  {snapshot.quantity} units
                </Text>
              </View>

              <Text className='text-gray-600 dark:text-gray-400'>
                Value: ${snapshot.value.toLocaleString()}
              </Text>

              {selectedProduct === snapshot.productId && (
                <View className='mt-4'>
                  {/* Stock Level Details */}
                  <View className='bg-gray-50 dark:bg-gray-700 p-4 rounded-lg mb-4'>
                    <Text className='font-semibold mb-2 dark:text-white'>Stock Levels</Text>
                    <View className='flex-row justify-between mb-2'>
                      <Text className='text-gray-600 dark:text-gray-400'>Low Stock Threshold:</Text>
                      <Text className='dark:text-white'>{snapshot.lowStockThreshold} units</Text>
                    </View>
                    <View className='flex-row justify-between mb-2'>
                      <Text className='text-gray-600 dark:text-gray-400'>Reorder Point:</Text>
                      <Text className='dark:text-white'>{snapshot.reorderPoint} units</Text>
                    </View>
                    <View className='flex-row justify-between'>
                      <Text className='text-gray-600 dark:text-gray-400'>Reorder Quantity:</Text>
                      <Text className='dark:text-white'>{snapshot.reorderQuantity} units</Text>
                    </View>
                  </View>

                  {/* Forecast */}
                  {forecasts[snapshot.productId] && (
                    <View className='bg-gray-50 dark:bg-gray-700 p-4 rounded-lg mb-4'>
                      <Text className='font-semibold mb-2 dark:text-white'>Demand Forecast</Text>
                      <LineChart
                        data={{
                          labels: forecasts[snapshot.productId].predictions
                            .slice(0, 7)
                            .map((p) => format(new Date(p.date), 'MM/dd')),
                          datasets: [
                            {
                              data: forecasts[snapshot.productId].predictions
                                .slice(0, 7)
                                .map((p) => p.expectedDemand),
                            },
                          ],
                        }}
                        width={300}
                        height={200}
                        chartConfig={{
                          backgroundColor: '#ffffff',
                          backgroundGradientFrom: '#ffffff',
                          backgroundGradientTo: '#ffffff',
                          decimalPlaces: 0,
                          color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
                        }}
                        bezier
                        style={{
                          marginVertical: 8,
                          borderRadius: 16,
                        }}
                      />

                      {/* Trends */}
                      <View className='mt-4'>
                        <Text className='font-semibold mb-2 dark:text-white'>Trends</Text>
                        {forecasts[snapshot.productId].trends.map((trend, index) => (
                          <Text key={index} className='text-gray-600 dark:text-gray-400'>
                            {trend.description} (Impact: {(trend.impact * 100).toFixed(1)}%)
                          </Text>
                        ))}
                      </View>
                    </View>
                  )}
                </View>
              )}
            </TouchableOpacity>
          ))}
      </View>

      {/* Analytics */}
      {analytics && (
        <View className='bg-white dark:bg-gray-800 m-4 p-4 rounded-lg'>
          <Text className='text-xl font-bold mb-4 dark:text-white'>Analytics</Text>
          <View className='flex-row flex-wrap'>
            <View className='w-1/2 p-2'>
              <Text className='text-gray-600 dark:text-gray-400'>Turnover Rate</Text>
              <Text className='text-2xl font-bold dark:text-white'>
                {(analytics.turnoverRate * 100).toFixed(1)}%
              </Text>
            </View>
            <View className='w-1/2 p-2'>
              <Text className='text-gray-600 dark:text-gray-400'>Stockout Rate</Text>
              <Text className='text-2xl font-bold dark:text-white'>
                {(analytics.stockoutRate * 100).toFixed(1)}%
              </Text>
            </View>
            <View className='w-1/2 p-2'>
              <Text className='text-gray-600 dark:text-gray-400'>Forecast Accuracy</Text>
              <Text className='text-2xl font-bold dark:text-white'>
                {(analytics.accuracyRate * 100).toFixed(1)}%
              </Text>
            </View>
          </View>

          {/* Value by Product */}
          <View className='mt-4'>
            <Text className='font-semibold mb-2 dark:text-white'>Inventory Value by Product</Text>
            <BarChart
              data={{
                labels: Object.keys(analytics.valueByProduct).slice(0, 5),
                datasets: [
                  {
                    data: Object.values(analytics.valueByProduct).slice(0, 5),
                  },
                ],
              }}
              width={300}
              height={200}
              chartConfig={{
                backgroundColor: '#ffffff',
                backgroundGradientFrom: '#ffffff',
                backgroundGradientTo: '#ffffff',
                decimalPlaces: 0,
                color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
              }}
              style={{
                marginVertical: 8,
                borderRadius: 16,
              }}
            />
          </View>
        </View>
      )}
    </ScrollView>
  );
};
