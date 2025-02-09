import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import { supabase } from '$lib/supabaseClient';

interface Notification {
  id: string;
  userId: string;
  type: 'mention' | 'reply' | 'reaction' | 'moderation' | 'achievement' | 'system';
  title: string;
  body: string;
  link?: string;
  icon?: string;
  metadata?: Record<string, any>;
  read: boolean;
  createdAt: string;
  expiresAt?: string;
}

interface NotificationPreferences {
  userId: string;
  channels: {
    inApp: boolean;
    email: boolean;
    push: boolean;
  };
  types: {
    mention: boolean;
    reply: boolean;
    reaction: boolean;
    moderation: boolean;
    achievement: boolean;
    system: boolean;
  };
  schedule: {
    digest: 'never' | 'daily' | 'weekly';
    quietHours: {
      start: string;
      end: string;
    };
  };
}

interface NotificationStats {
  total: number;
  unread: number;
  byType: Record<string, number>;
  readRate: number;
  clickRate: number;
}

export class NotificationService {
  private static instance: NotificationService;
  private notifications = writable<Notification[]>([]);
  private preferences = writable<NotificationPreferences | null>(null);
  private stats = writable<NotificationStats | null>(null);
  private realtimeSubscription: any = null;
  private serviceWorkerRegistration: ServiceWorkerRegistration | null = null;

  private constructor() {
    if (browser) {
      this.init();
    }
  }

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  private async init() {
    await Promise.all([
      this.loadNotifications(),
      this.loadPreferences(),
      this.calculateStats(),
      this.setupPushNotifications(),
      this.setupRealtimeSubscription()
    ]);
  }

  private async loadNotifications() {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      this.notifications.set(data || []);
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  }

  private async loadPreferences() {
    try {
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        this.preferences.set(data);
      } else {
        // Set default preferences
        const defaultPreferences: NotificationPreferences = {
          userId: 'current-user-id', // Replace with actual user ID
          channels: {
            inApp: true,
            email: true,
            push: false
          },
          types: {
            mention: true,
            reply: true,
            reaction: true,
            moderation: true,
            achievement: true,
            system: true
          },
          schedule: {
            digest: 'never',
            quietHours: {
              start: '22:00',
              end: '08:00'
            }
          }
        };

        await this.updatePreferences(defaultPreferences);
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
    }
  }

  private setupRealtimeSubscription() {
    this.realtimeSubscription = supabase
      .channel('notification_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notifications'
      }, payload => {
        this.handleRealtimeUpdate(payload);
      })
      .subscribe();
  }

  private async setupPushNotifications() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return;
    }

    try {
      this.serviceWorkerRegistration = await navigator.serviceWorker.register(
        '/notification-worker.js'
      );

      const subscription = await this.serviceWorkerRegistration.pushManager.getSubscription();
      if (!subscription) {
        // Request push notification permission if not subscribed
        const result = await Notification.requestPermission();
        if (result === 'granted') {
          await this.subscribeToPushNotifications();
        }
      }
    } catch (error) {
      console.error('Error setting up push notifications:', error);
    }
  }

  private async subscribeToPushNotifications() {
    if (!this.serviceWorkerRegistration) return;

    try {
      const subscription = await this.serviceWorkerRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: 'YOUR_VAPID_PUBLIC_KEY' // Replace with actual VAPID key
      });

      // Send subscription to server
      const { error } = await supabase
        .from('push_subscriptions')
        .upsert([{
          user_id: 'current-user-id', // Replace with actual user ID
          endpoint: subscription.endpoint,
          auth: subscription.getKey('auth'),
          p256dh: subscription.getKey('p256dh')
        }]);

      if (error) throw error;
    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
    }
  }

  private async handleRealtimeUpdate(payload: any) {
    // Update notifications store
    this.notifications.update(notifications => {
      switch (payload.eventType) {
        case 'INSERT':
          this.showNotification(payload.new);
          return [payload.new, ...notifications];
        case 'UPDATE':
          return notifications.map(notification =>
            notification.id === payload.new.id ? payload.new : notification
          );
        case 'DELETE':
          return notifications.filter(notification =>
            notification.id !== payload.old.id
          );
        default:
          return notifications;
      }
    });

    // Recalculate stats
    await this.calculateStats();
  }

  private async calculateStats() {
    let notifications: Notification[] = [];
    this.notifications.subscribe(value => {
      notifications = value;
    })();

    const stats: NotificationStats = {
      total: notifications.length,
      unread: notifications.filter(n => !n.read).length,
      byType: {},
      readRate: 0,
      clickRate: 0
    };

    // Calculate type distribution
    notifications.forEach(notification => {
      stats.byType[notification.type] = (stats.byType[notification.type] || 0) + 1;
    });

    // Calculate rates
    if (notifications.length > 0) {
      stats.readRate = notifications.filter(n => n.read).length / notifications.length;
      stats.clickRate = notifications.filter(n => n.metadata?.clicked).length / notifications.length;
    }

    this.stats.set(stats);
  }

  private async showNotification(notification: Notification) {
    let preferences: NotificationPreferences | null = null;
    this.preferences.subscribe(value => {
      preferences = value;
    })();

    if (!preferences) return;

    // Check quiet hours
    const now = new Date();
    const currentTime = now.getHours() * 100 + now.getMinutes();
    const startTime = parseInt(preferences.schedule.quietHours.start.replace(':', ''));
    const endTime = parseInt(preferences.schedule.quietHours.end.replace(':', ''));
    const isQuietHours = currentTime >= startTime || currentTime <= endTime;

    // Check if notification type is enabled
    if (!preferences.types[notification.type]) return;

    // Show in-app notification
    if (preferences.channels.inApp) {
      // Handled by UI components
    }

    // Send push notification
    if (preferences.channels.push && !isQuietHours) {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(notification.title, {
          body: notification.body,
          icon: notification.icon,
          tag: notification.id
        });
      }
    }

    // Send email notification
    if (preferences.channels.email && !isQuietHours) {
      await this.sendEmailNotification(notification);
    }
  }

  private async sendEmailNotification(notification: Notification) {
    try {
      const { error } = await supabase.functions.invoke('send-notification-email', {
        body: {
          notification,
          userId: notification.userId
        }
      });

      if (error) throw error;
    } catch (error) {
      console.error('Error sending email notification:', error);
    }
  }

  // Public methods
  async createNotification(notification: Omit<Notification, 'id' | 'createdAt'>): Promise<Notification> {
    const { data, error } = await supabase
      .from('notifications')
      .insert([{
        ...notification,
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async markAsRead(notificationId: string | string[]): Promise<void> {
    const ids = Array.isArray(notificationId) ? notificationId : [notificationId];

    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .in('id', ids);

    if (error) throw error;
  }

  async deleteNotification(notificationId: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId);

    if (error) throw error;
  }

  async updatePreferences(preferences: Partial<NotificationPreferences>): Promise<void> {
    const { error } = await supabase
      .from('notification_preferences')
      .upsert([{
        ...preferences,
        updated_at: new Date().toISOString()
      }]);

    if (error) throw error;

    // Update local preferences
    this.preferences.update(current => ({
      ...current,
      ...preferences
    }));
  }

  getNotifications() {
    return this.notifications;
  }

  getPreferences() {
    return this.preferences;
  }

  getStats() {
    return this.stats;
  }

  cleanup() {
    if (this.realtimeSubscription) {
      this.realtimeSubscription.unsubscribe();
    }
  }
}

// Create service instance
export const notificationService = NotificationService.getInstance(); 