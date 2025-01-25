import { FirebaseFirestore } from '@firebase/firestore';
import { getFirestore } from 'firebase/firestore';

import { ContentTemplate } from './ContentTemplateService';

export interface TemplateVersion {
  id: string;
  templateId: string;
  version: number;
  changes: string[];
  prompt: string;
  style?: string;
  parameters?: Record<string, any>;
  createdAt: Date;
  createdBy: string;
  performance?: {
    usageCount: number;
    successRate: number;
    averageRating: number;
    engagement: number;
  };
}

export interface TemplateComparison {
  oldVersion: TemplateVersion;
  newVersion: TemplateVersion;
  changes: {
    prompt: boolean;
    style: boolean;
    parameters: boolean;
    performanceDiff: {
      usageCount: number;
      successRate: number;
      averageRating: number;
      engagement: number;
    };
  };
}

export class TemplateVersioningService {
  private static instance: TemplateVersioningService;
  private db: FirebaseFirestore;

  private constructor() {
    this.db = getFirestore();
  }

  public static getInstance(): TemplateVersioningService {
    if (!TemplateVersioningService.instance) {
      TemplateVersioningService.instance = new TemplateVersioningService();
    }
    return TemplateVersioningService.instance;
  }

  async createVersion(
    templateId: string,
    changes: string[],
    template: Partial<ContentTemplate>,
    userId: string
  ): Promise<string> {
    const versionsRef = this.db
      .collection('templates')
      .doc(templateId)
      .collection('versions');

    // Get current version number
    const versions = await versionsRef
      .orderBy('version', 'desc')
      .limit(1)
      .get();
    const currentVersion = versions.empty ? 0 : versions.docs[0].data().version;

    const newVersion: Omit<TemplateVersion, 'id'> = {
      templateId,
      version: currentVersion + 1,
      changes,
      prompt: template.prompt!,
      style: template.style,
      parameters: template.parameters,
      createdAt: new Date(),
      createdBy: userId,
      performance: {
        usageCount: 0,
        successRate: 0,
        averageRating: 0,
        engagement: 0,
      },
    };

    const doc = await versionsRef.add(newVersion);
    return doc.id;
  }

  async getVersion(
    templateId: string,
    versionId: string
  ): Promise<TemplateVersion | null> {
    const doc = await this.db
      .collection('templates')
      .doc(templateId)
      .collection('versions')
      .doc(versionId)
      .get();

    return doc.exists
      ? ({ id: doc.id, ...doc.data() } as TemplateVersion)
      : null;
  }

  async listVersions(
    templateId: string,
    options: {
      limit?: number;
      startAfter?: number;
    } = {}
  ): Promise<TemplateVersion[]> {
    let query = this.db
      .collection('templates')
      .doc(templateId)
      .collection('versions')
      .orderBy('version', 'desc');

    if (options.startAfter !== undefined) {
      query = query.startAfter(options.startAfter) as unknown;
    }

    if (options.limit) {
      query = query.limit(options.limit) as unknown;
    }

    const snapshot = await query.get();
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as TemplateVersion[];
  }

  async compareVersions(
    templateId: string,
    oldVersionId: string,
    newVersionId: string
  ): Promise<TemplateComparison> {
    const [oldVersion, newVersion] = await Promise.all([
      this.getVersion(templateId, oldVersionId),
      this.getVersion(templateId, newVersionId),
    ]);

    if (!oldVersion || !newVersion) {
      throw new Error('Version not found');
    }

    return {
      oldVersion,
      newVersion,
      changes: {
        prompt: oldVersion.prompt !== newVersion.prompt,
        style: oldVersion.style !== newVersion.style,
        parameters:
          JSON.stringify(oldVersion.parameters) !==
          JSON.stringify(newVersion.parameters),
        performanceDiff: {
          usageCount:
            (newVersion.performance?.usageCount || 0) -
            (oldVersion.performance?.usageCount || 0),
          successRate:
            (newVersion.performance?.successRate || 0) -
            (oldVersion.performance?.successRate || 0),
          averageRating:
            (newVersion.performance?.averageRating || 0) -
            (oldVersion.performance?.averageRating || 0),
          engagement:
            (newVersion.performance?.engagement || 0) -
            (oldVersion.performance?.engagement || 0),
        },
      },
    };
  }

  async rollbackToVersion(
    templateId: string,
    versionId: string,
    userId: string
  ): Promise<void> {
    const version = await this.getVersion(templateId, versionId);
    if (!version) {
      throw new Error('Version not found');
    }

    const templateRef = this.db.collection('templates').doc(templateId);
    const template = await templateRef.get();

    if (!template.exists) {
      throw new Error('Template not found');
    }

    // Create new version with rollback changes
    await this.createVersion(
      templateId,
      [`Rollback to version ${version.version}`],
      {
        prompt: version.prompt,
        style: version.style,
        parameters: version.parameters,
      },
      userId
    );

    // Update template with rolled back version
    await templateRef.update({
      prompt: version.prompt,
      style: version.style,
      parameters: version.parameters,
      lastModified: new Date(),
      modifiedBy: userId,
    });
  }

  async updateVersionPerformance(
    templateId: string,
    versionId: string,
    performance: Partial<TemplateVersion['performance']>
  ): Promise<void> {
    const versionRef = this.db
      .collection('templates')
      .doc(templateId)
      .collection('versions')
      .doc(versionId);

    await versionRef.update({
      'performance.usageCount': performance.usageCount || 0,
      'performance.successRate': performance.successRate || 0,
      'performance.averageRating': performance.averageRating || 0,
      'performance.engagement': performance.engagement || 0,
    });
  }

  async getVersionHistory(
    templateId: string,
    options: {
      limit?: number;
      startAfter?: Date;
    } = {}
  ): Promise<{
    versions: TemplateVersion[];
    performanceOverTime: {
      version: number;
      performance: TemplateVersion['performance'];
      timestamp: Date;
    }[];
  }> {
    let query = this.db
      .collection('templates')
      .doc(templateId)
      .collection('versions')
      .orderBy('createdAt', 'desc');

    if (options.startAfter) {
      query = query.startAfter(options.startAfter) as unknown;
    }

    if (options.limit) {
      query = query.limit(options.limit) as unknown;
    }

    const snapshot = await query.get();
    const versions = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as TemplateVersion[];

    const performanceOverTime = versions.map(version => ({
      version: version.version,
      performance: version.performance!,
      timestamp: version.createdAt,
    }));

    return {
      versions,
      performanceOverTime,
    };
  }

  async getVersionPerformanceComparison(
    templateId: string,
    versionIds: string[]
  ): Promise<Record<string, TemplateVersion['performance']>> {
    const performances: Record<string, TemplateVersion['performance']> = {};

    await Promise.all(
      versionIds.map(async versionId => {
        const version = await this.getVersion(templateId, versionId);
        if (version?.performance) {
          performances[versionId] = version.performance;
        }
      })
    );

    return performances;
  }

  async findBestPerformingVersion(
    templateId: string,
    metric: keyof TemplateVersion['performance'] = 'engagement'
  ): Promise<TemplateVersion | null> {
    const versions = await this.listVersions(templateId);
    if (versions.length === 0) return null;

    return versions.reduce((best, current) => {
      if (!best.performance || !current.performance) return best;
      return best.performance[metric] > current.performance[metric]
        ? best
        : current;
    });
  }

  async archiveVersion(templateId: string, versionId: string): Promise<void> {
    const versionRef = this.db
      .collection('templates')
      .doc(templateId)
      .collection('versions')
      .doc(versionId);

    await versionRef.update({
      archived: true,
      archivedAt: new Date(),
    });
  }

  async restoreVersion(templateId: string, versionId: string): Promise<void> {
    const versionRef = this.db
      .collection('templates')
      .doc(templateId)
      .collection('versions')
      .doc(versionId);

    await versionRef.update({
      archived: false,
      archivedAt: null,
    });
  }
}
