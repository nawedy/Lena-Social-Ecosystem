import { LinearGradient } from 'expo-linear-gradient';
import { debounce } from 'lodash';
import React, { useState, useCallback } from 'react';
import {
  View,
  TextInput,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
} from 'react-native';

interface SearchResult {
  id: string;
  type: 'user' | 'post' | 'tag';
  title: string;
  subtitle?: string;
}

interface SearchScreenProps {
  navigation: any;
}

export const SearchScreen: React.FC<SearchScreenProps> = ({ navigation }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  const _performSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    try {
      setLoading(true);
      // TODO: Implement actual search logic
      const mockResults: SearchResult[] = [
        {
          id: '1',
          type: 'user',
          title: 'John Doe',
          subtitle: '@johndoe',
        },
        {
          id: '2',
          type: 'post',
          title: 'Amazing post about...',
          subtitle: 'Posted 2 hours ago',
        },
        {
          id: '3',
          type: 'tag',
          title: '#trending',
          subtitle: '1.2M posts',
        },
      ];
      setResults(mockResults);
    } catch (error) {
      console.error('Error performing search:', error);
    } finally {
      setLoading(false);
    }
  };

  const _debouncedSearch = useCallback(
    debounce((text: string) => performSearch(text), 300),
    []
  );

  const _handleSearch = (text: string) => {
    setQuery(text);
    debouncedSearch(text);
  };

  const _handleResultPress = (result: SearchResult) => {
    switch (result.type) {
      case 'user':
        navigation.navigate('Profile', { userId: result.id });
        break;
      case 'post':
        navigation.navigate('Post', { postId: result.id });
        break;
      case 'tag':
        navigation.navigate('TagPosts', { tag: result.title });
        break;
    }
  };

  const _renderSearchResult = ({ item }: { item: SearchResult }) => (
    <TouchableOpacity
      style={styles.resultItem}
      onPress={() => handleResultPress(item)}
    >
      <LinearGradient colors={['#fff', '#f8f8f8']} style={styles.gradient}>
        <View>
          <Text style={styles.resultTitle}>{item.title}</Text>
          {item.subtitle && (
            <Text style={styles.resultSubtitle}>{item.subtitle}</Text>
          )}
        </View>
        <View style={styles.resultType}>
          <Text style={styles.resultTypeText}>{item.type}</Text>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search users, posts, or tags..."
          value={query}
          onChangeText={handleSearch}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <Text>Searching...</Text>
        </View>
      ) : (
        <FlatList
          data={results}
          renderItem={renderSearchResult}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.resultsList}
          ListEmptyComponent={
            query ? (
              <View style={styles.centered}>
                <Text>No results found</Text>
              </View>
            ) : (
              <View style={styles.centered}>
                <Text>Start typing to search</Text>
              </View>
            )
          }
        />
      )}
    </View>
  );
};

const _styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  searchContainer: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  searchInput: {
    height: 40,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 15,
    fontSize: 16,
  },
  resultsList: {
    padding: 10,
  },
  resultItem: {
    marginBottom: 10,
    borderRadius: 10,
    overflow: 'hidden',
  },
  gradient: {
    padding: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  resultSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  resultType: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
  },
  resultTypeText: {
    fontSize: 12,
    color: '#666',
    textTransform: 'capitalize',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
});
