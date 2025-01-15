import { FirebaseFirestore } from '@firebase/firestore';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import { Follow, FollowRequest, FollowStatus } from '../types/follow';
import { User, UserPrivacySettings } from '../types/user';
import { NotificationService } from './NotificationService';
import { BlockingService } from './BlockingService';

export class FollowService {
  private static instance: FollowService;
  private db: FirebaseFirestore;
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
    const followedUser = await this.db.collection('users').doc(followedId).get();
    const privacySettings = (followedUser.data() as User).privacySettings;

    if (privacySettings.followApprovalRequired) {
      await this.createFollowRequest(followerId, followedId);
    } else {
      await this.createFollow(followerId, followedId);
    }
  }

  async unfollowUser(followerId: string, followedId: string): Promise<void> {
    const followsQuery = query(
      collection(this.db, 'follows'),
      where('followerId', '==', followerId),
      where('followedId', '==', followedId),
      where('status', '==', FollowStatus.ACTIVE)
    );

    const snapshot = await followsQuery.get();
    if (snapshot.empty) {
      throw new Error('Follow relationship not found');
    }

    const followDoc = snapshot.docs[0];
    await followDoc.ref.update({
      status: FollowStatus.INACTIVE,
      unfollowTimestamp: new Date(),
    });
  }

  async approveFollowRequest(requestId: string): Promise<void> {
    const requestDoc = await this.db.collection('followRequests').doc(requestId).get();
    if (!requestDoc.exists) {
      throw new Error('Follow request not found');
    }

    const request = requestDoc.data() as FollowRequest;
    if (request.status !== 'pending') {
      throw new Error('Follow request is not pending');
    }

    // Update request status
    await requestDoc.ref.update({
      status: 'approved',
      responseTimestamp: new Date(),
    });

    // Create follow relationship
    await this.createFollow(request.followerId, request.followedId);

    // Notify follower
    await this.notificationService.sendNotification(request.followerId, {
      type: 'follow_request_approved',
      title: 'Follow Request Approved',
      body: 'Your follow request has been approved',
      data: {
        followedId: request.followedId,
      },
    });
  }

  async rejectFollowRequest(requestId: string): Promise<void> {
    const requestDoc = await this.db.collection('followRequests').doc(requestId).get();
    if (!requestDoc.exists) {
      throw new Error('Follow request not found');
    }

    const request = requestDoc.data() as FollowRequest;
    if (request.status !== 'pending') {
      throw new Error('Follow request is not pending');
    }

    await requestDoc.ref.update({
      status: 'rejected',
      responseTimestamp: new Date(),
    });

    // Notify follower
    await this.notificationService.sendNotification(request.followerId, {
      type: 'follow_request_rejected',
      title: 'Follow Request Rejected',
      body: 'Your follow request was not approved',
      data: {
        followedId: request.followedId,
      },
    });
  }

  async getFollowers(userId: string): Promise<User[]> {
    const followsQuery = query(
      collection(this.db, 'follows'),
      where('followedId', '==', userId),
      where('status', '==', FollowStatus.ACTIVE)
    );

    const snapshot = await followsQuery.get();
    const followerIds = snapshot.docs.map(doc => (doc.data() as Follow).followerId);

    if (followerIds.length === 0) {
      return [];
    }

    const usersQuery = query(
      collection(this.db, 'users'),
      where('id', 'in', followerIds)
    );

    const usersSnapshot = await usersQuery.get();
    return usersSnapshot.docs.map(doc => doc.data() as User);
  }

  async getFollowing(userId: string): Promise<User[]> {
    const followsQuery = query(
      collection(this.db, 'follows'),
      where('followerId', '==', userId),
      where('status', '==', FollowStatus.ACTIVE)
    );

    const snapshot = await followsQuery.get();
    const followingIds = snapshot.docs.map(doc => (doc.data() as Follow).followedId);

    if (followingIds.length === 0) {
      return [];
    }

    const usersQuery = query(
      collection(this.db, 'users'),
      where('id', 'in', followingIds)
    );

    const usersSnapshot = await usersQuery.get();
    return usersSnapshot.docs.map(doc => doc.data() as User);
  }

  async getPendingFollowRequests(userId: string): Promise<FollowRequest[]> {
    const requestsQuery = query(
      collection(this.db, 'followRequests'),
      where('followedId', '==', userId),
      where('status', '==', 'pending')
    );

    const snapshot = await requestsQuery.get();
    return snapshot.docs.map(doc => doc.data() as FollowRequest);
  }

  async updateFollowPrivacySettings(
    userId: string,
    settings: Partial<UserPrivacySettings>
  ): Promise<void> {
    await this.db.collection('users').doc(userId).update({
      'privacySettings.followApprovalRequired': settings.followApprovalRequired,
    });
  }

  private async createFollowRequest(
    followerId: string,
    followedId: string
  ): Promise<void> {
    const request: FollowRequest = {
      id: `freq_${Date.now()}`,
      followerId,
      followedId,
      status: 'pending',
      timestamp: new Date(),
    };

    await this.db.collection('followRequests').add(request);

    // Notify user of follow request
    await this.notificationService.sendNotification(followedId, {
      type: 'follow_request',
      title: 'New Follow Request',
      body: 'Someone wants to follow you',
      data: {
        followerId,
        requestId: request.id,
      },
    });
  }

  private async createFollow(followerId: string, followedId: string): Promise<void> {
    const follow: Follow = {
      id: `follow_${Date.now()}`,
      followerId,
      followedId,
      status: FollowStatus.ACTIVE,
      timestamp: new Date(),
    };

    await this.db.collection('follows').add(follow);

    // Notify user of new follower
    await this.notificationService.sendNotification(followedId, {
      type: 'new_follower',
      title: 'New Follower',
      body: 'Someone started following you',
      data: {
        followerId,
      },
    });
  }
}
