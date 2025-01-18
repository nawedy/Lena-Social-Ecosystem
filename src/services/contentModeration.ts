import { BskyAgent } from '@atproto/api';
import { atproto } from './atproto';
import { securityService } from './security';

interface ContentModerationRule {
  id: string;
  type: 'text' | 'image' | 'video' | 'user';
  action: 'flag' | 'block' | 'warn';
  pattern?: string;
  keywords?: string[];
  threshold?: number;
  createdAt: string;
  updatedAt: string;
  enabled: boolean;
}

interface ContentReport {
  id: string;
  type: 'post' | 'message' | 'user' | 'group';
  targetUri: string;
  reporterDid: string;
  reason: string;
  details?: string;
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
  moderatorNotes?: string;
  createdAt: string;
  updatedAt: string;
}

interface ContentAnalysis {
  id: string;
  contentUri: string;
  contentType: 'text' | 'image' | 'video';
  analysis: {
    toxicity?: number;
    spam?: number;
    adult?: number;
    violence?: number;
    hate?: number;
  };
  flags: string[];
  createdAt: string;
}

export class ContentModerationService {
  private agent: BskyAgent;
  private moderationRules: Map<string, ContentModerationRule> = new Map();
  private static instance: ContentModerationService;

  private constructor() {
    this.agent = atproto.getAgent();
    this.loadModerationRules().catch(console.error);
  }

  public static getInstance(): ContentModerationService {
    if (!ContentModerationService.instance) {
      ContentModerationService.instance = new ContentModerationService();
    }
    return ContentModerationService.instance;
  }

  // Moderation Rules Management
  private async loadModerationRules(): Promise<void> {
    try {
      const response = await this.agent.api.app.bsky.moderation.getRules();
      response.rules.forEach(rule => {
        this.moderationRules.set(rule.id, rule);
      });
    } catch (error) {
      console.error('Failed to load moderation rules:', error);
    }
  }

  async createModerationRule(
    rule: Omit<ContentModerationRule, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<ContentModerationRule> {
    try {
      const timestamp = new Date().toISOString();
      const newRule: ContentModerationRule = {
        id: crypto.randomUUID(),
        ...rule,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      await this.agent.api.com.atproto.repo.createRecord({
        repo: this.agent.session?.did ?? '',
        collection: 'app.bsky.moderation.rule',
        record: newRule,
      });

      this.moderationRules.set(newRule.id, newRule);
      return newRule;
    } catch (error) {
      console.error('Failed to create moderation rule:', error);
      throw error;
    }
  }

  // Content Analysis
  async analyzeContent(params: {
    content: string;
    type: 'text' | 'image' | 'video';
    uri: string;
  }): Promise<ContentAnalysis> {
    try {
      let analysis: ContentAnalysis['analysis'] = {};
      const flags: string[] = [];

      if (params.type === 'text') {
        analysis = await this.analyzeText(params.content);
      } else if (params.type === 'image') {
        analysis = await this.analyzeImage(params.content);
      } else if (params.type === 'video') {
        analysis = await this.analyzeVideo(params.content);
      }

      // Apply moderation rules
      for (const rule of this.moderationRules.values()) {
        if (!rule.enabled) continue;

        if (rule.type === params.type) {
          if (
            rule.pattern &&
            new RegExp(rule.pattern, 'i').test(params.content)
          ) {
            flags.push(`pattern_match:${rule.id}`);
          }

          if (
            rule.keywords?.some(keyword =>
              params.content.toLowerCase().includes(keyword.toLowerCase())
            )
          ) {
            flags.push(`keyword_match:${rule.id}`);
          }

          if (rule.threshold) {
            const relevantScore = Object.values(analysis)[0];
            if (relevantScore && relevantScore >= rule.threshold) {
              flags.push(`threshold_exceeded:${rule.id}`);
            }
          }
        }
      }

      const contentAnalysis: ContentAnalysis = {
        id: crypto.randomUUID(),
        contentUri: params.uri,
        contentType: params.type,
        analysis,
        flags,
        createdAt: new Date().toISOString(),
      };

      // Store analysis results
      await this.agent.api.com.atproto.repo.createRecord({
        repo: this.agent.session?.did ?? '',
        collection: 'app.bsky.moderation.contentAnalysis',
        record: contentAnalysis,
      });

      return contentAnalysis;
    } catch (error) {
      console.error('Content analysis error:', error);
      throw error;
    }
  }

  private async analyzeText(
    text: string
  ): Promise<ContentAnalysis['analysis']> {
    // Implement text analysis using a content moderation API or ML model
    // This is a placeholder implementation
    return {
      toxicity: Math.random(),
      spam: Math.random(),
      hate: Math.random(),
    };
  }

  private async analyzeImage(
    imageUrl: string
  ): Promise<ContentAnalysis['analysis']> {
    // Implement image analysis using a computer vision API
    // This is a placeholder implementation
    return {
      adult: Math.random(),
      violence: Math.random(),
    };
  }

  private async analyzeVideo(
    videoUrl: string
  ): Promise<ContentAnalysis['analysis']> {
    // Implement video analysis using a video processing API
    // This is a placeholder implementation
    return {
      adult: Math.random(),
      violence: Math.random(),
    };
  }

  // Content Reporting
  async reportContent(params: {
    type: ContentReport['type'];
    targetUri: string;
    reason: string;
    details?: string;
  }): Promise<ContentReport> {
    try {
      const timestamp = new Date().toISOString();
      const report: ContentReport = {
        id: crypto.randomUUID(),
        reporterDid: this.agent.session?.did ?? '',
        status: 'pending',
        createdAt: timestamp,
        updatedAt: timestamp,
        ...params,
      };

      await this.agent.api.com.atproto.repo.createRecord({
        repo: this.agent.session?.did ?? '',
        collection: 'app.bsky.moderation.report',
        record: report,
      });

      // Trigger automated review
      void this.reviewReport(report);

      return report;
    } catch (error) {
      console.error('Content reporting error:', error);
      throw error;
    }
  }

  private async reviewReport(report: ContentReport): Promise<void> {
    try {
      // Get the reported content
      const content = await this.agent.api.app.bsky.feed.getPost({
        uri: report.targetUri,
      });

      // Analyze the content
      const analysis = await this.analyzeContent({
        content: content.record.text,
        type: 'text',
        uri: report.targetUri,
      });

      // Apply automated moderation based on analysis
      const shouldAutoModerate =
        analysis.flags.length > 0 ||
        (analysis.analysis.toxicity && analysis.analysis.toxicity > 0.8) ||
        (analysis.analysis.spam && analysis.analysis.spam > 0.8);

      if (shouldAutoModerate) {
        await this.takeModeratorAction({
          reportId: report.id,
          action: 'block',
          reason: 'Automated moderation based on content analysis',
          analysis,
        });
      }
    } catch (error) {
      console.error('Report review error:', error);
    }
  }

  // Moderation Actions
  async takeModeratorAction(params: {
    reportId: string;
    action: 'block' | 'warn' | 'dismiss';
    reason: string;
    analysis?: ContentAnalysis;
  }): Promise<void> {
    try {
      const report = await this.agent.api.app.bsky.moderation.getReport({
        id: params.reportId,
      });

      const timestamp = new Date().toISOString();
      const updatedReport: ContentReport = {
        ...report,
        status: params.action === 'dismiss' ? 'dismissed' : 'resolved',
        moderatorNotes: params.reason,
        updatedAt: timestamp,
      };

      await this.agent.api.com.atproto.repo.putRecord({
        repo: this.agent.session?.did ?? '',
        collection: 'app.bsky.moderation.report',
        rkey: report.id,
        record: updatedReport,
      });

      if (params.action === 'block') {
        await this.blockContent(report.targetUri);
      } else if (params.action === 'warn') {
        await this.warnUser(report.targetUri);
      }
    } catch (error) {
      console.error('Moderation action error:', error);
      throw error;
    }
  }

  private async blockContent(uri: string): Promise<void> {
    try {
      await this.agent.api.com.atproto.repo.deleteRecord({
        repo: this.agent.session?.did ?? '',
        collection: 'app.bsky.feed.post',
        rkey: uri.split('/').pop() ?? '',
      });
    } catch (error) {
      console.error('Content blocking error:', error);
      throw error;
    }
  }

  private async warnUser(uri: string): Promise<void> {
    try {
      const post = await this.agent.api.app.bsky.feed.getPost({ uri });
      await this.agent.api.app.bsky.notification.create({
        type: 'warning',
        recipient: post.record.author,
        reason: 'Content violation warning',
        uri,
      });
    } catch (error) {
      console.error('User warning error:', error);
      throw error;
    }
  }

  // Community Guidelines
  async getCommunityGuidelines(): Promise<string> {
    try {
      const response = await this.agent.api.app.bsky.moderation.getGuidelines();
      return response.text;
    } catch (error) {
      console.error('Failed to fetch community guidelines:', error);
      throw error;
    }
  }

  async updateCommunityGuidelines(text: string): Promise<void> {
    try {
      await this.agent.api.com.atproto.repo.putRecord({
        repo: this.agent.session?.did ?? '',
        collection: 'app.bsky.moderation.guidelines',
        rkey: 'default',
        record: {
          text,
          updatedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('Failed to update community guidelines:', error);
      throw error;
    }
  }
}

export const contentModeration = ContentModerationService.getInstance();
