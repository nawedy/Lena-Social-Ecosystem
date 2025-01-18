import { AtpAgent, BskyAgent } from '@atproto/api';

export interface UserIdentity {
  did: string;
  handle: string;
  email?: string;
  profileData: {
    displayName?: string;
    description?: string;
    avatar?: string;
  };
}

export class IdentityManager {
  private agent: BskyAgent;

  constructor(serviceUrl: string = 'https://bsky.social') {
    this.agent = new BskyAgent({ service: serviceUrl });
  }

  async createSession(
    identifier: string,
    password: string
  ): Promise<UserIdentity> {
    const response = await this.agent.login({ identifier, password });

    return {
      did: response.data.did,
      handle: response.data.handle,
      profileData: {
        displayName: response.data.displayName,
        description: response.data.description,
      },
    };
  }

  async getProfile(actor: string): Promise<UserIdentity> {
    const response = await this.agent.getProfile({ actor });

    return {
      did: response.data.did,
      handle: response.data.handle,
      profileData: {
        displayName: response.data.displayName,
        description: response.data.description,
        avatar: response.data.avatar,
      },
    };
  }

  async updateProfile(
    profile: Partial<UserIdentity['profileData']>
  ): Promise<void> {
    await this.agent.upsertProfile(existing => ({
      ...existing,
      ...profile,
    }));
  }
}
