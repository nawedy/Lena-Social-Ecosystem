import { BskyAgent, AppBskyNotificationListNotifications } from '@atproto/api';

export interface NotificationChannel {
  type: 'sms' | 'email' | 'push';
  enabled: boolean;
  target: string; // phone number, email, or push token
}

export interface NotificationPreferences {
  mentions: boolean;
  replies: boolean;
  likes: boolean;
  reposts: boolean;
  follows: boolean;
  quotes: boolean;
  channels: NotificationChannel[];
}

export class NotificationService {
  private agent: BskyAgent;
  private vapidPublicKey = process.env.REACT_APP_VAPID_PUBLIC_KEY;
  private serviceWorkerPath = '/service-worker.js';

  constructor(agent: BskyAgent) {
    this.agent = agent;
  }

  // Initialize push notifications
  public async initializePushNotifications(): Promise<void> {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      throw new Error('Push notifications are not supported');
    }

    try {
      const registration = await navigator.serviceWorker.register(this.serviceWorkerPath);
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.vapidPublicKey,
      });

      // Store the push subscription on your server
      await this.updatePushSubscription(subscription);
    } catch (error) {
      console.error('Failed to initialize push notifications:', error);
      throw error;
    }
  }

  // Update push subscription on server
  private async updatePushSubscription(subscription: PushSubscription): Promise<void> {
    // Implementation would depend on your backend service
    await fetch('/api/push-subscriptions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subscription,
        userId: this.agent.session?.did,
      }),
    });
  }

  // Update notification preferences
  public async updateNotificationPreferences(preferences: NotificationPreferences): Promise<void> {
    // Store preferences in AT Protocol using app.bsky.actor.preferences
    const record = {
      notifications: preferences,
      createdAt: new Date().toISOString(),
    };

    await this.agent.api.com.atproto.repo.putRecord({
      repo: this.agent.session?.did ?? '',
      collection: 'app.bsky.actor.preferences',
      rkey: 'notifications',
      record,
    });
  }

  // Get notification preferences
  public async getNotificationPreferences(): Promise<NotificationPreferences> {
    try {
      const response = await this.agent.api.com.atproto.repo.getRecord({
        repo: this.agent.session?.did ?? '',
        collection: 'app.bsky.actor.preferences',
        rkey: 'notifications',
      });

      return response.data.value.notifications;
    } catch (_error) {
      // Return default preferences if none are set
      return {
        mentions: true,
        replies: true,
        likes: true,
        reposts: true,
        follows: true,
        quotes: true,
        channels: [],
      };
    }
  }

  // Format notification for different channels
  private formatNotification(notification: AppBskyNotificationListNotifications.Notification) {
    const author = notification.author.displayName || notification.author.handle;
    let message = '';

    switch (notification.reason) {
      case 'like':
        message = `${author} liked your post`;
        break;
      case 'repost':
        message = `${author} reposted your post`;
        break;
      case 'follow':
        message = `${author} followed you`;
        break;
      case 'mention':
        message = `${author} mentioned you`;
        break;
      case 'reply':
        message = `${author} replied to your post`;
        break;
      case 'quote':
        message = `${author} quoted your post`;
        break;
      default:
        message = `New notification from ${author}`;
    }

    return {
      title: 'TikTokToe',
      body: message,
      data: {
        url: `/notification/${notification.uri}`,
        type: notification.reason,
      },
    };
  }

  // Send notification through specified channel
  private async sendNotification(
    notification: AppBskyNotificationListNotifications.Notification,
    channel: NotificationChannel
  ): Promise<void> {
    const formattedNotification = this.formatNotification(notification);

    switch (channel.type) {
      case 'push':
        // Send push notification via web push API
        // Implementation would depend on your push service
        await fetch('/api/push-notifications', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            target: channel.target,
            notification: formattedNotification,
          }),
        });
        break;

      case 'email':
        // Send email notification
        // Implementation would depend on your email service
        await fetch('/api/email-notifications', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: channel.target,
            subject: formattedNotification.title,
            text: formattedNotification.body,
          }),
        });
        break;

      case 'sms':
        // Send SMS notification
        // Implementation would depend on your SMS service
        await fetch('/api/sms-notifications', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: channel.target,
            message: formattedNotification.body,
          }),
        });
        break;
    }
  }

  // Process new notification
  public async processNotification(
    notification: AppBskyNotificationListNotifications.Notification
  ): Promise<void> {
    const preferences = await this.getNotificationPreferences();

    // Check if this type of notification is enabled
    if (!preferences[notification.reason as keyof NotificationPreferences]) {
      return;
    }

    // Send notification through each enabled channel
    await Promise.all(
      preferences.channels
        .filter((channel) => channel.enabled)
        .map((channel) => this.sendNotification(notification, channel))
    );
  }
}
