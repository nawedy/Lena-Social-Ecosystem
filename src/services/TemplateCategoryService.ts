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
  writeBatch,
  addDoc,
  updateDoc,
  deleteDoc,
  DocumentData,
  QueryDocumentSnapshot,
} from 'firebase/firestore';

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
  private db: Firestore;

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
    data: Omit<
      TemplateCategory,
      'id' | 'templateCount' | 'createdAt' | 'lastModified'
    >,
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

    const docRef = await addDoc(
      collection(this.db, 'templateCategories'),
      categoryData
    );
    return docRef.id;
  }

  async getCategory(categoryId: string): Promise<TemplateCategory | null> {
    const docRef = doc(this.db, 'templateCategories', categoryId);
    const docSnap = await getDoc(docRef);

    return docSnap.exists()
      ? ({ id: docSnap.id, ...docSnap.data() } as TemplateCategory)
      : null;
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

    const docRef = doc(this.db, 'templateCategories', categoryId);
    await updateDoc(docRef, updateData);
  }

  async deleteCategory(categoryId: string): Promise<void> {
    // Check if category has templates
    const templatesQuery = query(
      collection(this.db, 'templates'),
      where('categoryId', '==', categoryId),
      limit(1)
    );
    const templates = await getDocs(templatesQuery);

    if (!templates.empty) {
      throw new Error('Cannot delete category with templates');
    }

    // Check if category has subcategories
    const subcategoriesQuery = query(
      collection(this.db, 'templateCategories'),
      where('parent', '==', categoryId),
      limit(1)
    );
    const subcategories = await getDocs(subcategoriesQuery);

    if (!subcategories.empty) {
      throw new Error('Cannot delete category with subcategories');
    }

    const docRef = doc(this.db, 'templateCategories', categoryId);
    await deleteDoc(docRef);
  }

  async listCategories(
    options: {
      parent?: string;
      includeInactive?: boolean;
      searchTerm?: string;
    } = {}
  ): Promise<TemplateCategory[]> {
    const queryConstraints = [];

    if (options.parent !== undefined) {
      queryConstraints.push(where('parent', '==', options.parent));
    }

    if (!options.includeInactive) {
      queryConstraints.push(where('isActive', '==', true));
    }

    if (options.searchTerm) {
      queryConstraints.push(
        where('name', '>=', options.searchTerm),
        where('name', '<=', options.searchTerm + '\uf8ff')
      );
    }

    queryConstraints.push(orderBy('order'));

    const q = query(
      collection(this.db, 'templateCategories'),
      ...queryConstraints
    );
    const snapshot = await getDocs(q);

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
    const batch = writeBatch(this.db);
    const categoryRef = doc(this.db, 'templateCategories', categoryId);

    // Update the moved category
    batch.update(categoryRef, {
      parent: newParent,
      order: newOrder,
      lastModified: new Date(),
    });

    // Get and update affected categories
    const affectedQuery = query(
      collection(this.db, 'templateCategories'),
      where('parent', '==', newParent),
      where('order', '>=', newOrder),
      where('id', '!=', categoryId)
    );
    const affected = await getDocs(affectedQuery);

    affected.docs.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
      batch.update(doc.ref, {
        order: doc.data().order + 1,
      });
    });

    await batch.commit();
  }

  async getCategoryStats(categoryId: string): Promise<CategoryStats> {
    const templatesQuery = query(
      collection(this.db, 'templates'),
      where('categoryId', '==', categoryId)
    );
    const templates = await getDocs(templatesQuery);

    const stats: CategoryStats = {
      totalTemplates: templates.size,
      activeTemplates: 0,
      averageRating: 0,
      totalUsage: 0,
      popularTags: [],
    };

    const tagCounts = new Map<string, number>();
    let totalRating = 0;
    let ratedTemplates = 0;

    templates.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
      const data = doc.data();

      if (data.isActive) {
        stats.activeTemplates++;
      }

      if (data.rating) {
        totalRating += data.rating;
        ratedTemplates++;
      }

      if (data.usage) {
        stats.totalUsage += data.usage;
      }

      if (data.tags) {
        data.tags.forEach((tag: string) => {
          tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
        });
      }
    });

    stats.averageRating = ratedTemplates > 0 ? totalRating / ratedTemplates : 0;
    stats.popularTags = Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return stats;
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
    const batch = writeBatch(this.db);

    // Update all templates in source categories
    for (const sourceId of sourceIds) {
      const templatesQuery = query(
        collection(this.db, 'templates'),
        where('categoryId', '==', sourceId)
      );
      const templates = await getDocs(templatesQuery);

      templates.docs.forEach(doc => {
        batch.update(doc.ref, {
          categoryId: targetId,
          lastModified: new Date(),
          modifiedBy: userId,
        });
      });

      // Mark source category as inactive
      batch.update(doc(this.db, 'templateCategories', sourceId), {
        isActive: false,
        lastModified: new Date(),
        modifiedBy: userId,
      });
    }

    // Update template count for target category
    const targetTemplatesQuery = query(
      collection(this.db, 'templates'),
      where('categoryId', '==', targetId)
    );
    const targetTemplates = await getDocs(targetTemplatesQuery);

    batch.update(doc(this.db, 'templateCategories', targetId), {
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
    const batch = writeBatch(this.db);

    orderedIds.forEach((id, index) => {
      batch.update(doc(this.db, 'templateCategories', id), {
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
    const batch = writeBatch(this.db);
    const categoryRefs = categories.map(category => {
      const ref = doc(this.db, 'templateCategories');
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
    let queryConstraints = [];

    if (categoryIds && categoryIds.length > 0) {
      // Firebase doesn't support 'in' queries with more than 10 items
      const chunks = this.chunkArray(categoryIds, 10);
      const snapshots = await Promise.all(
        chunks.map(chunk =>
          getDocs(
            query(
              collection(this.db, 'templateCategories'),
              where('id', 'in', chunk)
            )
          )
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

    const snapshot = await getDocs(collection(this.db, 'templateCategories'));
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
