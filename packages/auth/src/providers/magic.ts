import { Magic } from 'magic-sdk';
import type { AuthUser, AuthSession } from '../types';

export class MagicProvider {
  private magic: Magic;

  constructor(apiKey: string) {
    this.magic = new Magic(apiKey);
  }

  async signInWithMagicLink(email: string): Promise<AuthSession> {
    try {
      const didToken = await this.magic.auth.loginWithMagicLink({ email });
      
      if (!didToken) {
        throw new Error('Magic link authentication failed');
      }

      const metadata = await this.magic.user.getMetadata();
      
      const user: AuthUser = {
        id: metadata.issuer!,
        email: metadata.email!,
        isVerified: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      return {
        user,
        accessToken: didToken,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      };
    } catch (error) {
      throw new Error(`Magic link authentication failed: ${error.message}`);
    }
  }

  async signInWithSocial(provider: 'google' | 'twitter' | 'facebook'): Promise<AuthSession> {
    try {
      const didToken = await this.magic.oauth.loginWithRedirect({
        provider,
        redirectURI: new URL('/callback', window.location.origin).href
      });

      const metadata = await this.magic.user.getMetadata();

      const user: AuthUser = {
        id: metadata.issuer!,
        email: metadata.email!,
        isVerified: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      return {
        user,
        accessToken: didToken!,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      };
    } catch (error) {
      throw new Error(`Social authentication failed: ${error.message}`);
    }
  }

  async getUser(): Promise<AuthUser | null> {
    try {
      const isLoggedIn = await this.magic.user.isLoggedIn();
      
      if (!isLoggedIn) {
        return null;
      }

      const metadata = await this.magic.user.getMetadata();

      return {
        id: metadata.issuer!,
        email: metadata.email!,
        isVerified: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    } catch (error) {
      throw new Error(`Failed to get user: ${error.message}`);
    }
  }

  async logout(): Promise<void> {
    try {
      await this.magic.user.logout();
    } catch (error) {
      throw new Error(`Logout failed: ${error.message}`);
    }
  }
} 