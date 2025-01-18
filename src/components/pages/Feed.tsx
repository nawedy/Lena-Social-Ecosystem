import {
  AppBskyEmbedImages,
  AppBskyEmbedRecordWithMedia,
  AppBskyFeedPost,
  RichText,
} from '@atproto/api';
import { formatDistanceToNow } from 'date-fns';
import React, { useEffect, useState, useCallback } from 'react';
import InfiniteScroll from 'react-infinite-scroll-component';

import { useATProto } from '../../contexts/ATProtoContext';
import { FeedViewPost, MediaCarouselItem } from '../../types/feed';
import MediaCarousel from '../shared/MediaCarousel';

const Feed: React.FC<{ algorithm?: string }> = ({ algorithm = 'reverse-chronological' }) => {
  const { getTimeline, like, unlike, repost, unrepost } = useATProto();
  const [posts, setPosts] = useState<FeedViewPost[]>([]);
  const [cursor, setCursor] = useState<string | undefined>();
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);

  const _fetchPosts = useCallback(
    async (cursor?: string) => {
      if (loading) return;
      setLoading(true);

      try {
        const _response = await getTimeline({ limit: 20, cursor, algorithm });
        const _newPosts = response.data.feed;

        setPosts((prev) => (cursor ? [...prev, ...newPosts] : newPosts));
        setCursor(response.data.cursor);
        setHasMore(!!response.data.cursor);
      } catch (error) {
        console.error('Error fetching feed:', error);
      } finally {
        setLoading(false);
      }
    },
    [getTimeline, loading, algorithm]
  );

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const _handleLike = async (post: FeedViewPost) => {
    try {
      if (post.viewer?.like) {
        await unlike(post.post.uri, post.post.cid);
        setPosts((prev) =>
          prev.map((p) =>
            p.post.uri === post.post.uri
              ? {
                  ...p,
                  likeCount: (p.likeCount || 0) - 1,
                  viewer: { ...p.viewer, like: undefined },
                }
              : p
          )
        );
      } else {
        await like(post.post.uri, post.post.cid);
        setPosts((prev) =>
          prev.map((p) =>
            p.post.uri === post.post.uri
              ? {
                  ...p,
                  likeCount: (p.likeCount || 0) + 1,
                  viewer: { ...p.viewer, like: 'temp-like' },
                }
              : p
          )
        );
      }
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  const _handleRepost = async (post: FeedViewPost) => {
    try {
      if (post.viewer?.repost) {
        await unrepost(post.post.uri, post.post.cid);
        setPosts((prev) =>
          prev.map((p) =>
            p.post.uri === post.post.uri
              ? {
                  ...p,
                  repostCount: (p.repostCount || 0) - 1,
                  viewer: { ...p.viewer, repost: undefined },
                }
              : p
          )
        );
      } else {
        await repost(post.post.uri, post.post.cid);
        setPosts((prev) =>
          prev.map((p) =>
            p.post.uri === post.post.uri
              ? {
                  ...p,
                  repostCount: (p.repostCount || 0) + 1,
                  viewer: { ...p.viewer, repost: 'temp-repost' },
                }
              : p
          )
        );
      }
    } catch (error) {
      console.error('Error toggling repost:', error);
    }
  };

  const _getMediaFromPost = (post: FeedViewPost): MediaCarouselItem[] => {
    const _embed = post.post.embed;
    if (!embed) return [];

    if (AppBskyEmbedImages.isView(embed)) {
      return embed.images.map((img) => ({
        type: 'image',
        uri: img.fullsize,
        alt: img.alt,
        aspectRatio: img.aspectRatio,
        thumbnail: img.thumb,
      }));
    }

    if (AppBskyEmbedRecordWithMedia.isView(embed) && embed.media) {
      if (AppBskyEmbedImages.isView(embed.media)) {
        return embed.media.images.map((img) => ({
          type: 'image',
          uri: img.fullsize,
          alt: img.alt,
          aspectRatio: img.aspectRatio,
          thumbnail: img.thumb,
        }));
      }
    }

    return [];
  };

  const _renderPostText = (post: FeedViewPost) => {
    const _record = post.post.record as AppBskyFeedPost.Record;
    const _rt = new RichText({ text: record.text, facets: record.facets });

    return (
      <div className='whitespace-pre-wrap'>
        {rt.segments.map((segment, i) => {
          if (segment.isMention()) {
            return (
              <a
                key={i}
                href={`/profile/${segment.text}`}
                className='text-blue-500 hover:underline'
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
                target='_blank'
                rel='noopener noreferrer'
                className='text-blue-500 hover:underline'
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
                className='text-blue-500 hover:underline'
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

  return (
    <div className='max-w-2xl mx-auto'>
      <InfiniteScroll
        dataLength={posts.length}
        next={() => fetchPosts(cursor)}
        hasMore={hasMore}
        loader={<div className='text-center py-4'>Loading...</div>}
        endMessage={<div className='text-center py-4'>No more posts</div>}
      >
        {posts.map((post) => {
          const _media = getMediaFromPost(post);
          return (
            <article
              key={post.post.uri}
              className='bg-white dark:bg-gray-800 rounded-lg shadow mb-6'
            >
              <div className='p-4'>
                <div className='flex items-center mb-4'>
                  <img
                    src={post.post.author.avatar}
                    alt={post.post.author.displayName || post.post.author.handle}
                    className='w-10 h-10 rounded-full'
                  />
                  <div className='ml-3'>
                    <h3 className='font-semibold text-gray-900 dark:text-white'>
                      {post.post.author.displayName || post.post.author.handle}
                    </h3>
                    <div className='flex items-center text-sm text-gray-500'>
                      <span>@{post.post.author.handle}</span>
                      <span className='mx-1'>·</span>
                      <time>
                        {formatDistanceToNow(new Date(post.post.indexedAt), {
                          addSuffix: true,
                        })}
                      </time>
                    </div>
                  </div>
                </div>

                <div className='text-gray-800 dark:text-gray-200 mb-4'>{renderPostText(post)}</div>

                {media.length > 0 && (
                  <div className='mb-4'>
                    <MediaCarousel items={media} />
                  </div>
                )}

                <div className='flex items-center justify-between text-gray-500'>
                  <button
                    onClick={() => handleLike(post)}
                    className={`flex items-center space-x-2 ${
                      post.viewer?.like ? 'text-red-500' : 'hover:text-red-500'
                    }`}
                  >
                    <span>{post.viewer?.like ? '❤️' : '🤍'}</span>
                    <span>{post.likeCount || 0}</span>
                  </button>
                  <button
                    onClick={() => handleRepost(post)}
                    className={`flex items-center space-x-2 ${
                      post.viewer?.repost ? 'text-green-500' : 'hover:text-green-500'
                    }`}
                  >
                    <span>🔄</span>
                    <span>{post.repostCount || 0}</span>
                  </button>
                  <button className='flex items-center space-x-2 hover:text-blue-500'>
                    <span>💭</span>
                    <span>{post.replyCount || 0}</span>
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </InfiniteScroll>
    </div>
  );
};

export default Feed;
