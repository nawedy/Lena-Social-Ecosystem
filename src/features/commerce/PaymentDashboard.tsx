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
  ATProtocolPayment,
  PaymentMethod,
  Transaction,
  PayoutAccount,
  PaymentAnalytics,
} from '../../services/atProtocolPayment';
import { LineChart, BarChart } from 'react-native-chart-kit';
import { format } from 'date-fns';

export const PaymentDashboard: React.FC = () => {
  const { agent } = useATProto();
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [payoutAccounts, setPayoutAccounts] = useState<PayoutAccount[]>([]);
  const [analytics, setAnalytics] = useState<PaymentAnalytics | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<string | null>(
    null
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const _payment = new ATProtocolPayment(agent);

  useEffect(() => {
    loadData();
  }, []);

  const _loadData = async () => {
    try {
      const [methodsData, transactionsData, payoutAccountsData, analyticsData] =
        await Promise.all([
          // Get payment methods
          agent.api.app.bsky.commerce.listPaymentMethods({}),
          // Get transactions
          agent.api.app.bsky.commerce.listTransactions({
            limit: 50,
          }),
          // Get payout accounts
          agent.api.app.bsky.commerce.listPayoutAccounts({}),
          // Get analytics
          payment.getPaymentAnalytics({
            period: {
              start: format(
                new Date().setDate(new Date().getDate() - 30),
                'yyyy-MM-dd'
              ),
              end: format(new Date(), 'yyyy-MM-dd'),
            },
          }),
        ]);

      setPaymentMethods(methodsData.data.paymentMethods);
      setTransactions(transactionsData.data.transactions);
      setPayoutAccounts(payoutAccountsData.data.payoutAccounts);
      setAnalytics(analyticsData);
      setLoading(false);
    } catch (error) {
      console.error('Error loading payment data:', error);
      setLoading(false);
    }
  };

  const _addPaymentMethod = async (params: {
    type: PaymentMethod['type'];
    provider: string;
    token: string;
  }) => {
    try {
      await payment.addPaymentMethod(params);
      await loadData();
    } catch (error) {
      console.error('Error adding payment method:', error);
    }
  };

  const _createPayoutAccount = async (params: {
    type: PayoutAccount['type'];
    accountDetails: PayoutAccount['accountDetails'];
  }) => {
    try {
      await payment.createPayoutAccount(params);
      await loadData();
    } catch (error) {
      console.error('Error creating payout account:', error);
    }
  };

  const _getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
      case 'active':
      case 'verified':
        return 'text-green-500';
      case 'pending':
        return 'text-yellow-500';
      case 'failed':
      case 'rejected':
      case 'expired':
        return 'text-red-500';
      default:
        return 'text-gray-500';
    }
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center">
        <Text className="text-lg dark:text-white">
          Loading payment dashboard...
        </Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-gray-100 dark:bg-gray-900">
      {/* Search Bar */}
      <View className="bg-white dark:bg-gray-800 m-4 p-4 rounded-lg">
        <TextInput
          className="bg-gray-100 dark:bg-gray-700 p-2 rounded-lg"
          placeholder="Search transactions..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#666"
        />
      </View>

      {/* Analytics Overview */}
      {analytics && (
        <View className="bg-white dark:bg-gray-800 m-4 p-4 rounded-lg">
          <Text className="text-xl font-bold mb-4 dark:text-white">
            Payment Analytics
          </Text>
          <View className="flex-row flex-wrap">
            <View className="w-1/2 p-2">
              <Text className="text-gray-600 dark:text-gray-400">
                Total Volume
              </Text>
              <Text className="text-2xl font-bold dark:text-white">
                ${analytics.metrics.totalVolume.toLocaleString()}
              </Text>
            </View>
            <View className="w-1/2 p-2">
              <Text className="text-gray-600 dark:text-gray-400">
                Success Rate
              </Text>
              <Text className="text-2xl font-bold dark:text-white">
                {(analytics.metrics.successRate * 100).toFixed(1)}%
              </Text>
            </View>
            <View className="w-1/2 p-2">
              <Text className="text-gray-600 dark:text-gray-400">
                Average Amount
              </Text>
              <Text className="text-2xl font-bold dark:text-white">
                ${analytics.metrics.averageAmount.toLocaleString()}
              </Text>
            </View>
            <View className="w-1/2 p-2">
              <Text className="text-gray-600 dark:text-gray-400">
                Refund Rate
              </Text>
              <Text className="text-2xl font-bold dark:text-white">
                {(analytics.metrics.refundRate * 100).toFixed(1)}%
              </Text>
            </View>
          </View>

          {/* Trends */}
          <View className="mt-4">
            <Text className="font-semibold mb-2 dark:text-white">Trends</Text>
            {analytics.trends.map((trend, index) => (
              <Text key={index} className="text-gray-600 dark:text-gray-400">
                {trend.metric}: {trend.change > 0 ? '+' : ''}
                {(trend.change * 100).toFixed(1)}%
                {trend.insight && ` - ${trend.insight}`}
              </Text>
            ))}
          </View>
        </View>
      )}

      {/* Payment Methods */}
      <View className="bg-white dark:bg-gray-800 m-4 p-4 rounded-lg">
        <Text className="text-xl font-bold mb-4 dark:text-white">
          Payment Methods
        </Text>
        {paymentMethods.map(method => (
          <View key={method.uri} className="mb-4 border-b border-gray-200 pb-4">
            <View className="flex-row justify-between">
              <Text className="font-semibold dark:text-white">
                {method.provider} ({method.type})
              </Text>
              <Text className={getStatusColor(method.status)}>
                {method.status}
              </Text>
            </View>
            {method.lastFour && (
              <Text className="text-gray-600 dark:text-gray-400">
                •••• {method.lastFour}
              </Text>
            )}
            {method.expiryDate && (
              <Text className="text-gray-600 dark:text-gray-400">
                Expires: {method.expiryDate}
              </Text>
            )}
          </View>
        ))}

        {/* Add Payment Method Button */}
        <TouchableOpacity
          onPress={() => {
            // Open payment method form
          }}
          className="bg-blue-500 p-2 rounded-lg mt-2"
        >
          <Text className="text-white text-center">Add Payment Method</Text>
        </TouchableOpacity>
      </View>

      {/* Recent Transactions */}
      <View className="bg-white dark:bg-gray-800 m-4 p-4 rounded-lg">
        <Text className="text-xl font-bold mb-4 dark:text-white">
          Recent Transactions
        </Text>
        {transactions
          .filter(
            transaction =>
              transaction.uri
                .toLowerCase()
                .includes(searchQuery.toLowerCase()) ||
              transaction.status
                .toLowerCase()
                .includes(searchQuery.toLowerCase())
          )
          .map(transaction => (
            <TouchableOpacity
              key={transaction.uri}
              onPress={() =>
                setSelectedTransaction(
                  selectedTransaction === transaction.uri
                    ? null
                    : transaction.uri
                )
              }
              className="mb-4 border-b border-gray-200 pb-4"
            >
              <View className="flex-row justify-between">
                <Text className="font-semibold dark:text-white">
                  {transaction.type.charAt(0).toUpperCase() +
                    transaction.type.slice(1)}
                </Text>
                <Text className={getStatusColor(transaction.status)}>
                  {transaction.status}
                </Text>
              </View>

              <View className="flex-row justify-between mt-1">
                <Text className="text-gray-600 dark:text-gray-400">
                  {format(new Date(transaction.createdAt), 'MMM d, yyyy HH:mm')}
                </Text>
                <Text className="font-semibold dark:text-white">
                  {transaction.amount} {transaction.currency}
                </Text>
              </View>

              {selectedTransaction === transaction.uri && (
                <View className="mt-4 bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                  <Text className="text-gray-600 dark:text-gray-400">
                    From: {transaction.fromDid}
                  </Text>
                  <Text className="text-gray-600 dark:text-gray-400">
                    To: {transaction.toDid}
                  </Text>
                  {transaction.reference && (
                    <Text className="text-gray-600 dark:text-gray-400">
                      Reference: {transaction.reference.type} (
                      {transaction.reference.uri})
                    </Text>
                  )}
                  {transaction.metadata && (
                    <View className="mt-2">
                      <Text className="font-semibold dark:text-white">
                        Metadata
                      </Text>
                      {Object.entries(transaction.metadata).map(
                        ([key, value]) => (
                          <Text
                            key={key}
                            className="text-gray-600 dark:text-gray-400"
                          >
                            {key}: {String(value)}
                          </Text>
                        )
                      )}
                    </View>
                  )}
                </View>
              )}
            </TouchableOpacity>
          ))}
      </View>

      {/* Payout Accounts */}
      <View className="bg-white dark:bg-gray-800 m-4 p-4 rounded-lg">
        <Text className="text-xl font-bold mb-4 dark:text-white">
          Payout Accounts
        </Text>
        {payoutAccounts.map(account => (
          <View
            key={account.uri}
            className="mb-4 border-b border-gray-200 pb-4"
          >
            <View className="flex-row justify-between">
              <Text className="font-semibold dark:text-white">
                {account.type === 'bank_account'
                  ? 'Bank Account'
                  : 'Crypto Wallet'}
              </Text>
              <Text className={getStatusColor(account.status)}>
                {account.status}
              </Text>
            </View>

            {account.type === 'bank_account' &&
              account.accountDetails.bankName && (
                <Text className="text-gray-600 dark:text-gray-400">
                  {account.accountDetails.bankName}
                </Text>
              )}

            {account.type === 'crypto_wallet' &&
              account.accountDetails.walletAddress && (
                <Text className="text-gray-600 dark:text-gray-400">
                  {account.accountDetails.walletAddress.substring(0, 10)}...
                </Text>
              )}

            {account.verification &&
              account.verification.status !== 'verified' && (
                <View className="mt-2">
                  <Text className="font-semibold dark:text-white">
                    Verification Status: {account.verification.status}
                  </Text>
                  {account.verification.requiredDocs.length > 0 && (
                    <View>
                      <Text className="text-gray-600 dark:text-gray-400">
                        Required Documents:
                      </Text>
                      {account.verification.requiredDocs.map((doc, index) => (
                        <Text
                          key={index}
                          className="text-gray-600 dark:text-gray-400"
                        >
                          • {doc}
                        </Text>
                      ))}
                    </View>
                  )}
                </View>
              )}
          </View>
        ))}

        {/* Add Payout Account Button */}
        <TouchableOpacity
          onPress={() => {
            // Open payout account form
          }}
          className="bg-blue-500 p-2 rounded-lg mt-2"
        >
          <Text className="text-white text-center">Add Payout Account</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};
