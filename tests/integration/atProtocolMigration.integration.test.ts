import { BskyAgent } from '@atproto/api';
import { ATProtocolMigration } from '../../src/services/atProtocolMigration';
import { ATProtocolCache } from '../../src/services/atProtocolCache';
import { ATProtocolErrorHandling } from '../../src/services/atProtocolErrorHandling';

describe('ATProtocolMigration Integration', () => {
  let agent: BskyAgent;
  let migration: ATProtocolMigration;
  let cache: ATProtocolCache;
  let errorHandler: ATProtocolErrorHandling;

  beforeAll(async () => {
    agent = new BskyAgent({ service: process.env.BSKY_SERVICE_URL });
    await agent.login({
      identifier: process.env.BSKY_TEST_USERNAME!,
      password: process.env.BSKY_TEST_PASSWORD!,
    });

    migration = new ATProtocolMigration(agent);
    cache = new ATProtocolCache(agent);
    errorHandler = new ATProtocolErrorHandling(agent);
  });

  describe('Full Migration Flow', () => {
    it('should successfully complete a full migration', async () => {
      // Start migration
      const migrationRecord = await migration.startMigration({
        tiktokUsername: process.env.TIKTOK_TEST_USERNAME!,
        options: {
          importVideos: true,
          importFollowers: true,
          importAnalytics: true,
          preserveMetadata: true,
          optimizeContent: true,
          scheduleContent: true,
          crossPostToTikTok: false,
        },
      });

      expect(migrationRecord.status).toBe('pending');

      // Wait for migration to complete
      let status = await migration.getMigrationStatus(migrationRecord.uri);
      while (status?.status === 'in_progress') {
        await new Promise(resolve => setTimeout(resolve, 1000));
        status = await migration.getMigrationStatus(migrationRecord.uri);
      }

      expect(status?.status).toBe('completed');

      // Verify imported data
      const posts = await agent.api.app.bsky.feed.getPosts({
        repo: agent.session?.did,
      });
      expect(posts.data.posts.length).toBeGreaterThan(0);

      const profile = await agent.api.app.bsky.actor.getProfile({
        actor: agent.session?.did,
      });
      expect(profile.data.analytics).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle and recover from errors during migration', async () => {
      // Simulate network error
      jest
        .spyOn(global, 'fetch')
        .mockRejectedValueOnce(new Error('Network error'));

      try {
        await migration.startMigration({
          tiktokUsername: 'nonexistent_user',
          options: {
            importVideos: true,
            importFollowers: true,
            importAnalytics: true,
            preserveMetadata: true,
            optimizeContent: true,
            scheduleContent: true,
            crossPostToTikTok: false,
          },
        });
      } catch (error) {
        const errorRecord = await errorHandler.handleError(error);
        expect(errorRecord.type).toBe('network');
        expect(errorRecord.resolved).toBe(false);
      }
    });
  });

  describe('Caching', () => {
    it('should cache and retrieve migration data', async () => {
      const migrationRecord = await migration.startMigration({
        tiktokUsername: process.env.TIKTOK_TEST_USERNAME!,
        options: {
          importVideos: true,
          importFollowers: false,
          importAnalytics: false,
          preserveMetadata: true,
          optimizeContent: false,
          scheduleContent: false,
          crossPostToTikTok: false,
        },
      });

      // Cache the migration record
      await cache.setCached(migrationRecord.uri, migrationRecord);

      // Retrieve from cache
      const cachedRecord = await cache.getCached(
        migrationRecord.uri,
        async () => migration.getMigrationStatus(migrationRecord.uri)
      );

      expect(cachedRecord).toEqual(migrationRecord);
    });
  });

  // Add more integration test cases...
});
