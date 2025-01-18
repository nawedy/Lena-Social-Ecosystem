import { getFirestore, Timestamp } from 'firebase/firestore';

import { generateInviteCode } from '../utils/crypto';
import { sendEmail } from '../utils/email';

import { AnalyticsService } from './AnalyticsService';
import { NotificationService } from './NotificationService';
import { SecurityService } from './SecurityService';

interface BetaTester {
  id: string;
  email: string;
  tiktokUsername?: string;
  inviteCode: string;
  status: 'invited' | 'active' | 'inactive';
  joinedAt?: Timestamp;
  lastActive?: Timestamp;
  features: string[];
  feedback: Feedback[];
  metrics: UserMetrics;
}

interface Feedback {
  id: string;
  type: 'bug' | 'feature' | 'improvement' | 'general';
  category: string;
  title: string;
  description: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  status: 'new' | 'in-review' | 'in-progress' | 'resolved';
  createdAt: Timestamp;
  updatedAt: Timestamp;
  attachments?: string[];
}

interface UserMetrics {
  gamesPlayed: number;
  gamesWon: number;
  averageGameDuration: number;
  migrationSuccess: boolean;
  migrationDuration?: number;
  featureUsage: Record<string, number>;
  lastLogin: Timestamp;
  deviceInfo: {
    platform: string;
    browser: string;
    version: string;
  };
}

export class BetaTestingService {
  private static instance: BetaTestingService;
  private db = getFirestore();
  private analytics = AnalyticsService.getInstance();
  private security = SecurityService.getInstance();
  private notifications = NotificationService.getInstance();

  private constructor() {}

  public static getInstance(): BetaTestingService {
    if (!BetaTestingService.instance) {
      BetaTestingService.instance = new BetaTestingService();
    }
    return BetaTestingService.instance;
  }

  async inviteBetaTester(email: string, tiktokUsername?: string): Promise<string> {
    const inviteCode = generateInviteCode();

    const betaTester: BetaTester = {
      id: generateInviteCode(), // Use as unique ID
      email,
      tiktokUsername,
      inviteCode,
      status: 'invited',
      features: ['core_gameplay', 'tiktok_migration', 'social_features'],
      feedback: [],
      metrics: {
        gamesPlayed: 0,
        gamesWon: 0,
        averageGameDuration: 0,
        migrationSuccess: false,
        featureUsage: {},
        lastLogin: Timestamp.now(),
        deviceInfo: {
          platform: '',
          browser: '',
          version: '',
        },
      },
    };

    await this.db.collection('beta_testers').doc(betaTester.id).set(betaTester);

    await this.sendInvitationEmail(email, inviteCode);

    this.analytics.trackEvent('beta_tester_invited', {
      email,
      tiktokUsername,
      timestamp: Date.now(),
    });

    return inviteCode;
  }

  private async sendInvitationEmail(email: string, inviteCode: string): Promise<void> {
    const emailTemplate = {
      subject: 'Welcome to TikTokToe Beta Testing Program!',
      body: `
        <h1>Welcome to TikTokToe Beta!</h1>
        <p>You've been selected to participate in our exclusive beta testing program.</p>
        <p>Your invite code is: <strong>${inviteCode}</strong></p>
        <p>To get started:</p>
        <ol>
          <li>Download TikTokToe from the App Store or Play Store</li>
          <li>Open the app and click "Join Beta"</li>
          <li>Enter your invite code</li>
          <li>Complete your profile and start playing!</li>
        </ol>
        <p>Important Beta Tester Resources:</p>
        <ul>
          <li>Beta Tester Dashboard: https://tiktok-toe.app/beta/dashboard</li>
          <li>Feedback Portal: https://tiktok-toe.app/beta/feedback</li>
          <li>Beta Tester Community: https://discord.gg/tiktok-toe-beta</li>
        </ul>
        <p>Questions? Contact our beta support team at beta@tiktok-toe.app</p>
      `,
    };

    await sendEmail(email, emailTemplate.subject, emailTemplate.body);
  }

  async activateBetaTester(
    inviteCode: string,
    deviceInfo: UserMetrics['deviceInfo']
  ): Promise<boolean> {
    const snapshot = await this.db
      .collection('beta_testers')
      .where('inviteCode', '==', inviteCode)
      .where('status', '==', 'invited')
      .get();

    if (snapshot.empty) {
      return false;
    }

    const betaTester = snapshot.docs[0];
    await betaTester.ref.update({
      status: 'active',
      joinedAt: Timestamp.now(),
      lastActive: Timestamp.now(),
      'metrics.deviceInfo': deviceInfo,
    });

    this.analytics.trackEvent('beta_tester_activated', {
      testerId: betaTester.id,
      deviceInfo,
      timestamp: Date.now(),
    });

    return true;
  }

  async submitFeedback(
    testerId: string,
    feedback: Omit<Feedback, 'id' | 'createdAt' | 'updatedAt' | 'status'>
  ): Promise<string> {
    const feedbackId = generateInviteCode();

    const newFeedback: Feedback = {
      ...feedback,
      id: feedbackId,
      status: 'new',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    await this.db
      .collection('beta_testers')
      .doc(testerId)
      .update({
        feedback: firebase.firestore.FieldValue.arrayUnion(newFeedback),
      });

    this.analytics.trackEvent('beta_feedback_submitted', {
      testerId,
      feedbackId,
      type: feedback.type,
      category: feedback.category,
      severity: feedback.severity,
      timestamp: Date.now(),
    });

    // Notify team of new feedback
    if (feedback.severity === 'critical' || feedback.severity === 'high') {
      await this.notifications.sendToTeam('New Critical Feedback', {
        testerId,
        feedbackId,
        type: feedback.type,
        title: feedback.title,
        severity: feedback.severity,
      });
    }

    return feedbackId;
  }

  async updateMetrics(testerId: string, metrics: Partial<UserMetrics>): Promise<void> {
    await this.db
      .collection('beta_testers')
      .doc(testerId)
      .update({
        'metrics.gamesPlayed': firebase.firestore.FieldValue.increment(metrics.gamesPlayed || 0),
        'metrics.gamesWon': firebase.firestore.FieldValue.increment(metrics.gamesWon || 0),
        'metrics.averageGameDuration': metrics.averageGameDuration,
        'metrics.migrationSuccess': metrics.migrationSuccess,
        'metrics.migrationDuration': metrics.migrationDuration,
        'metrics.lastLogin': Timestamp.now(),
        'metrics.featureUsage': metrics.featureUsage,
      });
  }

  async getBetaTesterStats(): Promise<{
    totalTesters: number;
    activeTesters: number;
    averageMigrationSuccess: number;
    topFeatures: Array<{ feature: string; usage: number }>;
  }> {
    const snapshot = await this.db.collection('beta_testers').get();
    const testers = snapshot.docs.map((doc) => doc.data() as BetaTester);

    const stats = {
      totalTesters: testers.length,
      activeTesters: testers.filter((t) => t.status === 'active').length,
      averageMigrationSuccess:
        testers.filter((t) => t.metrics.migrationSuccess).length / testers.length,
      topFeatures: this.calculateTopFeatures(testers),
    };

    return stats;
  }

  private calculateTopFeatures(testers: BetaTester[]): Array<{ feature: string; usage: number }> {
    const featureUsage: Record<string, number> = {};

    testers.forEach((tester) => {
      Object.entries(tester.metrics.featureUsage).forEach(([feature, count]) => {
        featureUsage[feature] = (featureUsage[feature] || 0) + count;
      });
    });

    return Object.entries(featureUsage)
      .map(([feature, usage]) => ({ feature, usage }))
      .sort((a, b) => b.usage - a.usage)
      .slice(0, 5);
  }
}
