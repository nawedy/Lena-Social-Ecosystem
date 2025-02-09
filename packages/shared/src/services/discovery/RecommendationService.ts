import { EventEmitter } from 'events';
import { supabase } from '../../supabase';
import { AIOptimizer } from '../optimization/AIOptimizer';
import { PlatformCache } from '../optimization/cache/PlatformCache';

interface RecommendationConfig {
  maxRecommendations: number;
  cacheTimeout: number;
  refreshInterval: number;
  weights: {
    contentSimilarity: number;
    userPreference: number;
    trending: number;
    recency: number;
    engagement: number;
  };
  filters: {
    minEngagementRate: number;
    maxAge: number;
    qualityThreshold: number;
  };
}

interface ContentItem {
  id: string;
  userId: string;
  type: string;
  title: string;
  description: string;
  tags: string[];
  categories: string[];
  createdAt: string;
  metrics: {
    views: number;
    likes: number;
    shares: number;
    comments: number;
    engagementRate: number;
    watchTime: number;
    completionRate: number;
  };
  embedding?: Float32Array;
}

interface UserProfile {
  id: string;
  preferences: {
    categories: string[];
    tags: string[];
    creators: string[];
    blockedCreators: string[];
  };
  history: {
    views: string[];
    likes: string[];
    shares: string[];
  };
  metrics: {
    averageWatchTime: number;
    categoryAffinities: Record<string, number>;
    creatorAffinities: Record<string, number>;
  };
}

interface RecommendationResult {
  items: ContentItem[];
  explanation: {
    factors: Record<string, number>;
    filters: string[];
  };
}

export class RecommendationService extends EventEmitter {
  private static instance: RecommendationService;
  private config: RecommendationConfig;
  private cache: PlatformCache<RecommendationResult>;
  private aiOptimizer: AIOptimizer;
  private contentIndex: Map<string, ContentItem> = new Map();
  private userProfiles: Map<string, UserProfile> = new Map();
  private refreshInterval: NodeJS.Timer | null = null;
  private isRefreshing = false;

  private constructor() {
    super();
    this.setupConfig();
    this.setupCache();
    this.setupAIOptimizer();
  }

  static getInstance(): RecommendationService {
    if (!RecommendationService.instance) {
      RecommendationService.instance = new RecommendationService();
    }
    return RecommendationService.instance;
  }

  private setupConfig() {
    this.config = {
      maxRecommendations: 100,
      cacheTimeout: 300000, // 5 minutes
      refreshInterval: 60000, // 1 minute
      weights: {
        contentSimilarity: 0.3,
        userPreference: 0.25,
        trending: 0.2,
        recency: 0.15,
        engagement: 0.1
      },
      filters: {
        minEngagementRate: 0.01,
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        qualityThreshold: 0.7
      }
    };
  }

  private setupCache() {
    this.cache = new PlatformCache({
      maxSize: 1024 * 1024 * 10, // 10MB
      maxAge: this.config.cacheTimeout,
      evictionPolicy: 'lru'
    });
  }

  private setupAIOptimizer() {
    this.aiOptimizer = new AIOptimizer({
      enableQualityPrediction: true,
      enableCachePrediction: true,
      enableResourcePrediction: true,
      modelUpdateInterval: 3600000, // 1 hour
      minDataPoints: 1000
    }, undefined, undefined, this.cache);
  }

  async initialize() {
    await this.loadContentIndex();
    await this.loadUserProfiles();
    this.startPeriodicRefresh();
  }

  private async loadContentIndex() {
    const { data, error } = await supabase
      .from('content_items')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10000);

    if (error) throw error;

    for (const item of data) {
      this.contentIndex.set(item.id, this.transformContentItem(item));
    }
  }

  private async loadUserProfiles() {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .limit(10000);

    if (error) throw error;

    for (const profile of data) {
      this.userProfiles.set(profile.id, this.transformUserProfile(profile));
    }
  }

  private startPeriodicRefresh() {
    this.refreshInterval = setInterval(() => {
      this.refreshRecommendations();
    }, this.config.refreshInterval);
  }

  private async refreshRecommendations() {
    if (this.isRefreshing) return;
    this.isRefreshing = true;

    try {
      await this.loadContentIndex();
      await this.loadUserProfiles();
      this.cache.clear();
    } catch (error) {
      console.error('Failed to refresh recommendations:', error);
    } finally {
      this.isRefreshing = false;
    }
  }

  async getRecommendations(
    userId: string,
    options: {
      limit?: number;
      offset?: number;
      filters?: Partial<RecommendationConfig['filters']>;
      weights?: Partial<RecommendationConfig['weights']>;
    } = {}
  ): Promise<RecommendationResult> {
    const cacheKey = `recommendations:${userId}:${JSON.stringify(options)}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const user = this.userProfiles.get(userId);
    if (!user) throw new Error('User profile not found');

    const items = Array.from(this.contentIndex.values());
    const rankedItems = await this.rankItems(items, user, options);
    const filteredItems = this.filterItems(rankedItems, user, options.filters);
    
    const result: RecommendationResult = {
      items: filteredItems.slice(
        options.offset || 0,
        (options.offset || 0) + (options.limit || this.config.maxRecommendations)
      ),
      explanation: {
        factors: options.weights || this.config.weights,
        filters: Object.keys(options.filters || this.config.filters)
      }
    };

    await this.cache.set(cacheKey, result, JSON.stringify(result).length);
    return result;
  }

  private async rankItems(
    items: ContentItem[],
    user: UserProfile,
    options: {
      weights?: Partial<RecommendationConfig['weights']>;
    }
  ): Promise<ContentItem[]> {
    const weights = { ...this.config.weights, ...options.weights };
    
    const scoredItems = await Promise.all(
      items.map(async item => {
        const scores = {
          contentSimilarity: await this.calculateContentSimilarity(item, user),
          userPreference: this.calculateUserPreference(item, user),
          trending: this.calculateTrendingScore(item),
          recency: this.calculateRecencyScore(item),
          engagement: this.calculateEngagementScore(item)
        };

        const totalScore = Object.entries(scores).reduce(
          (sum, [factor, score]) => sum + score * weights[factor],
          0
        );

        return { item, score: totalScore };
      })
    );

    return scoredItems
      .sort((a, b) => b.score - a.score)
      .map(({ item }) => item);
  }

  private filterItems(
    items: ContentItem[],
    user: UserProfile,
    filters?: Partial<RecommendationConfig['filters']>
  ): ContentItem[] {
    const activeFilters = { ...this.config.filters, ...filters };

    return items.filter(item => {
      // Skip content from blocked creators
      if (user.preferences.blockedCreators.includes(item.userId)) {
        return false;
      }

      // Apply engagement rate filter
      if (item.metrics.engagementRate < activeFilters.minEngagementRate) {
        return false;
      }

      // Apply age filter
      const age = Date.now() - new Date(item.createdAt).getTime();
      if (age > activeFilters.maxAge) {
        return false;
      }

      // Apply quality threshold
      const qualityScore = this.calculateQualityScore(item);
      if (qualityScore < activeFilters.qualityThreshold) {
        return false;
      }

      return true;
    });
  }

  private async calculateContentSimilarity(
    item: ContentItem,
    user: UserProfile
  ): Promise<number> {
    // Calculate similarity based on categories and tags
    const categoryOverlap = item.categories.filter(
      c => user.preferences.categories.includes(c)
    ).length;
    
    const tagOverlap = item.tags.filter(
      t => user.preferences.tags.includes(t)
    ).length;

    return (categoryOverlap / Math.max(1, item.categories.length) +
            tagOverlap / Math.max(1, item.tags.length)) / 2;
  }

  private calculateUserPreference(
    item: ContentItem,
    user: UserProfile
  ): number {
    // Calculate preference based on user history and metrics
    const categoryAffinity = item.categories.reduce(
      (sum, category) => sum + (user.metrics.categoryAffinities[category] || 0),
      0
    ) / item.categories.length;

    const creatorAffinity = user.metrics.creatorAffinities[item.userId] || 0;

    return (categoryAffinity + creatorAffinity) / 2;
  }

  private calculateTrendingScore(item: ContentItem): number {
    // Calculate trending score based on recent engagement
    const views = item.metrics.views;
    const engagement = item.metrics.likes + item.metrics.shares + item.metrics.comments;
    const watchTime = item.metrics.watchTime;

    return (
      (views * 0.4) +
      (engagement * 0.4) +
      (watchTime * 0.2)
    ) / (Date.now() - new Date(item.createdAt).getTime());
  }

  private calculateRecencyScore(item: ContentItem): number {
    // Calculate recency score with exponential decay
    const age = Date.now() - new Date(item.createdAt).getTime();
    const maxAge = this.config.filters.maxAge;
    return Math.exp(-age / maxAge);
  }

  private calculateEngagementScore(item: ContentItem): number {
    // Calculate engagement score based on various metrics
    return (
      item.metrics.engagementRate * 0.4 +
      item.metrics.completionRate * 0.4 +
      (item.metrics.shares / Math.max(1, item.metrics.views)) * 0.2
    );
  }

  private calculateQualityScore(item: ContentItem): number {
    // Calculate quality score based on multiple factors
    return (
      item.metrics.completionRate * 0.4 +
      item.metrics.engagementRate * 0.3 +
      (item.metrics.likes / Math.max(1, item.metrics.views)) * 0.3
    );
  }

  private transformContentItem(raw: any): ContentItem {
    return {
      id: raw.id,
      userId: raw.user_id,
      type: raw.type,
      title: raw.title,
      description: raw.description,
      tags: raw.tags || [],
      categories: raw.categories || [],
      createdAt: raw.created_at,
      metrics: {
        views: raw.views || 0,
        likes: raw.likes || 0,
        shares: raw.shares || 0,
        comments: raw.comments || 0,
        engagementRate: raw.engagement_rate || 0,
        watchTime: raw.watch_time || 0,
        completionRate: raw.completion_rate || 0
      },
      embedding: raw.embedding ? new Float32Array(raw.embedding) : undefined
    };
  }

  private transformUserProfile(raw: any): UserProfile {
    return {
      id: raw.id,
      preferences: {
        categories: raw.preferred_categories || [],
        tags: raw.preferred_tags || [],
        creators: raw.followed_creators || [],
        blockedCreators: raw.blocked_creators || []
      },
      history: {
        views: raw.viewed_items || [],
        likes: raw.liked_items || [],
        shares: raw.shared_items || []
      },
      metrics: {
        averageWatchTime: raw.average_watch_time || 0,
        categoryAffinities: raw.category_affinities || {},
        creatorAffinities: raw.creator_affinities || {}
      }
    };
  }

  updateConfig(config: Partial<RecommendationConfig>) {
    this.config = { ...this.config, ...config };
  }

  cleanup() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
    this.cache.clear();
    this.contentIndex.clear();
    this.userProfiles.clear();
  }
}

// Create recommendation service instance
export const recommendationService = RecommendationService.getInstance(); 