import { AppBskyFeedDefs } from '@atproto/api';

export type FeedViewPost = AppBskyFeedDefs.FeedViewPost;
export type PostView = AppBskyFeedDefs.PostView;
export type ImageView = AppBskyFeedDefs.ImageView;
export type VideoView = {
  uri: string;
  mimeType: string;
  duration: number;
  thumbnail?: ImageView;
};

export interface MediaCarouselItem {
  type: 'image' | 'video';
  uri: string;
  alt?: string;
  aspectRatio?: number;
  thumbnail?: string;
}
