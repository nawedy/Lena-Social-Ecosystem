import { BskyAgent } from '@atproto/api';
import { openDB, DBSchema, IDBPDatabase } from 'idb';

import { atproto } from './atproto';

interface OfflineDBSchema extends DBSchema {
  posts: {
    key: string;
    value: {
      uri: string;
      text: string;
      media?: { type: string; blob: Blob }[];
      createdAt: string;
      synced: boolean;
    };
    indexes: { 'by-date': string };
  };
  messages: {
    key: string;
    value: {
      uri: string;
      text: string;
      recipient: string;
      attachments?: { type: string; blob: Blob }[];
      createdAt: string;
      synced: boolean;
    };
    indexes: { 'by-date': string };
  };
  feed: {
    key: string;
    value: {
      uri: string;
      author: string;
      text: string;
      media?: { type: string; uri: string }[];
      createdAt: string;
      expiresAt: string;
    };
    indexes: { 'by-date': string; 'by-expiry': string };
  };
  media: {
    key: string;
    value: {
      uri: string;
      blob: Blob;
      type: string;
      createdAt: string;
    };
  };
}

export class OfflineSyncService {
  private agent: BskyAgent;
  private db: IDBPDatabase<OfflineDBSchema>;
  private static instance: OfflineSyncService;
  private syncInProgress = false;
  private networkStatus: 'online' | 'offline' = 'online';

  private constructor() {
    this.agent = atproto.getAgent();
    this.initializeDB().catch(console.error);
    this.setupNetworkListeners();
  }

  public static getInstance(): OfflineSyncService {
    if (!OfflineSyncService.instance) {
      OfflineSyncService.instance = new OfflineSyncService();
    }
    return OfflineSyncService.instance;
  }

  private async initializeDB(): Promise<void> {
    this.db = await openDB<OfflineDBSchema>('tiktoktoe-offline', 1, {
      upgrade(db) {
        // Posts store
        const postsStore = db.createObjectStore('posts', { keyPath: 'uri' });
        postsStore.createIndex('by-date', 'createdAt');

        // Messages store
        const messagesStore = db.createObjectStore('messages', {
          keyPath: 'uri',
        });
        messagesStore.createIndex('by-date', 'createdAt');

        // Feed store
        const feedStore = db.createObjectStore('feed', { keyPath: 'uri' });
        feedStore.createIndex('by-date', 'createdAt');
        feedStore.createIndex('by-expiry', 'expiresAt');

        // Media store
        db.createObjectStore('media', { keyPath: 'uri' });
      },
    });
  }

  private setupNetworkListeners(): void {
    window.addEventListener('online', () => {
      this.networkStatus = 'online';
      this.syncOfflineData().catch(console.error);
    });

    window.addEventListener('offline', () => {
      this.networkStatus = 'offline';
    });
  }

  // Offline Post Creation
  async createOfflinePost(
    text: string,
    media?: { type: string; blob: Blob }[]
  ): Promise<string> {
    try {
      const uri = `offline:${crypto.randomUUID()}`;
      const post = {
        uri,
        text,
        media,
        createdAt: new Date().toISOString(),
        synced: false,
      };

      await this.db.add('posts', post);

      if (this.networkStatus === 'online') {
        void this.syncOfflineData();
      }

      return uri;
    } catch (error) {
      console.error('Offline post creation error:', error);
      throw error;
    }
  }

  // Offline Message Creation
  async createOfflineMessage(
    text: string,
    recipient: string,
    attachments?: { type: string; blob: Blob }[]
  ): Promise<string> {
    try {
      const uri = `offline:${crypto.randomUUID()}`;
      const message = {
        uri,
        text,
        recipient,
        attachments,
        createdAt: new Date().toISOString(),
        synced: false,
      };

      await this.db.add('messages', message);

      if (this.networkStatus === 'online') {
        void this.syncOfflineData();
      }

      return uri;
    } catch (error) {
      console.error('Offline message creation error:', error);
      throw error;
    }
  }

  // Feed Caching
  async cacheFeedItem(item: {
    uri: string;
    author: string;
    text: string;
    media?: { type: string; uri: string }[];
  }): Promise<void> {
    try {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

      await this.db.add('feed', {
        ...item,
        createdAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
      });

      // Cleanup expired items
      void this.cleanupExpiredItems();
    } catch (error) {
      console.error('Feed item caching error:', error);
      throw error;
    }
  }

  // Media Caching
  async cacheMedia(uri: string, blob: Blob, type: string): Promise<void> {
    try {
      await this.db.add('media', {
        uri,
        blob,
        type,
        createdAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Media caching error:', error);
      throw error;
    }
  }

  // Data Synchronization
  async syncOfflineData(): Promise<void> {
    if (this.syncInProgress || this.networkStatus === 'offline') {
      return;
    }

    try {
      this.syncInProgress = true;

      // Sync posts
      const unsyncedPosts = await this.db.getAllFromIndex('posts', 'by-date');
      for (const post of unsyncedPosts.filter(p => !p.synced)) {
        try {
          let mediaUploads;
          if (post.media?.length) {
            mediaUploads = await Promise.all(
              post.media.map(m =>
                this.agent.uploadBlob(m.blob, {
                  encoding: m.type === 'image' ? 'image/jpeg' : 'video/mp4',
                })
              )
            );
          }

          const response = await this.agent.post({
            text: post.text,
            embed: mediaUploads
              ? {
                  $type: 'app.bsky.embed.images',
                  images: mediaUploads.map((upload, _i) => ({
                    alt: post.text,
                    image: upload.data.blob,
                  })),
                }
              : undefined,
          });

          await this.db.put('posts', {
            ...post,
            synced: true,
            uri: response.uri,
          });
        } catch (error) {
          console.error(`Failed to sync post ${post.uri}:`, error);
        }
      }

      // Sync messages
      const unsyncedMessages = await this.db.getAllFromIndex(
        'messages',
        'by-date'
      );
      for (const message of unsyncedMessages.filter(m => !m.synced)) {
        try {
          let attachmentUploads;
          if (message.attachments?.length) {
            attachmentUploads = await Promise.all(
              message.attachments.map(a =>
                this.agent.uploadBlob(a.blob, {
                  encoding:
                    a.type === 'image'
                      ? 'image/jpeg'
                      : a.type === 'video'
                        ? 'video/mp4'
                        : 'application/octet-stream',
                })
              )
            );
          }

          const response = await this.agent.api.com.atproto.repo.createRecord({
            repo: this.agent.session?.did ?? '',
            collection: 'app.bsky.graph.message',
            record: {
              text: message.text,
              recipient: message.recipient,
              attachments: attachmentUploads?.map((upload, i) => ({
                type: message.attachments?.[i].type,
                blob: upload.data.blob,
              })),
              createdAt: message.createdAt,
            },
          });

          await this.db.put('messages', {
            ...message,
            synced: true,
            uri: response.uri,
          });
        } catch (error) {
          console.error(`Failed to sync message ${message.uri}:`, error);
        }
      }
    } finally {
      this.syncInProgress = false;
    }
  }

  // Cleanup
  private async cleanupExpiredItems(): Promise<void> {
    try {
      const now = new Date().toISOString();
      const expiredItems = await this.db.getAllFromIndex('feed', 'by-expiry');

      for (const item of expiredItems) {
        if (item.expiresAt < now) {
          await this.db.delete('feed', item.uri);
        }
      }
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }

  // Storage Management
  async getStorageUsage(): Promise<{
    posts: number;
    messages: number;
    feed: number;
    media: number;
    total: number;
  }> {
    const [posts, messages, feed, media] = await Promise.all([
      this.db.count('posts'),
      this.db.count('messages'),
      this.db.count('feed'),
      this.db.count('media'),
    ]);

    return {
      posts,
      messages,
      feed,
      media,
      total: posts + messages + feed + media,
    };
  }

  async clearOldData(daysToKeep = 7): Promise<void> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysToKeep);
    const cutoffStr = cutoff.toISOString();

    try {
      const tx = this.db.transaction(
        ['posts', 'messages', 'feed', 'media'],
        'readwrite'
      );
      await Promise.all([
        this.deleteOldItems(tx.objectStore('posts'), 'by-date', cutoffStr),
        this.deleteOldItems(tx.objectStore('messages'), 'by-date', cutoffStr),
        this.deleteOldItems(tx.objectStore('feed'), 'by-date', cutoffStr),
        this.deleteOldItems(tx.objectStore('media'), 'by-date', cutoffStr),
      ]);
      await tx.done;
    } catch (error) {
      console.error('Clear old data error:', error);
      throw error;
    }
  }

  private async deleteOldItems(
    store: any,
    indexName: string,
    cutoff: string
  ): Promise<void> {
    let cursor = await store
      .index(indexName)
      .openCursor(IDBKeyRange.upperBound(cutoff));
    while (cursor) {
      await cursor.delete();
      cursor = await cursor.continue();
    }
  }
}

export const offlineSync = OfflineSyncService.getInstance();
