import { BskyAgent } from '@atproto/api';
import { Storage } from '@google-cloud/storage';
import { CloudVision } from '@google-cloud/vision';
import { LanguageServiceClient } from '@google-cloud/language';
import { PubSub } from '@google-cloud/pubsub';

interface ModerationType {
  type: 'text' | 'image' | 'video';
  content: string | Buffer;
  metadata?: Record<string, any>;
}

interface ModerationResult {
  isApproved: boolean;
  confidence: number;
  categories: string[];
  reasons?: string[];
  needsHumanReview: boolean;
}

export class ContentModerationService {
  private agent: BskyAgent;
  private storage: Storage;
  private vision: CloudVision;
  private language: LanguageServiceClient;
  private pubsub: PubSub;
  private readonly MODERATION_TOPIC = 'content-moderation';
  private readonly HUMAN_REVIEW_TOPIC = 'human-review-queue';
  private readonly CONFIDENCE_THRESHOLD = 0.85;

  constructor(agent: BskyAgent) {
    this.agent = agent;
    this.storage = new Storage();
    this.vision = new CloudVision();
    this.language = new LanguageServiceClient();
    this.pubsub = new PubSub();
  }

  async moderateContent(content: ModerationType): Promise<ModerationResult> {
    try {
      let result: ModerationResult;

      switch (content.type) {
        case 'text':
          result = await this.moderateText(content.content as string);
          break;
        case 'image':
          result = await this.moderateImage(content.content as Buffer);
          break;
        case 'video':
          result = await this.moderateVideo(content.content as Buffer);
          break;
        default:
          throw new Error('Unsupported content type');
      }

      // Log moderation result
      await this.logModerationResult(content, result);

      // If confidence is low or specific flags are triggered, queue for human review
      if (
        result.confidence < this.CONFIDENCE_THRESHOLD ||
        result.needsHumanReview
      ) {
        await this.queueForHumanReview(content, result);
      }

      return result;
    } catch (error) {
      console.error('Error in content moderation:', error);
      throw new Error('Content moderation failed');
    }
  }

  private async moderateText(text: string): Promise<ModerationResult> {
    try {
      const [sentiment] = await this.language.analyzeSentiment({
        document: { content: text, type: 'PLAIN_TEXT' },
      });
      const [classification] = await this.language.classifyText({
        document: { content: text, type: 'PLAIN_TEXT' },
      });

      // Analyze for harmful content
      const [result] = await this.language.analyzeEntitySentiment({
        document: { content: text, type: 'PLAIN_TEXT' },
      });

      const categories = classification.categories.map(c => c.name);
      const needsHumanReview = this.checkForSensitiveContent(categories);
      const confidence = Math.max(
        ...classification.categories.map(c => c.confidence)
      );

      return {
        isApproved: !needsHumanReview && confidence > this.CONFIDENCE_THRESHOLD,
        confidence,
        categories,
        needsHumanReview,
        reasons: this.generateModerationReasons(sentiment, result),
      };
    } catch (error) {
      console.error('Error in text moderation:', error);
      throw error;
    }
  }

  private async moderateImage(image: Buffer): Promise<ModerationResult> {
    try {
      const [result] = await this.vision.safeSearchDetection(image);
      const { adult, spoof, medical, violence, racy } =
        result.safeSearchAnnotation;

      const categories = [];
      const reasons = [];
      let needsHumanReview = false;

      // Check each category and add to reasons if flagged
      if (adult === 'LIKELY' || adult === 'VERY_LIKELY') {
        categories.push('adult');
        reasons.push('Contains adult content');
        needsHumanReview = true;
      }
      if (violence === 'LIKELY' || violence === 'VERY_LIKELY') {
        categories.push('violence');
        reasons.push('Contains violent content');
        needsHumanReview = true;
      }
      if (medical === 'LIKELY' || medical === 'VERY_LIKELY') {
        categories.push('medical');
        reasons.push('Contains medical content');
      }
      if (racy === 'LIKELY' || racy === 'VERY_LIKELY') {
        categories.push('racy');
        reasons.push('Contains suggestive content');
        needsHumanReview = true;
      }

      // Calculate overall confidence
      const confidence = this.calculateImageConfidence(
        result.safeSearchAnnotation
      );

      return {
        isApproved: !needsHumanReview && confidence > this.CONFIDENCE_THRESHOLD,
        confidence,
        categories,
        reasons,
        needsHumanReview,
      };
    } catch (error) {
      console.error('Error in image moderation:', error);
      throw error;
    }
  }

  private async moderateVideo(video: Buffer): Promise<ModerationResult> {
    // For video moderation, we'll analyze key frames
    // This is a simplified version - in production, you'd want to use Cloud Video Intelligence API
    try {
      // Extract key frames (implementation depends on your video processing library)
      const keyFrames = await this.extractKeyFrames(video);

      const frameResults = await Promise.all(
        keyFrames.map(frame => this.moderateImage(frame))
      );

      // Aggregate results from all frames
      const aggregatedResult = this.aggregateVideoResults(frameResults);

      return aggregatedResult;
    } catch (error) {
      console.error('Error in video moderation:', error);
      throw error;
    }
  }

  private async logModerationResult(
    content: ModerationType,
    result: ModerationResult
  ): Promise<void> {
    const topic = this.pubsub.topic(this.MODERATION_TOPIC);
    const data = {
      timestamp: new Date().toISOString(),
      contentType: content.type,
      metadata: content.metadata,
      result,
    };

    await topic.publish(Buffer.from(JSON.stringify(data)));
  }

  private async queueForHumanReview(
    content: ModerationType,
    result: ModerationResult
  ): Promise<void> {
    const topic = this.pubsub.topic(this.HUMAN_REVIEW_TOPIC);
    const data = {
      timestamp: new Date().toISOString(),
      contentType: content.type,
      metadata: content.metadata,
      moderationResult: result,
      status: 'pending_review',
    };

    await topic.publish(Buffer.from(JSON.stringify(data)));
  }

  private checkForSensitiveContent(categories: string[]): boolean {
    const sensitiveCategories = [
      'hate',
      'violence',
      'adult',
      'harassment',
      'self-harm',
      'terrorism',
    ];
    return categories.some(category =>
      sensitiveCategories.some(sensitive =>
        category.toLowerCase().includes(sensitive)
      )
    );
  }

  private generateModerationReasons(
    sentiment: any,
    entitySentiment: any
  ): string[] {
    const reasons: string[] = [];

    // Check overall sentiment
    if (sentiment.documentSentiment.score < -0.5) {
      reasons.push('Negative sentiment detected');
    }

    // Check entity sentiment
    entitySentiment.entities.forEach((entity: any) => {
      if (entity.sentiment.score < -0.7) {
        reasons.push(`Negative reference to ${entity.name}`);
      }
    });

    return reasons;
  }

  private calculateImageConfidence(safeSearch: any): number {
    const confidenceMap = {
      VERY_UNLIKELY: 0.1,
      UNLIKELY: 0.3,
      POSSIBLE: 0.5,
      LIKELY: 0.7,
      VERY_LIKELY: 0.9,
    };

    const values = Object.values(safeSearch).map(
      val => confidenceMap[val as keyof typeof confidenceMap]
    );
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  private async extractKeyFrames(video: Buffer): Promise<Buffer[]> {
    // Implement video frame extraction
    // This is a placeholder - you'll need to implement actual video frame extraction
    return [];
  }

  private aggregateVideoResults(results: ModerationResult[]): ModerationResult {
    const needsHumanReview = results.some(r => r.needsHumanReview);
    const allCategories = new Set(results.flatMap(r => r.categories));
    const allReasons = new Set(results.flatMap(r => r.reasons || []));
    const avgConfidence =
      results.reduce((sum, r) => sum + r.confidence, 0) / results.length;

    return {
      isApproved:
        !needsHumanReview && avgConfidence > this.CONFIDENCE_THRESHOLD,
      confidence: avgConfidence,
      categories: Array.from(allCategories),
      reasons: Array.from(allReasons),
      needsHumanReview,
    };
  }
}
