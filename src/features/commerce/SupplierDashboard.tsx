import { format } from 'date-fns';
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { LineChart, BarChart } from 'react-native-chart-kit';

import { useATProto } from '../../contexts/ATProtoContext';
import {
  ATProtocolOrderManagement,
  Supplier,
  OrderRoute,
} from '../../services/atProtocolOrderManagement';

export const SupplierDashboard: React.FC = () => {
  const { agent } = useATProto();
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [orders, setOrders] = useState<OrderRoute[]>([]);
  const [performance, setPerformance] = useState<{
    revenue: number;
    orders: number;
    fulfillmentRate: number;
    averageShippingDays: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const _orderManagement = new ATProtocolOrderManagement(agent);

  useEffect(() => {
    loadData();
  }, []);

  const _loadData = async () => {
    try {
      const [supplierData, ordersData, analyticsData] = await Promise.all([
        orderManagement.getSupplier(agent.session?.did ?? ''),
        orderManagement.getSupplierOrders(agent.session?.did ?? ''),
        orderManagement.getOrderAnalytics({
          timeframe: {
            start: format(
              new Date().setDate(new Date().getDate() - 30),
              'yyyy-MM-dd'
            ),
            end: format(new Date(), 'yyyy-MM-dd'),
          },
          supplier: agent.session?.did,
        }),
      ]);

      setSupplier(supplierData);
      setOrders(ordersData);
      setPerformance({
        revenue: analyticsData.totalRevenue,
        orders: analyticsData.totalOrders,
        fulfillmentRate: supplierData.performance.fulfillmentRate,
        averageShippingDays: supplierData.performance.averageShippingDays,
      });
    } catch (error) {
      console.error('Error loading supplier data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !supplier || !performance) {
    return (
      <View className="flex-1 justify-center items-center">
        <Text className="text-lg dark:text-white">
          Loading supplier dashboard...
        </Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-gray-100 dark:bg-gray-900">
      {/* Performance Overview */}
      <View className="bg-white dark:bg-gray-800 m-4 p-4 rounded-lg">
        <Text className="text-xl font-bold mb-4 dark:text-white">
          Performance Overview
        </Text>
        <View className="flex-row flex-wrap">
          <View className="w-1/2 p-2">
            <Text className="text-gray-600 dark:text-gray-400">Revenue</Text>
            <Text className="text-2xl font-bold dark:text-white">
              ${performance.revenue.toLocaleString()}
            </Text>
          </View>
          <View className="w-1/2 p-2">
            <Text className="text-gray-600 dark:text-gray-400">Orders</Text>
            <Text className="text-2xl font-bold dark:text-white">
              {performance.orders}
            </Text>
          </View>
          <View className="w-1/2 p-2">
            <Text className="text-gray-600 dark:text-gray-400">
              Fulfillment Rate
            </Text>
            <Text className="text-2xl font-bold dark:text-white">
              {(performance.fulfillmentRate * 100).toFixed(1)}%
            </Text>
          </View>
          <View className="w-1/2 p-2">
            <Text className="text-gray-600 dark:text-gray-400">
              Avg. Shipping Days
            </Text>
            <Text className="text-2xl font-bold dark:text-white">
              {performance.averageShippingDays.toFixed(1)}
            </Text>
          </View>
        </View>
      </View>

      {/* Inventory Management */}
      <View className="bg-white dark:bg-gray-800 m-4 p-4 rounded-lg">
        <Text className="text-xl font-bold mb-4 dark:text-white">
          Inventory Management
        </Text>
        {supplier.fulfillmentCenters.map(center => (
          <View key={center.id} className="mb-4">
            <Text className="font-semibold mb-2 dark:text-white">
              {center.location.city}, {center.location.region}
            </Text>
            <View className="space-y-2">
              {Object.entries(center.inventory).map(([productId, quantity]) => (
                <View
                  key={productId}
                  className="flex-row justify-between items-center"
                >
                  <Text className="dark:text-white">{productId}</Text>
                  <Text
                    className={`${quantity < 10 ? 'text-red-500' : 'dark:text-white'}`}
                  >
                    {quantity} units
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ))}
      </View>

      {/* Recent Orders */}
      <View className="bg-white dark:bg-gray-800 m-4 p-4 rounded-lg">
        <Text className="text-xl font-bold mb-4 dark:text-white">
          Recent Orders
        </Text>
        {orders.slice(0, 5).map(order => (
          <View key={order.uri} className="mb-4 border-b border-gray-200 pb-4">
            <View className="flex-row justify-between">
              <Text className="font-semibold dark:text-white">
                Order #{order.uri.split('/').pop()}
              </Text>
              <Text
                className={`${
                  order.status === 'pending'
                    ? 'text-yellow-500'
                    : order.status === 'processing'
                      ? 'text-blue-500'
                      : order.status === 'shipped'
                        ? 'text-green-500'
                        : 'text-gray-500'
                }`}
              >
                {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
              </Text>
            </View>
            <Text className="text-gray-600 dark:text-gray-400 mt-1">
              {format(new Date(order.createdAt), 'MMM d, yyyy h:mm a')}
            </Text>
            <Text className="text-gray-600 dark:text-gray-400 mt-1">
              {order.items.length} items - $
              {order.items
                .reduce((sum, item) => sum + item.price, 0)
                .toLocaleString()}
            </Text>
          </View>
        ))}
      </View>

      {/* Quick Actions */}
      <View className="flex-row flex-wrap p-4">
        <TouchableOpacity
          className="w-1/2 p-2"
          onPress={() => {
            /* Navigate to inventory management */
          }}
        >
          <View className="bg-blue-500 rounded-lg p-4">
            <Text className="text-white font-semibold">Update Inventory</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          className="w-1/2 p-2"
          onPress={() => {
            /* Navigate to shipping settings */
          }}
        >
          <View className="bg-blue-500 rounded-lg p-4">
            <Text className="text-white font-semibold">Shipping Settings</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          className="w-1/2 p-2"
          onPress={() => {
            /* Navigate to order processing */
          }}
        >
          <View className="bg-blue-500 rounded-lg p-4">
            <Text className="text-white font-semibold">Process Orders</Text>
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
