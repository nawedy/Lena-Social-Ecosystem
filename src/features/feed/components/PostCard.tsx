import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { formatDistanceToNow } from 'date-fns';
import { ApiService } from '../../../services/api';
import { useATProto } from '../../../contexts/ATProtoContext';
import FastImage from 'react-native-fast-image';

interface PostCardProps {
  post: {
    uri: string;
    cid: string;
    author: {
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
  };
  onError?: (error: Error) => void;
}

export function PostCard({ post, onError }: PostCardProps) {
  const { agent } = useATProto();
  const [isLiking, setIsLiking] = useState(false);
  const [isReposting, setIsReposting] = useState(false);
  const [localLikes, setLocalLikes] = useState(post.likes);
  const [localReposts, setLocalReposts] = useState(post.reposts);
  const [mediaLoading, setMediaLoading] = useState<Record<number, boolean>>({});

  const _handleError = useCallback(
    (error: Error, action: string) => {
      const _message = `Failed to ${action}: ${error.message}`;
      onError?.(error);
      Alert.window.alert('Error', message);
    },
    [onError]
  );

  const _handleLike = async () => {
    if (isLiking || !agent) return;

    setIsLiking(true);
    try {
      await agent.like(post.uri, post.cid);
      setLocalLikes(prev => prev + 1);
    } catch (error) {
      handleError(
        error instanceof Error ? error : new Error('Unknown error'),
        'like post'
      );
    } finally {
      setIsLiking(false);
    }
  };

  const _handleRepost = async () => {
    if (isReposting || !agent) return;

    setIsReposting(true);
    try {
      await agent.repost(post.uri, post.cid);
      setLocalReposts(prev => prev + 1);
    } catch (error) {
      handleError(
        error instanceof Error ? error : new Error('Unknown error'),
        'repost'
      );
    } finally {
      setIsReposting(false);
    }
  };

  const _handleMediaLoad = (index: number) => {
    setMediaLoading(prev => ({ ...prev, [index]: false }));
  };

  const _handleMediaLoadStart = (index: number) => {
    setMediaLoading(prev => ({ ...prev, [index]: true }));
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {post.author.avatar ? (
          <FastImage
            source={{ uri: post.author.avatar }}
            style={styles.avatar}
            defaultSource={require('../../../assets/default-avatar.png')}
          />
        ) : (
          <View style={[styles.avatar, styles.placeholderAvatar]} />
        )}
        <View style={styles.authorInfo}>
          <Text style={styles.displayName}>
            {post.author.displayName || post.author.handle}
          </Text>
          <Text style={styles.handle}>@{post.author.handle}</Text>
        </View>
        <Text style={styles.timestamp}>
          {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
        </Text>
      </View>

      <Text style={styles.content}>{post.text}</Text>

      {post.media && post.media.length > 0 && (
        <View style={styles.mediaContainer}>
          {post.media.map((media, index) => (
            <View key={index} style={styles.mediaWrapper}>
              <FastImage
                source={{ uri: media.url }}
                style={styles.media}
                resizeMode={FastImage.resizeMode.cover}
                onLoadStart={() => handleMediaLoadStart(index)}
                onLoad={() => handleMediaLoad(index)}
              />
              {mediaLoading[index] && (
                <ActivityIndicator
                  style={styles.mediaLoader}
                  size="large"
                  color="#0000ff"
                />
              )}
            </View>
          ))}
        </View>
      )}

      <View style={styles.actions}>
        <TouchableOpacity
          onPress={handleLike}
          style={[styles.actionButton, isLiking && styles.actionButtonDisabled]}
          disabled={isLiking}
        >
          {isLiking ? (
            <ActivityIndicator size="small" color="#999" />
          ) : (
            <Text>❤️ {localLikes}</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleRepost}
          style={[
            styles.actionButton,
            isReposting && styles.actionButtonDisabled,
          ]}
          disabled={isReposting}
        >
          {isReposting ? (
            <ActivityIndicator size="small" color="#999" />
          ) : (
            <Text>🔄 {localReposts}</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const _styles = StyleSheet.create({
  container: {
    padding: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  placeholderAvatar: {
    backgroundColor: '#eee',
  },
  authorInfo: {
    flex: 1,
  },
  displayName: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  handle: {
    color: '#666',
    fontSize: 14,
  },
  timestamp: {
    color: '#666',
    fontSize: 12,
  },
  content: {
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 10,
  },
  mediaContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -5,
  },
  mediaWrapper: {
    position: 'relative',
    width: '100%',
    aspectRatio: 16 / 9,
    marginVertical: 5,
    borderRadius: 10,
    overflow: 'hidden',
  },
  media: {
    width: '100%',
    height: '100%',
  },
  mediaLoader: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -12 }, { translateY: -12 }],
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 20,
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
});
