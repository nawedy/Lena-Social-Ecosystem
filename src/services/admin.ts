import { AppBskyFeedDefs, AppBskyActorDefs, RichText } from '@atproto/api';
import { BlobRef } from '@atproto/lexicon';

import { query, transaction } from '../db';

import { atproto } from './atproto';

interface ModAction {
  type: 'warn' | 'mute' | 'block' | 'report';
  targetDid: string;
  reason: string;
  duration?: number; // in hours
  evidence?: {
    postUri?: string;
    screenshot?: BlobRef;
  };
}

interface BetaStats {
  activeUsers: number;
  totalPosts: number;
  totalFeedback: number;
  engagementRate: number;
  topFeatures: Array<{ name: string; usage: number }>;
}

class AdminService {
  private static instance: AdminService;

  private constructor() {}

  public static getInstance(): AdminService {
    if (!AdminService.instance) {
      AdminService.instance = new AdminService();
    }
    return AdminService.instance;
  }

  async getBetaStats(
    timeRange: 'day' | 'week' | 'month' = 'day'
  ): Promise<BetaStats> {
    const timeFilter = {
      day: "interval '24 hours'",
      week: "interval '7 days'",
      month: "interval '30 days'",
    }[timeRange];

    try {
      const [userStats, postStats, feedbackStats, featureStats] =
        await Promise.all([
          query(`
          SELECT 
            COUNT(DISTINCT did) as active_users
          FROM beta_users
          WHERE last_active_at > NOW() - ${timeFilter}
        `),
          query(`
          SELECT COUNT(*) as total_posts
          FROM at_protocol_analytics
          WHERE event_type = 'post_created'
          AND server_timestamp > NOW() - ${timeFilter}
        `),
          query(`
          SELECT COUNT(*) as total_feedback
          FROM beta_feedback
          WHERE created_at > NOW() - ${timeFilter}
        `),
          query(`
          SELECT 
            event_data->>'feature' as feature_name,
            COUNT(*) as usage_count
          FROM at_protocol_analytics
          WHERE event_type = 'feature_used'
          AND server_timestamp > NOW() - ${timeFilter}
          GROUP BY event_data->>'feature'
          ORDER BY usage_count DESC
          LIMIT 5
        `),
        ]);

      const activeUsers = parseInt(userStats.rows[0].active_users);
      const totalPosts = parseInt(postStats.rows[0].total_posts);

      return {
        activeUsers,
        totalPosts,
        totalFeedback: parseInt(feedbackStats.rows[0].total_feedback),
        engagementRate: activeUsers ? totalPosts / activeUsers : 0,
        topFeatures: featureStats.rows.map(row => ({
          name: row.feature_name,
          usage: parseInt(row.usage_count),
        })),
      };
    } catch (error) {
      console.error('Error getting beta stats:', error);
      throw error;
    }
  }

  async getModQueue(status: 'pending' | 'resolved' = 'pending') {
    try {
      const { rows } = await query(
        `
        SELECT 
          m.*,
          bu.handle as reporter_handle,
          bu.at_handle as reporter_at_handle,
          m.metadata->>'evidence' as evidence
        FROM mod_queue m
        JOIN beta_users bu ON m.reporter_did = bu.did
        WHERE m.status = $1
        ORDER BY m.created_at DESC
      `,
        [status]
      );

      return rows;
    } catch (error) {
      console.error('Error getting mod queue:', error);
      throw error;
    }
  }

  async takeModAction(action: ModAction) {
    try {
      await transaction(async client => {
        // Record the action in our database
        await client.query(
          `
          INSERT INTO mod_actions 
          (type, target_did, reason, duration, evidence, created_at)
          VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
        `,
          [
            action.type,
            action.targetDid,
            action.reason,
            action.duration,
            action.evidence,
          ]
        );

        // Take action on AT Protocol
        switch (action.type) {
          case 'block':
            await atproto.agent.app.bsky.actor.block({
              subject: action.targetDid,
              createdAt: new Date().toISOString(),
            });
            break;

          case 'mute':
            await atproto.agent.app.bsky.actor.mute({
              actor: action.targetDid,
            });
            break;

          case 'report':
            await atproto.agent.com.atproto.moderation.createReport({
              reasonType: 'com.atproto.moderation.defs#reasonSpam',
              subject: {
                $type: 'com.atproto.admin.defs#repoRef',
                did: action.targetDid,
              },
              reason: action.reason,
            });
            break;
        }

        // Send warning message if applicable
        if (action.type === 'warn') {
          const text = `⚠️ Warning: Your recent activity violates our beta testing guidelines. Reason: ${action.reason}. Please review our community guidelines.`;

          const richText = new RichText({ text });
          await richText.detectFacets(atproto.agent);

          await atproto.agent.app.bsky.feed.post.create(
            { repo: action.targetDid },
            {
              text: richText.text,
              facets: richText.facets,
              createdAt: new Date().toISOString(),
            }
          );
        }
      });

      return true;
    } catch (error) {
      console.error('Error taking mod action:', error);
      throw error;
    }
  }

  async getFeedbackAnalytics() {
    try {
      const { rows } = await query(`
        WITH feedback_stats AS (
          SELECT 
            DATE_TRUNC('day', created_at) as date,
            type,
            COUNT(*) as count,
            AVG(CASE WHEN rating IS NOT NULL THEN rating ELSE NULL END) as avg_rating
          FROM beta_feedback
          WHERE created_at > NOW() - interval '30 days'
          GROUP BY DATE_TRUNC('day', created_at), type
        )
        SELECT 
          date,
          jsonb_object_agg(type, count) as counts,
          jsonb_object_agg(type, ROUND(COALESCE(avg_rating, 0)::numeric, 2)) as ratings
        FROM feedback_stats
        GROUP BY date
        ORDER BY date DESC
      `);

      return rows;
    } catch (error) {
      console.error('Error getting feedback analytics:', error);
      throw error;
    }
  }

  async getUserAnalytics(did: string) {
    try {
      const [profile, activity, feedback] = await Promise.all([
        atproto.getProfile(did),
        query(
          `
          SELECT 
            event_type,
            COUNT(*) as count,
            MAX(server_timestamp) as last_activity
          FROM at_protocol_analytics
          WHERE user_id = $1
          GROUP BY event_type
        `,
          [did]
        ),
        query(
          `
          SELECT *
          FROM beta_feedback
          WHERE user_id = $1
          ORDER BY created_at DESC
        `,
          [did]
        ),
      ]);

      return {
        profile: profile.data,
        activity: activity.rows,
        feedback: feedback.rows,
      };
    } catch (error) {
      console.error('Error getting user analytics:', error);
      throw error;
    }
  }
}

export const admin = AdminService.getInstance();
