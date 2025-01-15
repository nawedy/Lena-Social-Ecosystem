import { FirebaseFirestore } from '@firebase/firestore';
import { getFirestore } from 'firebase/firestore';
import { ContentTemplate } from './ContentTemplateService';

export type ApprovalStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'changes_requested'
  | 'draft';

export interface ApprovalRequest {
  id: string;
  templateId: string;
  templateVersion: string;
  status: ApprovalStatus;
  submittedBy: string;
  submittedAt: Date;
  reviewedBy?: string;
  reviewedAt?: Date;
  comments?: ApprovalComment[];
  changes?: string[];
  metadata?: {
    priority?: 'low' | 'medium' | 'high';
    category?: string;
    tags?: string[];
    aiProvider?: string;
    contentType?: string;
  };
}

export interface ApprovalComment {
  id: string;
  userId: string;
  message: string;
  timestamp: Date;
  type: 'comment' | 'change_request' | 'approval' | 'rejection';
  location?: {
    field: string;
    context?: string;
  };
}

export interface ApprovalWorkflow {
  id: string;
  name: string;
  steps: ApprovalStep[];
  requiredApprovers: number;
  autoApprovalCriteria?: {
    minRating?: number;
    minSuccessRate?: number;
    requiredTags?: string[];
    bannedTags?: string[];
  };
  notifications: {
    email?: boolean;
    inApp?: boolean;
    slack?: boolean;
  };
}

export interface ApprovalStep {
  id: string;
  name: string;
  type: 'review' | 'test' | 'validation';
  assignedTo?: string[];
  deadline?: number; // hours
  required: boolean;
  criteria?: {
    tests?: string[];
    validations?: string[];
    checklist?: string[];
  };
}

export class TemplateApprovalService {
  private static instance: TemplateApprovalService;
  private db: FirebaseFirestore;

  private constructor() {
    this.db = getFirestore();
  }

  public static getInstance(): TemplateApprovalService {
    if (!TemplateApprovalService.instance) {
      TemplateApprovalService.instance = new TemplateApprovalService();
    }
    return TemplateApprovalService.instance;
  }

  async submitForApproval(
    templateId: string,
    userId: string,
    metadata?: ApprovalRequest['metadata']
  ): Promise<string> {
    const template = await this.db
      .collection('templates')
      .doc(templateId)
      .get();

    if (!template.exists) {
      throw new Error('Template not found');
    }

    const request: Omit<ApprovalRequest, 'id'> = {
      templateId,
      templateVersion: template.data()?.version,
      status: 'pending',
      submittedBy: userId,
      submittedAt: new Date(),
      comments: [],
      changes: [],
      metadata,
    };

    const doc = await this.db.collection('approvalRequests').add(request);
    
    // Create initial workflow steps
    await this.initializeWorkflow(doc.id);

    return doc.id;
  }

  async getApprovalRequest(requestId: string): Promise<ApprovalRequest | null> {
    const doc = await this.db
      .collection('approvalRequests')
      .doc(requestId)
      .get();

    return doc.exists ? { id: doc.id, ...doc.data() } as ApprovalRequest : null;
  }

  async updateApprovalStatus(
    requestId: string,
    status: ApprovalStatus,
    userId: string,
    comment?: string
  ): Promise<void> {
    const request = await this.getApprovalRequest(requestId);
    if (!request) {
      throw new Error('Approval request not found');
    }

    const batch = this.db.batch();
    const requestRef = this.db.collection('approvalRequests').doc(requestId);

    batch.update(requestRef, {
      status,
      reviewedBy: userId,
      reviewedAt: new Date(),
    });

    if (comment) {
      const commentData: ApprovalComment = {
        id: Math.random().toString(36).substr(2, 9),
        userId,
        message: comment,
        timestamp: new Date(),
        type: this.getCommentType(status),
      };

      batch.update(requestRef, {
        comments: FirebaseFirestore.FieldValue.arrayUnion(commentData),
      });
    }

    // Update template status if approved or rejected
    if (status === 'approved' || status === 'rejected') {
      const templateRef = this.db
        .collection('templates')
        .doc(request.templateId);

      batch.update(templateRef, {
        approvalStatus: status,
        lastModified: new Date(),
        modifiedBy: userId,
      });
    }

    await batch.commit();
  }

  async addComment(
    requestId: string,
    userId: string,
    comment: string,
    location?: ApprovalComment['location']
  ): Promise<void> {
    const commentData: ApprovalComment = {
      id: Math.random().toString(36).substr(2, 9),
      userId,
      message: comment,
      timestamp: new Date(),
      type: 'comment',
      location,
    };

    await this.db
      .collection('approvalRequests')
      .doc(requestId)
      .update({
        comments: FirebaseFirestore.FieldValue.arrayUnion(commentData),
      });
  }

  async requestChanges(
    requestId: string,
    userId: string,
    changes: string[],
    comment?: string
  ): Promise<void> {
    const batch = this.db.batch();
    const requestRef = this.db.collection('approvalRequests').doc(requestId);

    batch.update(requestRef, {
      status: 'changes_requested',
      changes: FirebaseFirestore.FieldValue.arrayUnion(...changes),
    });

    if (comment) {
      const commentData: ApprovalComment = {
        id: Math.random().toString(36).substr(2, 9),
        userId,
        message: comment,
        timestamp: new Date(),
        type: 'change_request',
      };

      batch.update(requestRef, {
        comments: FirebaseFirestore.FieldValue.arrayUnion(commentData),
      });
    }

    await batch.commit();
  }

  async listApprovalRequests(options: {
    status?: ApprovalStatus;
    userId?: string;
    category?: string;
    startAfter?: Date;
    limit?: number;
  } = {}): Promise<ApprovalRequest[]> {
    let query = this.db.collection('approvalRequests');

    if (options.status) {
      query = query.where('status', '==', options.status) as any;
    }

    if (options.userId) {
      query = query.where('submittedBy', '==', options.userId) as any;
    }

    if (options.category) {
      query = query.where(
        'metadata.category',
        '==',
        options.category
      ) as any;
    }

    query = query.orderBy('submittedAt', 'desc') as any;

    if (options.startAfter) {
      query = query.startAfter(options.startAfter) as any;
    }

    if (options.limit) {
      query = query.limit(options.limit) as any;
    }

    const snapshot = await query.get();
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as ApprovalRequest[];
  }

  async createWorkflow(workflow: Omit<ApprovalWorkflow, 'id'>): Promise<string> {
    const doc = await this.db.collection('approvalWorkflows').add(workflow);
    return doc.id;
  }

  async updateWorkflow(
    workflowId: string,
    updates: Partial<ApprovalWorkflow>
  ): Promise<void> {
    await this.db
      .collection('approvalWorkflows')
      .doc(workflowId)
      .update(updates);
  }

  async getWorkflow(workflowId: string): Promise<ApprovalWorkflow | null> {
    const doc = await this.db
      .collection('approvalWorkflows')
      .doc(workflowId)
      .get();

    return doc.exists ? { id: doc.id, ...doc.data() } as ApprovalWorkflow : null;
  }

  async assignReviewers(
    requestId: string,
    reviewerIds: string[]
  ): Promise<void> {
    await this.db
      .collection('approvalRequests')
      .doc(requestId)
      .update({
        assignedReviewers: reviewerIds,
      });
  }

  async checkAutoApproval(templateId: string): Promise<{
    canAutoApprove: boolean;
    reasons: string[];
  }> {
    const [template, workflow] = await Promise.all([
      this.db.collection('templates').doc(templateId).get(),
      this.getDefaultWorkflow(),
    ]);

    if (!template.exists || !workflow?.autoApprovalCriteria) {
      return { canAutoApprove: false, reasons: ['No auto-approval criteria'] };
    }

    const data = template.data() as ContentTemplate;
    const criteria = workflow.autoApprovalCriteria;
    const reasons: string[] = [];

    if (
      criteria.minRating &&
      (!data.rating || data.rating < criteria.minRating)
    ) {
      reasons.push(`Rating below ${criteria.minRating}`);
    }

    if (
      criteria.minSuccessRate &&
      (!data.successRate || data.successRate < criteria.minSuccessRate)
    ) {
      reasons.push(`Success rate below ${criteria.minSuccessRate}`);
    }

    if (criteria.requiredTags) {
      const missingTags = criteria.requiredTags.filter(
        tag => !data.tags?.includes(tag)
      );
      if (missingTags.length > 0) {
        reasons.push(`Missing required tags: ${missingTags.join(', ')}`);
      }
    }

    if (criteria.bannedTags) {
      const bannedTagsFound = criteria.bannedTags.filter(tag =>
        data.tags?.includes(tag)
      );
      if (bannedTagsFound.length > 0) {
        reasons.push(`Contains banned tags: ${bannedTagsFound.join(', ')}`);
      }
    }

    return {
      canAutoApprove: reasons.length === 0,
      reasons,
    };
  }

  async getApprovalStats(
    timeframe: 'day' | 'week' | 'month' | 'year' = 'month'
  ): Promise<{
    total: number;
    approved: number;
    rejected: number;
    pending: number;
    averageTime: number;
    byCategory: Record<string, number>;
    byReviewer: Record<string, number>;
  }> {
    const startDate = this.getStartDate(timeframe);
    const requests = await this.db
      .collection('approvalRequests')
      .where('submittedAt', '>=', startDate)
      .get();

    const stats = {
      total: requests.size,
      approved: 0,
      rejected: 0,
      pending: 0,
      totalTime: 0,
      completedRequests: 0,
      byCategory: {} as Record<string, number>,
      byReviewer: {} as Record<string, number>,
    };

    requests.docs.forEach(doc => {
      const data = doc.data() as ApprovalRequest;
      
      switch (data.status) {
        case 'approved':
          stats.approved++;
          break;
        case 'rejected':
          stats.rejected++;
          break;
        case 'pending':
          stats.pending++;
          break;
      }

      if (data.reviewedAt) {
        stats.totalTime +=
          data.reviewedAt.getTime() - data.submittedAt.getTime();
        stats.completedRequests++;
      }

      if (data.metadata?.category) {
        stats.byCategory[data.metadata.category] =
          (stats.byCategory[data.metadata.category] || 0) + 1;
      }

      if (data.reviewedBy) {
        stats.byReviewer[data.reviewedBy] =
          (stats.byReviewer[data.reviewedBy] || 0) + 1;
      }
    });

    return {
      total: stats.total,
      approved: stats.approved,
      rejected: stats.rejected,
      pending: stats.pending,
      averageTime:
        stats.completedRequests > 0
          ? stats.totalTime / stats.completedRequests
          : 0,
      byCategory: stats.byCategory,
      byReviewer: stats.byReviewer,
    };
  }

  private getCommentType(status: ApprovalStatus): ApprovalComment['type'] {
    switch (status) {
      case 'approved':
        return 'approval';
      case 'rejected':
        return 'rejection';
      case 'changes_requested':
        return 'change_request';
      default:
        return 'comment';
    }
  }

  private async initializeWorkflow(requestId: string): Promise<void> {
    const workflow = await this.getDefaultWorkflow();
    if (!workflow) return;

    const steps = workflow.steps.map(step => ({
      ...step,
      status: 'pending',
      completedAt: null,
      completedBy: null,
    }));

    await this.db
      .collection('approvalRequests')
      .doc(requestId)
      .collection('workflow')
      .doc('steps')
      .set({ steps });
  }

  private async getDefaultWorkflow(): Promise<ApprovalWorkflow | null> {
    const snapshot = await this.db
      .collection('approvalWorkflows')
      .where('isDefault', '==', true)
      .limit(1)
      .get();

    return snapshot.empty
      ? null
      : { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as ApprovalWorkflow;
  }

  private getStartDate(timeframe: string): Date {
    const date = new Date();
    switch (timeframe) {
      case 'day':
        date.setDate(date.getDate() - 1);
        break;
      case 'week':
        date.setDate(date.getDate() - 7);
        break;
      case 'month':
        date.setMonth(date.getMonth() - 1);
        break;
      case 'year':
        date.setFullYear(date.getFullYear() - 1);
        break;
    }
    return date;
  }
}
