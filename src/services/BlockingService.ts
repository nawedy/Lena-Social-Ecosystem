import { FirebaseFirestore } from '@firebase/firestore';
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';

import { Block, BlockReason } from '../types/blocking';
import { User } from '../types/user';

import { NotificationService } from './NotificationService';

export class BlockingService {
  private static instance: BlockingService;
  private db: FirebaseFirestore;
  private notificationService: NotificationService;

  private constructor() {
    this.db = getFirestore();
    this.notificationService = NotificationService.getInstance();
  }

  public static getInstance(): BlockingService {
    if (!BlockingService.instance) {
      BlockingService.instance = new BlockingService();
    }
    return BlockingService.instance;
  }

  async blockUser(
    blockerId: string,
    blockedId: string,
    reason: BlockReason,
    additionalNotes?: string
  ): Promise<void> {
    // Verify users exist
    const [blocker, blocked] = await Promise.all([
      this.db.collection('users').doc(blockerId).get(),
      this.db.collection('users').doc(blockedId).get(),
    ]);

    if (!blocker.exists || !blocked.exists) {
      throw new Error('One or both users not found');
    }

    const block: Block = {
      id: `block_${Date.now()}`,
      blockerId,
      blockedId,
      reason,
      additionalNotes,
      timestamp: new Date(),
      status: 'active',
    };

    await this.db.collection('blocks').add(block);

    // Remove any existing follows
    await this.removeFollowRelationships(blockerId, blockedId);

    // Notify moderators for certain block reasons
    if (['harassment', 'hate_speech', 'threats'].includes(reason)) {
      await this.notifyModerators(block);
    }
  }

  async unblockUser(blockerId: string, blockedId: string): Promise<void> {
    const blocksQuery = query(
      collection(this.db, 'blocks'),
      where('blockerId', '==', blockerId),
      where('blockedId', '==', blockedId),
      where('status', '==', 'active')
    );

    const snapshot = await blocksQuery.get();
    if (snapshot.empty) {
      throw new Error('No active block found');
    }

    const blockDoc = snapshot.docs[0];
    await blockDoc.ref.update({
      status: 'inactive',
      unblockTimestamp: new Date(),
    });
  }

  async isUserBlocked(userId: string): Promise<boolean> {
    const blocksQuery = query(
      collection(this.db, 'blocks'),
      where('blockedId', '==', userId),
      where('status', '==', 'active')
    );

    const snapshot = await blocksQuery.get();
    return !snapshot.empty;
  }

  async getBlockedUsers(userId: string): Promise<User[]> {
    const blocksQuery = query(
      collection(this.db, 'blocks'),
      where('blockerId', '==', userId),
      where('status', '==', 'active')
    );

    const snapshot = await blocksQuery.get();
    const blockedIds = snapshot.docs.map(
      doc => (doc.data() as Block).blockedId
    );

    if (blockedIds.length === 0) {
      return [];
    }

    const usersQuery = query(
      collection(this.db, 'users'),
      where('id', 'in', blockedIds)
    );

    const usersSnapshot = await usersQuery.get();
    return usersSnapshot.docs.map(doc => doc.data() as User);
  }

  async getBlockingUsers(userId: string): Promise<User[]> {
    const blocksQuery = query(
      collection(this.db, 'blocks'),
      where('blockedId', '==', userId),
      where('status', '==', 'active')
    );

    const snapshot = await blocksQuery.get();
    const blockerIds = snapshot.docs.map(
      doc => (doc.data() as Block).blockerId
    );

    if (blockerIds.length === 0) {
      return [];
    }

    const usersQuery = query(
      collection(this.db, 'users'),
      where('id', 'in', blockerIds)
    );

    const usersSnapshot = await usersQuery.get();
    return usersSnapshot.docs.map(doc => doc.data() as User);
  }

  async canInteract(userId1: string, userId2: string): Promise<boolean> {
    const [blocks1, blocks2] = await Promise.all([
      this.isUserBlocked(userId1),
      this.isUserBlocked(userId2),
    ]);

    return !blocks1 && !blocks2;
  }

  private async removeFollowRelationships(
    userId1: string,
    userId2: string
  ): Promise<void> {
    await Promise.all([
      this.db
        .collection('follows')
        .where('followerId', '==', userId1)
        .where('followedId', '==', userId2)
        .get()
        .then(snapshot => {
          snapshot.forEach(doc => doc.ref.delete());
        }),
      this.db
        .collection('follows')
        .where('followerId', '==', userId2)
        .where('followedId', '==', userId1)
        .get()
        .then(snapshot => {
          snapshot.forEach(doc => doc.ref.delete());
        }),
    ]);
  }

  private async notifyModerators(block: Block): Promise<void> {
    const moderatorsQuery = query(
      collection(this.db, 'users'),
      where('role', '==', 'moderator')
    );

    const snapshot = await moderatorsQuery.get();
    const moderators = snapshot.docs.map(doc => doc.data() as User);

    for (const moderator of moderators) {
      await this.notificationService.sendNotification(moderator.id, {
        type: 'block_report',
        title: 'New Block Report',
        body: `Block reason: ${block.reason}`,
        data: {
          blockId: block.id,
          reason: block.reason,
          blockerId: block.blockerId,
          blockedId: block.blockedId,
        },
      });
    }
  }
}
