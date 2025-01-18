import { BskyAgent } from '@atproto/api';
import { ModerationAction, ModerationReason, ModerationResult } from '../../types/moderation';
import { logger } from '../../utils/logger';
import { moderationConfig } from '../../config/moderation';

export class ContentModerationService {
  private agent: BskyAgent;
  private readonly moderationQueue: Map<string, ModerationResult>;
  private readonly maxQueueSize: number;

  constructor(agent: BskyAgent) {
    this.agent = agent;
    this.moderationQueue = new Map();
    this.maxQueueSize = moderationConfig.maxQueueSize || 1000;
  }

  /**
   * Moderate a post for compliance with community guidelines
   */
  async moderatePost(uri: string, cid: string): Promise<ModerationResult> {
    try {
      // Check if already in queue
      const existing = this.moderationQueue.get(`${uri}:${cid}`);
      if (existing) {
        return existing;
      }

      // Get post data
      const post = await this.agent.api.app.bsky.feed.getPostThread({
        uri,
        depth: 0,
      });

      if (!post.success) {
        throw new Error('Failed to fetch post data');
      }

      const postView = post.data.thread.post;
      
      // Apply moderation rules
      const result = await this.applyModerationRules(postView);

      // Store result in queue
      if (this.moderationQueue.size >= this.maxQueueSize) {
        // Remove oldest entry if queue is full
        const firstKey = this.moderationQueue.keys().next().value;
        this.moderationQueue.delete(firstKey);
      }
      this.moderationQueue.set(`${uri}:${cid}`, result);

      return result;
    } catch (error) {
      logger.error('Post moderation failed', { uri, cid, error });
      throw new Error(`Failed to moderate post: ${error.message}`);
    }
  }

  /**
   * Apply moderation rules to content
   */
  private async applyModerationRules(content: any): Promise<ModerationResult> {
    const violations: ModerationReason[] = [];
    let action: ModerationAction = 'allow';

    try {
      // Check for prohibited content
      if (await this.containsProhibitedContent(content)) {
        violations.push('prohibited_content');
        action = 'remove';
      }

      // Check for spam patterns
      if (await this.isSpam(content)) {
        violations.push('spam');
        action = 'flag';
      }

      // Check for harassment
      if (await this.containsHarassment(content)) {
        violations.push('harassment');
        action = 'remove';
      }

      // Check rate limits
      if (await this.exceedsRateLimit(content)) {
        violations.push('rate_limit');
        action = 'throttle';
      }

      return {
        action,
        violations,
        timestamp: new Date().toISOString(),
        reviewRequired: violations.length > 0,
      };
    } catch (error) {
      logger.error('Rule application failed', { content, error });
      return {
        action: 'flag',
        violations: ['system_error'],
        timestamp: new Date().toISOString(),
        reviewRequired: true,
      };
    }
  }

  /**
   * Check if content contains prohibited material
   */
  private async containsProhibitedContent(content: any): Promise<boolean> {
    try {
      const text = this.extractText(content);
      const prohibitedPatterns = moderationConfig.prohibitedPatterns || [];
      
      return prohibitedPatterns.some(pattern => 
        new RegExp(pattern, 'i').test(text)
      );
    } catch (error) {
      logger.error('Prohibited content check failed', { error });
      return false;
    }
  }

  /**
   * Check if content matches spam patterns
   */
  private async isSpam(content: any): Promise<boolean> {
    try {
      const text = this.extractText(content);
      const spamPatterns = moderationConfig.spamPatterns || [];
      
      // Check for spam indicators
      const hasSpamPattern = spamPatterns.some(pattern => 
        new RegExp(pattern, 'i').test(text)
      );
      
      // Check for repetitive content
      const isRepetitive = this.isRepetitiveContent(text);
      
      return hasSpamPattern || isRepetitive;
    } catch (error) {
      logger.error('Spam check failed', { error });
      return false;
    }
  }

  /**
   * Check if content contains harassment
   */
  private async containsHarassment(content: any): Promise<boolean> {
    try {
      const text = this.extractText(content);
      const harassmentPatterns = moderationConfig.harassmentPatterns || [];
      
      return harassmentPatterns.some(pattern => 
        new RegExp(pattern, 'i').test(text)
      );
    } catch (error) {
      logger.error('Harassment check failed', { error });
      return false;
    }
  }

  /**
   * Check if user exceeds rate limits
   */
  private async exceedsRateLimit(content: any): Promise<boolean> {
    try {
      const { creator } = content;
      if (!creator?.did) return false;

      const recentPosts = await this.agent.api.app.bsky.feed.getAuthorFeed({
        actor: creator.did,
        limit: 50,
      });

      if (!recentPosts.success) return false;

      const posts = recentPosts.data.feed;
      const recentPostCount = posts.filter(post => {
        const postTime = new Date(post.post.indexedAt).getTime();
        const hourAgo = Date.now() - 3600000;
        return postTime > hourAgo;
      }).length;

      return recentPostCount > moderationConfig.hourlyPostLimit;
    } catch (error) {
      logger.error('Rate limit check failed', { error });
      return false;
    }
  }

  /**
   * Extract text content from various content types
   */
  private extractText(content: any): string {
    try {
      if (typeof content === 'string') return content;
      if (content.text) return content.text;
      if (content.record?.text) return content.record.text;
      return '';
    } catch (error) {
      logger.error('Text extraction failed', { error });
      return '';
    }
  }

  /**
   * Check if content is repetitive
   */
  private isRepetitiveContent(text: string): boolean {
    try {
      const words = text.toLowerCase().split(/\s+/);
      const uniqueWords = new Set(words);
      
      // If the ratio of unique words to total words is too low, it's repetitive
      return words.length > 10 && uniqueWords.size / words.length < 0.3;
    } catch (error) {
      logger.error('Repetitive content check failed', { error });
      return false;
    }
  }

  /**
   * Take action on moderated content
   */
  async takeAction(uri: string, action: ModerationAction): Promise<void> {
    try {
      switch (action) {
        case 'remove':
          await this.agent.deletePost(uri);
          break;
        case 'flag':
          await this.agent.api.app.bsky.feed.flagPost({
            subject: { uri },
            reason: 'violation',
          });
          break;
        case 'throttle':
          // Implement rate limiting logic
          break;
        case 'allow':
          // No action needed
          break;
        default:
          logger.warn('Unknown moderation action', { action });
      }
    } catch (error) {
      logger.error('Action execution failed', { uri, action, error });
      throw new Error(`Failed to execute moderation action: ${error.message}`);
    }
  }
}
