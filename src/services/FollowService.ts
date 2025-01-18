import {
  Firestore,
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  setDoc,
} from 'firebase/firestore';

import { Follow, FollowRequest } from '../types/follow';
import { User } from '../types/user';

import { BlockingService } from './BlockingService';
import { NotificationService } from './NotificationService';

export class FollowService {
  private static instance: FollowService;
  private db: Firestore;
  private notificationService: NotificationService;
  private blockingService: BlockingService;

  private constructor() {
    this.db = getFirestore();
    this.notificationService = NotificationService.getInstance();
    this.blockingService = BlockingService.getInstance();
  }

  public static getInstance(): FollowService {
    if (!FollowService.instance) {
      FollowService.instance = new FollowService();
    }
    return FollowService.instance;
  }

  async followUser(followerId: string, followedId: string): Promise<void> {
    // Check if users can interact
    const canInteract = await this.blockingService.canInteract(followerId, followedId);
    if (!canInteract) {
      throw new Error('Unable to follow this user');
    }

    // Get user privacy settings
    const followedUserDoc = await getDoc(doc(this.db, 'users', followedId));
    const followedUser = followedUserDoc.data() as User;

    if (followedUser.preferences?.privacy?.profileVisibility === 'private') {
      await this.createFollowRequest(followerId, followedId);
    } else {
      await this.createFollow(followerId, followedId);
    }
  }

  async unfollowUser(followerId: string, followedId: string): Promise<void> {
    const followsQuery = query(
      collection(this.db, 'follows'),
      where('followerId', '==', followerId),
      where('followingId', '==', followedId),
      where('status', '==', 'active')
    );

    const snapshot = await getDocs(followsQuery);
    if (snapshot.empty) {
      throw new Error('Follow relationship not found');
    }

    const followDoc = snapshot.docs[0];
    await updateDoc(followDoc.ref, {
      status: 'inactive',
      unfollowTimestamp: new Date(),
    });
  }

  async approveFollowRequest(requestId: string): Promise<void> {
    const requestDoc = await getDoc(doc(this.db, 'followRequests', requestId));
    if (!requestDoc.exists()) {
      throw new Error('Follow request not found');
    }

    const request = requestDoc.data() as FollowRequest;
    if (request.status !== 'pending') {
      throw new Error('Follow request is not pending');
    }

    // Update request status
    await updateDoc(doc(this.db, 'followRequests', requestId), {
      status: 'accepted',
      updatedAt: new Date(),
    });

    // Create follow relationship
    await this.createFollow(request.fromUserId, request.toUserId);

    // Notify follower
    await this.notificationService.sendNotification(request.fromUserId, {
      type: 'follow_request_approved',
      title: 'Follow Request Approved',
      body: 'Your follow request has been approved',
      data: {
        followedId: request.toUserId,
      },
    });
  }

  async rejectFollowRequest(requestId: string): Promise<void> {
    const requestDoc = await getDoc(doc(this.db, 'followRequests', requestId));
    if (!requestDoc.exists()) {
      throw new Error('Follow request not found');
    }

    const request = requestDoc.data() as FollowRequest;
    if (request.status !== 'pending') {
      throw new Error('Follow request is not pending');
    }

    // Update request status
    await updateDoc(doc(this.db, 'followRequests', requestId), {
      status: 'rejected',
      updatedAt: new Date(),
    });

    // Notify follower
    await this.notificationService.sendNotification(request.fromUserId, {
      type: 'follow_request_rejected',
      title: 'Follow Request Rejected',
      body: 'Your follow request has been rejected',
      data: {
        followedId: request.toUserId,
      },
    });
  }

  private async createFollowRequest(fromUserId: string, toUserId: string): Promise<void> {
    const request: FollowRequest = {
      id: `${fromUserId}_${toUserId}`,
      fromUserId,
      toUserId,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await setDoc(
      doc(this.db, 'followRequests', request.id),
      {
        ...request,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      { merge: true }
    );

    // Notify the target user
    await this.notificationService.sendNotification(toUserId, {
      type: 'follow_request',
      title: 'New Follow Request',
      body: 'Someone wants to follow you',
      data: {
        requestId: request.id,
        fromUserId,
      },
    });
  }

  private async createFollow(followerId: string, followingId: string): Promise<void> {
    const follow: Follow = {
      id: `${followerId}_${followingId}`,
      followerId,
      followingId,
      createdAt: new Date(),
      status: 'active',
      metadata: {
        source: 'direct',
      },
    };

    await setDoc(
      doc(this.db, 'follows', follow.id),
      {
        ...follow,
        createdAt: new Date(),
      },
      { merge: true }
    );

    // Notify the followed user
    await this.notificationService.sendNotification(followingId, {
      type: 'new_follower',
      title: 'New Follower',
      body: 'Someone started following you',
      data: {
        followerId,
      },
    });
  }
}
