import { BskyAgent } from '@atproto/api';
import { PubSub } from '@google-cloud/pubsub';

import { ContentModerationService } from '../moderation/ContentModerationService';

interface FilterRule {
  id: string;
  type: 'text' | 'image' | 'video';
  action: 'flag' | 'block' | 'review';
  criteria: {
    keywords?: string[];
    categories?: string[];
    threshold?: number;
  };
}

interface FilterResult {
  ruleId: string;
  action: 'flag' | 'block' | 'review';
  confidence: number;
  categories: string[];
  reasons: string[];
}

export class ATContentFilter {
  private agent: BskyAgent;
  private moderationService: ContentModerationService;
  private pubsub: PubSub;
  private readonly RECORD_NAMESPACE = 'app.bsky.filter';

  constructor(agent: BskyAgent) {
    this.agent = agent;
    this.moderationService = new ContentModerationService(agent);
    this.pubsub = new PubSub();
  }

  async createFilterRule(rule: Omit<FilterRule, 'id'>): Promise<FilterRule> {
    try {
      const record = {
        $type: `${this.RECORD_NAMESPACE}.rule`,
        createdAt: new Date().toISOString(),
        ...rule,
      };

      const response = await this.agent.com.atproto.repo.createRecord({
        repo: this.agent.session?.did,
        collection: `${this.RECORD_NAMESPACE}.rule`,
        record,
      });

      return {
        id: response.uri,
        ...rule,
      };
    } catch (error) {
      console.error('Error creating filter rule:', error);
      throw new Error('Failed to create filter rule');
    }
  }

  async getFilterRules(): Promise<FilterRule[]> {
    try {
      const response = await this.agent.com.atproto.repo.listRecords({
        repo: this.agent.session?.did,
        collection: `${this.RECORD_NAMESPACE}.rule`,
        limit: 100,
      });

      return response.records.map(record => ({
        id: record.uri,
        ...record.value,
      }));
    } catch (error) {
      console.error('Error getting filter rules:', error);
      throw new Error('Failed to get filter rules');
    }
  }

  async deleteFilterRule(ruleId: string): Promise<void> {
    try {
      await this.agent.com.atproto.repo.deleteRecord({
        repo: this.agent.session?.did,
        collection: `${this.RECORD_NAMESPACE}.rule`,
        rkey: ruleId,
      });
    } catch (error) {
      console.error('Error deleting filter rule:', error);
      throw new Error('Failed to delete filter rule');
    }
  }

  async filterContent(content: {
    text?: string;
    image?: string;
    video?: string;
  }): Promise<FilterResult[]> {
    try {
      const rules = await this.getFilterRules();
      const results: FilterResult[] = [];

      for (const rule of rules) {
        let matched = false;
        let confidence = 0;
        let categories: string[] = [];
        let reasons: string[] = [];

        switch (rule.type) {
          case 'text':
            if (content.text && rule.criteria.keywords) {
              const textAnalysis = await this.moderationService.moderateText(
                content.text
              );
              matched = this.matchesTextCriteria(
                content.text,
                rule.criteria,
                textAnalysis
              );
              confidence = textAnalysis.confidence;
              categories = textAnalysis.categories;
              reasons = textAnalysis.reasons || [];
            }
            break;

          case 'image':
            if (content.image) {
              const imageAnalysis = await this.moderationService.moderateImage(
                content.image
              );
              matched = this.matchesMediaCriteria(imageAnalysis, rule.criteria);
              confidence = imageAnalysis.confidence;
              categories = imageAnalysis.categories;
              reasons = imageAnalysis.reasons || [];
            }
            break;

          case 'video':
            if (content.video) {
              const videoAnalysis = await this.moderationService.moderateVideo(
                content.video
              );
              matched = this.matchesMediaCriteria(videoAnalysis, rule.criteria);
              confidence = videoAnalysis.confidence;
              categories = videoAnalysis.categories;
              reasons = videoAnalysis.reasons || [];
            }
            break;
        }

        if (matched) {
          results.push({
            ruleId: rule.id,
            action: rule.action,
            confidence,
            categories,
            reasons,
          });

          // Publish filter match event
          await this.publishFilterEvent({
            ruleId: rule.id,
            action: rule.action,
            content: {
              type: rule.type,
              ...content,
            },
            confidence,
            categories,
            reasons,
          });
        }
      }

      return results;
    } catch (error) {
      console.error('Error filtering content:', error);
      throw new Error('Failed to filter content');
    }
  }

  private matchesTextCriteria(
    text: string,
    criteria: FilterRule['criteria'],
    analysis: any
  ): boolean {
    if (criteria.keywords) {
      const lowercaseText = text.toLowerCase();
      const hasKeyword = criteria.keywords.some(keyword =>
        lowercaseText.includes(keyword.toLowerCase())
      );
      if (hasKeyword) return true;
    }

    if (criteria.categories && criteria.threshold) {
      const matchesCategory = criteria.categories.some(category =>
        analysis.categories.includes(category)
      );
      return matchesCategory && analysis.confidence >= criteria.threshold;
    }

    return false;
  }

  private matchesMediaCriteria(
    analysis: any,
    criteria: FilterRule['criteria']
  ): boolean {
    if (!criteria.categories || !criteria.threshold) return false;

    const matchesCategory = criteria.categories.some(category =>
      analysis.categories.includes(category)
    );
    return matchesCategory && analysis.confidence >= criteria.threshold;
  }

  private async publishFilterEvent(event: any): Promise<void> {
    try {
      const topic = this.pubsub.topic('content-filter-events');
      await topic.publish(Buffer.from(JSON.stringify(event)));

      // Also store the event in AT Protocol
      await this.agent.com.atproto.repo.createRecord({
        repo: this.agent.session?.did,
        collection: `${this.RECORD_NAMESPACE}.event`,
        record: {
          $type: `${this.RECORD_NAMESPACE}.event`,
          timestamp: new Date().toISOString(),
          ...event,
        },
      });
    } catch (error) {
      console.error('Error publishing filter event:', error);
    }
  }

  async getFilterEvents(
    startDate?: Date,
    endDate?: Date,
    limit = 100
  ): Promise<any[]> {
    try {
      const response = await this.agent.com.atproto.repo.listRecords({
        repo: this.agent.session?.did,
        collection: `${this.RECORD_NAMESPACE}.event`,
        limit,
      });

      let events = response.records.map(record => record.value);

      if (startDate) {
        events = events.filter(event => new Date(event.timestamp) >= startDate);
      }

      if (endDate) {
        events = events.filter(event => new Date(event.timestamp) <= endDate);
      }

      return events;
    } catch (error) {
      console.error('Error getting filter events:', error);
      throw new Error('Failed to get filter events');
    }
  }
}
