import { BskyAgent } from '@atproto/api';
import { openDB, DBSchema, IDBPDatabase } from 'idb';

import { atproto } from './atproto';

interface ConflictDBSchema extends DBSchema {
  conflicts: {
    key: string;
    value: {
      id: string;
      type: 'post' | 'message' | 'profile' | 'media';
      localVersion: any;
      remoteVersion: any;
      timestamp: string;
      status: 'pending' | 'resolved' | 'failed';
      resolution?: 'local' | 'remote' | 'merged';
      mergedVersion?: any;
    };
    indexes: { 'by-date': string; 'by-status': string };
  };
  mergeStrategies: {
    key: string;
    value: {
      type: 'post' | 'message' | 'profile' | 'media';
      strategy: 'local-wins' | 'remote-wins' | 'manual' | 'custom';
      customResolver?: string;
      lastUpdated: string;
    };
  };
  syncLog: {
    key: string;
    value: {
      id: string;
      operation: 'create' | 'update' | 'delete';
      type: 'post' | 'message' | 'profile' | 'media';
      timestamp: string;
      status: 'pending' | 'completed' | 'failed';
      retryCount: number;
      error?: string;
    };
    indexes: { 'by-date': string; 'by-status': string };
  };
}

interface MergeStrategy {
  type: 'post' | 'message' | 'profile' | 'media';
  strategy: 'local-wins' | 'remote-wins' | 'manual' | 'custom';
  customResolver?: (local: any, remote: any) => Promise<any>;
}

export class ConflictResolutionService {
  private agent: BskyAgent;
  private db: IDBPDatabase<ConflictDBSchema>;
  private static instance: ConflictResolutionService;
  private mergeStrategies: Map<string, MergeStrategy> = new Map();

  private constructor() {
    this.agent = atproto.getAgent();
    this.initializeDB().catch(console.error);
    this.setupDefaultStrategies();
  }

  public static getInstance(): ConflictResolutionService {
    if (!ConflictResolutionService.instance) {
      ConflictResolutionService.instance = new ConflictResolutionService();
    }
    return ConflictResolutionService.instance;
  }

  private async initializeDB(): Promise<void> {
    this.db = await openDB<ConflictDBSchema>('conflict-resolution', 1, {
      upgrade(db) {
        // Conflicts store
        const conflictsStore = db.createObjectStore('conflicts', {
          keyPath: 'id',
        });
        conflictsStore.createIndex('by-date', 'timestamp');
        conflictsStore.createIndex('by-status', 'status');

        // Merge strategies store
        db.createObjectStore('mergeStrategies', { keyPath: 'type' });

        // Sync log store
        const syncLogStore = db.createObjectStore('syncLog', { keyPath: 'id' });
        syncLogStore.createIndex('by-date', 'timestamp');
        syncLogStore.createIndex('by-status', 'status');
      },
    });
  }

  private setupDefaultStrategies(): void {
    this.mergeStrategies.set('post', {
      type: 'post',
      strategy: 'manual',
      customResolver: this.resolvePostConflict.bind(this),
    });

    this.mergeStrategies.set('message', {
      type: 'message',
      strategy: 'remote-wins',
    });

    this.mergeStrategies.set('profile', {
      type: 'profile',
      strategy: 'manual',
      customResolver: this.resolveProfileConflict.bind(this),
    });

    this.mergeStrategies.set('media', {
      type: 'media',
      strategy: 'local-wins',
    });
  }

  async detectConflicts(local: any, remote: any, type: MergeStrategy['type']): Promise<boolean> {
    try {
      switch (type) {
        case 'post':
          return this.detectPostConflict(local, remote);
        case 'message':
          return this.detectMessageConflict(local, remote);
        case 'profile':
          return this.detectProfileConflict(local, remote);
        case 'media':
          return this.detectMediaConflict(local, remote);
        default:
          return false;
      }
    } catch (error) {
      console.error('Conflict detection error:', error);
      return false;
    }
  }

  async resolveConflict(conflictId: string): Promise<void> {
    try {
      const conflict = await this.db.get('conflicts', conflictId);
      if (!conflict) throw new Error('Conflict not found');

      const strategy = this.mergeStrategies.get(conflict.type);
      if (!strategy) throw new Error('No merge strategy found for type');

      let resolvedVersion: any;

      switch (strategy.strategy) {
        case 'local-wins':
          resolvedVersion = conflict.localVersion;
          break;
        case 'remote-wins':
          resolvedVersion = conflict.remoteVersion;
          break;
        case 'manual':
          // Leave as pending for manual resolution
          return;
        case 'custom':
          if (strategy.customResolver) {
            resolvedVersion = await strategy.customResolver(
              conflict.localVersion,
              conflict.remoteVersion
            );
          }
          break;
      }

      if (resolvedVersion) {
        await this.applyResolution(conflict.id, resolvedVersion);
        await this.logSync({
          operation: 'update',
          type: conflict.type,
          status: 'completed',
        });
      }
    } catch (error) {
      console.error('Conflict resolution error:', error);
      throw error;
    }
  }

  async setMergeStrategy(type: MergeStrategy['type'], strategy: MergeStrategy): Promise<void> {
    try {
      this.mergeStrategies.set(type, strategy);
      await this.db.put('mergeStrategies', {
        type,
        strategy: strategy.strategy,
        customResolver: strategy.customResolver?.toString(),
        lastUpdated: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Merge strategy update error:', error);
      throw error;
    }
  }

  // Conflict Detection Methods
  private async detectPostConflict(local: any, remote: any): Promise<boolean> {
    if (!local || !remote) return false;

    // Check for content differences
    if (local.text !== remote.text) return true;

    // Check for media differences
    const localMedia = local.media || [];
    const remoteMedia = remote.media || [];
    if (localMedia.length !== remoteMedia.length) return true;

    // Check for edit timestamps
    const localTime = new Date(local.editedAt || local.createdAt).getTime();
    const remoteTime = new Date(remote.editedAt || remote.createdAt).getTime();
    if (Math.abs(localTime - remoteTime) > 1000) return true;

    return false;
  }

  private async detectMessageConflict(local: any, remote: any): Promise<boolean> {
    if (!local || !remote) return false;

    // Compare message content and metadata
    if (local.text !== remote.text) return true;
    if (local.status !== remote.status) return true;

    // Check attachments
    const localAttachments = local.attachments || [];
    const remoteAttachments = remote.attachments || [];
    if (localAttachments.length !== remoteAttachments.length) return true;

    return false;
  }

  private async detectProfileConflict(local: any, remote: any): Promise<boolean> {
    if (!local || !remote) return false;

    // Compare profile fields
    const fields = ['displayName', 'description', 'avatar'];
    return fields.some((field) => local[field] !== remote[field]);
  }

  private async detectMediaConflict(local: any, remote: any): Promise<boolean> {
    if (!local || !remote) return false;

    // Compare media metadata
    if (local.mimeType !== remote.mimeType) return true;
    if (local.size !== remote.size) return true;

    // Compare content hashes if available
    if (local.hash && remote.hash && local.hash !== remote.hash) return true;

    return false;
  }

  // Custom Resolvers
  private async resolvePostConflict(local: any, remote: any): Promise<any> {
    // Implement sophisticated post merging logic
    const merged = { ...remote }; // Start with remote version

    // If local has newer edits, use local content
    const localTime = new Date(local.editedAt || local.createdAt).getTime();
    const remoteTime = new Date(remote.editedAt || remote.createdAt).getTime();

    if (localTime > remoteTime) {
      merged.text = local.text;
      merged.media = local.media;
    }

    // Merge unique reactions and comments
    merged.reactions = [...new Set([...(local.reactions || []), ...(remote.reactions || [])])];
    merged.comments = this.mergeComments(local.comments || [], remote.comments || []);

    return merged;
  }

  private async resolveProfileConflict(local: any, remote: any): Promise<any> {
    // Implement profile merging logic
    const merged = { ...remote }; // Start with remote version

    // Use most recent non-null values
    const fields = ['displayName', 'description', 'avatar'];
    fields.forEach((field) => {
      if (local[field] && (!remote[field] || local.updatedAt > remote.updatedAt)) {
        merged[field] = local[field];
      }
    });

    // Merge arrays (e.g., followers, following)
    merged.followers = [...new Set([...(local.followers || []), ...(remote.followers || [])])];
    merged.following = [...new Set([...(local.following || []), ...(remote.following || [])])];

    return merged;
  }

  private mergeComments(local: any[], remote: any[]): any[] {
    // Merge comments by ID and timestamp
    const commentMap = new Map();

    [...local, ...remote].forEach((comment) => {
      const existing = commentMap.get(comment.id);
      if (!existing || new Date(comment.createdAt) > new Date(existing.createdAt)) {
        commentMap.set(comment.id, comment);
      }
    });

    return Array.from(commentMap.values()).sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }

  // Resolution Application
  private async applyResolution(conflictId: string, resolvedVersion: any): Promise<void> {
    try {
      const conflict = await this.db.get('conflicts', conflictId);
      if (!conflict) throw new Error('Conflict not found');

      // Update the conflict record
      await this.db.put('conflicts', {
        ...conflict,
        status: 'resolved',
        resolution: 'merged',
        mergedVersion: resolvedVersion,
      });

      // Update the AT Protocol record
      await this.agent.api.com.atproto.repo.putRecord({
        repo: this.agent.session?.did ?? '',
        collection: `app.bsky.${conflict.type}`,
        rkey: conflictId,
        record: resolvedVersion,
      });
    } catch (error) {
      console.error('Resolution application error:', error);
      throw error;
    }
  }

  // Sync Logging
  private async logSync(params: {
    operation: 'create' | 'update' | 'delete';
    type: MergeStrategy['type'];
    status: 'pending' | 'completed' | 'failed';
    error?: string;
  }): Promise<void> {
    try {
      await this.db.add('syncLog', {
        id: crypto.randomUUID(),
        ...params,
        timestamp: new Date().toISOString(),
        retryCount: 0,
      });
    } catch (error) {
      console.error('Sync logging error:', error);
    }
  }

  // Utility Methods
  async getPendingConflicts(): Promise<any[]> {
    return this.db.getAllFromIndex('conflicts', 'by-status', 'pending');
  }

  async getSyncLog(limit = 100): Promise<any[]> {
    return this.db.getAllFromIndex('syncLog', 'by-date', null, limit);
  }

  async getConflictDetails(conflictId: string): Promise<any> {
    return this.db.get('conflicts', conflictId);
  }
}

export const conflictResolution = ConflictResolutionService.getInstance();
