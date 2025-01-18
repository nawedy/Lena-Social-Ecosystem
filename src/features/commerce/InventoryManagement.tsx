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
  Supplier,
} from '../../services/atProtocolOrderManagement';
import { BarChart } from 'react-native-chart-kit';

interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  reorderPoint: number;
  location: string;
  lastUpdated: string;
}

interface InventoryMovement {
  type: 'in' | 'out';
  quantity: number;
  reason: string;
  timestamp: string;
}

export const InventoryManagement: React.FC = () => {
  const { agent } = useATProto();
  const [inventory, setInventory] = useState<Record<string, InventoryItem>>({});
  const [movements, setMovements] = useState<
    Record<string, InventoryMovement[]>
  >({});
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const _orderManagement = new ATProtocolOrderManagement(agent);

  useEffect(() => {
    loadInventory();
  }, []);

  const _loadInventory = async () => {
    try {
      const _supplier = await orderManagement.getSupplier(
        agent.session?.did ?? ''
      );
      const inventoryData: Record<string, InventoryItem> = {};

      supplier.fulfillmentCenters.forEach(center => {
        Object.entries(center.inventory).forEach(([id, quantity]) => {
          if (!inventoryData[id]) {
            inventoryData[id] = {
              id,
              name: id, // You would typically get this from a product catalog
              sku: id,
              quantity,
              reorderPoint: 10, // This should come from your inventory settings
              location: `${center.location.city}, ${center.location.region}`,
              lastUpdated: new Date().toISOString(),
            };
          } else {
            inventoryData[id].quantity += quantity;
          }
        });
      });

      setInventory(inventoryData);
      await loadMovements(Object.keys(inventoryData));
      setLoading(false);
    } catch (error) {
      console.error('Error loading inventory:', error);
      setLoading(false);
    }
  };

  const _loadMovements = async (itemIds: string[]) => {
    try {
      const movementData: Record<string, InventoryMovement[]> = {};

      // Get movements from AT Protocol records
      const _records = await agent.api.com.atproto.repo.listRecords({
        repo: agent.session?.did ?? '',
        collection: 'app.bsky.commerce.inventoryMovement',
      });

      records.data.records.forEach(record => {
        const _movement = record.value as any;
        if (!movementData[movement.itemId]) {
          movementData[movement.itemId] = [];
        }
        movementData[movement.itemId].push({
          type: movement.type,
          quantity: movement.quantity,
          reason: movement.reason,
          timestamp: movement.timestamp,
        });
      });

      setMovements(movementData);
    } catch (error) {
      console.error('Error loading movements:', error);
    }
  };

  const _updateInventory = async (
    itemId: string,
    adjustment: number,
    reason: string
  ) => {
    try {
      const _movement = {
        $type: 'app.bsky.commerce.inventoryMovement',
        itemId,
        type: adjustment > 0 ? 'in' : 'out',
        quantity: Math.abs(adjustment),
        reason,
        timestamp: new Date().toISOString(),
      };

      await agent.api.com.atproto.repo.createRecord({
        repo: agent.session?.did ?? '',
        collection: 'app.bsky.commerce.inventoryMovement',
        record: movement,
      });

      setInventory(prev => ({
        ...prev,
        [itemId]: {
          ...prev[itemId],
          quantity: prev[itemId].quantity + adjustment,
          lastUpdated: new Date().toISOString(),
        },
      }));

      await loadMovements([itemId]);
    } catch (error) {
      console.error('Error updating inventory:', error);
    }
  };

  const _filteredInventory = Object.values(inventory).filter(
    item =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.location.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center">
        <Text className="text-lg dark:text-white">Loading inventory...</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-gray-100 dark:bg-gray-900">
      {/* Search Bar */}
      <View className="bg-white dark:bg-gray-800 m-4 p-4 rounded-lg">
        <TextInput
          className="bg-gray-100 dark:bg-gray-700 p-2 rounded-lg"
          placeholder="Search inventory..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#666"
        />
      </View>

      {/* Inventory Overview */}
      <View className="bg-white dark:bg-gray-800 m-4 p-4 rounded-lg">
        <Text className="text-xl font-bold mb-4 dark:text-white">
          Inventory Overview
        </Text>
        {filteredInventory.map(item => (
          <TouchableOpacity
            key={item.id}
            onPress={() =>
              setSelectedItem(selectedItem === item.id ? null : item.id)
            }
            className="mb-4 border-b border-gray-200 pb-4"
          >
            <View className="flex-row justify-between">
              <Text className="font-semibold dark:text-white">{item.name}</Text>
              <Text
                className={`${
                  item.quantity <= item.reorderPoint
                    ? 'text-red-500'
                    : 'text-green-500'
                }`}
              >
                {item.quantity} units
              </Text>
            </View>

            <Text className="text-gray-600 dark:text-gray-400">
              SKU: {item.sku}
            </Text>
            <Text className="text-gray-600 dark:text-gray-400">
              Location: {item.location}
            </Text>

            {selectedItem === item.id && (
              <View className="mt-4">
                {/* Inventory Actions */}
                <View className="flex-row space-x-2 mb-4">
                  <TouchableOpacity
                    className="bg-green-500 rounded-lg p-2 flex-1"
                    onPress={() =>
                      updateInventory(item.id, 1, 'Manual adjustment')
                    }
                  >
                    <Text className="text-white text-center">Add Stock</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="bg-red-500 rounded-lg p-2 flex-1"
                    onPress={() =>
                      updateInventory(item.id, -1, 'Manual adjustment')
                    }
                  >
                    <Text className="text-white text-center">Remove Stock</Text>
                  </TouchableOpacity>
                </View>

                {/* Movement History */}
                {movements[item.id]?.length > 0 && (
                  <View>
                    <Text className="font-semibold mb-2 dark:text-white">
                      Movement History
                    </Text>
                    {movements[item.id]
                      .sort(
                        (a, b) =>
                          new Date(b.timestamp).getTime() -
                          new Date(a.timestamp).getTime()
                      )
                      .slice(0, 5)
                      .map((movement, index) => (
                        <View key={index} className="mb-2">
                          <Text
                            className={`${
                              movement.type === 'in'
                                ? 'text-green-500'
                                : 'text-red-500'
                            }`}
                          >
                            {movement.type === 'in' ? '+' : '-'}
                            {movement.quantity} units
                          </Text>
                          <Text className="text-gray-600 dark:text-gray-400">
                            {movement.reason}
                          </Text>
                          <Text className="text-gray-500 text-sm">
                            {new Date(movement.timestamp).toLocaleString()}
                          </Text>
                        </View>
                      ))}
                  </View>
                )}
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Low Stock Alerts */}
      <View className="bg-white dark:bg-gray-800 m-4 p-4 rounded-lg">
        <Text className="text-xl font-bold mb-4 dark:text-white">
          Low Stock Alerts
        </Text>
        {Object.values(inventory)
          .filter(item => item.quantity <= item.reorderPoint)
          .map(item => (
            <View key={item.id} className="mb-4 border-b border-gray-200 pb-4">
              <Text className="font-semibold text-red-500">{item.name}</Text>
              <Text className="text-gray-600 dark:text-gray-400">
                Current Stock: {item.quantity} units
              </Text>
              <Text className="text-gray-600 dark:text-gray-400">
                Reorder Point: {item.reorderPoint} units
              </Text>
              <TouchableOpacity
                className="bg-blue-500 rounded-lg p-2 mt-2"
                onPress={() => {
                  /* Implement reorder functionality */
                }}
              >
                <Text className="text-white text-center">Reorder Stock</Text>
              </TouchableOpacity>
            </View>
          ))}
      </View>
    </ScrollView>
  );
};
