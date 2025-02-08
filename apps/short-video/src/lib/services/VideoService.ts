import { supabase } from '$lib/supabaseClient';
import { Web3Storage } from 'web3.storage';
import { createFFmpeg } from '@ffmpeg/ffmpeg';
import type { Database } from '$lib/types/database';

interface VideoFilter {
  userId?: string;
  category?: string;
  tags?: string[];
  status?: 'processing' | 'published' | 'private' | 'archived';
  tokenGated?: boolean;
  nft?: boolean;
  search?: string;
}

interface VideoSort {
  field: 'created_at' | 'views' | 'likes_count' | 'comments_count' | 'shares_count';
  direction: 'asc' | 'desc';
}

interface ProcessedVideo {
  mp4Url: string;
  webmUrl: string;
  thumbnailUrl: string;
  duration: number;
  width: number;
  height: number;
}

export class VideoService {
  private web3Storage: Web3Storage;
  private ffmpeg: any;

  constructor() {
    this.web3Storage = new Web3Storage({ token: import.meta.env.VITE_WEB3_STORAGE_TOKEN });
    this.ffmpeg = createFFmpeg({ log: true });
  }

  async listVideos(
    filter?: VideoFilter,
    sort?: VideoSort,
    page = 1,
    limit = 10
  ) {
    let query = supabase
      .from('videos')
      .select(`
        *,
        user:user_id (
          id,
          username,
          display_name,
          avatar_url,
          verification_status
        ),
        interactions:video_interactions (
          type,
          count
        )
      `);

    // Apply filters
    if (filter?.userId) {
      query = query.eq('user_id', filter.userId);
    }
    if (filter?.category) {
      query = query.contains('categories', [filter.category]);
    }
    if (filter?.tags?.length) {
      query = query.contains('tags', filter.tags);
    }
    if (filter?.status) {
      query = query.eq('status', filter.status);
    }
    if (filter?.tokenGated !== undefined) {
      query = query.eq('token_gated', filter.tokenGated);
    }
    if (filter?.nft !== undefined) {
      query = query.eq('nft', filter.nft);
    }
    if (filter?.search) {
      query = query.or(`title.ilike.%${filter.search}%,description.ilike.%${filter.search}%`);
    }

    // Apply sorting
    if (sort) {
      query = query.order(sort.field, { ascending: sort.direction === 'asc' });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    // Apply pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to fetch videos: ${error.message}`);
    }

    return {
      videos: data || [],
      total: count || 0,
      page,
      limit
    };
  }

  async getVideo(id: string) {
    const { data, error } = await supabase
      .from('videos')
      .select(`
        *,
        user:user_id (
          id,
          username,
          display_name,
          avatar_url,
          verification_status
        ),
        comments (
          id,
          content,
          created_at,
          user:user_id (
            id,
            username,
            avatar_url
          )
        ),
        interactions:video_interactions (
          type,
          count
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      throw new Error(`Failed to fetch video: ${error.message}`);
    }

    // Increment view count
    await this.recordView(id);

    return data;
  }

  async uploadVideo(
    file: File,
    metadata: {
      title: string;
      description?: string;
      visibility?: boolean;
      allowComments?: boolean;
      allowDuets?: boolean;
      musicTitle?: string;
      musicArtist?: string;
      originalSound?: boolean;
      location?: string;
      tags?: string[];
      mentions?: string[];
      categories?: string[];
      tokenGated?: boolean;
      tokenContract?: string;
      tokenId?: string;
      tokenStandard?: string;
    }
  ) {
    try {
      // Process video
      const processedVideo = await this.processVideo(file);

      // Upload to IPFS
      const cid = await this.uploadToIPFS([
        new File([file], 'original.mp4'),
        new File([processedVideo.mp4], 'processed.mp4'),
        new File([processedVideo.webm], 'processed.webm'),
        new File([processedVideo.thumbnail], 'thumbnail.jpg')
      ]);

      // Create video record
      const { data, error } = await supabase
        .from('videos')
        .insert({
          ...metadata,
          video_url: `ipfs://${cid}/processed.mp4`,
          thumbnail_url: `ipfs://${cid}/thumbnail.jpg`,
          duration: processedVideo.duration,
          width: processedVideo.width,
          height: processedVideo.height,
          ipfs_hash: cid,
          status: 'published'
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create video record: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Failed to upload video:', error);
      throw error;
    }
  }

  private async processVideo(file: File): Promise<ProcessedVideo> {
    if (!this.ffmpeg.isLoaded()) {
      await this.ffmpeg.load();
    }

    const { name } = file;
    this.ffmpeg.FS('writeFile', name, await file.arrayBuffer());

    // Generate MP4
    await this.ffmpeg.run(
      '-i', name,
      '-c:v', 'libx264',
      '-preset', 'medium',
      '-crf', '23',
      '-c:a', 'aac',
      '-b:a', '128k',
      'output.mp4'
    );

    // Generate WebM
    await this.ffmpeg.run(
      '-i', name,
      '-c:v', 'libvpx-vp9',
      '-crf', '30',
      '-b:v', '0',
      '-c:a', 'libopus',
      'output.webm'
    );

    // Generate thumbnail
    await this.ffmpeg.run(
      '-i', name,
      '-ss', '00:00:01',
      '-vframes', '1',
      'thumbnail.jpg'
    );

    // Get video metadata
    const { duration, width, height } = await this.getVideoMetadata(file);

    // Read processed files
    const mp4 = this.ffmpeg.FS('readFile', 'output.mp4');
    const webm = this.ffmpeg.FS('readFile', 'output.webm');
    const thumbnail = this.ffmpeg.FS('readFile', 'thumbnail.jpg');

    // Clean up
    this.ffmpeg.FS('unlink', name);
    this.ffmpeg.FS('unlink', 'output.mp4');
    this.ffmpeg.FS('unlink', 'output.webm');
    this.ffmpeg.FS('unlink', 'thumbnail.jpg');

    return {
      mp4Url: URL.createObjectURL(new Blob([mp4], { type: 'video/mp4' })),
      webmUrl: URL.createObjectURL(new Blob([webm], { type: 'video/webm' })),
      thumbnailUrl: URL.createObjectURL(new Blob([thumbnail], { type: 'image/jpeg' })),
      duration,
      width,
      height
    };
  }

  private async getVideoMetadata(file: File) {
    return new Promise<{ duration: number; width: number; height: number }>((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(video.src);
        resolve({
          duration: Math.round(video.duration),
          width: video.videoWidth,
          height: video.videoHeight
        });
      };
      video.src = URL.createObjectURL(file);
    });
  }

  private async uploadToIPFS(files: File[]): Promise<string> {
    return this.web3Storage.put(files);
  }

  async recordView(videoId: string) {
    const { error } = await supabase
      .from('video_interactions')
      .insert({
        video_id: videoId,
        type: 'view'
      });

    if (error && error.code !== '23505') { // Ignore unique constraint violations
      throw new Error(`Failed to record view: ${error.message}`);
    }
  }

  async likeVideo(videoId: string) {
    const { error } = await supabase
      .from('video_interactions')
      .insert({
        video_id: videoId,
        type: 'like'
      });

    if (error) {
      throw new Error(`Failed to like video: ${error.message}`);
    }
  }

  async unlikeVideo(videoId: string) {
    const { error } = await supabase
      .from('video_interactions')
      .delete()
      .match({
        video_id: videoId,
        type: 'like'
      });

    if (error) {
      throw new Error(`Failed to unlike video: ${error.message}`);
    }
  }

  async shareVideo(videoId: string) {
    const { error } = await supabase
      .from('video_interactions')
      .insert({
        video_id: videoId,
        type: 'share'
      });

    if (error) {
      throw new Error(`Failed to record share: ${error.message}`);
    }
  }

  async addComment(videoId: string, content: string, parentId?: string) {
    const { data, error } = await supabase
      .from('comments')
      .insert({
        video_id: videoId,
        content,
        parent_id: parentId
      })
      .select(`
        *,
        user:user_id (
          id,
          username,
          avatar_url
        )
      `)
      .single();

    if (error) {
      throw new Error(`Failed to add comment: ${error.message}`);
    }

    return data;
  }

  async deleteComment(commentId: string) {
    const { error } = await supabase
      .from('comments')
      .delete()
      .eq('id', commentId);

    if (error) {
      throw new Error(`Failed to delete comment: ${error.message}`);
    }
  }

  async reportVideo(videoId: string, reason: string, description?: string) {
    const { error } = await supabase
      .from('reports')
      .insert({
        video_id: videoId,
        reason,
        description
      });

    if (error) {
      throw new Error(`Failed to report video: ${error.message}`);
    }
  }

  async getAnalytics(videoId: string) {
    const { data, error } = await supabase
      .from('video_analytics')
      .select('*')
      .eq('video_id', videoId)
      .single();

    if (error) {
      throw new Error(`Failed to fetch analytics: ${error.message}`);
    }

    return data;
  }
} 