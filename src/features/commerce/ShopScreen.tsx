import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image } from 'react-native';

import { useATProto } from '../../contexts/ATProtoContext';
import { ATProtocolCommerce, Product } from '../../services/atProtocolCommerce';

export const ShopScreen: React.FC = () => {
  const { agent } = useATProto();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const _navigation = useNavigation();
  const _commerce = new ATProtocolCommerce(agent);

  useEffect(() => {
    loadProducts();
  }, []);

  const _loadProducts = async () => {
    try {
      const _result = await commerce.searchProducts('', {
        limit: 20,
      });
      setProducts(result.products);
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setLoading(false);
    }
  };

  const _renderProduct = ({ item }: { item: Product }) => (
    <TouchableOpacity
      className="bg-white dark:bg-gray-800 rounded-lg shadow-md m-2 p-4"
      onPress={() => navigation.navigate('ProductDetails', { product: item })}
    >
      {item.images?.[0] && (
        <Image
          source={{ uri: item.images[0] }}
          className="w-full h-48 rounded-lg mb-2"
          resizeMode="cover"
        />
      )}
      <Text className="text-lg font-semibold dark:text-white">{item.name}</Text>
      <Text className="text-gray-600 dark:text-gray-300 mb-2">
        {item.description}
      </Text>
      <View className="flex-row justify-between items-center">
        <Text className="text-xl font-bold text-blue-600 dark:text-blue-400">
          {item.currency} {item.price.toFixed(2)}
        </Text>
        <TouchableOpacity
          className="bg-blue-500 px-4 py-2 rounded-lg"
          onPress={() => commerce.addToCart(item.uri)}
        >
          <Text className="text-white font-semibold">Add to Cart</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center">
        <Text className="text-lg dark:text-white">Loading products...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-100 dark:bg-gray-900">
      <FlatList
        data={products}
        renderItem={renderProduct}
        keyExtractor={item => item.uri}
        contentContainerClassName="p-2"
      />
      <TouchableOpacity
        className="absolute bottom-4 right-4 bg-blue-500 p-4 rounded-full shadow-lg"
        onPress={() => navigation.navigate('Cart')}
      >
        <Text className="text-white font-semibold">Cart</Text>
      </TouchableOpacity>
    </View>
  );
};
