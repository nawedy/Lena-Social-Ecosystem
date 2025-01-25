import { FirebaseFirestore } from '@firebase/firestore';
import { getFirestore } from 'firebase/firestore';

export interface ContentTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  type: 'text' | 'image' | 'video';
  prompt: string;
  style?: string;
  parameters?: Record<string, unknown>;
  tags: string[];
  usageCount: number;
  rating: number;
  createdBy: string;
  isPublic: boolean;
  aiProvider: string;
  previewUrl?: string;
}

export class ContentTemplateService {
  private static instance: ContentTemplateService;
  private db: FirebaseFirestore;

  private constructor() {
    this.db = getFirestore();
  }

  public static getInstance(): ContentTemplateService {
    if (!ContentTemplateService.instance) {
      ContentTemplateService.instance = new ContentTemplateService();
    }
    return ContentTemplateService.instance;
  }

  async createTemplate(template: Omit<ContentTemplate, 'id'>): Promise<string> {
    const templatesRef = this.db.collection('contentTemplates');
    const doc = await templatesRef.add({
      ...template,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return doc.id;
  }

  async getTemplate(id: string): Promise<ContentTemplate | null> {
    const doc = await this.db.collection('contentTemplates').doc(id).get();
    return doc.exists
      ? ({ id: doc.id, ...doc.data() } as ContentTemplate)
      : null;
  }

  async updateTemplate(
    id: string,
    updates: Partial<ContentTemplate>
  ): Promise<void> {
    await this.db
      .collection('contentTemplates')
      .doc(id)
      .update({
        ...updates,
        updatedAt: new Date(),
      });
  }

  async deleteTemplate(id: string): Promise<void> {
    await this.db.collection('contentTemplates').doc(id).delete();
  }

  async listTemplates(options: {
    category?: string;
    type?: 'text' | 'image' | 'video';
    userId?: string;
    isPublic?: boolean;
    tags?: string[];
    aiProvider?: string;
    limit?: number;
    orderBy?: 'usageCount' | 'rating' | 'createdAt';
    orderDirection?: 'asc' | 'desc';
  }): Promise<ContentTemplate[]> {
    let query = this.db.collection('contentTemplates');

    if (options.category) {
      query = query.where('category', '==', options.category) as unknown;
    }

    if (options.type) {
      query = query.where('type', '==', options.type) as unknown;
    }

    if (options.userId) {
      query = query.where('createdBy', '==', options.userId) as unknown;
    }

    if (options.isPublic !== undefined) {
      query = query.where('isPublic', '==', options.isPublic) as unknown;
    }

    if (options.aiProvider) {
      query = query.where('aiProvider', '==', options.aiProvider) as unknown;
    }

    if (options.tags && options.tags.length > 0) {
      query = query.where(
        'tags',
        'array-contains-any',
        options.tags
      ) as unknown;
    }

    if (options.orderBy) {
      query = query.orderBy(
        options.orderBy,
        options.orderDirection || 'desc'
      ) as unknown;
    }

    if (options.limit) {
      query = query.limit(options.limit) as unknown;
    }

    const snapshot = await query.get();
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as ContentTemplate[];
  }

  async incrementUsageCount(id: string): Promise<void> {
    const ref = this.db.collection('contentTemplates').doc(id);
    await ref.update({
      usageCount: FirebaseFirestore.FieldValue.increment(1),
    });
  }

  async rateTemplate(id: string, rating: number): Promise<void> {
    if (rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    const ref = this.db.collection('contentTemplates').doc(id);
    const doc = await ref.get();
    const data = doc.data();

    if (!data) {
      throw new Error('Template not found');
    }

    const currentRating = data.rating || 0;
    const currentRatingsCount = data.ratingsCount || 0;
    const newRating =
      (currentRating * currentRatingsCount + rating) /
      (currentRatingsCount + 1);

    await ref.update({
      rating: newRating,
      ratingsCount: FirebaseFirestore.FieldValue.increment(1),
    });
  }

  async searchTemplates(query: string): Promise<ContentTemplate[]> {
    // Note: In a production environment, you'd want to use a proper search service
    // like Algolia or Elasticsearch for better search capabilities
    const snapshot = await this.db
      .collection('contentTemplates')
      .where('isPublic', '==', true)
      .get();

    const templates = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as ContentTemplate[];

    const searchTerms = query.toLowerCase().split(' ');

    return templates.filter(template => {
      const searchableText = `
        ${template.name.toLowerCase()}
        ${template.description.toLowerCase()}
        ${template.tags.join(' ').toLowerCase()}
        ${template.category.toLowerCase()}
      `;

      return searchTerms.every(term => searchableText.includes(term));
    });
  }

  async getPopularTemplates(
    type?: 'text' | 'image' | 'video',
    limit = 10
  ): Promise<ContentTemplate[]> {
    let query = this.db
      .collection('contentTemplates')
      .where('isPublic', '==', true)
      .orderBy('usageCount', 'desc');

    if (type) {
      query = query.where('type', '==', type) as unknown;
    }

    const snapshot = await query.limit(limit).get();
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as ContentTemplate[];
  }

  async getRecommendedTemplates(
    userId: string,
    limit = 10
  ): Promise<ContentTemplate[]> {
    // Get user's recent template usage
    const userHistory = await this.db
      .collection('users')
      .doc(userId)
      .collection('templateHistory')
      .orderBy('timestamp', 'desc')
      .limit(5)
      .get();

    const userPreferences = new Set<string>();
    userHistory.docs.forEach(doc => {
      const data = doc.data();
      if (data.category) userPreferences.add(data.category);
      if (data.type) userPreferences.add(data.type);
      if (data.tags)
        data.tags.forEach((tag: string) => userPreferences.add(tag));
    });

    // Get templates matching user preferences
    const snapshot = await this.db
      .collection('contentTemplates')
      .where('isPublic', '==', true)
      .orderBy('rating', 'desc')
      .limit(limit * 2)
      .get();

    const templates = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as ContentTemplate[];

    // Score templates based on user preferences
    const scoredTemplates = templates.map(template => {
      let score = 0;
      if (userPreferences.has(template.category)) score += 2;
      if (userPreferences.has(template.type)) score += 2;
      template.tags.forEach(tag => {
        if (userPreferences.has(tag)) score += 1;
      });
      return { template, score };
    });

    // Return top scoring templates
    return scoredTemplates
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ template }) => template);
  }

  async getTemplateCategories(): Promise<string[]> {
    const snapshot = await this.db
      .collection('contentTemplates')
      .where('isPublic', '==', true)
      .get();

    const categories = new Set<string>();
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.category) {
        categories.add(data.category);
      }
    });

    return Array.from(categories).sort();
  }

  async getTemplateTags(): Promise<string[]> {
    const snapshot = await this.db
      .collection('contentTemplates')
      .where('isPublic', '==', true)
      .get();

    const tags = new Set<string>();
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.tags) {
        data.tags.forEach((tag: string) => tags.add(tag));
      }
    });

    return Array.from(tags).sort();
  }
}
