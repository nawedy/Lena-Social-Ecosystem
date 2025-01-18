import { AppBskyFeedDefs, RichText } from '@atproto/api';
import { formatDistanceToNow } from 'date-fns';
import React, { useState, useCallback } from 'react';

import { useATProto } from '../../contexts/ATProtoContext';

import MediaCarousel from './MediaCarousel';

interface PostProps {
  post: AppBskyFeedDefs.FeedViewPost;
  onRemix?: (post: AppBskyFeedDefs.FeedViewPost) => void;
  onReply?: (post: AppBskyFeedDefs.FeedViewPost) => void;
}

const Post: React.FC<PostProps> = ({ post, onRemix, onReply }) => {
  const { agent } = useATProto();
  const [isLiked, setIsLiked] = useState(post.viewer?.like !== undefined);
  const [isReposted, setIsReposted] = useState(post.viewer?.repost !== undefined);
  const [isSaved, setIsSaved] = useState(false);
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [isRemixing, setIsRemixing] = useState(false);
  const [remixText, setRemixText] = useState('');

  const _handleLike = useCallback(async () => {
    if (!agent) return;

    try {
      if (isLiked) {
        await agent.deleteLike(post.viewer?.like!);
        setIsLiked(false);
      } else {
        await agent.like(post.post.uri, post.post.cid);
        setIsLiked(true);
      }
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  }, [agent, post, isLiked]);

  const _handleRepost = useCallback(async () => {
    if (!agent) return;

    try {
      if (isReposted) {
        await agent.deleteRepost(post.viewer?.repost!);
        setIsReposted(false);
      } else {
        await agent.repost(post.post.uri, post.post.cid);
        setIsReposted(true);
      }
    } catch (error) {
      console.error('Error toggling repost:', error);
    }
  }, [agent, post, isReposted]);

  const _handleSave = useCallback(async () => {
    if (!agent) return;

    try {
      // Using the AT Protocol's save feature
      await agent.api.app.bsky.actor.saveFeed({
        feed: post.post.uri,
      });
      setIsSaved(true);
    } catch (error) {
      console.error('Error saving post:', error);
    }
  }, [agent, post]);

  const _handleSubmitReply = useCallback(async () => {
    if (!agent || !replyText.trim()) return;

    try {
      const _rt = new RichText({ text: replyText });
      await rt.detectFacets(agent);

      const _response = await agent.post({
        text: rt.text,
        facets: rt.facets,
        reply: {
          root: {
            uri: post.post.uri,
            cid: post.post.cid,
          },
          parent: {
            uri: post.post.uri,
            cid: post.post.cid,
          },
        },
      });

      setReplyText('');
      setShowReplyForm(false);
      onReply?.(post);
    } catch (error) {
      console.error('Error posting reply:', error);
    }
  }, [agent, post, replyText, onReply]);

  const _handleSubmitRemix = useCallback(async () => {
    if (!agent || !remixText.trim()) return;

    try {
      const _rt = new RichText({ text: remixText });
      await rt.detectFacets(agent);

      const _response = await agent.post({
        text: rt.text,
        facets: rt.facets,
        embed: {
          $type: 'app.bsky.embed.record',
          record: {
            uri: post.post.uri,
            cid: post.post.cid,
          },
        },
      });

      setRemixText('');
      setIsRemixing(false);
      onRemix?.(post);
    } catch (error) {
      console.error('Error posting remix:', error);
    }
  }, [agent, post, remixText, onRemix]);

  const _renderPostText = (text: string, facets?: any[]) => {
    const _rt = new RichText({ text, facets });
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
    <article className='bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 space-y-4'>
      {/* Post Header */}
      <div className='flex items-center justify-between'>
        <div className='flex items-center space-x-3'>
          <img
            src={post.post.author.avatar}
            alt={post.post.author.displayName || post.post.author.handle}
            className='w-10 h-10 rounded-full'
          />
          <div>
            <p className='font-semibold'>
              {post.post.author.displayName || post.post.author.handle}
            </p>
            <p className='text-sm text-gray-500'>
              {formatDistanceToNow(new Date(post.post.indexedAt), {
                addSuffix: true,
              })}
            </p>
          </div>
        </div>

        <div className='flex items-center space-x-2'>
          <button
            onClick={handleSave}
            className={`p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 ${
              isSaved ? 'text-yellow-500' : 'text-gray-500'
            }`}
          >
            📌
          </button>
          <button className='p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500'>
            •••
          </button>
        </div>
      </div>

      {/* Post Content */}
      <div className='text-gray-800 dark:text-gray-200'>
        {renderPostText(post.post.record.text, post.post.record.facets)}
      </div>

      {/* Media */}
      {post.post.embed && (
        <div className='rounded-lg overflow-hidden'>
          <MediaCarousel
            items={[
              {
                type: 'image',
                uri: (post.post.embed as any).images?.[0]?.fullsize,
                alt: (post.post.embed as any).images?.[0]?.alt,
                aspectRatio: (post.post.embed as any).images?.[0]?.aspectRatio,
              },
            ]}
          />
        </div>
      )}

      {/* Interaction Buttons */}
      <div className='flex items-center justify-between border-t border-b py-2'>
        <button
          onClick={() => setShowReplyForm(!showReplyForm)}
          className='flex items-center space-x-2 text-gray-500 hover:text-blue-500'
        >
          <span>💭</span>
          <span>{post.replyCount || 0}</span>
        </button>
        <button
          onClick={handleRepost}
          className={`flex items-center space-x-2 ${
            isReposted ? 'text-green-500' : 'text-gray-500 hover:text-green-500'
          }`}
        >
          <span>🔄</span>
          <span>{post.repostCount || 0}</span>
        </button>
        <button
          onClick={handleLike}
          className={`flex items-center space-x-2 ${
            isLiked ? 'text-red-500' : 'text-gray-500 hover:text-red-500'
          }`}
        >
          <span>❤️</span>
          <span>{post.likeCount || 0}</span>
        </button>
        <button
          onClick={() => setIsRemixing(!isRemixing)}
          className='flex items-center space-x-2 text-gray-500 hover:text-purple-500'
        >
          <span>🎵</span>
          <span>Remix</span>
        </button>
      </div>

      {/* Reply Form */}
      {showReplyForm && (
        <div className='space-y-2'>
          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder='Write your reply...'
            className='w-full p-2 rounded-lg border dark:border-gray-600 dark:bg-gray-700'
            rows={3}
          />
          <div className='flex justify-end space-x-2'>
            <button
              onClick={() => setShowReplyForm(false)}
              className='px-4 py-2 text-gray-500 hover:text-gray-700'
            >
              Cancel
            </button>
            <button
              onClick={handleSubmitReply}
              className='px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600'
              disabled={!replyText.trim()}
            >
              Reply
            </button>
          </div>
        </div>
      )}

      {/* Remix Form */}
      {isRemixing && (
        <div className='space-y-2'>
          <textarea
            value={remixText}
            onChange={(e) => setRemixText(e.target.value)}
            placeholder='Add your remix...'
            className='w-full p-2 rounded-lg border dark:border-gray-600 dark:bg-gray-700'
            rows={3}
          />
          <div className='flex justify-end space-x-2'>
            <button
              onClick={() => setIsRemixing(false)}
              className='px-4 py-2 text-gray-500 hover:text-gray-700'
            >
              Cancel
            </button>
            <button
              onClick={handleSubmitRemix}
              className='px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600'
              disabled={!remixText.trim()}
            >
              Post Remix
            </button>
          </div>
        </div>
      )}
    </article>
  );
};

export default Post;
