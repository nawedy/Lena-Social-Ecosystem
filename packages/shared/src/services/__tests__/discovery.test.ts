import { discoveryService } from '../discovery/DiscoveryService';

describe('Discovery Service', () => {
  beforeEach(() => {
    discoveryService.cleanup();
    jest.clearAllMocks();
  });

  afterEach(() => {
    discoveryService.cleanup();
  });

  describe('Content Indexing', () => {
    it('should index new content items', async () => {
      const item = {
        id: 'video-123',
        userId: 'user-1',
        type: 'video',
        title: 'Test Video',
        tags: ['funny', 'pets'],
        categories: ['entertainment'],
        createdAt: Date.now(),
        metrics: {
          views: 1000,
          likes: 500,
          shares: 100,
          comments: 50,
          completionRate: 80,
          watchTime: 45,
          replayCount: 2
        }
      };

      await discoveryService.indexContent(item);

      // Get recommendations to verify item is indexed
      const context = {
        userId: 'test-user',
        timestamp: Date.now()
      };

      // Create test user profile first
      await discoveryService.updateUserProfile('test-user', {
        interests: ['funny'],
        contentPreferences: {
          categories: ['entertainment']
        }
      });

      const recommendations = await discoveryService.getRecommendations(context);
      expect(recommendations.items).toContainEqual(expect.objectContaining({
        id: 'video-123'
      }));
    });

    it('should maintain cache size limit', async () => {
      // Update config to set small cache size
      discoveryService.updateConfig({
        maxCacheSize: 2
      });

      // Index more items than cache size
      for (let i = 0; i < 3; i++) {
        await discoveryService.indexContent({
          id: `video-${i}`,
          userId: 'user-1',
          type: 'video',
          title: `Test Video ${i}`,
          tags: ['test'],
          categories: ['test'],
          createdAt: Date.now(),
          metrics: {
            views: 0,
            likes: 0,
            shares: 0,
            comments: 0,
            completionRate: 0,
            watchTime: 0,
            replayCount: 0
          }
        });
      }

      // Create test user profile
      await discoveryService.updateUserProfile('test-user', {
        interests: ['test']
      });

      // Get recommendations to check cache size
      const recommendations = await discoveryService.getRecommendations({
        userId: 'test-user',
        timestamp: Date.now()
      });

      expect(recommendations.items.length).toBe(2);
    });
  });

  describe('User Profiles', () => {
    it('should create and update user profiles', async () => {
      const userId = 'test-user';
      const profile = {
        interests: ['music', 'dance'],
        followedCreators: ['creator-1'],
        contentPreferences: {
          categories: ['entertainment'],
          contentTypes: ['video']
        }
      };

      await discoveryService.updateUserProfile(userId, profile);

      // Index some content
      await discoveryService.indexContent({
        id: 'video-1',
        userId: 'creator-1',
        type: 'video',
        title: 'Dance Video',
        tags: ['dance'],
        categories: ['entertainment'],
        createdAt: Date.now(),
        metrics: {
          views: 100,
          likes: 50,
          shares: 10,
          comments: 5,
          completionRate: 90,
          watchTime: 30,
          replayCount: 1
        }
      });

      // Get recommendations
      const recommendations = await discoveryService.getRecommendations({
        userId,
        timestamp: Date.now()
      });

      // Content should be recommended due to matching interests and preferences
      expect(recommendations.items[0].id).toBe('video-1');
      expect(recommendations.explanation[0].reason).toBe('Matches your interests');
    });

    it('should handle blocked creators', async () => {
      const userId = 'test-user';
      await discoveryService.updateUserProfile(userId, {
        blockedCreators: ['blocked-creator']
      });

      // Index content from blocked creator
      await discoveryService.indexContent({
        id: 'video-1',
        userId: 'blocked-creator',
        type: 'video',
        title: 'Test Video',
        tags: ['test'],
        categories: ['test'],
        createdAt: Date.now(),
        metrics: {
          views: 1000,
          likes: 500,
          shares: 100,
          comments: 50,
          completionRate: 80,
          watchTime: 45,
          replayCount: 2
        }
      });

      // Get recommendations
      const recommendations = await discoveryService.getRecommendations({
        userId,
        timestamp: Date.now()
      });

      // Content from blocked creator should not be recommended
      expect(recommendations.items).not.toContainEqual(expect.objectContaining({
        userId: 'blocked-creator'
      }));
    });
  });

  describe('Recommendations', () => {
    beforeEach(async () => {
      // Create test user
      await discoveryService.updateUserProfile('test-user', {
        interests: ['music', 'dance'],
        contentPreferences: {
          categories: ['entertainment']
        }
      });

      // Index test content
      await Promise.all([
        discoveryService.indexContent({
          id: 'trending-video',
          userId: 'creator-1',
          type: 'video',
          title: 'Viral Dance',
          tags: ['dance'],
          categories: ['entertainment'],
          createdAt: Date.now(),
          metrics: {
            views: 1000000,
            likes: 500000,
            shares: 100000,
            comments: 50000,
            completionRate: 95,
            watchTime: 60,
            replayCount: 5
          }
        }),
        discoveryService.indexContent({
          id: 'relevant-video',
          userId: 'creator-2',
          type: 'video',
          title: 'Music Tutorial',
          tags: ['music'],
          categories: ['entertainment'],
          createdAt: Date.now() - 7 * 24 * 60 * 60 * 1000, // 7 days old
          metrics: {
            views: 1000,
            likes: 500,
            shares: 100,
            comments: 50,
            completionRate: 90,
            watchTime: 45,
            replayCount: 2
          }
        }),
        discoveryService.indexContent({
          id: 'old-video',
          userId: 'creator-3',
          type: 'video',
          title: 'Old Content',
          tags: ['dance'],
          categories: ['entertainment'],
          createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000, // 30 days old
          metrics: {
            views: 100,
            likes: 50,
            shares: 10,
            comments: 5,
            completionRate: 70,
            watchTime: 20,
            replayCount: 1
          }
        })
      ]);
    });

    it('should rank items by multiple factors', async () => {
      const recommendations = await discoveryService.getRecommendations({
        userId: 'test-user',
        timestamp: Date.now()
      });

      // Trending video should be ranked first due to high engagement
      expect(recommendations.items[0].id).toBe('trending-video');
      expect(recommendations.explanation[0].reason).toBe('Popular with other users');

      // Relevant video should be ranked second due to matching interests
      expect(recommendations.items[1].id).toBe('relevant-video');
      expect(recommendations.explanation[1].reason).toBe('Matches your interests');

      // Old video should be ranked last due to age and low engagement
      expect(recommendations.items[2].id).toBe('old-video');
    });

    it('should apply filters', async () => {
      const recommendations = await discoveryService.getRecommendations({
        userId: 'test-user',
        timestamp: Date.now()
      }, {
        filters: {
          tags: ['music'],
          minEngagement: 1000
        }
      });

      expect(recommendations.items).toHaveLength(1);
      expect(recommendations.items[0].id).toBe('relevant-video');
    });

    it('should handle pagination', async () => {
      const page1 = await discoveryService.getRecommendations({
        userId: 'test-user',
        timestamp: Date.now()
      }, {
        limit: 2,
        offset: 0
      });

      const page2 = await discoveryService.getRecommendations({
        userId: 'test-user',
        timestamp: Date.now()
      }, {
        limit: 2,
        offset: 2
      });

      expect(page1.items).toHaveLength(2);
      expect(page2.items).toHaveLength(1);
      expect(page1.items[0].id).not.toBe(page2.items[0].id);
    });
  });

  describe('Trending Items', () => {
    it('should maintain trending items list', async () => {
      // Start discovery service
      await discoveryService.start();

      // Index viral content
      await discoveryService.indexContent({
        id: 'viral-video',
        userId: 'creator-1',
        type: 'video',
        title: 'Viral Content',
        tags: ['viral'],
        categories: ['entertainment'],
        createdAt: Date.now(),
        metrics: {
          views: 1000000,
          likes: 500000,
          shares: 100000,
          comments: 50000,
          completionRate: 95,
          watchTime: 60,
          replayCount: 5
        }
      });

      // Wait for trending refresh
      await new Promise(resolve => setTimeout(resolve, 100));

      const trendingItems = discoveryService.getTrendingItems();
      expect(trendingItems).toContain('viral-video');
    });

    it('should update trending items when new content goes viral', async () => {
      await discoveryService.start();

      const trendingUpdateHandler = jest.fn();
      discoveryService.on('trending_updated', trendingUpdateHandler);

      // Index viral content
      await discoveryService.indexContent({
        id: 'viral-video',
        userId: 'creator-1',
        type: 'video',
        title: 'Viral Content',
        tags: ['viral'],
        categories: ['entertainment'],
        createdAt: Date.now(),
        metrics: {
          views: 1000000,
          likes: 500000,
          shares: 100000,
          comments: 50000,
          completionRate: 95,
          watchTime: 60,
          replayCount: 5
        }
      });

      await new Promise(resolve => setTimeout(resolve, 100));
      expect(trendingUpdateHandler).toHaveBeenCalled();
    });
  });

  describe('Service Lifecycle', () => {
    it('should start and stop periodic refresh', async () => {
      const refreshSpy = jest.spyOn(discoveryService as any, 'refreshTrendingItems');

      await discoveryService.start();
      expect(refreshSpy).toHaveBeenCalled();

      await discoveryService.stop();
      refreshSpy.mockClear();

      await new Promise(resolve => setTimeout(resolve, 6000));
      expect(refreshSpy).not.toHaveBeenCalled();
    });

    it('should clean up resources', async () => {
      // Index some content
      await discoveryService.indexContent({
        id: 'test-video',
        userId: 'creator-1',
        type: 'video',
        title: 'Test Video',
        tags: ['test'],
        categories: ['test'],
        createdAt: Date.now(),
        metrics: {
          views: 100,
          likes: 50,
          shares: 10,
          comments: 5,
          completionRate: 90,
          watchTime: 30,
          replayCount: 1
        }
      });

      // Create user profile
      await discoveryService.updateUserProfile('test-user', {
        interests: ['test']
      });

      // Start service
      await discoveryService.start();

      // Clean up
      discoveryService.cleanup();

      // Verify cleanup
      const recommendations = await discoveryService.getRecommendations({
        userId: 'test-user',
        timestamp: Date.now()
      });

      expect(recommendations.items).toHaveLength(0);
      expect(discoveryService.getTrendingItems()).toHaveLength(0);
    });
  });
}); 