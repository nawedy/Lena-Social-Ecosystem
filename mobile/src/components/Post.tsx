import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Image,
  TouchableOpacity,
  Dimensions,
  _Platform,
} from 'react-native';
import FastImage from 'react-native-fast-image';
import Video from 'react-native-video';
import { useTheme } from '../theme';
import { Card } from './shared/Card';
import { formatDistanceToNow } from 'date-fns';
import { useNavigation } from '@react-navigation/native';
import { SharedElement } from 'react-navigation-shared-element';

interface PostProps {
  id: string;
  author: {
    did: string;
    handle: string;
    displayName?: string;
    avatar?: string;
  };
  content: {
    text?: string;
    media?: {
      type: 'image' | 'video';
      url: string;
      aspectRatio: number;
      thumbnail?: string;
    }[];
  };
  createdAt: string;
  likes: number;
  replies: number;
  reposts: number;
  liked: boolean;
  reposted: boolean;
  index?: number;
  currentIndex?: number;
}

export const Post: React.FC<PostProps> = ({
  id,
  author,
  content,
  createdAt,
  likes,
  replies,
  reposts,
  liked,
  reposted,
  index = 0,
  currentIndex = 0,
}) => {
  const theme = useTheme();
  const navigation = useNavigation();
  const { _width } = Dimensions.get('window');

  const likeScale = useRef(new Animated.Value(1)).current;
  const repostRotate = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    contentOpacity.setValue(1);
    Animated.timing(contentOpacity, {
      toValue: index === currentIndex ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [contentOpacity, index, currentIndex]);

  const handleLike = () => {
    Animated.sequence([
      Animated.spring(likeScale, {
        toValue: 1.2,
        useNativeDriver: true,
        speed: 50,
      }),
      Animated.spring(likeScale, {
        toValue: 1,
        useNativeDriver: true,
        speed: 50,
      }),
    ]).start();
    // Add like logic here
  };

  const handleRepost = () => {
    Animated.sequence([
      Animated.timing(repostRotate, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(repostRotate, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
    // Add repost logic here
  };

  const navigateToProfile = () => {
    navigation.navigate('Profile', { did: author.did });
  };

  const navigateToPost = () => {
    navigation.navigate('PostDetail', { id });
  };

  const spin = repostRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View style={{ opacity: contentOpacity }}>
      <Card onPress={navigateToPost}>
        <View style={styles.header}>
          <TouchableOpacity onPress={navigateToProfile} style={styles.author}>
            <SharedElement id={`avatar.${author.did}`}>
              <FastImage
                source={{ uri: author.avatar }}
                style={styles.avatar}
                defaultSource={require('../assets/default-avatar.png')}
              />
            </SharedElement>
            <View style={styles.authorInfo}>
              <Text style={styles.displayName}>
                {author.displayName || author.handle}
              </Text>
              <Text style={styles.handle}>@{author.handle}</Text>
            </View>
          </TouchableOpacity>
          <Text style={styles.timestamp}>
            {formatDistanceToNow(new Date(createdAt), { addSuffix: true })}
          </Text>
        </View>

        {content.text && (
          <Text style={styles.text} numberOfLines={5}>
            {content.text}
          </Text>
        )}

        {content.media && content.media.length > 0 && (
          <View style={styles.mediaContainer}>
            {content.media.map((media, index) => (
              <SharedElement key={index} id={`media.${id}.${index}`}>
                {media.type === 'image' ? (
                  <FastImage
                    source={{ uri: media.url }}
                    style={[
                      styles.media,
                      { aspectRatio: media.aspectRatio || 1 },
                    ]}
                    resizeMode={FastImage.resizeMode.cover}
                  />
                ) : (
                  <Video
                    source={{ uri: media.url }}
                    style={[
                      styles.media,
                      { aspectRatio: media.aspectRatio || 16 / 9 },
                    ]}
                    poster={media.thumbnail}
                    posterResizeMode="cover"
                    resizeMode="cover"
                    paused={true}
                    muted={true}
                  />
                )}
              </SharedElement>
            ))}
          </View>
        )}

        <View style={styles.actions}>
          <TouchableOpacity onPress={handleLike} style={styles.action}>
            <Animated.View style={{ transform: [{ scale: likeScale }] }}>
              <Image
                source={
                  liked
                    ? require('../assets/heart-filled.png')
                    : require('../assets/heart.png')
                }
                style={[
                  styles.actionIcon,
                  liked && { tintColor: theme.colors.error },
                ]}
              />
            </Animated.View>
            <Text style={styles.actionCount}>{likes}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.action}>
            <Image
              source={require('../assets/comment.png')}
              style={styles.actionIcon}
            />
            <Text style={styles.actionCount}>{replies}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleRepost} style={styles.action}>
            <Animated.View style={{ transform: [{ rotate: spin }] }}>
              <Image
                source={require('../assets/repost.png')}
                style={[
                  styles.actionIcon,
                  reposted && { tintColor: theme.colors.success },
                ]}
              />
            </Animated.View>
            <Text style={styles.actionCount}>{reposts}</Text>
          </TouchableOpacity>
        </View>
      </Card>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  author: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  authorInfo: {
    marginLeft: 12,
  },
  displayName: {
    fontSize: 16,
    fontWeight: '600',
  },
  handle: {
    fontSize: 14,
    color: '#666',
  },
  timestamp: {
    fontSize: 12,
    color: '#666',
  },
  text: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 12,
  },
  mediaContainer: {
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  media: {
    width: '100%',
    backgroundColor: '#f0f0f0',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#eee',
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionIcon: {
    width: 20,
    height: 20,
    marginRight: 4,
  },
  actionCount: {
    fontSize: 14,
    color: '#666',
  },
});
