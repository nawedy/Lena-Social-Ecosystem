import {
  BskyAgent,
  AtUri,
  AppBskyFeedPost,
  AppBskyNotificationListNotifications,
} from '@atproto/api';
import { ReplaySubject } from 'rxjs';

export interface NotificationUpdate {
  type: 'notification';
  notification: AppBskyNotificationListNotifications.Notification;
}

export interface PostUpdate {
  type: 'post';
  post: AppBskyFeedPost.Record;
  uri: AtUri;
  cid: string;
}

export type Update = NotificationUpdate | PostUpdate;

export class SubscriptionService {
  private agent: BskyAgent;
  private updateSubject = new ReplaySubject<Update>(100);
  private notificationCursor?: string;
  private pollInterval: number = 5000; // 5 seconds
  private pollTimeout?: NodeJS.Timeout;

  constructor(agent: BskyAgent) {
    this.agent = agent;
  }

  public get updates() {
    return this.updateSubject.asObservable();
  }

  public async start() {
    await this.pollNotifications();
    this.schedulePoll();
  }

  public stop() {
    if (this.pollTimeout) {
      clearTimeout(this.pollTimeout);
      this.pollTimeout = undefined;
    }
  }

  private schedulePoll() {
    this.pollTimeout = setTimeout(async () => {
      await this.pollNotifications();
      this.schedulePoll();
    }, this.pollInterval);
  }

  private async pollNotifications() {
    try {
      const response = await this.agent.listNotifications({
        cursor: this.notificationCursor,
        limit: 20,
      });

      if (!response.success) return;

      // Update cursor for next poll
      this.notificationCursor = response.data.cursor;

      // Emit new notifications
      for (const notification of response.data.notifications) {
        this.updateSubject.next({
          type: 'notification',
          notification,
        });
      }
    } catch (error) {
      console.error('Error polling notifications:', error);
    }
  }

  public async subscribeToProfile(did: string) {
    try {
      const response = await this.agent.getAuthorFeed(did, { limit: 1 });
      if (!response.success) return;

      // Store the latest post for future comparison
      let latestPostCid = response.data.feed[0]?.post.cid;

      // Set up polling for this profile
      const pollProfile = async () => {
        try {
          const newResponse = await this.agent.getAuthorFeed(did, { limit: 1 });
          if (!newResponse.success) return;

          const newPost = newResponse.data.feed[0]?.post;
          if (newPost && newPost.cid !== latestPostCid) {
            latestPostCid = newPost.cid;
            this.updateSubject.next({
              type: 'post',
              post: newPost.record as AppBskyFeedPost.Record,
              uri: new AtUri(newPost.uri),
              cid: newPost.cid,
            });
          }
        } catch (error) {
          console.error('Error polling profile:', error);
        }
      };

      // Poll every 10 seconds
      setInterval(pollProfile, 10000);
    } catch (error) {
      console.error('Error subscribing to profile:', error);
    }
  }
}
