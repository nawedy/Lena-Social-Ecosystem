import { AnalyticsService } from './AnalyticsService';
import { RBACService } from './RBACService';

interface NotificationChannel {
  type: 'email' | 'slack' | 'webhook' | 'push' | 'sms' | 'in_app';
  config: {
    enabled: boolean;
    endpoint?: string;
    apiKey?: string;
    template?: string;
    priority?: 'low' | 'normal' | 'high' | 'urgent';
  };
}

interface NotificationTemplate {
  id: string;
  name: string;
  type: 'email' | 'slack' | 'webhook' | 'push' | 'sms' | 'in_app';
  subject?: string;
  content: string;
  variables: string[];
  locale: string;
  version: number;
}

interface NotificationRule {
  id: string;
  name: string;
  condition: {
    type: 'metric' | 'event' | 'schedule' | 'threshold';
    metric?: string;
    event?: string;
    schedule?: string;
    threshold?: number;
    operator?: '>' | '<' | '==' | '>=' | '<=';
  };
  channels: string[];
  template: string;
  recipients: {
    users?: string[];
    roles?: string[];
    teams?: string[];
  };
  throttle?: {
    limit: number;
    window: number;
  };
}

interface Notification {
  id: string;
  type: 'email' | 'slack' | 'webhook' | 'push' | 'sms' | 'in_app';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  subject?: string;
  content: string;
  recipients: string[];
  metadata: {
    rule?: string;
    trigger?: string;
    account?: string;
    data?: any; // TODO: Define a more specific type if possible
  };
  status: 'pending' | 'sent' | 'failed' | 'delivered' | 'read';
  createdAt: Date;
  sentAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;
}

export class NotificationService {
  private static instance: NotificationService;
  private channels: Map<string, NotificationChannel>;
  private templates: Map<string, NotificationTemplate>;
  private rules: Map<string, NotificationRule>;
  private notifications: Map<string, Notification>;
  private rbac: RBACService;
  private analytics: AnalyticsService;

  private constructor() {
    this.channels = new Map();
    this.templates = new Map();
    this.rules = new Map();
    this.notifications = new Map();
    this.rbac = RBACService.getInstance();
    this.analytics = AnalyticsService.getInstance();
    this.initializeDefaultChannels();
  }

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  private initializeDefaultChannels() {
    // Initialize email channel
    this.channels.set('email', {
      type: 'email',
      config: {
        enabled: true,
        template: 'default_email',
        priority: 'normal',
      },
    });

    // Initialize push notifications
    this.channels.set('push', {
      type: 'push',
      config: {
        enabled: true,
        template: 'default_push',
        priority: 'high',
      },
    });

    // Initialize in-app notifications
    this.channels.set('in_app', {
      type: 'in_app',
      config: {
        enabled: true,
        template: 'default_in_app',
        priority: 'normal',
      },
    });
  }

  public async createNotificationRule(
    rule: Omit<NotificationRule, 'id'>
  ): Promise<string> {
    const ruleId = `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newRule: NotificationRule = {
      id: ruleId,
      ...rule,
    };
    this.rules.set(ruleId, newRule);
    return ruleId;
  }

  public async createTemplate(
    template: Omit<NotificationTemplate, 'id' | 'version'>
  ): Promise<string> {
    const templateId = `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newTemplate: NotificationTemplate = {
      id: templateId,
      version: 1,
      ...template,
    };
    this.templates.set(templateId, newTemplate);
    return templateId;
  }

  public async sendNotification(
    type: Notification['type'],
    subject: string,
    content: string,
    recipients: string[],
    metadata: Notification['metadata'] = {}
  ): Promise<string> {
    const notificationId = `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const notification: Notification = {
      id: notificationId,
      type,
      priority: 'normal',
      subject,
      content,
      recipients,
      metadata,
      status: 'pending',
      createdAt: new Date(),
    };

    try {
      // Store notification
      this.notifications.set(notificationId, notification);

      // Send through appropriate channel
      await this.sendThroughChannel(notification);

      // Update status
      notification.status = 'sent';
      notification.sentAt = new Date();
      this.notifications.set(notificationId, notification);

      // Track analytics
      await this.analytics.trackEvent('notification_sent', {
        notificationId,
        type,
        recipients: recipients.length,
        metadata,
      });

      return notificationId;
    } catch (error) {
      console.error('Error sending notification:', error);
      notification.status = 'failed';
      this.notifications.set(notificationId, notification);
      throw error;
    }
  }

  public async sendBulkNotifications(
    notifications: Array<{
      type: Notification['type'];
      subject: string;
      content: string;
      recipients: string[];
      metadata?: Notification['metadata'];
    }>
  ): Promise<string[]> {
    const notificationIds: string[] = [];

    // Group notifications by type for batch processing
    const groupedNotifications = notifications.reduce(
      (acc, notification) => {
        if (!acc[notification.type]) {
          acc[notification.type] = [];
        }
        acc[notification.type].push(notification);
        return acc;
      },
      {} as Record<Notification['type'], typeof notifications>
    );

    // Process each group in parallel
    await Promise.all(
      Object.entries(groupedNotifications).map(
        async ([type, notifications]) => {
          const ids = await this.processBulkNotifications(
            type as Notification['type'],
            notifications
          );
          notificationIds.push(...ids);
        }
      )
    );

    return notificationIds;
  }

  public async checkNotificationStatus(
    notificationId: string
  ): Promise<Notification['status']> {
    const notification = this.notifications.get(notificationId);
    if (!notification) {
      throw new Error(`Notification ${notificationId} not found`);
    }
    return notification.status;
  }

  public async markNotificationAsRead(
    notificationId: string,
    userId: string
  ): Promise<void> {
    const notification = this.notifications.get(notificationId);
    if (!notification) {
      throw new Error(`Notification ${notificationId} not found`);
    }

    if (!notification.recipients.includes(userId)) {
      throw new Error('User is not a recipient of this notification');
    }

    notification.status = 'read';
    notification.readAt = new Date();
    this.notifications.set(notificationId, notification);

    // Track analytics
    await this.analytics.trackEvent('notification_read', {
      notificationId,
      userId,
      type: notification.type,
    });
  }

  public async getUnreadNotifications(userId: string): Promise<Notification[]> {
    const unread: Notification[] = [];
    for (const notification of this.notifications.values()) {
      if (
        notification.recipients.includes(userId) &&
        notification.status !== 'read'
      ) {
        unread.push(notification);
      }
    }
    return unread.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  public async subscribeToNotifications(
    _userId: string,
    _channels: Notification['type'][]
  ): Promise<void> {
    // Implementation for notification subscription
  }

  public async unsubscribeFromNotifications(
    _userId: string,
    _channels: Notification['type'][]
  ): Promise<void> {
    // Implementation for notification unsubscription
  }

  private async sendThroughChannel(notification: Notification): Promise<void> {
    const channel = this.channels.get(notification.type);
    if (!channel || !channel.config.enabled) {
      throw new Error(`Channel ${notification.type} not found or disabled`);
    }

    switch (notification.type) {
      case 'email':
        await this.sendEmail(notification);
        break;
      case 'push':
        await this.sendPushNotification(notification);
        break;
      case 'slack':
        await this.sendSlackNotification(notification);
        break;
      case 'webhook':
        await this.sendWebhookNotification(notification);
        break;
      case 'sms':
        await this.sendSMSNotification(notification);
        break;
      case 'in_app':
        await this.sendInAppNotification(notification);
        break;
      default:
        throw new Error(`Unsupported notification type: ${notification.type}`);
    }
  }

  private async processBulkNotifications(
    _type: Notification['type'],
    _notifications: Array<{
      subject: string;
      content: string;
      recipients: string[];
      metadata?: Notification['metadata'];
    }>
  ): Promise<string[]> {
    // Implementation for bulk notification processing
    return [];
  }

  private async sendEmail(_notification: Notification): Promise<void> {
    // Implementation for email sending
  }

  private async sendPushNotification(
    _notification: Notification
  ): Promise<void> {
    // Implementation for push notification
  }

  private async sendSlackNotification(
    _notification: Notification
  ): Promise<void> {
    // Implementation for Slack notification
  }

  private async sendWebhookNotification(
    _notification: Notification
  ): Promise<void> {
    // Implementation for webhook notification
  }

  private async sendSMSNotification(
    _notification: Notification
  ): Promise<void> {
    // Implementation for SMS notification
  }

  private async sendInAppNotification(
    _notification: Notification
  ): Promise<void> {
    // Implementation for in-app notification
  }
}
