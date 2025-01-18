import { BskyAgent } from '@atproto/api';
import { ATProtocolMigration } from '../../src/services/atProtocolMigration';
import { TikTokMigrationService } from '../../src/services/TikTokMigrationService';

jest.mock('@atproto/api');
jest.mock('../../src/services/TikTokMigrationService');

describe('ATProtocolMigration', () => {
  let agent: jest.Mocked<BskyAgent>;
  let migration: ATProtocolMigration;

  beforeEach(() => {
    agent = new BskyAgent({
      service: 'https://example.com',
    }) as jest.Mocked<BskyAgent>;
    agent.session = { did: 'did:example:123' };
    migration = new ATProtocolMigration(agent);
  });

  describe('startMigration', () => {
    it('should create a migration record and start the process', async () => {
      const mockResponse = {
        uri: 'at://did:example:123/app.bsky.migration.record/123',
        cid: 'bafyreib2nxmhaxvwkom7zou5w2hvzxxovkd5qzqz5vwzxj5q5z4q5q5q5q',
      };

      agent.api.com.atproto.repo.createRecord.mockResolvedValueOnce(
        mockResponse
      );

      const result = await migration.startMigration({
        tiktokUsername: 'testuser',
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

      expect(result.uri).toBe(mockResponse.uri);
      expect(result.cid).toBe(mockResponse.cid);
      expect(result.status).toBe('pending');
      expect(result.sourceUsername).toBe('testuser');
    });
  });

  describe('getMigrationStatus', () => {
    it('should return the current status of a migration', async () => {
      const mockMigration = {
        uri: 'at://did:example:123/app.bsky.migration.record/123',
        cid: 'bafyreib2nxmhaxvwkom7zou5w2hvzxxovkd5qzqz5vwzxj5q5z4q5q5q5q',
        status: 'in_progress',
        progress: {
          current: 50,
          total: 100,
          currentStep: 'Importing videos',
        },
      };

      agent.api.com.atproto.repo.getRecord.mockResolvedValueOnce({
        data: { value: mockMigration },
      });

      const result = await migration.getMigrationStatus(mockMigration.uri);

      expect(result).toEqual(mockMigration);
    });
  });

  describe('listMigrations', () => {
    it('should return a list of all migrations', async () => {
      const mockMigrations = [
        {
          uri: 'at://did:example:123/app.bsky.migration.record/123',
          status: 'completed',
        },
        {
          uri: 'at://did:example:123/app.bsky.migration.record/124',
          status: 'in_progress',
        },
      ];

      agent.api.app.bsky.migration.listRecords.mockResolvedValueOnce({
        data: { migrations: mockMigrations },
      });

      const result = await migration.listMigrations();

      expect(result).toEqual(mockMigrations);
    });
  });

  // Add more test cases for other methods...
});
