import { recommendationService } from '../discovery/RecommendationService';
import { supabase } from '../../supabase';

jest.mock('../../supabase', () => ({
  supabase: {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn()
  }
}));

describe('Recommendation Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    recommendationService.cleanup();
  });

  afterEach(() => {
    recommendationService.cleanup();
  });

  describe('Content Indexing', () => {
    it('should load and index new content items', async () => {
      const mockContentItems = [
        {
          id: 'content-1',
          user_id: 'user-1',
          type: 'video',
          title: 'Test Video 1',
          description: 'Test Description 1',
          tags: ['fun', 'entertainment'],
          categories: ['music', 'dance'],
          created_at: new Date().toISOString(),
          views: 1000,
          likes: 100,
          shares: 50,
          comments: 25,
          engagement_rate: 0.15,
          watch_time: 3600,
          completion_rate: 0.85
        }
      ];

      (supabase.limit as jest.Mock).mockResolvedValueOnce({
        data: mockContentItems,
        error: null
      });

      await recommendationService.initialize();

      const recommendations = await recommendationService.getRecommendations('user-1');
      expect(recommendations.items).toHaveLength(1);
      expect(recommendations.items[0].id).toBe('content-1');
    });

    it('should maintain cache size limits', async () => {
      const mockContentItems = Array(1000).fill(null).map((_, i) => ({
        id: `content-${i}`,
        user_id: `user-${i % 10}`,
        type: 'video',
        title: `Test Video ${i}`,
        description: `Test Description ${i}`,
        tags: ['fun', 'entertainment'],
        categories: ['music', 'dance'],
        created_at: new Date().toISOString(),
        views: 1000,
        likes: 100,
        shares: 50,
        comments: 25,
        engagement_rate: 0.15,
        watch_time: 3600,
        completion_rate: 0.85
      }));

      (supabase.limit as jest.Mock).mockResolvedValueOnce({
        data: mockContentItems,
        error: null
      });

      await recommendationService.initialize();

      // Request recommendations multiple times to fill cache
      for (let i = 0; i < 100; i++) {
        await recommendationService.getRecommendations(`user-${i}`, {
          limit: 10,
          offset: i * 10
        });
      }

      // Cache should not exceed its size limit
      expect((recommendationService as any).cache.size).toBeLessThanOrEqual(1024 * 1024 * 10);
    });
  });

  describe('User Profiles', () => {
    it('should load and update user profiles', async () => {
      const mockUserProfiles = [
        {
          id: 'user-1',
          preferred_categories: ['music', 'dance'],
          preferred_tags: ['fun', 'entertainment'],
          followed_creators: ['creator-1', 'creator-2'],
          blocked_creators: ['creator-3'],
          viewed_items: ['content-1', 'content-2'],
          liked_items: ['content-1'],
          shared_items: [],
          average_watch_time: 300,
          category_affinities: { music: 0.8, dance: 0.6 },
          creator_affinities: { 'creator-1': 0.9 }
        }
      ];

      (supabase.limit as jest.Mock)
        .mockResolvedValueOnce({ data: [], error: null }) // content items
        .mockResolvedValueOnce({ data: mockUserProfiles, error: null }); // user profiles

      await recommendationService.initialize();

      const recommendations = await recommendationService.getRecommendations('user-1');
      expect(recommendations.explanation.factors).toBeDefined();
      expect(recommendations.explanation.filters).toBeDefined();
    });

    it('should handle blocked creators', async () => {
      const mockUserProfiles = [
        {
          id: 'user-1',
          blocked_creators: ['creator-3'],
          preferred_categories: [],
          preferred_tags: [],
          followed_creators: [],
          viewed_items: [],
          liked_items: [],
          shared_items: [],
          average_watch_time: 0,
          category_affinities: {},
          creator_affinities: {}
        }
      ];

      const mockContentItems = [
        {
          id: 'content-1',
          user_id: 'creator-3',
          type: 'video',
          title: 'Test Video',
          description: 'Test Description',
          tags: [],
          categories: [],
          created_at: new Date().toISOString(),
          views: 1000,
          likes: 100,
          shares: 50,
          comments: 25,
          engagement_rate: 0.15,
          watch_time: 3600,
          completion_rate: 0.85
        }
      ];

      (supabase.limit as jest.Mock)
        .mockResolvedValueOnce({ data: mockContentItems, error: null })
        .mockResolvedValueOnce({ data: mockUserProfiles, error: null });

      await recommendationService.initialize();

      const recommendations = await recommendationService.getRecommendations('user-1');
      expect(recommendations.items).toHaveLength(0);
    });
  });

  describe('Recommendations', () => {
    it('should rank items by multiple factors', async () => {
      const mockUserProfiles = [
        {
          id: 'user-1',
          preferred_categories: ['music'],
          preferred_tags: ['fun'],
          followed_creators: [],
          blocked_creators: [],
          viewed_items: [],
          liked_items: [],
          shared_items: [],
          average_watch_time: 300,
          category_affinities: { music: 0.8 },
          creator_affinities: {}
        }
      ];

      const mockContentItems = [
        {
          id: 'content-1',
          user_id: 'creator-1',
          type: 'video',
          title: 'Music Video',
          description: 'Fun music video',
          tags: ['fun'],
          categories: ['music'],
          created_at: new Date().toISOString(),
          views: 1000,
          likes: 100,
          shares: 50,
          comments: 25,
          engagement_rate: 0.15,
          watch_time: 3600,
          completion_rate: 0.85
        },
        {
          id: 'content-2',
          user_id: 'creator-2',
          type: 'video',
          title: 'Random Video',
          description: 'Random content',
          tags: ['random'],
          categories: ['other'],
          created_at: new Date().toISOString(),
          views: 500,
          likes: 50,
          shares: 25,
          comments: 10,
          engagement_rate: 0.1,
          watch_time: 1800,
          completion_rate: 0.7
        }
      ];

      (supabase.limit as jest.Mock)
        .mockResolvedValueOnce({ data: mockContentItems, error: null })
        .mockResolvedValueOnce({ data: mockUserProfiles, error: null });

      await recommendationService.initialize();

      const recommendations = await recommendationService.getRecommendations('user-1');
      expect(recommendations.items[0].id).toBe('content-1');
    });

    it('should apply filters correctly', async () => {
      const mockUserProfiles = [
        {
          id: 'user-1',
          preferred_categories: [],
          preferred_tags: [],
          followed_creators: [],
          blocked_creators: [],
          viewed_items: [],
          liked_items: [],
          shared_items: [],
          average_watch_time: 0,
          category_affinities: {},
          creator_affinities: {}
        }
      ];

      const mockContentItems = [
        {
          id: 'content-1',
          user_id: 'creator-1',
          type: 'video',
          title: 'Old Video',
          description: 'Old content',
          tags: [],
          categories: [],
          created_at: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString(),
          views: 1000,
          likes: 100,
          shares: 50,
          comments: 25,
          engagement_rate: 0.15,
          watch_time: 3600,
          completion_rate: 0.85
        }
      ];

      (supabase.limit as jest.Mock)
        .mockResolvedValueOnce({ data: mockContentItems, error: null })
        .mockResolvedValueOnce({ data: mockUserProfiles, error: null });

      await recommendationService.initialize();

      const recommendations = await recommendationService.getRecommendations('user-1');
      expect(recommendations.items).toHaveLength(0);
    });

    it('should handle pagination correctly', async () => {
      const mockUserProfiles = [
        {
          id: 'user-1',
          preferred_categories: [],
          preferred_tags: [],
          followed_creators: [],
          blocked_creators: [],
          viewed_items: [],
          liked_items: [],
          shared_items: [],
          average_watch_time: 0,
          category_affinities: {},
          creator_affinities: {}
        }
      ];

      const mockContentItems = Array(50).fill(null).map((_, i) => ({
        id: `content-${i}`,
        user_id: 'creator-1',
        type: 'video',
        title: `Video ${i}`,
        description: `Description ${i}`,
        tags: [],
        categories: [],
        created_at: new Date().toISOString(),
        views: 1000,
        likes: 100,
        shares: 50,
        comments: 25,
        engagement_rate: 0.15,
        watch_time: 3600,
        completion_rate: 0.85
      }));

      (supabase.limit as jest.Mock)
        .mockResolvedValueOnce({ data: mockContentItems, error: null })
        .mockResolvedValueOnce({ data: mockUserProfiles, error: null });

      await recommendationService.initialize();

      const page1 = await recommendationService.getRecommendations('user-1', {
        limit: 10,
        offset: 0
      });

      const page2 = await recommendationService.getRecommendations('user-1', {
        limit: 10,
        offset: 10
      });

      expect(page1.items).toHaveLength(10);
      expect(page2.items).toHaveLength(10);
      expect(page1.items[0].id).not.toBe(page2.items[0].id);
    });
  });

  describe('Service Lifecycle', () => {
    it('should start and stop periodic refresh', async () => {
      jest.useFakeTimers();

      (supabase.limit as jest.Mock)
        .mockResolvedValue({ data: [], error: null });

      await recommendationService.initialize();

      // Fast-forward time
      jest.advanceTimersByTime(60000);

      expect(supabase.from).toHaveBeenCalledTimes(4); // 2 initial + 2 refresh

      recommendationService.cleanup();

      // Fast-forward time again
      jest.advanceTimersByTime(60000);

      // No additional calls after cleanup
      expect(supabase.from).toHaveBeenCalledTimes(4);

      jest.useRealTimers();
    });

    it('should clean up resources properly', async () => {
      (supabase.limit as jest.Mock)
        .mockResolvedValue({ data: [], error: null });

      await recommendationService.initialize();

      const cache = (recommendationService as any).cache;
      const contentIndex = (recommendationService as any).contentIndex;
      const userProfiles = (recommendationService as any).userProfiles;

      // Add some items
      await recommendationService.getRecommendations('user-1');

      recommendationService.cleanup();

      expect(cache.size).toBe(0);
      expect(contentIndex.size).toBe(0);
      expect(userProfiles.size).toBe(0);
    });
  });
}); 