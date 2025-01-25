import { Datastore } from '@google-cloud/datastore';
import { PubSub } from '@google-cloud/pubsub';

import { config } from '../config';

import { completeAnalytics } from './completeAnalytics';
import { performanceMonitoring } from './performanceMonitoring';

interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  priority: 'high' | 'normal' | 'low';
  status: 'unread' | 'read' | 'archived';
  createdAt: string;
  expiresAt?: string;
  actions?: Array<{
    id: string;
    title: string;
    url?: string;
    data?: Record<string, any>;
  }>;
}

interface NotificationSubscription {
  userId: string;
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userAgent: string;
  createdAt: string;
}

interface NotificationPreferences {
  userId: string;
  channels: {
    push: boolean;
    email: boolean;
    inApp: boolean;
  };
  mutedUntil?: string;
  mutedTypes?: string[];
  customSettings?: Record<string, any>;
}

export class RealtimeNotificationsService {
  private static instance: RealtimeNotificationsService;
  private pubsub: PubSub;
  private datastore: Datastore;
  private webPush = require('web-push');
  private activeConnections: Map<string, Set<WebSocket>>;
  private subscriptionsByUser: Map<string, Set<NotificationSubscription>>;
  private readonly NOTIFICATION_TTL = 30 * 24 * 60 * 60; // 30 days

  private constructor() {
    this.pubsub = new PubSub({
      projectId: config.gcp.projectId,
      keyFilename: config.gcp.keyFile,
    });
    this.datastore = new Datastore({
      projectId: config.gcp.projectId,
      keyFilename: config.gcp.keyFile,
    });
    this.activeConnections = new Map();
    this.subscriptionsByUser = new Map();

    this.webPush.setVapidDetails(
      'mailto:support@tiktotoe.com',
      config.VAPID_PUBLIC_KEY,
      config.VAPID_PRIVATE_KEY
    );

    this.initializeService();
  }

  public static getInstance(): RealtimeNotificationsService {
    if (!RealtimeNotificationsService.instance) {
      RealtimeNotificationsService.instance =
        new RealtimeNotificationsService();
    }
    return RealtimeNotificationsService.instance;
  }

  private async initializeService(): Promise<void> {
    await this.loadSubscriptions();
    this.setupNotificationProcessor();
  }

  // WebSocket Connection Management
  async handleWebSocketConnection(
    userId: string,
    ws: WebSocket
  ): Promise<void> {
    let userConnections = this.activeConnections.get(userId);
    if (!userConnections) {
      userConnections = new Set();
      this.activeConnections.set(userId, userConnections);
    }
    userConnections.add(ws);

    ws.on('close', () => {
      userConnections?.delete(ws);
      if (userConnections?.size === 0) {
        this.activeConnections.delete(userId);
      }
    });

    // Send any pending notifications
    const pendingNotifications = await this.getPendingNotifications(userId);
    for (const notification of pendingNotifications) {
      ws.send(JSON.stringify(notification));
    }
  }

  // Push Subscription Management
  async subscribe(params: {
    userId: string;
    subscription: NotificationSubscription;
  }): Promise<void> {
    try {
      let userSubscriptions = this.subscriptionsByUser.get(params.userId);
      if (!userSubscriptions) {
        userSubscriptions = new Set();
        this.subscriptionsByUser.set(params.userId, userSubscriptions);
      }

      userSubscriptions.add(params.subscription);
      await this.persistSubscription(params.subscription);

      // Track subscription
      await completeAnalytics.trackEvent({
        type: 'notification_subscribed',
        userId: params.userId,
        data: {
          userAgent: params.subscription.userAgent,
        },
        metadata: {
          service: 'realtime-notifications',
          environment: config.app.env,
          version: '1.0.0',
        },
      });
    } catch (error) {
      performanceMonitoring.recordError(error as Error, {
        operation: 'subscribe',
        userId: params.userId,
      });
      throw error;
    }
  }

  async unsubscribe(params: {
    userId: string;
    endpoint: string;
  }): Promise<void> {
    try {
      const userSubscriptions = this.subscriptionsByUser.get(params.userId);
      if (userSubscriptions) {
        const subscription = Array.from(userSubscriptions).find(
          s => s.endpoint === params.endpoint
        );
        if (subscription) {
          userSubscriptions.delete(subscription);
          await this.deleteSubscription(subscription);
        }
      }

      // Track unsubscription
      await completeAnalytics.trackEvent({
        type: 'notification_unsubscribed',
        userId: params.userId,
        data: {
          endpoint: params.endpoint,
        },
        metadata: {
          service: 'realtime-notifications',
          environment: config.app.env,
          version: '1.0.0',
        },
      });
    } catch (error) {
      performanceMonitoring.recordError(error as Error, {
        operation: 'unsubscribe',
        userId: params.userId,
      });
      throw error;
    }
  }

  // Notification Management
  async send(
    notification: Omit<Notification, 'id' | 'createdAt' | 'status'>
  ): Promise<void> {
    try {
      const completeNotification: Notification = {
        ...notification,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        status: 'unread',
      };

      await this.persistNotification(completeNotification);
      await this.publishNotificationEvent(
        'notification_created',
        completeNotification
      );

      // Track notification
      await completeAnalytics.trackEvent({
        type: 'notification_sent',
        userId: notification.userId,
        data: {
          notificationId: completeNotification.id,
          type: notification.type,
          priority: notification.priority,
        },
        metadata: {
          service: 'realtime-notifications',
          environment: config.app.env,
          version: '1.0.0',
        },
      });
    } catch (error) {
      performanceMonitoring.recordError(error as Error, {
        operation: 'send',
        userId: notification.userId,
        type: notification.type,
      });
      throw error;
    }
  }

  async markAsRead(params: {
    userId: string;
    notificationId: string;
  }): Promise<void> {
    try {
      const key = this.datastore.key(['Notification', params.notificationId]);
      const [notification] = await this.datastore.get(key);

      if (!notification || notification.userId !== params.userId) {
        throw new Error('Notification not found');
      }

      notification.status = 'read';
      await this.datastore.save({
        key,
        data: notification,
      });

      // Track read status
      await completeAnalytics.trackEvent({
        type: 'notification_read',
        userId: params.userId,
        data: {
          notificationId: params.notificationId,
        },
        metadata: {
          service: 'realtime-notifications',
          environment: config.app.env,
          version: '1.0.0',
        },
      });
    } catch (error) {
      performanceMonitoring.recordError(error as Error, {
        operation: 'markAsRead',
        userId: params.userId,
        notificationId: params.notificationId,
      });
      throw error;
    }
  }

  // Preferences Management
  async updatePreferences(
    userId: string,
    preferences: Partial<NotificationPreferences>
  ): Promise<NotificationPreferences> {
    try {
      const key = this.datastore.key(['NotificationPreferences', userId]);
      const [existingPreferences] = await this.datastore.get(key);

      const updatedPreferences: NotificationPreferences = {
        userId,
        channels: {
          push: true,
          email: true,
          inApp: true,
          ...existingPreferences?.channels,
          ...preferences.channels,
        },
        ...existingPreferences,
        ...preferences,
      };

      await this.datastore.save({
        key,
        data: updatedPreferences,
      });

      return updatedPreferences;
    } catch (error) {
      performanceMonitoring.recordError(error as Error, {
        operation: 'updatePreferences',
        userId,
      });
      throw error;
    }
  }

  // Private Methods
  private async loadSubscriptions(): Promise<void> {
    const query = this.datastore.createQuery('NotificationSubscription');
    const [subscriptions] = await this.datastore.runQuery(query);

    subscriptions.forEach((subscription: NotificationSubscription) => {
      let userSubscriptions = this.subscriptionsByUser.get(subscription.userId);
      if (!userSubscriptions) {
        userSubscriptions = new Set();
        this.subscriptionsByUser.set(subscription.userId, userSubscriptions);
      }
      userSubscriptions.add(subscription);
    });
  }

  private async persistSubscription(
    subscription: NotificationSubscription
  ): Promise<void> {
    const key = this.datastore.key([
      'NotificationSubscription',
      subscription.endpoint,
    ]);
    await this.datastore.save({
      key,
      data: subscription,
    });
  }

  private async deleteSubscription(
    subscription: NotificationSubscription
  ): Promise<void> {
    const key = this.datastore.key([
      'NotificationSubscription',
      subscription.endpoint,
    ]);
    await this.datastore.delete(key);
  }

  private async persistNotification(notification: Notification): Promise<void> {
    const key = this.datastore.key(['Notification', notification.id]);
    await this.datastore.save({
      key,
      data: notification,
    });
  }

  private async getPendingNotifications(
    userId: string
  ): Promise<Notification[]> {
    const query = this.datastore
      .createQuery('Notification')
      .filter('userId', '=', userId)
      .filter('status', '=', 'unread')
      .order('createdAt', { descending: true });

    const [notifications] = await this.datastore.runQuery(query);
    return notifications;
  }

  private async publishNotificationEvent(
    eventType: string,
    data: Record<string, any>
  ): Promise<void> {
    const topic = this.pubsub.topic('notification-events');
    const messageData = {
      eventType,
      timestamp: new Date().toISOString(),
      ...data,
    };

    await topic.publish(Buffer.from(JSON.stringify(messageData)));
  }

  private setupNotificationProcessor(): void {
    const subscription = this.pubsub
      .topic('notification-events')
      .subscription('notification-processor');

    subscription.on('message', async message => {
      try {
        const event = JSON.parse(message.data.toString());

        if (event.eventType === 'notification_created') {
          const notification: Notification = event;

          // Send to WebSocket connections
          const userConnections = this.activeConnections.get(
            notification.userId
          );
          if (userConnections) {
            userConnections.forEach(ws => {
              ws.send(JSON.stringify(notification));
            });
          }

          // Send push notifications
          const userSubscriptions = this.subscriptionsByUser.get(
            notification.userId
          );
          if (userSubscriptions) {
            for (const subscription of userSubscriptions) {
              try {
                await this.webPush.sendNotification(
                  {
                    endpoint: subscription.endpoint,
                    keys: subscription.keys,
                  },
                  JSON.stringify({
                    title: notification.title,
                    body: notification.body,
                    data: notification.data,
                    actions: notification.actions,
                  })
                );
              } catch (error) {
                if (error.statusCode === 410) {
                  // Subscription has expired or is invalid
                  await this.unsubscribe({
                    userId: notification.userId,
                    endpoint: subscription.endpoint,
                  });
                } else {
                  performanceMonitoring.recordError(error as Error, {
                    operation: 'sendPushNotification',
                    userId: notification.userId,
                    endpoint: subscription.endpoint,
                  });
                }
              }
            }
          }
        }

        message.ack();
      } catch (error) {
        performanceMonitoring.recordError(error as Error, {
          operation: 'processNotificationEvent',
          messageId: message.id,
        });
        message.nack();
      }
    });
  }
}

export const realtimeNotifications = RealtimeNotificationsService.getInstance();
