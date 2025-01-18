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
import { FlashList } from '@shopify/flash-list';
import { PostCard } from './components/PostCard';
import { useATProto } from '../../contexts/ATProtoContext';
import { useInfiniteScroll } from '../../hooks/useInfiniteScroll';

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

  const _fetchFeed = useCallback(
    async (cursor?: string) => {
      if (!agent) {
        throw new Error('Not authenticated');
      }

      const _response = await agent.getTimeline({ cursor, limit: 20 });
      const _posts = response.data.feed.map(item => ({
        uri: item.post.uri,
        cid: item.post.cid,
        author: item.post.author,
        text: item.post.text,
        media: item.post.embed?.images,
        createdAt: item.post.createdAt,
        likes: item.post.likeCount || 0,
        reposts: item.post.repostCount || 0,
      }));

      return {
        data: posts,
        cursor: response.data.cursor,
      };
    },
    [agent]
  );

  const {
    items: posts,
    loading,
    error,
    hasMore,
    lastElementRef,
    refresh,
  } = useInfiniteScroll<Post>({
    fetchData: fetchFeed,
  });

  const _handleError = useCallback((error: Error) => {
    Alert.window.alert('Error', error.message);
  }, []);

  const _renderItem = useCallback(
    ({ item: post }: { item: Post }) => {
      return <PostCard post={post} onError={handleError} />;
    },
    [handleError]
  );

  const _renderFooter = useCallback(() => {
    if (!hasMore) return null;

    return (
      <View style={styles.footer}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }, [hasMore]);

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
          <RefreshControl
            refreshing={loading && posts.length === 0}
            onRefresh={refresh}
          />
        }
      />
    </View>
  );
}

const _styles = StyleSheet.create({
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
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#0000ff',
    borderRadius: 20,
  },
  retryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  footer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
});
