import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { useATProto } from '../../contexts/ATProtoContext';
import {
  ATProtocolOrderManagement,
  OrderRoute,
} from '../../services/atProtocolOrderManagement';
import { format } from 'date-fns';
import { Timeline } from '../../components/shared/Timeline';

interface OrderStatus {
  status: string;
  description: string;
  timestamp: string;
  location?: string;
}

export const OrderTrackingDashboard: React.FC = () => {
  const { agent } = useATProto();
  const [orders, setOrders] = useState<OrderRoute[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<OrderRoute | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const _orderManagement = new ATProtocolOrderManagement(agent);

  useEffect(() => {
    loadOrders();
  }, []);

  const _loadOrders = async () => {
    try {
      const _response = await orderManagement.getOrders();
      setOrders(response);
      setLoading(false);
    } catch (error) {
      console.error('Error loading orders:', error);
      setLoading(false);
    }
  };

  const _updateOrderStatus = async (
    orderUri: string,
    status: string,
    note?: string
  ) => {
    try {
      await orderManagement.updateOrderStatus(orderUri, status, note);
      await loadOrders();
    } catch (error) {
      console.error('Error updating order status:', error);
    }
  };

  const _filteredOrders = orders.filter(
    order =>
      order.uri.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.status.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const _getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return 'text-yellow-500';
      case 'processing':
        return 'text-blue-500';
      case 'shipped':
        return 'text-green-500';
      case 'delivered':
        return 'text-green-700';
      case 'cancelled':
        return 'text-red-500';
      default:
        return 'text-gray-500';
    }
  };

  const _renderTimeline = (order: OrderRoute) => {
    const timelineItems: OrderStatus[] = order.timeline.map(item => ({
      status: item.status,
      description: item.note || `Order ${item.status}`,
      timestamp: item.timestamp,
    }));

    if (order.tracking) {
      timelineItems.push(
        ...order.tracking.updates.map(update => ({
          status: update.status,
          description: `Package ${update.status}`,
          timestamp: update.timestamp,
          location: update.location,
        }))
      );
    }

    return timelineItems.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center">
        <Text className="text-lg dark:text-white">Loading orders...</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-gray-100 dark:bg-gray-900">
      {/* Search Bar */}
      <View className="bg-white dark:bg-gray-800 m-4 p-4 rounded-lg">
        <TextInput
          className="bg-gray-100 dark:bg-gray-700 p-2 rounded-lg"
          placeholder="Search orders..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#666"
        />
      </View>

      {/* Order List */}
      <View className="bg-white dark:bg-gray-800 m-4 p-4 rounded-lg">
        <Text className="text-xl font-bold mb-4 dark:text-white">Orders</Text>
        {filteredOrders.map(order => (
          <TouchableOpacity
            key={order.uri}
            onPress={() =>
              setSelectedOrder(selectedOrder?.uri === order.uri ? null : order)
            }
            className="mb-4 border-b border-gray-200 pb-4"
          >
            <View className="flex-row justify-between">
              <Text className="font-semibold dark:text-white">
                Order #{order.uri.split('/').pop()}
              </Text>
              <Text className={getStatusColor(order.status)}>
                {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
              </Text>
            </View>

            <Text className="text-gray-600 dark:text-gray-400 mt-1">
              Created: {format(new Date(order.createdAt), 'MMM d, yyyy h:mm a')}
            </Text>

            <Text className="text-gray-600 dark:text-gray-400">
              Items: {order.items.length} | Total: $
              {order.items
                .reduce((sum, item) => sum + item.price, 0)
                .toLocaleString()}
            </Text>

            {selectedOrder?.uri === order.uri && (
              <View className="mt-4">
                {/* Order Details */}
                <View className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg mb-4">
                  <Text className="font-semibold mb-2 dark:text-white">
                    Shipping Details
                  </Text>
                  <Text className="text-gray-600 dark:text-gray-400">
                    {order.shipping.address}
                  </Text>
                  <Text className="text-gray-600 dark:text-gray-400">
                    Method: {order.shipping.method}
                  </Text>
                  <Text className="text-gray-600 dark:text-gray-400">
                    Est. Delivery: {order.shipping.estimatedDays} days
                  </Text>
                </View>

                {/* Tracking Information */}
                {order.tracking && (
                  <View className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg mb-4">
                    <Text className="font-semibold mb-2 dark:text-white">
                      Tracking Info
                    </Text>
                    <Text className="text-gray-600 dark:text-gray-400">
                      Carrier: {order.tracking.carrier}
                    </Text>
                    <Text className="text-gray-600 dark:text-gray-400">
                      Number: {order.tracking.number}
                    </Text>
                    <TouchableOpacity
                      onPress={() => {
                        /* Open tracking URL */
                      }}
                      className="mt-2"
                    >
                      <Text className="text-blue-500">Track Package</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Timeline */}
                <View className="mt-4">
                  <Text className="font-semibold mb-2 dark:text-white">
                    Order Timeline
                  </Text>
                  <Timeline items={renderTimeline(order)} />
                </View>

                {/* Action Buttons */}
                <View className="flex-row flex-wrap mt-4">
                  {order.status === 'pending' && (
                    <TouchableOpacity
                      className="bg-blue-500 rounded-lg p-2 m-1 flex-1"
                      onPress={() => updateOrderStatus(order.uri, 'processing')}
                    >
                      <Text className="text-white text-center">
                        Process Order
                      </Text>
                    </TouchableOpacity>
                  )}
                  {order.status === 'processing' && (
                    <TouchableOpacity
                      className="bg-green-500 rounded-lg p-2 m-1 flex-1"
                      onPress={() => updateOrderStatus(order.uri, 'shipped')}
                    >
                      <Text className="text-white text-center">
                        Mark as Shipped
                      </Text>
                    </TouchableOpacity>
                  )}
                  {['pending', 'processing'].includes(order.status) && (
                    <TouchableOpacity
                      className="bg-red-500 rounded-lg p-2 m-1 flex-1"
                      onPress={() => updateOrderStatus(order.uri, 'cancelled')}
                    >
                      <Text className="text-white text-center">
                        Cancel Order
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
};
