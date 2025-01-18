import { atproto } from './atproto';
import { query, transaction } from '../db';
import { RichText } from '@atproto/api';

export interface AppealEvidence {
  description: string;
  attachments: Array<{
    type: 'text' | 'image' | 'link';
    content: string;
  }>;
}

export interface AppealRequest {
  actionId: string;
  userId: string;
  reason: string;
  evidence?: AppealEvidence;
}

export interface AppealReview {
  appealId: string;
  reviewerId: string;
  decision: 'approved' | 'denied';
  reason: string;
  actionTaken?: string;
}

export interface Appeal {
  id: string;
  action_id: string;
  user_id: string;
  reason: string;
  evidence?: AppealEvidence;
  status: 'pending' | 'approved' | 'denied';
  reviewer_id?: string;
  review_reason?: string;
  review_action?: string;
  created_at: string;
  reviewed_at?: string;
  action_type?: string;
  action_reason?: string;
  action_date?: string;
  user_handle?: string;
  user_at_handle?: string;
  reviewer_handle?: string;
}

export interface AppealStats {
  total_appeals: number;
  pending_appeals: number;
  approved_appeals: number;
  denied_appeals: number;
  avg_review_time: number;
}

class AppealService {
  private static instance: AppealService;

  private constructor() {}

  public static getInstance(): AppealService {
    if (!AppealService.instance) {
      AppealService.instance = new AppealService();
    }
    return AppealService.instance;
  }

  async submitAppeal(appeal: AppealRequest): Promise<{ id: string }> {
    try {
      const result = await transaction(async client => {
        // Check if user has unknown pending appeals
        const {
          rows: [pendingAppeal],
        } = await client.query<{ id: string }>(
          `
          SELECT id FROM appeals
          WHERE user_id = $1 AND status = 'pending'
          LIMIT 1
        `,
          [appeal.userId]
        );

        if (pendingAppeal) {
          throw new Error('You already have a pending appeal');
        }

        // Create appeal record
        const {
          rows: [newAppeal],
        } = await client.query<{ id: string }>(
          `
          INSERT INTO appeals (
            action_id,
            user_id,
            reason,
            evidence,
            status,
            created_at
          ) VALUES ($1, $2, $3, $4, 'pending', CURRENT_TIMESTAMP)
          RETURNING id
        `,
          [
            appeal.actionId,
            appeal.userId,
            appeal.reason,
            appeal.evidence ? JSON.stringify(appeal.evidence) : null,
          ]
        );

        // Notify admins via AT Protocol
        const text = `New appeal submitted for review\nAppeal ID: ${newAppeal.id}\nUser: ${appeal.userId}`;
        const richText = new RichText({ text });
        await richText.detectFacets(atproto.agent);

        await atproto.agent.app.bsky.feed.post.create(
          { repo: process.env.ADMIN_DID as string },
          {
            text: richText.text,
            facets: richText.facets,
            createdAt: new Date().toISOString(),
          }
        );

        return newAppeal;
      });

      return result;
    } catch (error) {
      console.error('Error submitting appeal:', error);
      throw error;
    }
  }

  async reviewAppeal(review: AppealReview): Promise<boolean> {
    try {
      await transaction(async client => {
        // Update appeal status
        const {
          rows: [appeal],
        } = await client.query<Appeal>(
          `
          UPDATE appeals
          SET 
            status = $1,
            reviewer_id = $2,
            review_reason = $3,
            review_action = $4,
            reviewed_at = CURRENT_TIMESTAMP
          WHERE id = $5
          RETURNING *
        `,
          [
            review.decision === 'approved' ? 'approved' : 'denied',
            review.reviewerId,
            review.reason,
            review.actionTaken,
            review.appealId,
          ]
        );

        if (!appeal) {
          throw new Error('Appeal not found');
        }

        // If approved, reverse the original action
        if (review.decision === 'approved') {
          const {
            rows: [action],
          } = await client.query<{ id: string; type: string; target_did: string }>(
            `
            SELECT * FROM mod_actions WHERE id = $1
          `,
            [appeal.action_id]
          );

          if (action) {
            switch (action.type) {
              case 'block':
                await atproto.agent.app.bsky.actor.block.delete({
                  subject: action.target_did,
                });
                break;

              case 'mute':
                await atproto.agent.app.bsky.actor.mute.delete({
                  actor: action.target_did,
                });
                break;
            }
          }
        }

        // Notify user via AT Protocol
        const text = `Appeal ${review.appealId} has been ${review.decision}.\nReason: ${review.reason}`;
        const richText = new RichText({ text });
        await richText.detectFacets(atproto.agent);

        await atproto.agent.app.bsky.feed.post.create(
          { repo: appeal.user_id },
          {
            text: richText.text,
            facets: richText.facets,
            createdAt: new Date().toISOString(),
          }
        );
      });

      return true;
    } catch (error) {
      console.error('Error reviewing appeal:', error);
      throw error;
    }
  }

  async getAppealsByUser(userId: string): Promise<Appeal[]> {
    try {
      const { rows } = await query<Appeal>(
        `
        SELECT 
          a.*,
          ma.type as action_type,
          ma.reason as action_reason,
          ma.created_at as action_date,
          bu.handle as reviewer_handle
        FROM appeals a
        LEFT JOIN mod_actions ma ON a.action_id = ma.id
        LEFT JOIN beta_users bu ON a.reviewer_id = bu.did
        WHERE a.user_id = $1
        ORDER BY a.created_at DESC
      `,
        [userId]
      );

      return rows;
    } catch (error) {
      console.error('Error getting user appeals:', error);
      throw error;
    }
  }

  async getPendingAppeals(): Promise<Appeal[]> {
    try {
      const { rows } = await query<Appeal>(`
        SELECT 
          a.*,
          ma.type as action_type,
          ma.reason as action_reason,
          ma.created_at as action_date,
          bu.handle as user_handle,
          bu.at_handle as user_at_handle
        FROM appeals a
        LEFT JOIN mod_actions ma ON a.action_id = ma.id
        LEFT JOIN beta_users bu ON a.user_id = bu.did
        WHERE a.status = 'pending'
        ORDER BY a.created_at ASC
      `);

      return rows;
    } catch (error) {
      console.error('Error getting pending appeals:', error);
      throw error;
    }
  }

  async getAppealStats(): Promise<AppealStats> {
    try {
      const { rows } = await query<AppealStats>(`
        SELECT
          COUNT(*) as total_appeals,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_appeals,
          COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_appeals,
          COUNT(CASE WHEN status = 'denied' THEN 1 END) as denied_appeals,
          AVG(EXTRACT(EPOCH FROM (reviewed_at - created_at))/3600)::numeric(10,2) as avg_review_time
        FROM appeals
      `);

      return rows[0];
    } catch (error) {
      console.error('Error getting appeal stats:', error);
      throw error;
    }
  }
}

export const appeal = AppealService.getInstance();
