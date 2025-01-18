import { BskyAgent } from '@atproto/api';
import { ATProtoService } from './atProtocolIntegration';
import { RichText } from '@atproto/api';

export interface MigrationRecord {
  $type: string;
  uri: string;
  cid: string;
  sourceUsername: string;
  targetDid: string;
  options: {
    importVideos: boolean;
    importFollowers: boolean;
    importAnalytics: boolean;
    preserveMetadata: boolean;
    optimizeContent: boolean;
    scheduleContent: boolean;
    crossPostToTikTok: boolean;
  };
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  progress: {
    current: number;
    total: number;
    currentStep: string;
  };
  results: {
    videosImported: number;
    followersImported: number;
    engagementMetricsImported: boolean;
    scheduledPosts: number;
  };
  error?: string;
  startedAt: string;
  completedAt?: string;
}

export class ATProtocolMigrationService {
  private atProto: ATProtoService;

  constructor(atProto: ATProtoService) {
    this.atProto = atProto;
  }

  async startMigration(params: {
    sourceUsername: string;
    targetDid: string;
    options: MigrationRecord['options'];
  }): Promise<MigrationRecord> {
    const record: Omit<MigrationRecord, 'uri' | 'cid'> = {
      $type: 'app.bsky.migration.record',
      sourceUsername: params.sourceUsername,
      targetDid: params.targetDid,
      options: params.options,
      status: 'pending',
      progress: {
        current: 0,
        total: 100,
        currentStep: 'Initializing migration',
      },
      results: {
        videosImported: 0,
        followersImported: 0,
        engagementMetricsImported: false,
        scheduledPosts: 0,
      },
      startedAt: new Date().toISOString(),
    };

    try {
      const response = await this.createMigrationRecord(record);
      return {
        ...record,
        uri: response.uri,
        cid: response.cid,
      };
    } catch (error) {
      console.error('Failed to start migration:', error);
      throw error;
    }
  }

  private async createMigrationRecord(
    record: Omit<MigrationRecord, 'uri' | 'cid'>
  ): Promise<{ uri: string; cid: string }> {
    const session = this.atProto.getSession();
    if (!session) {
      throw new Error('Not logged in');
    }

    try {
      const response = await fetch(
        `https://bsky.social/xrpc/com.atproto.repo.createRecord`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.accessJwt}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            repo: session.did,
            collection: 'app.bsky.migration.record',
            record,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(
          `Failed to create migration record: ${response.statusText}`
        );
      }

      const data = await response.json();
      return {
        uri: data.uri,
        cid: data.cid,
      };
    } catch (error) {
      console.error('Failed to create migration record:', error);
      throw error;
    }
  }

  async updateMigrationProgress(
    migrationUri: string,
    update: Partial<MigrationRecord>
  ): Promise<void> {
    const session = this.atProto.getSession();
    if (!session) {
      throw new Error('Not logged in');
    }

    try {
      const rkey = migrationUri.split('/').pop();
      if (!rkey) {
        throw new Error('Invalid migration URI');
      }

      const response = await fetch(
        `https://bsky.social/xrpc/com.atproto.repo.putRecord`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.accessJwt}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            repo: session.did,
            collection: 'app.bsky.migration.record',
            rkey,
            record: update,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(
          `Failed to update migration record: ${response.statusText}`
        );
      }
    } catch (error) {
      console.error('Failed to update migration progress:', error);
      throw error;
    }
  }

  async getMigrationStatus(migrationUri: string): Promise<MigrationRecord> {
    try {
      const response = await fetch(
        `https://bsky.social/xrpc/com.atproto.repo.getRecord?repo=${migrationUri.split('/')[0]}&collection=app.bsky.migration.record&rkey=${migrationUri.split('/').pop()}`
      );

      if (!response.ok) {
        throw new Error(
          `Failed to get migration status: ${response.statusText}`
        );
      }

      const data = await response.json();
      return data.value as MigrationRecord;
    } catch (error) {
      console.error('Failed to get migration status:', error);
      throw error;
    }
  }

  async cancelMigration(migrationUri: string): Promise<void> {
    await this.updateMigrationProgress(migrationUri, {
      status: 'failed',
      error: 'Migration cancelled by user',
      completedAt: new Date().toISOString(),
    });
  }
}
