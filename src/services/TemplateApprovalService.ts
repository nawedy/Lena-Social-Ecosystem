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
  startAfter,
  updateDoc,
  setDoc,
  addDoc,
  arrayUnion,
  DocumentData,
  QueryDocumentSnapshot,
  DocumentSnapshot
} from 'firebase/firestore';
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
  private db: Firestore;

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
    const templateDoc = await getDoc(doc(this.db, 'templates', templateId));

    if (!templateDoc.exists()) {
      throw new Error('Template not found');
    }

    const request: Omit<ApprovalRequest, 'id'> = {
      templateId,
      templateVersion: templateDoc.data()?.version,
      status: 'pending',
      submittedBy: userId,
      submittedAt: new Date(),
      comments: [],
      changes: [],
      metadata,
    };

    const docRef = await addDoc(collection(this.db, 'approvalRequests'), request);
    
    // Create initial workflow steps
    await this.initializeWorkflow(docRef.id);

    return docRef.id;
  }

  async getApprovalRequest(requestId: string): Promise<ApprovalRequest | null> {
    const docRef = doc(this.db, 'approvalRequests', requestId);
    const docSnap = await getDoc(docRef);

    return docSnap.exists() 
      ? { id: docSnap.id, ...docSnap.data() } as ApprovalRequest 
      : null;
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

    const requestRef = doc(this.db, 'approvalRequests', requestId);
    const updates: Partial<ApprovalRequest> = {
      status,
      reviewedBy: userId,
      reviewedAt: new Date(),
    };

    if (comment) {
      const commentData: ApprovalComment = {
        id: Math.random().toString(36).substr(2, 9),
        userId,
        message: comment,
        timestamp: new Date(),
        type: this.getCommentType(status),
      };

      updates.comments = arrayUnion(commentData) as any;
    }

    await updateDoc(requestRef, updates);

    // Update template status if approved or rejected
    if (status === 'approved' || status === 'rejected') {
      const templateRef = doc(this.db, 'templates', request.templateId);
      await updateDoc(templateRef, {
        approvalStatus: status,
        lastModified: new Date(),
        modifiedBy: userId,
      });
    }
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

    const requestRef = doc(this.db, 'approvalRequests', requestId);
    await updateDoc(requestRef, {
      comments: arrayUnion(commentData),
    });
  }

  async requestChanges(
    requestId: string,
    userId: string,
    changes: string[],
    comment?: string
  ): Promise<void> {
    const requestRef = doc(this.db, 'approvalRequests', requestId);
    const updates: any = {
      status: 'changes_requested',
      changes: arrayUnion(...changes),
    };

    if (comment) {
      const commentData: ApprovalComment = {
        id: Math.random().toString(36).substr(2, 9),
        userId,
        message: comment,
        timestamp: new Date(),
        type: 'change_request',
      };

      updates.comments = arrayUnion(commentData);
    }

    await updateDoc(requestRef, updates);
  }

  async listApprovalRequests(options: {
    status?: ApprovalStatus;
    userId?: string;
    category?: string;
    startAfter?: Date;
    limit?: number;
  } = {}): Promise<ApprovalRequest[]> {
    const queryConstraints = [];

    if (options.status) {
      queryConstraints.push(where('status', '==', options.status));
    }

    if (options.userId) {
      queryConstraints.push(where('submittedBy', '==', options.userId));
    }

    if (options.category) {
      queryConstraints.push(where('metadata.category', '==', options.category));
    }

    queryConstraints.push(orderBy('submittedAt', 'desc'));

    if (options.startAfter) {
      queryConstraints.push(startAfter(options.startAfter));
    }

    if (options.limit) {
      queryConstraints.push(limit(options.limit));
    }

    const q = query(collection(this.db, 'approvalRequests'), ...queryConstraints);
    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as ApprovalRequest[];
  }

  async createWorkflow(workflow: Omit<ApprovalWorkflow, 'id'>): Promise<string> {
    const docRef = await addDoc(collection(this.db, 'approvalWorkflows'), workflow);
    return docRef.id;
  }

  async updateWorkflow(
    workflowId: string,
    updates: Partial<ApprovalWorkflow>
  ): Promise<void> {
    const workflowRef = doc(this.db, 'approvalWorkflows', workflowId);
    await updateDoc(workflowRef, updates);
  }

  async getWorkflow(workflowId: string): Promise<ApprovalWorkflow | null> {
    const docRef = doc(this.db, 'approvalWorkflows', workflowId);
    const docSnap = await getDoc(docRef);

    return docSnap.exists() 
      ? { id: docSnap.id, ...docSnap.data() } as ApprovalWorkflow 
      : null;
  }

  async assignReviewers(
    requestId: string,
    reviewerIds: string[]
  ): Promise<void> {
    const requestRef = doc(this.db, 'approvalRequests', requestId);
    await updateDoc(requestRef, {
      assignedReviewers: reviewerIds,
    });
  }

  async checkAutoApproval(templateId: string): Promise<{
    canAutoApprove: boolean;
    reasons: string[];
  }> {
    const [templateDoc, workflow] = await Promise.all([
      getDoc(doc(this.db, 'templates', templateId)),
      this.getDefaultWorkflow(),
    ]);

    if (!templateDoc.exists() || !workflow?.autoApprovalCriteria) {
      return { canAutoApprove: false, reasons: ['No auto-approval criteria'] };
    }

    const data = templateDoc.data() as ContentTemplate;
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
    const q = query(
      collection(this.db, 'approvalRequests'),
      where('submittedAt', '>=', startDate)
    );
    const snapshot = await getDocs(q);

    const stats = {
      total: snapshot.size,
      approved: 0,
      rejected: 0,
      pending: 0,
      totalTime: 0,
      completedRequests: 0,
      byCategory: {} as Record<string, number>,
      byReviewer: {} as Record<string, number>,
    };

    snapshot.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
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

    const stepsRef = doc(this.db, 'approvalRequests', requestId, 'workflow', 'steps');
    await setDoc(stepsRef, { steps });
  }

  private async getDefaultWorkflow(): Promise<ApprovalWorkflow | null> {
    const q = query(
      collection(this.db, 'approvalWorkflows'),
      where('isDefault', '==', true),
      limit(1)
    );
    const snapshot = await getDocs(q);

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
