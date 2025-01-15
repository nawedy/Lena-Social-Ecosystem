import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { formatDistanceToNow } from 'date-fns';
import { ApiService } from '../../../services/api';

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
}

export function PostCard({ post }: PostCardProps) {
  const handleLike = async () => {
    try {
      const api = ApiService.getInstance();
      await api.getAgent().like(post.uri, post.cid);
    } catch (error) {
      console.error('Failed to like post:', error);
    }
  };

  const handleRepost = async () => {
    try {
      const api = ApiService.getInstance();
      await api.getAgent().repost(post.uri, post.cid);
    } catch (error) {
      console.error('Failed to repost:', error);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {post.author.avatar && (
          <Image
            source={{ uri: post.author.avatar }}
            style={styles.avatar}
          />
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
            <Image
              key={index}
              source={{ uri: media.url }}
              style={styles.media}
              resizeMode="cover"
            />
          ))}
        </View>
      )}

      <View style={styles.actions}>
        <TouchableOpacity onPress={handleLike} style={styles.actionButton}>
          <Text>❤️ {post.likes}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleRepost} style={styles.actionButton}>
          <Text>🔄 {post.reposts}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#fff',
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
    marginBottom: 10,
    lineHeight: 22,
  },
  mediaContainer: {
    marginBottom: 10,
  },
  media: {
    width: Dimensions.get('window').width - 30,
    height: 200,
    borderRadius: 10,
    marginBottom: 5,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 10,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
