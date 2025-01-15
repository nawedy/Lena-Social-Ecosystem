import { FirebaseFirestore } from '@firebase/firestore';
import { getFirestore } from 'firebase/firestore';
import { ContentTemplate } from './ContentTemplateService';

export interface SharedTemplate extends ContentTemplate {
  shareId: string;
  originalId: string;
  originalOwner: string;
  sharedAt: Date;
  expiresAt?: Date;
  accessCount: number;
  forkCount: number;
  accessList?: string[]; // List of user IDs who can access
  password?: string;
  settings: {
    allowForks: boolean;
    allowModifications: boolean;
    requireAttribution: boolean;
    trackUsage: boolean;
  };
}

export interface TemplateShare {
  id: string;
  templateId: string;
  shareUrl: string;
  sharedBy: string;
  sharedAt: Date;
  expiresAt?: Date;
  accessCount: number;
  settings: SharedTemplate['settings'];
}

export class TemplateSharingService {
  private static instance: TemplateSharingService;
  private db: FirebaseFirestore;

  private constructor() {
    this.db = getFirestore();
  }

  public static getInstance(): TemplateSharingService {
    if (!TemplateSharingService.instance) {
      TemplateSharingService.instance = new TemplateSharingService();
    }
    return TemplateSharingService.instance;
  }

  async shareTemplate(
    templateId: string,
    userId: string,
    options: {
      expiration?: Date;
      password?: string;
      accessList?: string[];
      settings?: Partial<SharedTemplate['settings']>;
    } = {}
  ): Promise<TemplateShare> {
    const templateRef = this.db.collection('templates').doc(templateId);
    const template = await templateRef.get();

    if (!template.exists) {
      throw new Error('Template not found');
    }

    const templateData = template.data() as ContentTemplate;
    if (templateData.createdBy !== userId) {
      throw new Error('Only template owner can share');
    }

    const shareId = this.generateShareId();
    const shareUrl = this.generateShareUrl(shareId);

    const shareData: SharedTemplate = {
      ...templateData,
      shareId,
      originalId: templateId,
      originalOwner: userId,
      sharedAt: new Date(),
      expiresAt: options.expiration,
      accessCount: 0,
      forkCount: 0,
      accessList: options.accessList,
      password: options.password,
      settings: {
        allowForks: true,
        allowModifications: false,
        requireAttribution: true,
        trackUsage: true,
        ...options.settings,
      },
    };

    await this.db.collection('sharedTemplates').doc(shareId).set(shareData);

    const share: TemplateShare = {
      id: shareId,
      templateId,
      shareUrl,
      sharedBy: userId,
      sharedAt: new Date(),
      expiresAt: options.expiration,
      accessCount: 0,
      settings: shareData.settings,
    };

    await this.db
      .collection('templates')
      .doc(templateId)
      .collection('shares')
      .doc(shareId)
      .set(share);

    return share;
  }

  async getSharedTemplate(
    shareId: string,
    options: {
      password?: string;
      userId?: string;
    } = {}
  ): Promise<SharedTemplate | null> {
    const doc = await this.db.collection('sharedTemplates').doc(shareId).get();

    if (!doc.exists) {
      return null;
    }

    const template = { id: doc.id, ...doc.data() } as SharedTemplate;

    // Check expiration
    if (template.expiresAt && template.expiresAt.getTime() < Date.now()) {
      return null;
    }

    // Check password
    if (template.password && template.password !== options.password) {
      throw new Error('Invalid password');
    }

    // Check access list
    if (
      template.accessList &&
      template.accessList.length > 0 &&
      (!options.userId || !template.accessList.includes(options.userId))
    ) {
      throw new Error('Access denied');
    }

    // Update access count
    await doc.ref.update({
      accessCount: FirebaseFirestore.FieldValue.increment(1),
    });

    return template;
  }

  async forkTemplate(
    shareId: string,
    userId: string,
    modifications?: Partial<ContentTemplate>
  ): Promise<string> {
    const shared = await this.getSharedTemplate(shareId, { userId });

    if (!shared) {
      throw new Error('Shared template not found');
    }

    if (!shared.settings.allowForks) {
      throw new Error('Forking not allowed');
    }

    const templateData: Omit<ContentTemplate, 'id'> = {
      ...shared,
      name: `${shared.name} (Fork)`,
      createdBy: userId,
      createdAt: new Date(),
      isPublic: false,
      ...modifications,
    };

    if (shared.settings.requireAttribution) {
      templateData.attribution = {
        originalId: shared.originalId,
        originalOwner: shared.originalOwner,
        forkedFrom: shareId,
      };
    }

    const doc = await this.db.collection('templates').add(templateData);

    // Update fork count
    await this.db
      .collection('sharedTemplates')
      .doc(shareId)
      .update({
        forkCount: FirebaseFirestore.FieldValue.increment(1),
      });

    return doc.id;
  }

  async listShares(
    templateId: string
  ): Promise<(TemplateShare & { active: boolean })[]> {
    const snapshot = await this.db
      .collection('templates')
      .doc(templateId)
      .collection('shares')
      .orderBy('sharedAt', 'desc')
      .get();

    return snapshot.docs.map(doc => {
      const share = { id: doc.id, ...doc.data() } as TemplateShare;
      return {
        ...share,
        active:
          !share.expiresAt || share.expiresAt.getTime() > Date.now(),
      };
    });
  }

  async revokeShare(templateId: string, shareId: string): Promise<void> {
    await Promise.all([
      this.db.collection('sharedTemplates').doc(shareId).delete(),
      this.db
        .collection('templates')
        .doc(templateId)
        .collection('shares')
        .doc(shareId)
        .delete(),
    ]);
  }

  async updateShareSettings(
    shareId: string,
    settings: Partial<SharedTemplate['settings']>
  ): Promise<void> {
    await this.db
      .collection('sharedTemplates')
      .doc(shareId)
      .update({
        settings: FirebaseFirestore.FieldValue.arrayUnion(settings),
      });
  }

  async trackSharedTemplateUsage(
    shareId: string,
    userId: string
  ): Promise<void> {
    const sharedRef = this.db.collection('sharedTemplates').doc(shareId);
    const shared = await sharedRef.get();

    if (!shared.exists) {
      throw new Error('Shared template not found');
    }

    const template = shared.data() as SharedTemplate;
    if (!template.settings.trackUsage) {
      return;
    }

    await this.db
      .collection('sharedTemplates')
      .doc(shareId)
      .collection('usage')
      .add({
        userId,
        timestamp: new Date(),
      });
  }

  private generateShareId(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  private generateShareUrl(shareId: string): string {
    return `https://tiktok-toe.app/template/share/${shareId}`;
  }

  async getSharedTemplateAnalytics(
    shareId: string
  ): Promise<{
    accessCount: number;
    forkCount: number;
    usageCount: number;
    uniqueUsers: number;
    usageByDay: { date: string; count: number }[];
  }> {
    const sharedRef = this.db.collection('sharedTemplates').doc(shareId);
    const shared = await sharedRef.get();

    if (!shared.exists) {
      throw new Error('Shared template not found');
    }

    const template = shared.data() as SharedTemplate;

    // Get usage data
    const usageSnapshot = await sharedRef
      .collection('usage')
      .orderBy('timestamp', 'desc')
      .get();

    const usage = usageSnapshot.docs.map(doc => ({
      userId: doc.data().userId,
      timestamp: doc.data().timestamp.toDate(),
    }));

    // Calculate metrics
    const uniqueUsers = new Set(usage.map(u => u.userId)).size;
    const usageByDay = this.aggregateUsageByDay(usage);

    return {
      accessCount: template.accessCount,
      forkCount: template.forkCount,
      usageCount: usage.length,
      uniqueUsers,
      usageByDay,
    };
  }

  private aggregateUsageByDay(
    usage: { timestamp: Date }[]
  ): { date: string; count: number }[] {
    const byDay = usage.reduce((acc, curr) => {
      const date = curr.timestamp.toISOString().split('T')[0];
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(byDay).map(([date, count]) => ({
      date,
      count,
    }));
  }
}
