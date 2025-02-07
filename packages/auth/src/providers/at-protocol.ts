import { BskyAgent } from '@atproto/api';
import type { AuthUser, AuthSession } from '../types';

export class AtProtocolProvider {
  private agent: BskyAgent;

  constructor(service: string = 'https://bsky.social') {
    this.agent = new BskyAgent({ service });
  }

  async signIn(identifier: string, password: string): Promise<AuthSession> {
    try {
      const response = await this.agent.login({ identifier, password });
      
      const user: AuthUser = {
        id: response.data.did,
        did: response.data.did,
        username: response.data.handle,
        isVerified: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      return {
        user,
        accessToken: response.data.accessJwt,
        refreshToken: response.data.refreshJwt,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      };
    } catch (error) {
      throw new Error(`AT Protocol authentication failed: ${error.message}`);
    }
  }

  async createAccount(email: string, password: string, username: string): Promise<AuthSession> {
    try {
      const response = await this.agent.createAccount({
        email,
        password,
        handle: username
      });

      const user: AuthUser = {
        id: response.data.did,
        did: response.data.did,
        email,
        username: response.data.handle,
        isVerified: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      return {
        user,
        accessToken: response.data.accessJwt,
        refreshToken: response.data.refreshJwt,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      };
    } catch (error) {
      throw new Error(`AT Protocol account creation failed: ${error.message}`);
    }
  }

  async refreshSession(refreshToken: string): Promise<AuthSession> {
    try {
      const response = await this.agent.resumeSession({
        refreshJwt: refreshToken
      });

      const user: AuthUser = {
        id: response.data.did,
        did: response.data.did,
        username: response.data.handle,
        isVerified: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      return {
        user,
        accessToken: response.data.accessJwt,
        refreshToken: response.data.refreshJwt,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      };
    } catch (error) {
      throw new Error(`AT Protocol session refresh failed: ${error.message}`);
    }
  }

  async getProfile(did: string): Promise<any> {
    try {
      const response = await this.agent.getProfile({ actor: did });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch AT Protocol profile: ${error.message}`);
    }
  }
} 