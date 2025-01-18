import { BskyAgent } from '@atproto/api';
import * as OTPAuth from 'otpauth';
import QRCode from 'qrcode';

export class MFAService {
  private agent: BskyAgent;

  constructor(agent: BskyAgent) {
    this.agent = agent;
  }

  async setupMFA(userId: string): Promise<{ secret: string; qrCode: string }> {
    try {
      // Generate TOTP secret
      const totp = new OTPAuth.TOTP({
        issuer: 'TikTokToe',
        label: userId,
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.generate(20),
      });

      // Generate QR code
      const qrCode = await QRCode.toDataURL(totp.toString());

      // Store the secret in AT Protocol user data
      await this.agent.com.atproto.repo.putRecord({
        repo: this.agent.session?.did,
        collection: 'app.bsky.actor.profile',
        rkey: 'mfa',
        record: {
          mfaEnabled: true,
          mfaSecret: totp.secret.base32,
        },
      });

      return {
        secret: totp.secret.base32,
        qrCode,
      };
    } catch (error) {
      console.error('Error setting up MFA:', error);
      throw new Error('Failed to set up MFA');
    }
  }

  async verifyMFACode(code: string): Promise<boolean> {
    try {
      // Get user's MFA secret
      const response = await this.agent.com.atproto.repo.getRecord({
        repo: this.agent.session?.did,
        collection: 'app.bsky.actor.profile',
        rkey: 'mfa',
      });

      const { mfaSecret } = response.data.value as unknown;

      // Verify the code
      const totp = new OTPAuth.TOTP({
        issuer: 'TikTokToe',
        label: this.agent.session?.did,
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret: mfaSecret,
      });

      return totp.validate({ token: code, window: 1 }) !== null;
    } catch (error) {
      console.error('Error verifying MFA code:', error);
      throw new Error('Failed to verify MFA code');
    }
  }

  async disableMFA(): Promise<void> {
    try {
      await this.agent.com.atproto.repo.deleteRecord({
        repo: this.agent.session?.did,
        collection: 'app.bsky.actor.profile',
        rkey: 'mfa',
      });
    } catch (error) {
      console.error('Error disabling MFA:', error);
      throw new Error('Failed to disable MFA');
    }
  }

  async isMFAEnabled(): Promise<boolean> {
    try {
      const response = await this.agent.com.atproto.repo.getRecord({
        repo: this.agent.session?.did,
        collection: 'app.bsky.actor.profile',
        rkey: 'mfa',
      });
      return (response.data.value as unknown).mfaEnabled === true;
    } catch (error) {
      return false;
    }
  }
}
