import { AppBskyFeedDefs, AppBskyActorDefs } from '@atproto/api';

import { query, transaction } from '../db';

import { atproto } from './atproto';

export class ATProtoBetaService {
  private static instance: ATProtoBetaService;

  private constructor() {}

  public static getInstance(): ATProtoBetaService {
    if (!ATProtoBetaService.instance) {
      ATProtoBetaService.instance = new ATProtoBetaService();
    }
    return ATProtoBetaService.instance;
  }

  async trackUserEngagement(userId: string, post: AppBskyFeedDefs.PostView) {
    try {
      await query(
        `INSERT INTO at_protocol_analytics 
        (user_id, event_type, repo, collection, rkey, cid, uri, event_data)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          userId,
          'post_view',
          post.uri.split('/')[2], // repo
          'app.bsky.feed.post',
          post.uri.split('/')[4], // rkey
          post.cid,
          post.uri,
          {
            isRepost: !!post.repost,
            hasMedia: !!post.embed,
            replyCount: post.replyCount,
            repostCount: post.repostCount,
            likeCount: post.likeCount,
            indexedAt: post.indexedAt,
          },
        ]
      );
    } catch (error) {
      console.error('Error tracking user engagement:', error);
    }
  }

  async trackCustomFeedUsage(
    userId: string,
    feedId: string,
    posts: AppBskyFeedDefs.FeedViewPost[]
  ) {
    try {
      await query(
        `INSERT INTO at_protocol_analytics 
        (user_id, event_type, event_data)
        VALUES ($1, $2, $3)`,
        [
          userId,
          'custom_feed_view',
          {
            feedId,
            postCount: posts.length,
            timestamp: new Date().toISOString(),
            postTypes: posts.reduce((acc, post) => {
              const type = post.post.embed?.$type || 'text';
              acc[type] = (acc[type] || 0) + 1;
              return acc;
            }, {} as Record<string, number>),
          },
        ]
      );
    } catch (error) {
      console.error('Error tracking custom feed usage:', error);
    }
  }

  async validateBetaProfile(profile: AppBskyActorDefs.ProfileViewDetailed) {
    const requiredFields = ['displayName', 'description', 'avatar'];
    const completedFields = requiredFields.filter((field) => !!profile[field]);
    const isComplete = completedFields.length === requiredFields.length;

    try {
      await query(
        `UPDATE beta_users 
        SET at_profile_complete = $1,
            metadata = jsonb_set(
              COALESCE(metadata, '{}'::jsonb),
              '{profile_completion}',
              $2::jsonb
            )
        WHERE at_did = $3`,
        [
          isComplete,
          JSON.stringify({
            completedFields,
            missingFields: requiredFields.filter((f) => !completedFields.includes(f)),
            lastChecked: new Date().toISOString(),
          }),
          profile.did,
        ]
      );

      return isComplete;
    } catch (error) {
      console.error('Error validating beta profile:', error);
      return false;
    }
  }

  async getBetaMetrics(userId: string) {
    try {
      const result = await query(
        `SELECT 
          COUNT(DISTINCT CASE WHEN event_type = 'post_view' THEN id END) as post_views,
          COUNT(DISTINCT CASE WHEN event_type = 'custom_feed_view' THEN id END) as feed_views,
          COUNT(DISTINCT repo) as unique_repos_interacted,
          jsonb_object_agg(
            DISTINCT event_type,
            COUNT(*)
          ) as event_counts,
          MAX(server_timestamp) as last_activity
        FROM at_protocol_analytics
        WHERE user_id = $1
        GROUP BY user_id`,
        [userId]
      );

      return result.rows[0] || null;
    } catch (error) {
      console.error('Error getting beta metrics:', error);
      return null;
    }
  }

  async syncBetaUserProfile(userId: string) {
    try {
      const profile = await atproto.getProfile(userId);

      await transaction(async (client) => {
        await client.query(
          `UPDATE beta_users 
          SET at_handle = $1,
              at_did = $2,
              metadata = jsonb_set(
                COALESCE(metadata, '{}'::jsonb),
                '{profile_sync}',
                $3::jsonb
              )
          WHERE did = $4`,
          [
            profile.data.handle,
            profile.data.did,
            JSON.stringify({
              followers: profile.data.followersCount,
              following: profile.data.followsCount,
              posts: profile.data.postsCount,
              lastSync: new Date().toISOString(),
            }),
            userId,
          ]
        );

        await this.validateBetaProfile(profile.data);
      });

      return true;
    } catch (error) {
      console.error('Error syncing beta user profile:', error);
      return false;
    }
  }
}

export const atprotoBeta = ATProtoBetaService.getInstance();
