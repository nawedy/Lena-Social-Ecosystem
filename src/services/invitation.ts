import { AppBskyFeedPost, RichText } from '@atproto/api';

import { query, transaction } from '../db';

import { atproto } from './atproto';
import { sendEmail } from './email';

interface InvitationData {
  inviterDid: string;
  inviteeEmail: string;
  inviteeHandle?: string;
  customMessage?: string;
}

class InvitationService {
  private static instance: InvitationService;

  private constructor() {}

  public static getInstance(): InvitationService {
    if (!InvitationService.instance) {
      InvitationService.instance = new InvitationService();
    }
    return InvitationService.instance;
  }

  async generateInvitationCode(inviterDid: string): Promise<string> {
    const code =
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15);

    await query(
      `UPDATE beta_users 
      SET invitation_code = $1 
      WHERE did = $2`,
      [code, inviterDid]
    );

    return code;
  }

  async sendInvitation(data: InvitationData): Promise<boolean> {
    try {
      const invitationCode = await this.generateInvitationCode(data.inviterDid);

      const inviterProfile = await atproto.getProfile(data.inviterDid);

      // Create invitation record
      await transaction(async client => {
        await client.query(
          `INSERT INTO beta_invitations 
          (inviter_did, invitee_email, invitation_code, status, metadata)
          VALUES ($1, $2, $3, $4, $5)`,
          [
            data.inviterDid,
            data.inviteeEmail,
            invitationCode,
            'pending',
            {
              inviteeHandle: data.inviteeHandle,
              customMessage: data.customMessage,
              sentAt: new Date().toISOString(),
            },
          ]
        );

        // Track analytics
        await client.query(
          `INSERT INTO at_protocol_analytics 
          (user_id, event_type, event_data)
          VALUES ($1, $2, $3)`,
          [
            data.inviterDid,
            'invitation_sent',
            {
              inviteeEmail: data.inviteeEmail,
              inviteeHandle: data.inviteeHandle,
              timestamp: new Date().toISOString(),
            },
          ]
        );
      });

      // Send invitation email
      await sendEmail({
        to: data.inviteeEmail,
        subject: `${inviterProfile.data.displayName} invited you to join TikTokToe Beta!`,
        template: 'beta-invitation',
        data: {
          inviterName: inviterProfile.data.displayName,
          inviterHandle: inviterProfile.data.handle,
          invitationCode,
          customMessage: data.customMessage,
          inviteeHandle: data.inviteeHandle,
        },
      });

      // Post invitation announcement if handle is provided
      if (data.inviteeHandle) {
        await this.postInvitationAnnouncement(
          data.inviterDid,
          data.inviteeHandle,
          inviterProfile.data.handle
        );
      }

      return true;
    } catch (error) {
      console.error('Error sending invitation:', error);
      return false;
    }
  }

  private async postInvitationAnnouncement(
    _inviterDid: string,
    inviteeHandle: string,
    _inviterHandle: string
  ) {
    try {
      const text = `🎉 Just invited @${inviteeHandle} to join the TikTokToe beta! Can't wait to see you on the platform! #TikTokToeBeta`;

      const richText = new RichText({ text });
      await richText.detectFacets(atproto.agent);

      const post = {
        text: richText.text,
        facets: richText.facets,
        embed: {
          $type: 'app.bsky.embed.external',
          external: {
            uri: 'https://tiktoktoe.app/beta',
            title: 'Join TikTokToe Beta',
            description:
              'Experience the future of social media with AT Protocol',
          },
        },
      };

      await atproto.post(post);
    } catch (error) {
      console.error('Error posting invitation announcement:', error);
    }
  }

  async validateInvitation(code: string): Promise<{
    valid: boolean;
    inviterDid?: string;
    metadata?: any;
  }> {
    try {
      const { rows } = await query(
        `SELECT i.*, bu.handle as inviter_handle, bu.at_handle as inviter_at_handle
        FROM beta_invitations i
        JOIN beta_users bu ON i.inviter_did = bu.did
        WHERE i.invitation_code = $1 AND i.status = 'pending'`,
        [code]
      );

      if (rows.length === 0) {
        return { valid: false };
      }

      return {
        valid: true,
        inviterDid: rows[0].inviter_did,
        metadata: {
          ...rows[0].metadata,
          inviterHandle: rows[0].inviter_handle,
          inviterAtHandle: rows[0].inviter_at_handle,
        },
      };
    } catch (error) {
      console.error('Error validating invitation:', error);
      return { valid: false };
    }
  }

  async acceptInvitation(code: string, did: string): Promise<boolean> {
    try {
      const validation = await this.validateInvitation(code);
      if (!validation.valid) {
        return false;
      }

      await transaction(async client => {
        // Update invitation status
        await client.query(
          `UPDATE beta_invitations 
          SET status = 'accepted', 
              accepted_at = CURRENT_TIMESTAMP,
              accepted_by_did = $1
          WHERE invitation_code = $2`,
          [did, code]
        );

        // Create beta user
        await client.query(
          `INSERT INTO beta_users 
          (did, status, invited_by, invitation_code)
          VALUES ($1, $2, $3, $4)`,
          [did, 'active', validation.inviterDid, code]
        );

        // Track analytics
        await client.query(
          `INSERT INTO at_protocol_analytics 
          (user_id, event_type, event_data)
          VALUES ($1, $2, $3)`,
          [
            did,
            'invitation_accepted',
            {
              inviterDid: validation.inviterDid,
              timestamp: new Date().toISOString(),
            },
          ]
        );
      });

      return true;
    } catch (error) {
      console.error('Error accepting invitation:', error);
      return false;
    }
  }

  async getInvitationStats(inviterDid: string) {
    try {
      const { rows } = await query(
        `SELECT 
          COUNT(*) as total_sent,
          COUNT(CASE WHEN status = 'accepted' THEN 1 END) as accepted,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
          json_build_object(
            'last_sent', MAX(created_at),
            'last_accepted', MAX(accepted_at)
          ) as timestamps
        FROM beta_invitations
        WHERE inviter_did = $1`,
        [inviterDid]
      );

      return rows[0];
    } catch (error) {
      console.error('Error getting invitation stats:', error);
      return null;
    }
  }
}

export const invitation = InvitationService.getInstance();
