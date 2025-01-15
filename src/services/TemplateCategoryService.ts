import { FirebaseFirestore } from '@firebase/firestore';
import { getFirestore } from 'firebase/firestore';

export interface TemplateCategory {
  id: string;
  name: string;
  description: string;
  icon?: string;
  color?: string;
  parent?: string;
  order: number;
  templateCount: number;
  createdAt: Date;
  createdBy: string;
  lastModified: Date;
  modifiedBy: string;
  metadata?: Record<string, any>;
  isActive: boolean;
}

export interface CategoryStats {
  totalTemplates: number;
  activeTemplates: number;
  averageRating: number;
  totalUsage: number;
  popularTags: { tag: string; count: number }[];
}

export class TemplateCategoryService {
  private static instance: TemplateCategoryService;
  private db: FirebaseFirestore;

  private constructor() {
    this.db = getFirestore();
  }

  public static getInstance(): TemplateCategoryService {
    if (!TemplateCategoryService.instance) {
      TemplateCategoryService.instance = new TemplateCategoryService();
    }
    return TemplateCategoryService.instance;
  }

  async createCategory(
    data: Omit<TemplateCategory, 'id' | 'templateCount' | 'createdAt' | 'lastModified'>,
    userId: string
  ): Promise<string> {
    const categoryData: Omit<TemplateCategory, 'id'> = {
      ...data,
      templateCount: 0,
      createdAt: new Date(),
      createdBy: userId,
      lastModified: new Date(),
      modifiedBy: userId,
    };

    const doc = await this.db.collection('templateCategories').add(categoryData);
    return doc.id;
  }

  async getCategory(categoryId: string): Promise<TemplateCategory | null> {
    const doc = await this.db
      .collection('templateCategories')
      .doc(categoryId)
      .get();

    return doc.exists ? { id: doc.id, ...doc.data() } as TemplateCategory : null;
  }

  async updateCategory(
    categoryId: string,
    data: Partial<TemplateCategory>,
    userId: string
  ): Promise<void> {
    const updateData = {
      ...data,
      lastModified: new Date(),
      modifiedBy: userId,
    };

    await this.db
      .collection('templateCategories')
      .doc(categoryId)
      .update(updateData);
  }

  async deleteCategory(categoryId: string): Promise<void> {
    // Check if category has templates
    const templates = await this.db
      .collection('templates')
      .where('categoryId', '==', categoryId)
      .limit(1)
      .get();

    if (!templates.empty) {
      throw new Error('Cannot delete category with templates');
    }

    // Check if category has subcategories
    const subcategories = await this.db
      .collection('templateCategories')
      .where('parent', '==', categoryId)
      .limit(1)
      .get();

    if (!subcategories.empty) {
      throw new Error('Cannot delete category with subcategories');
    }

    await this.db.collection('templateCategories').doc(categoryId).delete();
  }

  async listCategories(options: {
    parent?: string;
    includeInactive?: boolean;
    searchTerm?: string;
  } = {}): Promise<TemplateCategory[]> {
    let query = this.db.collection('templateCategories');

    if (options.parent !== undefined) {
      query = query.where('parent', '==', options.parent) as any;
    }

    if (!options.includeInactive) {
      query = query.where('isActive', '==', true) as any;
    }

    if (options.searchTerm) {
      query = query.where('name', '>=', options.searchTerm)
        .where('name', '<=', options.searchTerm + '\uf8ff') as any;
    }

    query = query.orderBy('order') as any;

    const snapshot = await query.get();
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as TemplateCategory[];
  }

  async getCategoryHierarchy(): Promise<TemplateCategory[]> {
    const categories = await this.listCategories();
    return this.buildHierarchy(categories);
  }

  private buildHierarchy(
    categories: TemplateCategory[],
    parent?: string,
    level: number = 0
  ): TemplateCategory[] {
    const hierarchy: TemplateCategory[] = [];
    const children = categories.filter(c => c.parent === parent);

    for (const child of children) {
      const subcategories = this.buildHierarchy(
        categories,
        child.id,
        level + 1
      );
      hierarchy.push({
        ...child,
        metadata: {
          ...child.metadata,
          level,
          hasChildren: subcategories.length > 0,
        },
      });
      hierarchy.push(...subcategories);
    }

    return hierarchy;
  }

  async moveCategory(
    categoryId: string,
    newParent: string | null,
    newOrder: number
  ): Promise<void> {
    const batch = this.db.batch();
    const categoryRef = this.db.collection('templateCategories').doc(categoryId);

    // Update the moved category
    batch.update(categoryRef, {
      parent: newParent,
      order: newOrder,
      lastModified: new Date(),
    });

    // Get and update affected categories
    const affected = await this.db
      .collection('templateCategories')
      .where('parent', '==', newParent)
      .where('order', '>=', newOrder)
      .where('id', '!=', categoryId)
      .get();

    affected.docs.forEach(doc => {
      batch.update(doc.ref, {
        order: doc.data().order + 1,
      });
    });

    await batch.commit();
  }

  async getCategoryStats(categoryId: string): Promise<CategoryStats> {
    const templates = await this.db
      .collection('templates')
      .where('categoryId', '==', categoryId)
      .get();

    const templateData = templates.docs.map(doc => doc.data());
    const activeTemplates = templateData.filter(t => t.isActive);

    const tags = templateData.flatMap(t => t.tags || []);
    const tagCounts = tags.reduce((acc, tag) => {
      acc[tag] = (acc[tag] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const popularTags = Object.entries(tagCounts)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalTemplates: templates.size,
      activeTemplates: activeTemplates.length,
      averageRating:
        templateData.reduce((sum, t) => sum + (t.rating || 0), 0) /
        templates.size,
      totalUsage: templateData.reduce((sum, t) => sum + (t.usageCount || 0), 0),
      popularTags,
    };
  }

  async suggestCategories(
    template: {
      name: string;
      description: string;
      tags?: string[];
    },
    limit: number = 5
  ): Promise<TemplateCategory[]> {
    // Get all categories
    const categories = await this.listCategories();
    
    // Calculate relevance scores
    const scores = categories.map(category => {
      let score = 0;

      // Match by name
      if (template.name.toLowerCase().includes(category.name.toLowerCase())) {
        score += 3;
      }

      // Match by description
      if (
        template.description
          .toLowerCase()
          .includes(category.description.toLowerCase())
      ) {
        score += 2;
      }

      // Match by tags
      if (template.tags && category.metadata?.tags) {
        const matchingTags = template.tags.filter(tag =>
          category.metadata.tags.includes(tag)
        );
        score += matchingTags.length;
      }

      return { category, score };
    });

    // Sort by score and return top matches
    return scores
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(s => s.category);
  }

  async mergeCategoriesInto(
    sourceIds: string[],
    targetId: string,
    userId: string
  ): Promise<void> {
    const batch = this.db.batch();

    // Update all templates in source categories
    for (const sourceId of sourceIds) {
      const templates = await this.db
        .collection('templates')
        .where('categoryId', '==', sourceId)
        .get();

      templates.docs.forEach(doc => {
        batch.update(doc.ref, {
          categoryId: targetId,
          lastModified: new Date(),
          modifiedBy: userId,
        });
      });

      // Mark source category as inactive
      batch.update(this.db.collection('templateCategories').doc(sourceId), {
        isActive: false,
        lastModified: new Date(),
        modifiedBy: userId,
      });
    }

    // Update template count for target category
    const targetTemplates = await this.db
      .collection('templates')
      .where('categoryId', '==', targetId)
      .get();

    batch.update(this.db.collection('templateCategories').doc(targetId), {
      templateCount: targetTemplates.size,
      lastModified: new Date(),
      modifiedBy: userId,
    });

    await batch.commit();
  }

  async reorderCategories(
    parent: string | null,
    orderedIds: string[]
  ): Promise<void> {
    const batch = this.db.batch();

    orderedIds.forEach((id, index) => {
      batch.update(this.db.collection('templateCategories').doc(id), {
        order: index,
        parent,
      });
    });

    await batch.commit();
  }

  async importCategories(
    categories: Omit<TemplateCategory, 'id'>[],
    userId: string
  ): Promise<string[]> {
    const batch = this.db.batch();
    const categoryRefs = categories.map(category => {
      const ref = this.db.collection('templateCategories').doc();
      batch.set(ref, {
        ...category,
        createdAt: new Date(),
        createdBy: userId,
        lastModified: new Date(),
        modifiedBy: userId,
      });
      return ref;
    });

    await batch.commit();
    return categoryRefs.map(ref => ref.id);
  }

  async exportCategories(
    categoryIds?: string[]
  ): Promise<Omit<TemplateCategory, 'id'>[]> {
    let query = this.db.collection('templateCategories');

    if (categoryIds && categoryIds.length > 0) {
      // Firebase doesn't support 'in' queries with more than 10 items
      const chunks = this.chunkArray(categoryIds, 10);
      const snapshots = await Promise.all(
        chunks.map(chunk =>
          query.where('id', 'in', chunk).get()
        )
      );

      return snapshots
        .flatMap(snapshot => snapshot.docs)
        .map(doc => {
          const data = doc.data();
          delete data.id;
          return data as Omit<TemplateCategory, 'id'>;
        });
    }

    const snapshot = await query.get();
    return snapshot.docs.map(doc => {
      const data = doc.data();
      delete data.id;
      return data as Omit<TemplateCategory, 'id'>;
    });
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}
