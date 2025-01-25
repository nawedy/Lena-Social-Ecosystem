import {
  Firestore,
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  updateDoc,
  setDoc,
  addDoc,
  increment,
  deleteDoc,
  DocumentData,
  QueryDocumentSnapshot,
} from 'firebase/firestore';

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
  private db: Firestore;

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
    const templateRef = doc(this.db, 'templates', templateId);
    const templateSnap = await getDoc(templateRef);

    if (!templateSnap.exists()) {
      throw new Error('Template not found');
    }

    const templateData = templateSnap.data() as ContentTemplate;
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

    await setDoc(doc(this.db, 'sharedTemplates', shareId), shareData);

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

    await setDoc(
      doc(this.db, 'templates', templateId, 'shares', shareId),
      share
    );

    return share;
  }

  async getSharedTemplate(
    shareId: string,
    options: {
      password?: string;
      userId?: string;
    } = {}
  ): Promise<SharedTemplate | null> {
    const docRef = doc(this.db, 'sharedTemplates', shareId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    const template = { id: docSnap.id, ...docSnap.data() } as SharedTemplate;

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
    await updateDoc(docRef, {
      accessCount: increment(1),
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

    const docRef = await addDoc(collection(this.db, 'templates'), templateData);

    // Update fork count
    await updateDoc(doc(this.db, 'sharedTemplates', shareId), {
      forkCount: increment(1),
    });

    return docRef.id;
  }

  async listShares(
    templateId: string
  ): Promise<(TemplateShare & { active: boolean })[]> {
    const snapshot = await getDocs(
      query(
        collection(this.db, 'templates', templateId, 'shares'),
        orderBy('sharedAt', 'desc')
      )
    );

    return snapshot.docs.map(doc => {
      const share = { id: doc.id, ...doc.data() } as TemplateShare;
      return {
        ...share,
        active: !share.expiresAt || share.expiresAt.getTime() > Date.now(),
      };
    });
  }

  async revokeShare(templateId: string, shareId: string): Promise<void> {
    await Promise.all([
      deleteDoc(doc(this.db, 'sharedTemplates', shareId)),
      deleteDoc(doc(this.db, 'templates', templateId, 'shares', shareId)),
    ]);
  }

  async updateShareSettings(
    shareId: string,
    settings: Partial<SharedTemplate['settings']>
  ): Promise<void> {
    await updateDoc(doc(this.db, 'sharedTemplates', shareId), {
      settings,
    });
  }

  async trackSharedTemplateUsage(
    shareId: string,
    userId: string
  ): Promise<void> {
    const sharedRef = doc(this.db, 'sharedTemplates', shareId);
    const shared = await getDoc(sharedRef);

    if (!shared.exists()) {
      throw new Error('Shared template not found');
    }

    const template = shared.data() as SharedTemplate;
    if (!template.settings.trackUsage) {
      return;
    }

    await addDoc(collection(sharedRef, 'usage'), {
      userId,
      timestamp: new Date(),
    });
  }

  private generateShareId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  private generateShareUrl(shareId: string): string {
    return `${process.env.NEXT_PUBLIC_APP_URL}/templates/shared/${shareId}`;
  }

  async getSharedTemplateAnalytics(shareId: string): Promise<{
    accessCount: number;
    forkCount: number;
    usageCount: number;
    uniqueUsers: number;
    usageByDay: { date: string; count: number }[];
  }> {
    const sharedRef = doc(this.db, 'sharedTemplates', shareId);
    const shared = await getDoc(sharedRef);

    if (!shared.exists()) {
      throw new Error('Shared template not found');
    }

    const template = shared.data() as SharedTemplate;

    // Get usage data
    const usageSnapshot = await getDocs(
      query(collection(sharedRef, 'usage'), orderBy('timestamp', 'desc'))
    );

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
    const byDay = usage.reduce(
      (acc, curr) => {
        const date = curr.timestamp.toISOString().split('T')[0];
        acc[date] = (acc[date] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return Object.entries(byDay).map(([date, count]) => ({
      date,
      count,
    }));
  }
}
