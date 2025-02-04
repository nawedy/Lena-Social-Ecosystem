import {
  AppBskyActorDefs,
  AppBskyFeedDefs,
  RichText,
  AppBskyFeedPost,
} from '@atproto/api';
import { formatDistanceToNow } from 'date-fns';
import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

import { useATProto } from '../../contexts/ATProtoContext';
import { SubscriptionService } from '../../services/subscription';
import { _FeedViewPost as FeedViewPost } from '../../types/feed';
import { logger } from '../../utils/logger';
import MediaCarousel from '../shared/MediaCarousel';

interface ProfileViewDetailed extends AppBskyActorDefs.ProfileViewDetailed {
  handle: string;
  displayName?: string;
  description?: string;
  avatar?: string;
  banner?: string;
  followersCount: number;
  followsCount: number;
  postsCount: number;
  indexedAt: string;
}

const Profile: React.FC = () => {
  const { handle } = useParams<{ handle: string }>();
  const _navigate = useNavigate();
  const { agent, getProfile, getAuthorFeed, follow, unfollow } = useATProto();
  const [profile, setProfile] = useState<ProfileViewDetailed | null>(null);
  const [posts, setPosts] = useState<AppBskyFeedDefs.FeedViewPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | undefined>();
  const [hasMore, setHasMore] = useState(true);
  const [subscriptionService, setSubscriptionService] =
    useState<SubscriptionService | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    if (agent) {
      const _service = new SubscriptionService(agent);
      setSubscriptionService(service);
      return () => service.stop();
    }
  }, [agent]);

  useEffect(() => {
    if (subscriptionService && profile?.did && !isSubscribed) {
      subscriptionService.start();
      subscriptionService.subscribeToProfile(profile.did);
      setIsSubscribed(true);

      const _subscription = subscriptionService.updates.subscribe(update => {
        if (update.type === 'post' && update.post.author.did === profile.did) {
          setPosts(prevPosts => [
            {
              post: {
                uri: update.uri.toString(),
                cid: update.cid,
                author: profile,
                record: update.post,
                indexedAt: new Date().toISOString(),
              },
              reply: undefined,
              reason: undefined,
            },
            ...prevPosts,
          ]);
        }
      });

      return () => subscription.unsubscribe();
    }
  }, [subscriptionService, profile, isSubscribed]);

  const fetchProfile = useCallback(async () => {
    if (!handle) return;

    try {
      setLoading(true);
      const response = await getProfile(handle);
      setProfile(response.data);

      // Fetch initial posts
      const _feedResponse = await getAuthorFeed(response.data.did, {
        limit: 20,
      });
      setPosts(feedResponse.data.feed);
      setCursor(feedResponse.data.cursor);
      setHasMore(!!feedResponse.data.cursor);
    } catch (err) {
      console.error('Error fetching profile:', err);
      setError('Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, [handle, getProfile, getAuthorFeed,setProfile, setLoading, setPosts, setCursor, setHasMore, setError]);

  const loadMorePosts = useCallback(async () => {
    if (!profile?.did || !cursor || !hasMore) return;
    
    try {
      const _response = await getAuthorFeed(profile.did, {
        cursor,
        limit: 20,
      });
      setPosts(prev => [...prev, ...response.data.feed]);
      setCursor(response.data.cursor);
      setHasMore(!!response.data.cursor);
    } catch (err) {
      console.error('Error loading more posts:', err);
    }
  }, [profile?.did, cursor, hasMore, getAuthorFeed, setPosts, setCursor, setHasMore]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const _handleFollowToggle = async () => {
    if (!profile) return;

    try {
      if (profile.viewer?.following) {
        await unfollow(profile.did);
        setProfile(prev =>
          prev
            ? {
                ...prev,
                followersCount: prev.followersCount - 1,
                viewer: { ...prev.viewer, following: undefined },
              }
            : null
        );
      } else {
        await follow(profile.did);
        setProfile(prev =>
          prev
            ? {
                ...prev,
                followersCount: prev.followersCount + 1,
                viewer: { ...prev.viewer, following: 'temp' },
              }
            : null
        );
      }
    } catch (err) {
      console.error('Error toggling follow:', err);
    }
  };

  const handleShare = async () => {
    if (!profile) return;

    try {
      await navigator.share({
        title: `${profile.displayName || profile.handle}'s Profile`,
        text: profile.description || `Check out ${profile.handle} on TikTokToe`,
        url: window.location.href,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleReport = async () => {
    if (!profile) return;
    // Implement AT Protocol's reporting mechanism
    // This would typically involve creating a com.atproto.moderation.create record
    logger.info('Reporting profile:', profile.did);
  };

  const handleMute = async () => {
    if (!profile) return;
    // Implement AT Protocol's muting mechanism
    // This would typically involve creating a app.bsky.graph.mute record
    logger.info('Muting profile:', profile.did);
  };

  const _renderPostText = (post: AppBskyFeedDefs.FeedViewPost) => {
    const record = post.post.record as AppBskyFeedPost.Record;
    const rt = new RichText({ text: record.text, facets: record.facets });

    return (
      <div className="whitespace-pre-wrap">
        {rt.segments.map((segment, i) => {
          if (segment.isMention()) {
            return (
              <a
                key={i}
                href={`/profile/${segment.text}`}
                className="text-blue-500 hover:underline"
              >
                {segment.text}
              </a>
            );
          }
          if (segment.isLink()) {
            return (
              <a
                key={i}
                href={segment.link?.uri}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline"
              >
                {segment.text}
              </a>
            );
          }
          if (segment.isTag()) {
            return (
              <a
                key={i}
                href={`/tag/${segment.tag?.tag}`}
                className="text-blue-500 hover:underline"
              >
                {segment.text}
              </a>
            );
          }
          return <span key={i}>{segment.text}</span>;
        })}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="text-center py-8">
        <p className="text-red-500">{error || 'Profile not found'}</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4">
      {/* Banner */}
      <div className="h-48 rounded-t-lg overflow-hidden relative">
        {profile.banner ? (
          <img
            src={profile.banner}
            alt="Profile banner"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-r from-blue-400 to-purple-500" />
        )}
      </div>

      {/* Profile Info */}
      <div className="relative px-6 pb-6">
        <div className="flex justify-between items-end">
          <div className="-mt-16 mb-4">
            <img
              src={profile.avatar || '/default-avatar.png'}
              alt={profile.displayName || profile.handle}
              className="w-32 h-32 rounded-full border-4 border-white dark:border-gray-800"
            />
          </div>
          <div className="space-x-3">
            <button
              onClick={handleFollowToggle}
              className={`px-6 py-2 rounded-full font-medium ${
                profile.viewer?.following
                  ? 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                  : 'bg-blue-500 text-white hover:bg-blue-600'
              }`}
            >
              {profile.viewer?.following ? 'Following' : 'Follow'}
            </button>
            <button
              onClick={handleShare}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-full hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Share
            </button>
          </div>
        </div>

        <div className="mt-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {profile.displayName || profile.handle}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">@{profile.handle}</p>
          {profile.description && (
            <div className="mt-4 text-gray-800 dark:text-gray-200">
              <RichText text={profile.description} />
            </div>
          )}
        </div>

        <div className="flex space-x-6 mt-6">
          <div className="text-center">
            <div className="font-bold text-gray-900 dark:text-white">
              {profile.postsCount}
            </div>
            <div className="text-gray-600 dark:text-gray-400">Posts</div>
          </div>
          <button
            onClick={() => navigate(`/profile/${handle}/followers`)}
            className="text-center hover:opacity-75"
          >
            <div className="font-bold text-gray-900 dark:text-white">
              {profile.followersCount}
            </div>
            <div className="text-gray-600 dark:text-gray-400">Followers</div>
          </button>
          <button
            onClick={() => navigate(`/profile/${handle}/following`)}
            className="text-center hover:opacity-75"
          >
            <div className="font-bold text-gray-900 dark:text-white">
              {profile.followsCount}
            </div>
            <div className="text-gray-600 dark:text-gray-400">Following</div>
          </button>
        </div>

        {/* New interactive features */}
        <div className="mt-4 flex space-x-4">
          <button
            onClick={handleShare}
            className="px-4 py-2 bg-blue-500 text-white rounded-full hover:bg-blue-600"
          >
            Share Profile
          </button>
          <button
            onClick={handleReport}
            className="px-4 py-2 bg-red-500 text-white rounded-full hover:bg-red-600"
          >
            Report
          </button>
          <button
            onClick={handleMute}
            className="px-4 py-2 bg-gray-500 text-white rounded-full hover:bg-gray-600"
          >
            Mute
          </button>
        </div>

        {/* Posts Grid */}
        <div className="mt-8 space-y-6">
          {posts.map(post => (
            <article
              key={post.post.uri}
              className="bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow duration-200"
            >
              <div className="p-4">
                {/* Post header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <img
                      src={post.post.author.avatar}
                      alt={
                        post.post.author.displayName || post.post.author.handle
                      }
                      className="w-10 h-10 rounded-full"
                    />
                    <div>
                      <p className="font-semibold">
                        {post.post.author.displayName ||
                          post.post.author.handle}
                      </p>
                      <p className="text-sm text-gray-500">
                        {formatDistanceToNow(new Date(post.post.indexedAt), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      /* Add post menu */
                    }}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    •••
                  </button>
                </div>

                {/* Post content */}
                <div className="text-gray-800 dark:text-gray-200 mb-4">
                  {renderPostText(post)}
                </div>

                {/* Media display */}
                {post.post.embed && (
                  <div className="mb-4">
                    <MediaCarousel
                      items={[
                        {
                          type: 'image',
                          uri: (post.post.embed as any).images?.[0]?.fullsize,
                          alt: (post.post.embed as any).images?.[0]?.alt,
                          aspectRatio: (post.post.embed as any).images?.[0]
                            ?.aspectRatio,
                        },
                      ]}
                    />
                  </div>
                )}

                {/* Enhanced interaction buttons */}
                <div className="flex items-center justify-between text-gray-500 border-t pt-4">
                  <button className="flex items-center space-x-2 hover:text-blue-500 transition-colors">
                    <span>💭</span>
                    <span>{post.replyCount || 0}</span>
                  </button>
                  <button className="flex items-center space-x-2 hover:text-green-500 transition-colors">
                    <span>🔄</span>
                    <span>{post.repostCount || 0}</span>
                  </button>
                  <button className="flex items-center space-x-2 hover:text-red-500 transition-colors">
                    <span>❤️</span>
                    <span>{post.likeCount || 0}</span>
                  </button>
                  <button className="flex items-center space-x-2 hover:text-blue-500 transition-colors">
                    <span>📤</span>
                    <span>Share</span>
                  </button>
                </div>
              </div>
            </article>
          ))}

          {hasMore && (
            <button
              onClick={loadMorePosts}
              className="w-full py-2 text-blue-500 hover:text-blue-600"
            >
              Load more posts
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;
