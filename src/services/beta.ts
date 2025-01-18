import { atproto } from './atproto';
import { query, transaction } from '../db';
import { RichText } from '@atproto/api';
import { Storage } from '@google-cloud/storage';
import { PubSub } from '@google-cloud/pubsub';

const storage = new Storage();
const pubsub = new PubSub();

interface BetaInvitation {
  email: string;
  inviterDid: string;
  customMessage?: string;
}

interface BetaFeedback {
  userId: string;
  type: 'bug' | 'feature' | 'general';
  title: string;
  description: string;
  rating?: number;
  attachments?: Array<{
    type: 'image' | 'video';
    url: string;
  }>;
  metadata?: Record<string, any>;
}

class BetaService {
  private static instance: BetaService;
  private readonly mediaBucket: string;
  private readonly feedbackTopic: string;

  private constructor() {
    this.mediaBucket = process.env.MEDIA_BUCKET || 'tiktok-toe-media';
    this.feedbackTopic = 'beta-feedback';
  }

  public static getInstance(): BetaService {
    if (!BetaService.instance) {
      BetaService.instance = new BetaService();
    }
    return BetaService.instance;
  }

  async sendInvitation(invitation: BetaInvitation): Promise<boolean> {
    try {
      const result = await transaction(async client => {
        // Check inviter's quota
        const {
          rows: [inviter],
        } = await client.query(
          `
          SELECT invitations_sent, max_invitations
          FROM beta_users
          WHERE did = $1
        `,
          [invitation.inviterDid]
        );

        if (inviter.invitations_sent >= inviter.max_invitations) {
          throw new Error('Invitation quota exceeded');
        }

        // Generate unique invitation code
        const invitationCode = await this.generateInvitationCode();

        // Create invitation record
        const {
          rows: [newInvitation],
        } = await client.query(
          `
          INSERT INTO beta_invitations (
            inviter_did,
            invitee_email,
            invitation_code,
            metadata
          ) VALUES ($1, $2, $3, $4)
          RETURNING id
        `,
          [
            invitation.inviterDid,
            invitation.email,
            invitationCode,
            { customMessage: invitation.customMessage },
          ]
        );

        // Update inviter's quota
        await client.query(
          `
          UPDATE beta_users
          SET invitations_sent = invitations_sent + 1
          WHERE did = $1
        `,
          [invitation.inviterDid]
        );

        // Send invitation email via Cloud Pub/Sub
        const topic = pubsub.topic('email-notifications');
        await topic.publish(
          Buffer.from(
            JSON.stringify({
              type: 'beta-invitation',
              data: {
                email: invitation.email,
                code: invitationCode,
                message: invitation.customMessage,
              },
            })
          )
        );

        // Post invitation announcement on AT Protocol
        const text = `I just invited someone to join the beta! 🎉 #BetaTesting`;
        const richText = new RichText({ text });
        await richText.detectFacets(atproto.agent);

        await atproto.agent.app.bsky.feed.post.create(
          { repo: invitation.inviterDid },
          {
            text: richText.text,
            facets: richText.facets,
            createdAt: new Date().toISOString(),
          }
        );

        return newInvitation;
      });

      return true;
    } catch (error) {
      console.error('Error sending invitation:', error);
      return false;
    }
  }

  async submitFeedback(feedback: BetaFeedback): Promise<boolean> {
    try {
      // Upload attachments to Cloud Storage
      const attachments = await Promise.all(
        (feedback.attachments || []).map(async attachment => {
          const bucket = storage.bucket(this.mediaBucket);
          const filename = `feedback/${feedback.userId}/${Date.now()}-${Math.random().toString(36).substring(7)}`;
          const file = bucket.file(filename);

          await file.save(Buffer.from(attachment.url.split(',')[1], 'base64'), {
            metadata: {
              contentType:
                attachment.type === 'image' ? 'image/jpeg' : 'video/mp4',
            },
          });

          return {
            ...attachment,
            url: `gs://${this.mediaBucket}/${filename}`,
          };
        })
      );

      // Store feedback in database
      const {
        rows: [newFeedback],
      } = await query(
        `
        INSERT INTO beta_feedback (
          user_id,
          type,
          title,
          description,
          rating,
          attachments,
          metadata,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
        RETURNING id
      `,
        [
          feedback.userId,
          feedback.type,
          feedback.title,
          feedback.description,
          feedback.rating,
          JSON.stringify(attachments),
          feedback.metadata,
        ]
      );

      // Publish feedback event to Cloud Pub/Sub
      const topic = pubsub.topic(this.feedbackTopic);
      await topic.publish(
        Buffer.from(
          JSON.stringify({
            id: newFeedback.id,
            ...feedback,
            attachments,
          })
        )
      );

      // Post feedback summary on AT Protocol (if not a bug report)
      if (feedback.type !== 'bug') {
        const text = `Just submitted ${feedback.type} feedback for the beta! 💡 #BetaFeedback`;
        const richText = new RichText({ text });
        await richText.detectFacets(atproto.agent);

        await atproto.agent.app.bsky.feed.post.create(
          { repo: feedback.userId },
          {
            text: richText.text,
            facets: richText.facets,
            createdAt: new Date().toISOString(),
          }
        );
      }

      return true;
    } catch (error) {
      console.error('Error submitting feedback:', error);
      return false;
    }
  }

  private async generateInvitationCode(): Promise<string> {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code: string;

    do {
      code = Array.from({ length: 8 }, () =>
        chars.charAt(Math.floor(Math.random() * chars.length))
      ).join('');

      const { rows } = await query(
        `
        SELECT id FROM beta_invitations WHERE invitation_code = $1
      `,
        [code]
      );

      if (rows.length === 0) break;
    } while (true);

    return code;
  }

  async getBetaStats() {
    try {
      const [userStats, feedbackStats] = await Promise.all([
        query(`
          SELECT
            COUNT(*) as total_users,
            COUNT(CASE WHEN last_active_at > NOW() - interval '7 days' THEN 1 END) as active_users,
            SUM(invitations_sent) as total_invitations,
            SUM(invitations_accepted) as accepted_invitations
          FROM beta_users
        `),
        query(`
          SELECT
            type,
            COUNT(*) as count,
            AVG(rating) as avg_rating
          FROM beta_feedback
          GROUP BY type
        `),
      ]);

      return {
        users: userStats.rows[0],
        feedback: feedbackStats.rows,
      };
    } catch (error) {
      console.error('Error getting beta stats:', error);
      throw error;
    }
  }
}

export const beta = BetaService.getInstance();
