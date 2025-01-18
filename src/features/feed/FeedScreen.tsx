import { FlashList } from '@shopify/flash-list';
import React, { useCallback } from 'react';
import {
  View,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Text,
  TouchableOpacity,
} from 'react-native';


import { useATProto } from '../../contexts/ATProtoContext';
import { useInfiniteScroll } from '../../hooks/useInfiniteScroll';

import { PostCard } from './components/PostCard';

interface Post {
  uri: string;
  cid: string;
  author: {
    did: string;
    handle: string;
    displayName?: string;
    avatar?: string;
  };
  text: string;
  media?: {
    type: 'image' | 'video';
    url: string;
    alt?: string;
  }[];
  createdAt: string;
  likes: number;
  reposts: number;
}

export function FeedScreen() {
  const { agent } = useATProto();

  const fetchFeed = useCallback(
    async (cursor?: string) => {
      if (!agent) {
        throw new Error('Not authenticated');
      }

      try {
        const response = await agent.getTimeline({ cursor, limit: 20 });
        const posts = response.data.feed.map((item) => ({
          uri: item.post.uri,
          cid: item.post.cid,
          author: item.post.author,
          text: item.post.text,
          media: item.post.embed?.images,
          createdAt: item.post.indexedAt,
          likes: item.post.likeCount || 0,
          reposts: item.post.repostCount || 0,
        }));

        return {
          data: posts,
          cursor: response.data.cursor,
        };
      } catch (error) {
        console.error('Error fetching feed:', error);
        throw error;
      }
    },
    [agent]
  );

  const handleError = useCallback((error: Error) => {
    Alert.alert('Error', error.message);
  }, []);

  const {
    data: posts,
    loading,
    error,
    lastElementRef,
    refresh,
  } = useInfiniteScroll<Post>({
    fetchData: fetchFeed,
  });

  const renderItem = useCallback(
    ({ item: post }: { item: Post }) => {
      return <PostCard post={post} onError={handleError} />;
    },
    [handleError]
  );

  const renderFooter = useCallback(() => {
    if (!loading) return null;

    return (
      <View style={styles.footer}>
        <ActivityIndicator size='large' color='#0000ff' />
      </View>
    );
  }, [loading]);

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{error.message}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={refresh}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlashList
        data={posts}
        renderItem={renderItem}
        estimatedItemSize={200}
        onEndReachedThreshold={0.5}
        onEndReached={lastElementRef}
        ListFooterComponent={renderFooter}
        refreshControl={
          <RefreshControl refreshing={loading && posts.length === 0} onRefresh={refresh} />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#ff3b30',
    marginBottom: 16,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    padding: 16,
  },
});
