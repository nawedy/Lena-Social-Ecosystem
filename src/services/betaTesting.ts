import { BskyAgent } from '@atproto/api';
import { Datastore } from '@google-cloud/datastore';
import { PubSub } from '@google-cloud/pubsub';
import { Storage } from '@google-cloud/storage';

import { config } from '../config';

import { analytics } from './analytics';
import { atproto } from './atproto';


interface BetaTester {
  id: string;
  email: string;
  invitationStatus: 'pending' | 'accepted' | 'declined';
  joinDate?: string;
  lastActive?: string;
  features: {
    [key: string]: boolean;
  };
  feedback: Array<{
    id: string;
    type: 'bug' | 'feature' | 'general';
    content: string;
    timestamp: string;
    status: 'new' | 'in-review' | 'resolved';
    priority: 'low' | 'medium' | 'high';
  }>;
  metrics: {
    sessionsCount: number;
    averageSessionDuration: number;
    featuresUsed: string[];
    lastFeatureUsed?: string;
  };
}

interface InvitationBatch {
  id: string;
  createdAt: string;
  expiresAt: string;
  maxInvites: number;
  invitedCount: number;
  features: string[];
}

export class BetaTestingService {
  private static instance: BetaTestingService;
  private agent: BskyAgent;
  private storage: Storage;
  private pubsub: PubSub;
  private datastore: Datastore;
  private readonly BUCKET_NAME = 'tiktok-toe-beta-feedback';
  private readonly TOPIC_NAME = 'beta-events';

  private constructor() {
    this.agent = atproto.getAgent();
    this.storage = new Storage({
      projectId: config.gcp.projectId,
      keyFilename: config.gcp.keyFile,
    });
    this.pubsub = new PubSub({
      projectId: config.gcp.projectId,
      keyFilename: config.gcp.keyFile,
    });
    this.datastore = new Datastore({
      projectId: config.gcp.projectId,
      keyFilename: config.gcp.keyFile,
    });
  }

  public static getInstance(): BetaTestingService {
    if (!BetaTestingService.instance) {
      BetaTestingService.instance = new BetaTestingService();
    }
    return BetaTestingService.instance;
  }

  // Invitation Management
  async createInvitationBatch(params: {
    maxInvites: number;
    expiresInDays: number;
    features: string[];
  }): Promise<InvitationBatch> {
    const batch: InvitationBatch = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + params.expiresInDays * 86400000).toISOString(),
      maxInvites: params.maxInvites,
      invitedCount: 0,
      features: params.features,
    };

    const key = this.datastore.key(['InvitationBatch', batch.id]);
    await this.datastore.save({
      key,
      data: batch,
    });

    return batch;
  }

  async inviteUser(email: string, batchId: string): Promise<BetaTester> {
    // Verify batch exists and has capacity
    const batchKey = this.datastore.key(['InvitationBatch', batchId]);
    const [batch] = await this.datastore.get(batchKey);

    if (!batch || batch.invitedCount >= batch.maxInvites) {
      throw new Error('Invalid or full invitation batch');
    }

    // Create beta tester record
    const tester: BetaTester = {
      id: crypto.randomUUID(),
      email,
      invitationStatus: 'pending',
      features: batch.features.reduce(
        (acc, feature) => ({
          ...acc,
          [feature]: true,
        }),
        {}
      ),
      feedback: [],
      metrics: {
        sessionsCount: 0,
        averageSessionDuration: 0,
        featuresUsed: [],
      },
    };

    // Save tester record
    const testerKey = this.datastore.key(['BetaTester', tester.id]);
    await this.datastore.save({
      key: testerKey,
      data: tester,
    });

    // Update batch count
    batch.invitedCount++;
    await this.datastore.save({
      key: batchKey,
      data: batch,
    });

    // Send invitation email
    await this.sendInvitationEmail(tester);

    // Publish event
    await this.publishEvent('tester-invited', {
      testerId: tester.id,
      email: tester.email,
      batchId,
    });

    return tester;
  }

  // Feedback Collection
  async submitFeedback(params: {
    testerId: string;
    type: 'bug' | 'feature' | 'general';
    content: string;
    priority?: 'low' | 'medium' | 'high';
  }): Promise<void> {
    const testerKey = this.datastore.key(['BetaTester', params.testerId]);
    const [tester] = await this.datastore.get(testerKey);

    if (!tester) {
      throw new Error('Beta tester not found');
    }

    const feedback = {
      id: crypto.randomUUID(),
      type: params.type,
      content: params.content,
      timestamp: new Date().toISOString(),
      status: 'new',
      priority: params.priority || 'medium',
    };

    tester.feedback.push(feedback);
    await this.datastore.save({
      key: testerKey,
      data: tester,
    });

    // Store detailed feedback in Cloud Storage
    const feedbackFile = this.storage
      .bucket(this.BUCKET_NAME)
      .file(`${params.testerId}/${feedback.id}.json`);
    await feedbackFile.save(JSON.stringify(feedback, null, 2));

    // Publish feedback event
    await this.publishEvent('feedback-submitted', {
      testerId: params.testerId,
      feedbackId: feedback.id,
      type: params.type,
      priority: feedback.priority,
    });

    // Track feedback submission
    analytics.track('beta_feedback_submitted', {
      testerId: params.testerId,
      feedbackType: params.type,
      priority: feedback.priority,
    });
  }

  // Metrics Collection
  async updateTesterMetrics(
    testerId: string,
    metrics: Partial<BetaTester['metrics']>
  ): Promise<void> {
    const testerKey = this.datastore.key(['BetaTester', testerId]);
    const [tester] = await this.datastore.get(testerKey);

    if (!tester) {
      throw new Error('Beta tester not found');
    }

    // Update metrics
    tester.metrics = {
      ...tester.metrics,
      ...metrics,
    };

    // Update last active timestamp
    tester.lastActive = new Date().toISOString();

    await this.datastore.save({
      key: testerKey,
      data: tester,
    });

    // Track metrics update
    analytics.track('beta_metrics_updated', {
      testerId,
      metrics,
    });
  }

  // Feature Management
  async toggleFeature(testerId: string, feature: string, enabled: boolean): Promise<void> {
    const testerKey = this.datastore.key(['BetaTester', testerId]);
    const [tester] = await this.datastore.get(testerKey);

    if (!tester) {
      throw new Error('Beta tester not found');
    }

    tester.features[feature] = enabled;
    await this.datastore.save({
      key: testerKey,
      data: tester,
    });

    // Publish feature toggle event
    await this.publishEvent('feature-toggled', {
      testerId,
      feature,
      enabled,
    });
  }

  // Analytics & Reporting
  async getTesterStats(): Promise<{
    totalTesters: number;
    activeTesters: number;
    feedbackCount: number;
    averageSessionDuration: number;
  }> {
    const query = this.datastore.createQuery('BetaTester');
    const [testers] = await this.datastore.runQuery(query);

    const now = new Date();
    const activeThreshold = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days

    const stats = testers.reduce(
      (acc, tester) => {
        acc.totalTesters++;
        if (new Date(tester.lastActive) > activeThreshold) {
          acc.activeTesters++;
        }
        acc.feedbackCount += tester.feedback.length;
        acc.totalSessionDuration +=
          tester.metrics.averageSessionDuration * tester.metrics.sessionsCount;
        acc.totalSessions += tester.metrics.sessionsCount;
        return acc;
      },
      {
        totalTesters: 0,
        activeTesters: 0,
        feedbackCount: 0,
        totalSessionDuration: 0,
        totalSessions: 0,
      }
    );

    return {
      totalTesters: stats.totalTesters,
      activeTesters: stats.activeTesters,
      feedbackCount: stats.feedbackCount,
      averageSessionDuration:
        stats.totalSessions > 0 ? stats.totalSessionDuration / stats.totalSessions : 0,
    };
  }

  // Private helper methods
  private async sendInvitationEmail(_tester: BetaTester): Promise<void> {
    // Implementation for sending invitation email
    // This would typically integrate with your email service provider
  }

  private async publishEvent(eventType: string, data: Record<string, any>): Promise<void> {
    const topic = this.pubsub.topic(this.TOPIC_NAME);
    const messageData = {
      eventType,
      timestamp: new Date().toISOString(),
      ...data,
    };

    await topic.publish(Buffer.from(JSON.stringify(messageData)));
  }
}

export const betaTesting = BetaTestingService.getInstance();
