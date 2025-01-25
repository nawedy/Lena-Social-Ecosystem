import { BskyAgent } from '@atproto/api';
import { RichText } from '@atproto/api';

import { config } from '../config';

import { ATProtoService } from './atProtocolIntegration';

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

export class MigrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MigrationError';
  }
}

export class NetworkError extends Error {
  constructor(
    message: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'NetworkError';
  }
}

export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class InvalidURLError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidURLError';
  }
}

const MIGRATION_COLLECTION = 'app.bsky.migration.record';

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
      const errorMessage = `Failed to start migration for user ${params.sourceUsername}: ${(error as Error).message}`;
      console.error(errorMessage, error);
      throw new MigrationError(errorMessage);
    }
  }

  private async createMigrationRecord(
    record: Omit<MigrationRecord, 'uri' | 'cid'>
  ): Promise<{ uri: string; cid: string }> {
    const session = this.atProto.getSession();
    if (!session) {
      throw new AuthenticationError('Not logged in');
    }

    try {
      const response = await fetch(
        `${config.atProtocol.server}/xrpc/com.atproto.repo.createRecord`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.accessJwt}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            repo: session.did,
            collection: MIGRATION_COLLECTION,
            record,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorDetails = JSON.stringify(errorData);
        throw new NetworkError(
          `Failed to create migration record. Status: ${response.status}. Details: ${errorDetails}`,
          response.status
        );
      }

      const data = await response.json();
      return {
        uri: data.uri,
        cid: data.cid,
      };
    } catch (error) {
      const errorMessage = `Failed to create migration record: ${(error as Error).message}`;
      console.error(errorMessage, error);
      throw new MigrationError(errorMessage);
    }
  }

  async updateMigrationProgress(
    migrationUri: string,
    update: Partial<MigrationRecord>
  ): Promise<void> {
    const session = this.atProto.getSession();
    if (!session) {
      throw new AuthenticationError('Not logged in');
    }

    try {
      const rkey = migrationUri.split('/').pop();
      if (!rkey) {
        throw new InvalidURLError('Invalid migration URI');
      }
      const response = await fetch(
        `${config.atProtocol.server}/xrpc/com.atproto.repo.putRecord`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.accessJwt}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            repo: session.did,
            collection: MIGRATION_COLLECTION,
            rkey,
            record: update,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorDetails = JSON.stringify(errorData);
        throw new NetworkError(
          `Failed to update migration record. Status: ${response.status}. Details: ${errorDetails}`,
          response.status
        );
      }
    } catch (error) {
      const errorMessage = `Failed to update migration progress for URI ${migrationUri}: ${(error as Error).message}`;
      console.error(errorMessage, error);
      throw new MigrationError(errorMessage);
    }
  }

  async getMigrationStatus(migrationUri: string): Promise<MigrationRecord> {
    try {
      const parts = migrationUri.split('/');
      if (parts.length < 2) {
        throw new InvalidURLError(
          `Invalid migration URI format: ${migrationUri}`
        );
      }
      const repo = parts[0];
      const rkey = parts.pop();
      if (!rkey) {
        throw new InvalidURLError('Invalid migration URI');
      }
      const response = await fetch(
        `${config.atProtocol.server}/xrpc/com.atproto.repo.getRecord?repo=${repo}&collection=${MIGRATION_COLLECTION}&rkey=${rkey}`
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
