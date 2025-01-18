import { BskyAgent } from '@atproto/api';

export class ApiService {
  private agent: BskyAgent;
  private static instance: ApiService;

  private constructor(serviceUrl = 'https://bsky.social') {
    this.agent = new BskyAgent({ service: serviceUrl });
  }

  static getInstance(serviceUrl?: string): ApiService {
    if (!ApiService.instance) {
      ApiService.instance = new ApiService(serviceUrl);
    }
    return ApiService.instance;
  }

  async initialize(identifier: string, password: string): Promise<void> {
    await this.agent.login({ identifier, password });
  }

  getAgent(): BskyAgent {
    if (!this.agent.session) {
      throw new Error('API service not initialized. Call initialize() first.');
    }
    return this.agent;
  }

  async refreshSession(): Promise<void> {
    if (!this.agent.session) {
      throw new Error('No session to refresh');
    }
    await this.agent.resumeSession(this.agent.session);
  }

  async logout(): Promise<void> {
    await this.agent.logout();
  }
}
