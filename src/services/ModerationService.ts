import { FirebaseFirestore } from '@firebase/firestore';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import { Report, ReportStatus, ReportType } from '../types/moderation';
import { User, UserStatus } from '../types/user';
import { NotificationService } from './NotificationService';
import { OpenAI } from 'openai';

export class ModerationService {
  private static instance: ModerationService;
  private db: FirebaseFirestore;
  private notificationService: NotificationService;
  private openai: OpenAI;

  private constructor() {
    this.db = getFirestore();
    this.notificationService = NotificationService.getInstance();
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  public static getInstance(): ModerationService {
    if (!ModerationService.instance) {
      ModerationService.instance = new ModerationService();
    }
    return ModerationService.instance;
  }

  async reportContent(
    reporterId: string,
    reportedId: string,
    contentId: string,
    contentType: string,
    reportType: ReportType,
    description: string
  ): Promise<void> {
    const report: Report = {
      id: `report_${Date.now()}`,
      reporterId,
      reportedId,
      contentId,
      contentType,
      reportType,
      description,
      status: ReportStatus.PENDING,
      timestamp: new Date(),
      aiAnalysis: null,
      moderatorNotes: null,
      resolution: null,
    };

    // Perform AI content analysis
    const aiAnalysis = await this.analyzeContent(contentType, description);
    report.aiAnalysis = aiAnalysis;

    // Auto-escalate if AI detects severe violations
    if (aiAnalysis.severity >= 0.8) {
      report.status = ReportStatus.ESCALATED;
      await this.notifyModerators(report, true);
    }

    await this.db.collection('reports').add(report);

    // Regular moderator notification
    if (report.status !== ReportStatus.ESCALATED) {
      await this.notifyModerators(report, false);
    }
  }

  async reviewReport(
    reportId: string,
    moderatorId: string,
    decision: 'approve' | 'reject',
    notes: string
  ): Promise<void> {
    const reportDoc = await this.db.collection('reports').doc(reportId).get();
    if (!reportDoc.exists) {
      throw new Error('Report not found');
    }

    const report = reportDoc.data() as Report;
    report.status = decision === 'approve' ? ReportStatus.APPROVED : ReportStatus.REJECTED;
    report.moderatorNotes = notes;
    report.reviewedBy = moderatorId;
    report.reviewTimestamp = new Date();

    await reportDoc.ref.update(report);

    if (decision === 'approve') {
      await this.takeAction(report);
    }

    // Notify reporter of decision
    await this.notificationService.sendNotification(report.reporterId, {
      type: 'report_decision',
      title: 'Report Update',
      body: `Your report has been ${decision}ed`,
      data: {
        reportId: report.id,
        decision,
      },
    });
  }

  async appealSuspension(userId: string, reason: string): Promise<void> {
    const user = await this.db.collection('users').doc(userId).get();
    if (!user.exists) {
      throw new Error('User not found');
    }

    const userData = user.data() as User;
    if (userData.status !== UserStatus.SUSPENDED) {
      throw new Error('User is not suspended');
    }

    const appeal = {
      id: `appeal_${Date.now()}`,
      userId,
      reason,
      status: 'pending',
      timestamp: new Date(),
    };

    await this.db.collection('appeals').add(appeal);

    // Notify moderators of appeal
    await this.notifyModerators({
      type: 'appeal',
      userId,
      reason,
    }, false);
  }

  async reviewAppeal(
    appealId: string,
    moderatorId: string,
    decision: 'approve' | 'reject',
    notes: string
  ): Promise<void> {
    const appealDoc = await this.db.collection('appeals').doc(appealId).get();
    if (!appealDoc.exists) {
      throw new Error('Appeal not found');
    }

    const appeal = appealDoc.data();
    appeal.status = decision;
    appeal.moderatorNotes = notes;
    appeal.reviewedBy = moderatorId;
    appeal.reviewTimestamp = new Date();

    await appealDoc.ref.update(appeal);

    if (decision === 'approve') {
      await this.db.collection('users').doc(appeal.userId).update({
        status: UserStatus.ACTIVE,
        suspensionEndDate: null,
      });
    }

    // Notify user of appeal decision
    await this.notificationService.sendNotification(appeal.userId, {
      type: 'appeal_decision',
      title: 'Appeal Decision',
      body: `Your appeal has been ${decision}ed`,
      data: {
        appealId,
        decision,
      },
    });
  }

  private async analyzeContent(contentType: string, content: string): Promise<any> {
    try {
      const response = await this.openai.moderations.create({
        input: content,
      });

      return {
        categories: response.results[0].categories,
        categoryScores: response.results[0].category_scores,
        flagged: response.results[0].flagged,
        severity: this.calculateSeverity(response.results[0].category_scores),
        timestamp: new Date(),
      };
    } catch (error) {
      console.error('AI analysis failed:', error);
      return {
        error: 'AI analysis failed',
        timestamp: new Date(),
      };
    }
  }

  private calculateSeverity(scores: Record<string, number>): number {
    // Calculate weighted severity score based on category scores
    const weights = {
      hate: 1.0,
      'hate/threatening': 1.0,
      'self-harm': 0.9,
      sexual: 0.8,
      'sexual/minors': 1.0,
      violence: 0.8,
      'violence/graphic': 0.9,
    };

    let totalScore = 0;
    let totalWeight = 0;

    for (const [category, score] of Object.entries(scores)) {
      const weight = weights[category] || 0.5;
      totalScore += score * weight;
      totalWeight += weight;
    }

    return totalScore / totalWeight;
  }

  private async takeAction(report: Report): Promise<void> {
    const severity = report.aiAnalysis?.severity || 0;
    const user = await this.db.collection('users').doc(report.reportedId).get();
    const userData = user.data() as User;

    let suspensionDuration = 0;
    if (severity >= 0.9) {
      suspensionDuration = 30; // 30 days
    } else if (severity >= 0.7) {
      suspensionDuration = 7; // 7 days
    } else if (severity >= 0.5) {
      suspensionDuration = 1; // 1 day
    }

    if (suspensionDuration > 0) {
      const suspensionEndDate = new Date();
      suspensionEndDate.setDate(suspensionEndDate.getDate() + suspensionDuration);

      await this.db.collection('users').doc(report.reportedId).update({
        status: UserStatus.SUSPENDED,
        suspensionEndDate,
        lastSuspensionReason: report.reportType,
      });

      // Notify user of suspension
      await this.notificationService.sendNotification(report.reportedId, {
        type: 'account_suspended',
        title: 'Account Suspended',
        body: `Your account has been suspended for ${suspensionDuration} days`,
        data: {
          suspensionEndDate,
          reason: report.reportType,
        },
      });
    }

    // Remove violating content
    if (report.contentId) {
      await this.db.collection(report.contentType).doc(report.contentId).update({
        status: 'removed',
        removedReason: report.reportType,
        removedTimestamp: new Date(),
      });
    }
  }

  private async notifyModerators(data: any, urgent: boolean): Promise<void> {
    const moderatorsQuery = query(
      collection(this.db, 'users'),
      where('role', '==', 'moderator')
    );

    const snapshot = await moderatorsQuery.get();
    const moderators = snapshot.docs.map(doc => doc.data() as User);

    for (const moderator of moderators) {
      await this.notificationService.sendNotification(moderator.id, {
        type: urgent ? 'urgent_moderation' : 'moderation_required',
        title: urgent ? '🚨 Urgent Moderation Required' : 'New Moderation Task',
        body: `New ${data.type} requires review`,
        data,
        priority: urgent ? 'high' : 'normal',
      });
    }
  }
}
