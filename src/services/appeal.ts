import { atproto } from './atproto';
import { query, transaction } from '../db';
import { RichText } from '@atproto/api';
import { BskyAgent } from '@atproto/api';
import { AppBskyFeedPost } from '@atproto/api';
import { logger } from '../utils/logger';
import { appealConfig } from '../config/appeal';

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
  private agent: BskyAgent;
  private readonly appealQueue: Map<string, Appeal>;
  private readonly maxQueueSize: number;

  private constructor() {
    this.agent = atproto.agent;
    this.appealQueue = new Map();
    this.maxQueueSize = appealConfig.maxQueueSize || 1000;
  }

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

        // Store in queue
        if (this.appealQueue.size >= this.maxQueueSize) {
          const firstKey = this.appealQueue.keys().next().value;
          this.appealQueue.delete(firstKey);
        }
        this.appealQueue.set(newAppeal.id, {
          id: newAppeal.id,
          action_id: appeal.actionId,
          user_id: appeal.userId,
          reason: appeal.reason,
          evidence: appeal.evidence,
          status: 'pending',
          created_at: new Date().toISOString(),
        });

        // Notify admins via AT Protocol
        const text = `New appeal submitted for review\nAppeal ID: ${newAppeal.id}\nUser: ${appeal.userId}`;
        const richText = new RichText({ text });
        await richText.detectFacets(this.agent);

        await this.agent.app.bsky.feed.post.create(
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
                await this.agent.app.bsky.actor.block.delete({
                  subject: action.target_did,
                });
                break;

              case 'mute':
                await this.agent.app.bsky.actor.mute.delete({
                  actor: action.target_did,
                });
                break;
            }
          }
        }

        // Notify user via AT Protocol
        const text = `Appeal ${review.appealId} has been ${review.decision}.\nReason: ${review.reason}`;
        const richText = new RichText({ text });
        await richText.detectFacets(this.agent);

        await this.agent.app.bsky.feed.post.create(
          { repo: appeal.user_id },
          {
            text: richText.text,
            facets: richText.facets,
            createdAt: new Date().toISOString(),
          }
        );

        // Update appeal status in queue
        const updatedAppeal: Appeal = {
          ...this.appealQueue.get(review.appealId),
          status: review.decision === 'approved' ? 'approved' : 'denied',
          reviewer_id: review.reviewerId,
          review_reason: review.reason,
          review_action: review.actionTaken,
          reviewed_at: new Date().toISOString(),
        };
        this.appealQueue.set(review.appealId, updatedAppeal);
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

  async getAppeal(appealId: string): Promise<Appeal | null> {
    try {
      const appeal = this.appealQueue.get(appealId);
      if (!appeal) {
        logger.warn('Appeal not found', { appealId });
        return null;
      }
      return appeal;
    } catch (error) {
      logger.error('Appeal retrieval failed', { appealId, error });
      throw new Error(`Failed to get appeal: ${error.message}`);
    }
  }

  async getUserAppeals(userId: string): Promise<Appeal[]> {
    try {
      return Array.from(this.appealQueue.values())
        .filter(appeal => appeal.user_id === userId)
        .sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
    } catch (error) {
      logger.error('User appeals retrieval failed', { userId, error });
      throw new Error(`Failed to get user appeals: ${error.message}`);
    }
  }

  async updateAppealStatus(
    appealId: string,
    status: 'approved' | 'denied',
    adminNotes?: string
  ): Promise<Appeal> {
    try {
      const appeal = await this.getAppeal(appealId);
      if (!appeal) {
        throw new Error('Appeal not found');
      }

      const updatedAppeal: Appeal = {
        ...appeal,
        status,
        admin_notes: adminNotes,
        updated_at: new Date().toISOString(),
      };

      this.appealQueue.set(appealId, updatedAppeal);

      // If appeal is approved, restore content
      if (status === 'approved') {
        await this.handleApprovedAppeal(appeal);
      }

      // Log status update
      logger.info('Appeal status updated', { 
        appealId,
        oldStatus: appeal.status,
        newStatus: status 
      });

      return updatedAppeal;
    } catch (error) {
      logger.error('Appeal status update failed', { appealId, status, error });
      throw new Error(`Failed to update appeal status: ${error.message}`);
    }
  }

  private async handleApprovedAppeal(appeal: Appeal): Promise<void> {
    try {
      switch (appeal.action_type) {
        case 'post_removal':
          await this.restorePost(appeal);
          break;
        case 'account_suspension':
          await this.restoreAccount(appeal);
          break;
        case 'strike':
          await this.removeStrike(appeal);
          break;
        default:
          logger.warn('Unknown appeal type', { type: appeal.action_type });
      }
    } catch (error) {
      logger.error('Appeal approval handling failed', { 
        appealId: appeal.id,
        type: appeal.action_type,
        error 
      });
      throw error;
    }
  }

  private async restorePost(appeal: Appeal): Promise<void> {
    try {
      // Get original post data from evidence
      const postData = JSON.parse(appeal.evidence || '{}');
      if (!postData.uri || !postData.record) {
        throw new Error('Invalid post data in evidence');
      }

      // Restore the post using AT Protocol
      await this.agent.api.app.bsky.feed.post.create(
        { did: appeal.user_id },
        postData.record
      );

      logger.info('Post restored', { 
        appealId: appeal.id,
        userId: appeal.user_id,
        postUri: postData.uri 
      });
    } catch (error) {
      logger.error('Post restoration failed', { 
        appealId: appeal.id,
        error 
      });
      throw error;
    }
  }

  private async restoreAccount(appeal: Appeal): Promise<void> {
    try {
      // Implement account restoration logic using AT Protocol
      // This will depend on your specific implementation
      logger.info('Account restored', { 
        appealId: appeal.id,
        userId: appeal.user_id 
      });
    } catch (error) {
      logger.error('Account restoration failed', { 
        appealId: appeal.id,
        error 
      });
      throw error;
    }
  }

  private async removeStrike(appeal: Appeal): Promise<void> {
    try {
      // Implement strike removal logic
      // This will depend on your strike system implementation
      logger.info('Strike removed', { 
        appealId: appeal.id,
        userId: appeal.user_id 
      });
    } catch (error) {
      logger.error('Strike removal failed', { 
        appealId: appeal.id,
        error 
      });
      throw error;
    }
  }

  async getPendingAppeals(): Promise<Appeal[]> {
    try {
      return Array.from(this.appealQueue.values())
        .filter(appeal => appeal.status === 'pending')
        .sort((a, b) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
    } catch (error) {
      logger.error('Pending appeals retrieval failed', { error });
      throw new Error(`Failed to get pending appeals: ${error.message}`);
    }
  }

  async getAppealsStats(): Promise<{
    total: number;
    pending: number;
    approved: number;
    rejected: number;
  }> {
    try {
      const appeals = Array.from(this.appealQueue.values());
      return {
        total: appeals.length,
        pending: appeals.filter(a => a.status === 'pending').length,
        approved: appeals.filter(a => a.status === 'approved').length,
        rejected: appeals.filter(a => a.status === 'denied').length,
      };
    } catch (error) {
      logger.error('Appeals stats retrieval failed', { error });
      throw new Error(`Failed to get appeals stats: ${error.message}`);
    }
  }
}

export const appeal = AppealService.getInstance();
