import { browser } from '$app/environment';
import { writable, derived } from 'svelte/store';
import { supabase } from '$lib/supabaseClient';
import { userProfileService } from '../profile/UserProfileService';

interface ContentItem {
  id: string;
  type: 'track' | 'podcast' | 'playlist' | 'album';
  title: string;
  creator: {
    id: string;
    name: string;
  };
  genre: string;
  tags: string[];
  features: {
    tempo?: number;
    key?: string;
    mood?: string[];
    energy?: number;
    danceability?: number;
    acousticness?: number;
    instrumentalness?: number;
    valence?: number;
  };
  popularity: number;
  releaseDate: string;
  duration: number;
  language?: string;
  explicit: boolean;
}

interface UserPreferences {
  favoriteGenres: string[];
  favoriteTags: string[];
  favoriteArtists: string[];
  likedContent: string[];
  dislikedContent: string[];
  listenHistory: Array<{
    contentId: string;
    timestamp: number;
    duration: number;
    completed: boolean;
  }>;
  skipHistory: Array<{
    contentId: string;
    timestamp: number;
    duration: number;
  }>;
}

interface RecommendationResult {
  items: ContentItem[];
  explanation: {
    type: 'genre' | 'artist' | 'similar' | 'trending' | 'discovery';
    reason: string;
    score: number;
  };
}

interface RecommendationConfig {
  weights: {
    genre: number;
    tags: number;
    artists: number;
    popularity: number;
    recency: number;
    userHistory: number;
    contextual: number;
  };
  filters: {
    excludeListened: boolean;
    excludeExplicit: boolean;
    maxDuration?: number;
    languages?: string[];
  };
  diversity: {
    genre: number;
    artist: number;
    tempo: number;
    mood: number;
  };
}

export class RecommendationService {
  private static instance: RecommendationService;
  private recommendations = writable<Record<string, ContentItem[]>>({});
  private userPreferences = writable<UserPreferences | null>(null);
  private config = writable<RecommendationConfig>({
    weights: {
      genre: 0.3,
      tags: 0.2,
      artists: 0.2,
      popularity: 0.1,
      recency: 0.1,
      userHistory: 0.2,
      contextual: 0.1
    },
    filters: {
      excludeListened: false,
      excludeExplicit: false
    },
    diversity: {
      genre: 0.7,
      artist: 0.5,
      tempo: 0.3,
      mood: 0.4
    }
  });
  private loading = writable(false);
  private error = writable<string | null>(null);
  private contentEmbeddings: Map<string, Float32Array> = new Map();
  private updateInterval: NodeJS.Timer | null = null;

  private constructor() {
    if (browser) {
      this.init();
    }
  }

  static getInstance(): RecommendationService {
    if (!RecommendationService.instance) {
      RecommendationService.instance = new RecommendationService();
    }
    return RecommendationService.instance;
  }

  private async init() {
    try {
      // Load user preferences
      const profile = userProfileService.getProfile();
      if (profile) {
        await this.loadUserPreferences(profile.id);
      }

      // Start periodic updates
      this.startPeriodicUpdates();
    } catch (error) {
      console.error('Recommendation service initialization failed:', error);
      this.error.set('Failed to initialize recommendation service');
    }
  }

  private startPeriodicUpdates() {
    this.updateInterval = setInterval(() => {
      this.refreshRecommendations();
    }, 3600000); // Every hour
  }

  private async loadUserPreferences(userId: string): Promise<void> {
    try {
      this.loading.set(true);
      this.error.set(null);

      const { data: preferences, error } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) throw error;

      this.userPreferences.set(preferences);
    } catch (error) {
      console.error('Failed to load user preferences:', error);
      this.error.set('Failed to load user preferences');
    } finally {
      this.loading.set(false);
    }
  }

  private async refreshRecommendations(): Promise<void> {
    const preferences = await this.getUserPreferences();
    if (!preferences) return;

    try {
      this.loading.set(true);
      this.error.set(null);

      // Get personalized recommendations
      const personalizedRecs = await this.getPersonalizedRecommendations();
      
      // Get trending content
      const trendingRecs = await this.getTrendingRecommendations();
      
      // Get discovery recommendations
      const discoveryRecs = await this.getDiscoveryRecommendations();

      // Combine and diversify recommendations
      const combined = this.diversifyRecommendations([
        ...personalizedRecs,
        ...trendingRecs,
        ...discoveryRecs
      ]);

      // Update recommendations store
      this.recommendations.update(recs => ({
        ...recs,
        personalized: combined.slice(0, 50),
        trending: trendingRecs.slice(0, 20),
        discovery: discoveryRecs.slice(0, 20)
      }));
    } catch (error) {
      console.error('Failed to refresh recommendations:', error);
      this.error.set('Failed to refresh recommendations');
    } finally {
      this.loading.set(false);
    }
  }

  private async getPersonalizedRecommendations(): Promise<ContentItem[]> {
    const preferences = await this.getUserPreferences();
    if (!preferences) return [];

    const config = await this.getConfig();

    try {
      // Get content based on user preferences
      const { data: content, error } = await supabase
        .rpc('get_personalized_recommendations', {
          user_preferences: preferences,
          weights: config.weights,
          filters: config.filters
        });

      if (error) throw error;

      return content;
    } catch (error) {
      console.error('Failed to get personalized recommendations:', error);
      return [];
    }
  }

  private async getTrendingRecommendations(): Promise<ContentItem[]> {
    try {
      const { data: trending, error } = await supabase
        .rpc('get_trending_content', {
          time_window: '7 days'
        });

      if (error) throw error;

      return trending;
    } catch (error) {
      console.error('Failed to get trending recommendations:', error);
      return [];
    }
  }

  private async getDiscoveryRecommendations(): Promise<ContentItem[]> {
    const preferences = await this.getUserPreferences();
    if (!preferences) return [];

    try {
      const { data: discovery, error } = await supabase
        .rpc('get_discovery_recommendations', {
          user_preferences: preferences,
          exclude_content: [
            ...preferences.likedContent,
            ...preferences.dislikedContent,
            ...preferences.listenHistory.map(h => h.contentId)
          ]
        });

      if (error) throw error;

      return discovery;
    } catch (error) {
      console.error('Failed to get discovery recommendations:', error);
      return [];
    }
  }

  private diversifyRecommendations(items: ContentItem[]): ContentItem[] {
    const config = this.getConfig();
    const diversified: ContentItem[] = [];
    const seen = {
      genres: new Set<string>(),
      artists: new Set<string>(),
      tempos: new Set<number>(),
      moods: new Set<string>()
    };

    // Sort by score
    items.sort((a, b) => b.popularity - a.popularity);

    // Add items while maintaining diversity
    for (const item of items) {
      const genreDiversity = seen.genres.size === 0 || 
        Math.random() > (seen.genres.has(item.genre) ? config.diversity.genre : 0);
      
      const artistDiversity = seen.artists.size === 0 ||
        Math.random() > (seen.artists.has(item.creator.id) ? config.diversity.artist : 0);
      
      const tempoDiversity = !item.features.tempo || seen.tempos.size === 0 ||
        Math.random() > (seen.tempos.has(Math.round(item.features.tempo / 10) * 10) ? config.diversity.tempo : 0);
      
      const moodDiversity = !item.features.mood || seen.moods.size === 0 ||
        Math.random() > (item.features.mood.some(m => seen.moods.has(m)) ? config.diversity.mood : 0);

      if (genreDiversity && artistDiversity && tempoDiversity && moodDiversity) {
        diversified.push(item);
        seen.genres.add(item.genre);
        seen.artists.add(item.creator.id);
        if (item.features.tempo) {
          seen.tempos.add(Math.round(item.features.tempo / 10) * 10);
        }
        if (item.features.mood) {
          item.features.mood.forEach(m => seen.moods.add(m));
        }
      }
    }

    return diversified;
  }

  async updateUserPreferences(updates: Partial<UserPreferences>): Promise<void> {
    const profile = userProfileService.getProfile();
    if (!profile) throw new Error('User not authenticated');

    try {
      this.loading.set(true);
      this.error.set(null);

      const { error } = await supabase
        .from('user_preferences')
        .update(updates)
        .eq('user_id', profile.id);

      if (error) throw error;

      // Update local state
      this.userPreferences.update(prefs => prefs ? {
        ...prefs,
        ...updates
      } : null);

      // Refresh recommendations with new preferences
      await this.refreshRecommendations();
    } catch (error) {
      console.error('Failed to update preferences:', error);
      this.error.set('Failed to update preferences');
      throw error;
    } finally {
      this.loading.set(false);
    }
  }

  async trackContentInteraction(contentId: string, type: 'like' | 'dislike' | 'skip' | 'listen', data?: any): Promise<void> {
    const profile = userProfileService.getProfile();
    if (!profile) return;

    try {
      const { error } = await supabase
        .from('content_interactions')
        .insert({
          user_id: profile.id,
          content_id: contentId,
          type,
          data,
          created_at: new Date().toISOString()
        });

      if (error) throw error;

      // Update preferences based on interaction
      const preferences = await this.getUserPreferences();
      if (!preferences) return;

      switch (type) {
        case 'like':
          await this.updateUserPreferences({
            likedContent: [...preferences.likedContent, contentId],
            dislikedContent: preferences.dislikedContent.filter(id => id !== contentId)
          });
          break;
        case 'dislike':
          await this.updateUserPreferences({
            dislikedContent: [...preferences.dislikedContent, contentId],
            likedContent: preferences.likedContent.filter(id => id !== contentId)
          });
          break;
        case 'listen':
          await this.updateUserPreferences({
            listenHistory: [
              ...preferences.listenHistory,
              {
                contentId,
                timestamp: Date.now(),
                duration: data.duration,
                completed: data.completed
              }
            ]
          });
          break;
        case 'skip':
          await this.updateUserPreferences({
            skipHistory: [
              ...preferences.skipHistory,
              {
                contentId,
                timestamp: Date.now(),
                duration: data.duration
              }
            ]
          });
          break;
      }
    } catch (error) {
      console.error('Failed to track content interaction:', error);
    }
  }

  // Store accessors
  getRecommendations(type: 'personalized' | 'trending' | 'discovery' = 'personalized'): ContentItem[] {
    let items: ContentItem[] = [];
    this.recommendations.subscribe(recs => {
      items = recs[type] || [];
    })();
    return items;
  }

  private async getUserPreferences(): Promise<UserPreferences | null> {
    let preferences: UserPreferences | null = null;
    this.userPreferences.subscribe(prefs => {
      preferences = prefs;
    })();
    return preferences;
  }

  private getConfig(): RecommendationConfig {
    let config: RecommendationConfig | null = null;
    this.config.subscribe(c => {
      config = c;
    })();
    return config!;
  }

  updateConfig(updates: Partial<RecommendationConfig>): void {
    this.config.update(config => ({
      ...config,
      ...updates
    }));
  }

  isLoading() {
    return this.loading;
  }

  getError() {
    return this.error;
  }

  // Derived stores
  recommendationCount = derived(this.recommendations, recs =>
    Object.values(recs).reduce((total, items) => total + items.length, 0)
  );

  cleanup() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }
}

export const recommendationService = RecommendationService.getInstance(); 