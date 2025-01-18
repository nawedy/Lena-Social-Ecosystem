import { BskyAgent } from '@atproto/api';

import { atproto } from './atproto';

export interface ModerationRule {
  id: string;
  type: 'keyword' | 'regex' | 'ai';
  pattern: string;
  action: 'flag' | 'hide' | 'block';
  scope: 'global' | 'personal';
  createdAt: string;
  updatedAt: string;
}

export interface ModerationAction {
  id: string;
  ruleId: string;
  contentUri: string;
  action: 'flagged' | 'hidden' | 'blocked';
  reason: string;
  timestamp: string;
}

export class ATProtocolModerationService {
  private agent: BskyAgent;

  constructor() {
    this.agent = atproto.getAgent();
  }

  // Community Guidelines Management
  async createCommunityGuidelines(params: {
    rules: string[];
    description: string;
    version: string;
    enforcementPolicy: {
      violations: {
        type: string;
        severity: 'low' | 'medium' | 'high';
        actions: string[];
      }[];
    };
  }) {
    try {
      const record = {
        $type: 'app.bsky.moderation.guidelines',
        ...params,
        createdAt: new Date().toISOString(),
      };

      return await this.agent.api.com.atproto.repo.createRecord({
        repo: this.agent.session?.did ?? '',
        collection: 'app.bsky.moderation.guidelines',
        record,
      });
    } catch (error) {
      console.error('AT Protocol community guidelines creation error:', error);
      throw error;
    }
  }

  // Moderation Rules
  async createModerationRule(params: {
    type: 'keyword' | 'regex' | 'ai';
    pattern: string;
    action: 'flag' | 'hide' | 'block';
    scope: 'global' | 'personal';
  }): Promise<ModerationRule> {
    try {
      const timestamp = new Date().toISOString();
      const record = {
        $type: 'app.bsky.moderation.rule',
        ...params,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      const response = await this.agent.api.com.atproto.repo.createRecord({
        repo: this.agent.session?.did ?? '',
        collection: 'app.bsky.moderation.rule',
        record,
      });

      return {
        id: response.uri,
        ...params,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
    } catch (error) {
      console.error('AT Protocol moderation rule creation error:', error);
      throw error;
    }
  }

  // Content Filtering
  async filterContent(content: string): Promise<{
    filtered: boolean;
    rules: ModerationRule[];
    suggestedAction?: 'flag' | 'hide' | 'block';
  }> {
    try {
      return await this.agent.api.app.bsky.moderation.filterContent({
        content,
        did: this.agent.session?.did ?? '',
      });
    } catch (error) {
      console.error('AT Protocol content filtering error:', error);
      throw error;
    }
  }

  // Moderation Actions
  async takeModerationAction(params: {
    contentUri: string;
    ruleId: string;
    action: 'flag' | 'hide' | 'block';
    reason: string;
  }): Promise<ModerationAction> {
    try {
      const record = {
        $type: 'app.bsky.moderation.action',
        content: params.contentUri,
        rule: params.ruleId,
        action: params.action,
        reason: params.reason,
        timestamp: new Date().toISOString(),
      };

      const response = await this.agent.api.com.atproto.repo.createRecord({
        repo: this.agent.session?.did ?? '',
        collection: 'app.bsky.moderation.action',
        record,
      });

      return {
        id: response.uri,
        ruleId: params.ruleId,
        contentUri: params.contentUri,
        action: params.action as 'flagged' | 'hidden' | 'blocked',
        reason: params.reason,
        timestamp: record.timestamp,
      };
    } catch (error) {
      console.error('AT Protocol moderation action error:', error);
      throw error;
    }
  }

  // Appeals
  async submitAppeal(params: {
    actionId: string;
    reason: string;
    evidence?: string;
  }) {
    try {
      const record = {
        $type: 'app.bsky.moderation.appeal',
        action: params.actionId,
        reason: params.reason,
        evidence: params.evidence,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };

      return await this.agent.api.com.atproto.repo.createRecord({
        repo: this.agent.session?.did ?? '',
        collection: 'app.bsky.moderation.appeal',
        record,
      });
    } catch (error) {
      console.error('AT Protocol appeal submission error:', error);
      throw error;
    }
  }

  // Automated Content Analysis
  async analyzeContent(params: {
    content: string;
    type: 'text' | 'image' | 'video';
    context?: string;
  }) {
    try {
      return await this.agent.api.app.bsky.moderation.analyzeContent({
        ...params,
        did: this.agent.session?.did ?? '',
      });
    } catch (error) {
      console.error('AT Protocol content analysis error:', error);
      throw error;
    }
  }

  // Moderation Dashboard
  async getModerationStats(timeframe: 'day' | 'week' | 'month') {
    try {
      return await this.agent.api.app.bsky.moderation.getStats({
        did: this.agent.session?.did ?? '',
        timeframe,
      });
    } catch (error) {
      console.error('AT Protocol moderation stats error:', error);
      throw error;
    }
  }

  async getModerationQueue(params: {
    status: 'pending' | 'reviewed';
    limit?: number;
    cursor?: string;
  }) {
    try {
      return await this.agent.api.app.bsky.moderation.getQueue({
        ...params,
        did: this.agent.session?.did ?? '',
      });
    } catch (error) {
      console.error('AT Protocol moderation queue error:', error);
      throw error;
    }
  }
}

export const atProtocolModeration = new ATProtocolModerationService();
