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
  ATProtocolShipping,
  ShipmentLabel,
} from '../../services/atProtocolShipping';
import {
  ATProtocolOrderManagement,
  OrderRoute,
} from '../../services/atProtocolOrderManagement';
import { format } from 'date-fns';

interface ReturnRequest {
  uri: string;
  cid: string;
  orderUri: string;
  reason: string;
  items: Array<{
    id: string;
    quantity: number;
    reason: string;
  }>;
  status:
    | 'pending'
    | 'approved'
    | 'shipped'
    | 'received'
    | 'refunded'
    | 'denied';
  returnLabel?: ShipmentLabel;
  refundAmount?: number;
  createdAt: string;
  updatedAt: string;
}

export const ReturnsManagement: React.FC = () => {
  const { agent } = useATProto();
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [selectedReturn, setSelectedReturn] = useState<ReturnRequest | null>(
    null
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const _shipping = new ATProtocolShipping(agent);
  const _orderManagement = new ATProtocolOrderManagement(agent);

  useEffect(() => {
    loadReturns();
  }, []);

  const _loadReturns = async () => {
    try {
      const _response = await agent.api.app.bsky.commerce.listReturns({
        limit: 50,
      });

      setReturns(response.data.returns);
      setLoading(false);
    } catch (error) {
      console.error('Error loading returns:', error);
      setLoading(false);
    }
  };

  const _approveReturn = async (returnUri: string) => {
    try {
      const _returnRequest = returns.find(r => r.uri === returnUri);
      if (!returnRequest) return;

      // Generate return label
      const _returnLabel = await shipping.createReturnLabel({
        originalShipmentUri: returnRequest.orderUri,
        reason: returnRequest.reason,
        items: returnRequest.items,
      });

      // Update return request status
      await agent.api.app.bsky.commerce.updateReturn({
        return: returnUri,
        status: 'approved',
        returnLabel: returnLabel,
        timestamp: new Date().toISOString(),
      });

      await loadReturns();
    } catch (error) {
      console.error('Error approving return:', error);
    }
  };

  const _processRefund = async (returnUri: string, amount: number) => {
    try {
      await agent.api.app.bsky.commerce.processReturnRefund({
        return: returnUri,
        amount,
        timestamp: new Date().toISOString(),
      });

      await loadReturns();
    } catch (error) {
      console.error('Error processing refund:', error);
    }
  };

  const _denyReturn = async (returnUri: string, reason: string) => {
    try {
      await agent.api.app.bsky.commerce.updateReturn({
        return: returnUri,
        status: 'denied',
        note: reason,
        timestamp: new Date().toISOString(),
      });

      await loadReturns();
    } catch (error) {
      console.error('Error denying return:', error);
    }
  };

  const _getStatusColor = (status: ReturnRequest['status']) => {
    switch (status) {
      case 'pending':
        return 'text-yellow-500';
      case 'approved':
        return 'text-blue-500';
      case 'shipped':
        return 'text-purple-500';
      case 'received':
        return 'text-green-500';
      case 'refunded':
        return 'text-green-700';
      case 'denied':
        return 'text-red-500';
      default:
        return 'text-gray-500';
    }
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center">
        <Text className="text-lg dark:text-white">Loading returns...</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-gray-100 dark:bg-gray-900">
      {/* Search Bar */}
      <View className="bg-white dark:bg-gray-800 m-4 p-4 rounded-lg">
        <TextInput
          className="bg-gray-100 dark:bg-gray-700 p-2 rounded-lg"
          placeholder="Search returns..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#666"
        />
      </View>

      {/* Returns List */}
      <View className="bg-white dark:bg-gray-800 m-4 p-4 rounded-lg">
        <Text className="text-xl font-bold mb-4 dark:text-white">
          Return Requests
        </Text>
        {returns
          .filter(
            ret =>
              ret.uri.toLowerCase().includes(searchQuery.toLowerCase()) ||
              ret.status.toLowerCase().includes(searchQuery.toLowerCase())
          )
          .map(returnRequest => (
            <TouchableOpacity
              key={returnRequest.uri}
              onPress={() =>
                setSelectedReturn(
                  selectedReturn?.uri === returnRequest.uri
                    ? null
                    : returnRequest
                )
              }
              className="mb-4 border-b border-gray-200 pb-4"
            >
              <View className="flex-row justify-between">
                <Text className="font-semibold dark:text-white">
                  Return #{returnRequest.uri.split('/').pop()}
                </Text>
                <Text className={getStatusColor(returnRequest.status)}>
                  {returnRequest.status.charAt(0).toUpperCase() +
                    returnRequest.status.slice(1)}
                </Text>
              </View>

              <Text className="text-gray-600 dark:text-gray-400">
                Order: #{returnRequest.orderUri.split('/').pop()}
              </Text>
              <Text className="text-gray-600 dark:text-gray-400">
                Items:{' '}
                {returnRequest.items.reduce(
                  (sum, item) => sum + item.quantity,
                  0
                )}
              </Text>
              <Text className="text-gray-600 dark:text-gray-400">
                Created:{' '}
                {format(new Date(returnRequest.createdAt), 'MMM d, yyyy')}
              </Text>

              {selectedReturn?.uri === returnRequest.uri && (
                <View className="mt-4">
                  {/* Return Details */}
                  <View className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg mb-4">
                    <Text className="font-semibold mb-2 dark:text-white">
                      Return Reason
                    </Text>
                    <Text className="text-gray-600 dark:text-gray-400">
                      {returnRequest.reason}
                    </Text>

                    <Text className="font-semibold mt-4 mb-2 dark:text-white">
                      Items
                    </Text>
                    {returnRequest.items.map((item, index) => (
                      <View key={index} className="mb-2">
                        <Text className="text-gray-600 dark:text-gray-400">
                          Item #{item.id} - Qty: {item.quantity}
                        </Text>
                        <Text className="text-gray-600 dark:text-gray-400">
                          Reason: {item.reason}
                        </Text>
                      </View>
                    ))}

                    {returnRequest.returnLabel && (
                      <View className="mt-4">
                        <Text className="font-semibold mb-2 dark:text-white">
                          Return Shipping Label
                        </Text>
                        <Text className="text-gray-600 dark:text-gray-400">
                          Tracking: {returnRequest.returnLabel.trackingNumber}
                        </Text>
                        <TouchableOpacity
                          onPress={() => {
                            /* Open label URL */
                          }}
                          className="mt-2"
                        >
                          <Text className="text-blue-500">View Label</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>

                  {/* Action Buttons */}
                  {returnRequest.status === 'pending' && (
                    <View className="flex-row flex-wrap">
                      <TouchableOpacity
                        className="bg-green-500 rounded-lg p-2 m-1 flex-1"
                        onPress={() => approveReturn(returnRequest.uri)}
                      >
                        <Text className="text-white text-center">
                          Approve Return
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        className="bg-red-500 rounded-lg p-2 m-1 flex-1"
                        onPress={() =>
                          denyReturn(
                            returnRequest.uri,
                            'Not eligible for return'
                          )
                        }
                      >
                        <Text className="text-white text-center">
                          Deny Return
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {returnRequest.status === 'received' && (
                    <TouchableOpacity
                      className="bg-blue-500 rounded-lg p-2 mt-2"
                      onPress={() => processRefund(returnRequest.uri, 100)} // Amount should be calculated
                    >
                      <Text className="text-white text-center">
                        Process Refund
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </TouchableOpacity>
          ))}
      </View>

      {/* Return Statistics */}
      <View className="bg-white dark:bg-gray-800 m-4 p-4 rounded-lg">
        <Text className="text-xl font-bold mb-4 dark:text-white">
          Return Statistics
        </Text>
        <View className="flex-row flex-wrap">
          <View className="w-1/2 p-2">
            <Text className="text-gray-600 dark:text-gray-400">
              Pending Returns
            </Text>
            <Text className="text-2xl font-bold dark:text-white">
              {returns.filter(r => r.status === 'pending').length}
            </Text>
          </View>
          <View className="w-1/2 p-2">
            <Text className="text-gray-600 dark:text-gray-400">Processing</Text>
            <Text className="text-2xl font-bold dark:text-white">
              {
                returns.filter(r => ['approved', 'shipped'].includes(r.status))
                  .length
              }
            </Text>
          </View>
          <View className="w-1/2 p-2">
            <Text className="text-gray-600 dark:text-gray-400">Completed</Text>
            <Text className="text-2xl font-bold dark:text-white">
              {returns.filter(r => r.status === 'refunded').length}
            </Text>
          </View>
          <View className="w-1/2 p-2">
            <Text className="text-gray-600 dark:text-gray-400">Denied</Text>
            <Text className="text-2xl font-bold dark:text-white">
              {returns.filter(r => r.status === 'denied').length}
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
};
