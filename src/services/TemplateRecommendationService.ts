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
  DocumentData,
  QueryDocumentSnapshot
} from 'firebase/firestore';
import { ContentTemplate } from './ContentTemplateService';

export interface TemplateRecommendation {
  templateId: string;
  score: number;
  reasons: string[];
  confidence: number;
  category: string;
  tags: string[];
}

export interface UserPreferences {
  favoriteCategories: string[];
  favoriteTags: string[];
  favoriteTemplates: string[];
  usageHistory: {
    templateId: string;
    timestamp: Date;
    success: boolean;
  }[];
  contentTypes: string[];
  aiProviders: string[];
}

export interface RecommendationContext {
  userId: string;
  currentTemplateId?: string;
  currentCategory?: string;
  currentTags?: string[];
  contentType?: string;
  aiProvider?: string;
}

export class TemplateRecommendationService {
  private static instance: TemplateRecommendationService;
  private db: Firestore;
  private readonly MAX_RECOMMENDATIONS = 10;
  private readonly SIMILARITY_THRESHOLD = 0.7;

  private constructor() {
    this.db = getFirestore();
  }

  public static getInstance(): TemplateRecommendationService {
    if (!TemplateRecommendationService.instance) {
      TemplateRecommendationService.instance = new TemplateRecommendationService();
    }
    return TemplateRecommendationService.instance;
  }

  async getRecommendations(
    context: RecommendationContext,
    limit: number = this.MAX_RECOMMENDATIONS
  ): Promise<TemplateRecommendation[]> {
    const [userPrefs, templates] = await Promise.all([
      this.getUserPreferences(context.userId),
      this.getRelevantTemplates(context),
    ]);

    const scoredTemplates = await this.scoreTemplates(
      templates,
      userPrefs,
      context
    );

    return scoredTemplates
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  async getSimilarTemplates(
    templateId: string,
    limit: number = 5
  ): Promise<TemplateRecommendation[]> {
    const template = await this.getTemplate(templateId);
    if (!template) {
      throw new Error('Template not found');
    }

    const q = query(
      collection(this.db, 'templates'),
      where('categoryId', '==', template.categoryId),
      where('isActive', '==', true)
    );
    const similarTemplates = await getDocs(q);

    const scored = await Promise.all(
      similarTemplates.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(t => t.id !== templateId)
        .map(async t => ({
          templateId: t.id,
          score: await this.calculateSimilarity(template, t),
          reasons: this.getSimilarityReasons(template, t),
          confidence: this.calculateConfidence(template, t),
          category: t.categoryId,
          tags: t.tags || [],
        }))
    );

    return scored
      .filter(s => s.score >= this.SIMILARITY_THRESHOLD)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  async getTrendingTemplates(
    options: {
      timeframe?: 'day' | 'week' | 'month';
      category?: string;
      contentType?: string;
    } = {}
  ): Promise<TemplateRecommendation[]> {
    const timeframe = options.timeframe || 'week';
    const startDate = this.getStartDate(timeframe);

    const queryConstraints = [
      where('isActive', '==', true),
      where('lastUsed', '>=', startDate)
    ];

    if (options.category) {
      queryConstraints.push(where('categoryId', '==', options.category));
    }

    if (options.contentType) {
      queryConstraints.push(where('contentType', '==', options.contentType));
    }

    const q = query(collection(this.db, 'templates'), ...queryConstraints);
    const templates = await getDocs(q);

    const scored = templates.docs.map(doc => {
      const data = doc.data();
      const score = this.calculateTrendingScore(data, startDate);
      return {
        templateId: doc.id,
        score,
        reasons: this.getTrendingReasons(data),
        confidence: this.calculateTrendingConfidence(data),
        category: data.categoryId,
        tags: data.tags || [],
      };
    });

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, this.MAX_RECOMMENDATIONS);
  }

  async getPersonalizedRecommendations(
    userId: string,
    limit: number = 5
  ): Promise<TemplateRecommendation[]> {
    const userPrefs = await this.getUserPreferences(userId);
    const recommendations: TemplateRecommendation[] = [];

    // Get templates from favorite categories
    if (userPrefs.favoriteCategories.length > 0) {
      const categoryQuery = query(
        collection(this.db, 'templates'),
        where('categoryId', 'in', userPrefs.favoriteCategories),
        where('isActive', '==', true),
        limit(limit)
      );
      const categoryTemplates = await getDocs(categoryQuery);

      recommendations.push(
        ...categoryTemplates.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => ({
          templateId: doc.id,
          score: this.calculatePersonalizedScore(doc.data(), userPrefs),
          reasons: ['Based on your favorite categories'],
          confidence: 0.8,
          category: doc.data().categoryId,
          tags: doc.data().tags || [],
        }))
      );
    }

    // Get templates with favorite tags
    if (userPrefs.favoriteTags.length > 0) {
      const tagQuery = query(
        collection(this.db, 'templates'),
        where('tags', 'array-contains-any', userPrefs.favoriteTags),
        where('isActive', '==', true),
        limit(limit)
      );
      const tagTemplates = await getDocs(tagQuery);

      recommendations.push(
        ...tagTemplates.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => ({
          templateId: doc.id,
          score: this.calculatePersonalizedScore(doc.data(), userPrefs),
          reasons: ['Based on your favorite tags'],
          confidence: 0.7,
          category: doc.data().categoryId,
          tags: doc.data().tags || [],
        }))
      );
    }

    return recommendations
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  async updateUserPreferences(
    userId: string,
    preferences: Partial<UserPreferences>
  ): Promise<void> {
    await this.db
      .collection('userPreferences')
      .doc(userId)
      .set(preferences, { merge: true });
  }

  async trackTemplateUsage(
    userId: string,
    templateId: string,
    success: boolean
  ): Promise<void> {
    const usage = {
      templateId,
      timestamp: new Date(),
      success,
    };

    await Promise.all([
      // Update user preferences
      this.db
        .collection('userPreferences')
        .doc(userId)
        .update({
          usageHistory: this.db.FieldValue.arrayUnion(usage),
        }),

      // Update template stats
      this.db
        .collection('templates')
        .doc(templateId)
        .update({
          usageCount: this.db.FieldValue.increment(1),
          successCount: this.db.FieldValue.increment(success ? 1 : 0),
          lastUsed: new Date(),
        }),
    ]);
  }

  private async getTemplate(templateId: string): Promise<ContentTemplate | null> {
    const docRef = doc(this.db, 'templates', templateId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } as ContentTemplate : null;
  }

  private async getUserPreferences(userId: string): Promise<UserPreferences> {
    const docRef = doc(this.db, 'userPreferences', userId);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      return {
        favoriteCategories: [],
        favoriteTags: [],
        favoriteTemplates: [],
        usageHistory: [],
        contentTypes: [],
        aiProviders: [],
      };
    }

    return docSnap.data() as UserPreferences;
  }

  private async getRelevantTemplates(
    context: RecommendationContext
  ): Promise<ContentTemplate[]> {
    const queryConstraints = [where('isActive', '==', true)];

    if (context.currentCategory) {
      queryConstraints.push(where('categoryId', '==', context.currentCategory));
    }

    if (context.contentType) {
      queryConstraints.push(where('contentType', '==', context.contentType));
    }

    if (context.aiProvider) {
      queryConstraints.push(where('aiProvider', '==', context.aiProvider));
    }

    const q = query(collection(this.db, 'templates'), ...queryConstraints);
    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as ContentTemplate[];
  }

  private async scoreTemplates(
    templates: ContentTemplate[],
    userPrefs: UserPreferences,
    context: RecommendationContext
  ): Promise<TemplateRecommendation[]> {
    return templates.map(template => {
      const score = this.calculateScore(template, userPrefs, context);
      return {
        templateId: template.id,
        score,
        reasons: this.getRecommendationReasons(template, userPrefs, context),
        confidence: this.calculateConfidence(template, userPrefs),
        category: template.categoryId,
        tags: template.tags || [],
      };
    });
  }

  private calculateScore(
    template: ContentTemplate,
    userPrefs: UserPreferences,
    context: RecommendationContext
  ): number {
    let score = 0;

    // Category match
    if (userPrefs.favoriteCategories.includes(template.categoryId)) {
      score += 0.3;
    }

    // Tag matches
    const tagMatches = (template.tags || []).filter(tag =>
      userPrefs.favoriteTags.includes(tag)
    ).length;
    score += tagMatches * 0.1;

    // Usage history
    const usageCount = userPrefs.usageHistory.filter(
      u => u.templateId === template.id
    ).length;
    score += Math.min(usageCount * 0.05, 0.2);

    // Success rate
    const successRate = template.successCount / template.usageCount || 0;
    score += successRate * 0.2;

    // Recency
    const daysSinceLastUse = this.getDaysSince(template.lastUsed);
    score += Math.max(0, 0.2 - daysSinceLastUse * 0.01);

    return Math.min(score, 1);
  }

  private getRecommendationReasons(
    template: ContentTemplate,
    userPrefs: UserPreferences,
    context: RecommendationContext
  ): string[] {
    const reasons: string[] = [];

    if (userPrefs.favoriteCategories.includes(template.categoryId)) {
      reasons.push('Matches your favorite category');
    }

    const tagMatches = (template.tags || []).filter(tag =>
      userPrefs.favoriteTags.includes(tag)
    );
    if (tagMatches.length > 0) {
      reasons.push(`Matches ${tagMatches.length} of your favorite tags`);
    }

    const usageCount = userPrefs.usageHistory.filter(
      u => u.templateId === template.id
    ).length;
    if (usageCount > 0) {
      reasons.push(`You've used this template ${usageCount} times`);
    }

    if (template.successCount / template.usageCount > 0.8) {
      reasons.push('High success rate');
    }

    return reasons;
  }

  private calculateConfidence(
    template: any,
    userPrefs: UserPreferences
  ): number {
    let confidence = 0.5;

    // More usage = higher confidence
    confidence += Math.min(template.usageCount * 0.01, 0.3);

    // Recent usage = higher confidence
    const daysSinceLastUse = this.getDaysSince(template.lastUsed);
    confidence += Math.max(0, 0.2 - daysSinceLastUse * 0.01);

    return Math.min(confidence, 1);
  }

  private async calculateSimilarity(
    template1: any,
    template2: any
  ): Promise<number> {
    let similarity = 0;

    // Category match
    if (template1.categoryId === template2.categoryId) {
      similarity += 0.3;
    }

    // Tag similarity
    const tags1 = new Set(template1.tags || []);
    const tags2 = new Set(template2.tags || []);
    const commonTags = new Set(
      [...tags1].filter(tag => tags2.has(tag))
    );
    similarity += (commonTags.size / Math.max(tags1.size, tags2.size)) * 0.3;

    // Content type match
    if (template1.contentType === template2.contentType) {
      similarity += 0.2;
    }

    // AI provider match
    if (template1.aiProvider === template2.aiProvider) {
      similarity += 0.2;
    }

    return similarity;
  }

  private getSimilarityReasons(template1: any, template2: any): string[] {
    const reasons: string[] = [];

    if (template1.categoryId === template2.categoryId) {
      reasons.push('Same category');
    }

    const tags1 = new Set(template1.tags || []);
    const tags2 = new Set(template2.tags || []);
    const commonTags = new Set(
      [...tags1].filter(tag => tags2.has(tag))
    );
    if (commonTags.size > 0) {
      reasons.push(`${commonTags.size} common tags`);
    }

    if (template1.contentType === template2.contentType) {
      reasons.push('Same content type');
    }

    if (template1.aiProvider === template2.aiProvider) {
      reasons.push('Same AI provider');
    }

    return reasons;
  }

  private calculateTrendingScore(template: any, startDate: Date): number {
    const daysSinceStart = this.getDaysSince(startDate);
    if (daysSinceStart === 0) return 0;

    const recentUsage = template.usageCount / daysSinceStart;
    const successRate = template.successCount / template.usageCount || 0;

    return (recentUsage * 0.7 + successRate * 0.3);
  }

  private getTrendingReasons(template: any): string[] {
    const reasons: string[] = [];

    if (template.usageCount > 100) {
      reasons.push('Frequently used');
    }

    const successRate = template.successCount / template.usageCount || 0;
    if (successRate > 0.8) {
      reasons.push('High success rate');
    }

    const daysSinceLastUse = this.getDaysSince(template.lastUsed);
    if (daysSinceLastUse < 1) {
      reasons.push('Recently used');
    }

    return reasons;
  }

  private calculateTrendingConfidence(template: any): number {
    let confidence = 0.5;

    // More usage = higher confidence
    confidence += Math.min(template.usageCount * 0.01, 0.3);

    // Success rate affects confidence
    const successRate = template.successCount / template.usageCount || 0;
    confidence += successRate * 0.2;

    return Math.min(confidence, 1);
  }

  private getDaysSince(date: Date): number {
    return Math.floor(
      (new Date().getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
    );
  }

  private getStartDate(timeframe: 'day' | 'week' | 'month'): Date {
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
    }
    return date;
  }

  private calculatePersonalizedScore(
    template: any,
    userPrefs: UserPreferences
  ): number {
    let score = 0;

    // Category match
    if (userPrefs.favoriteCategories.includes(template.categoryId)) {
      score += 0.4;
    }

    // Tag matches
    const tagMatches = (template.tags || []).filter(tag =>
      userPrefs.favoriteTags.includes(tag)
    ).length;
    score += tagMatches * 0.1;

    // Content type match
    if (userPrefs.contentTypes.includes(template.contentType)) {
      score += 0.3;
    }

    // AI provider match
    if (userPrefs.aiProviders.includes(template.aiProvider)) {
      score += 0.2;
    }

    return Math.min(score, 1);
  }
}
