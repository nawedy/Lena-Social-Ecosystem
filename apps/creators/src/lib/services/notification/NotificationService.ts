import { browser } from '$app/environment';
import { writable, derived } from 'svelte/store';
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
  private loading = writable(false);
  private error = writable<string | null>(null);
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
    try {
      this.loading.set(true);

      // Load initial data
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await Promise.all([
          this.loadNotifications(),
          this.loadPreferences()
        ]);
      }

      // Setup realtime subscription
      this.setupRealtimeSubscription();

      // Setup push notifications if supported
      if ('serviceWorker' in navigator && 'PushManager' in window) {
        await this.setupPushNotifications();
      }
    } catch (err) {
      console.error('Notification service initialization failed:', err);
      this.error.set(err.message);
    } finally {
      this.loading.set(false);
    }
  }

  private async loadNotifications() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    this.notifications.set(data);
    await this.calculateStats();
  }

  private async loadPreferences() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get user preferences or create default ones
    const { data, error } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    if (!data) {
      // Create default preferences
      const defaultPreferences: Omit<NotificationPreferences, 'userId'> = {
        channels: {
          inApp: true,
          email: true,
          push: true
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
          digest: 'daily',
          quietHours: {
            start: '22:00',
            end: '08:00'
          }
        }
      };

      const { data: newPrefs, error: createError } = await supabase
        .from('notification_preferences')
        .insert({
          user_id: user.id,
          ...defaultPreferences
        })
        .single();

      if (createError) throw createError;
      this.preferences.set(newPrefs);
    } else {
      this.preferences.set(data);
    }
  }

  private setupRealtimeSubscription() {
    const { data: { user } } = supabase.auth.getUser();
    if (!user) return;

    this.realtimeSubscription = supabase
      .channel('notification_updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`
      }, this.handleRealtimeUpdate.bind(this))
      .subscribe();
  }

  private async setupPushNotifications() {
    try {
      this.serviceWorkerRegistration = await navigator.serviceWorker.register('/notification-worker.js');
      const subscription = await this.serviceWorkerRegistration.pushManager.getSubscription();

      if (!subscription) {
        await this.subscribeToPushNotifications();
      }
    } catch (err) {
      console.error('Failed to setup push notifications:', err);
    }
  }

  private async subscribeToPushNotifications() {
    try {
      const { data: { vapidPublicKey } } = await supabase
        .from('push_notification_config')
        .select('vapid_public_key')
        .single();

      const subscription = await this.serviceWorkerRegistration!.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidPublicKey
      });

      // Save subscription to backend
      const { error } = await supabase
        .from('push_subscriptions')
        .insert({
          user_id: (await supabase.auth.getUser()).data.user!.id,
          endpoint: subscription.endpoint,
          auth: subscription.getKey('auth'),
          p256dh: subscription.getKey('p256dh')
        });

      if (error) throw error;
    } catch (err) {
      console.error('Failed to subscribe to push notifications:', err);
    }
  }

  private async handleRealtimeUpdate(payload: any) {
    // Handle different types of updates
    switch (payload.eventType) {
      case 'INSERT':
        this.notifications.update(notifications => [payload.new, ...notifications]);
        await this.calculateStats();
        await this.showNotification(payload.new);
        break;
      case 'UPDATE':
        this.notifications.update(notifications =>
          notifications.map(n => n.id === payload.new.id ? payload.new : n)
        );
        await this.calculateStats();
        break;
      case 'DELETE':
        this.notifications.update(notifications =>
          notifications.filter(n => n.id !== payload.old.id)
        );
        await this.calculateStats();
        break;
    }
  }

  private async calculateStats() {
    let notifications: Notification[] = [];
    this.notifications.subscribe(value => {
      notifications = value;
    })();

    const stats: NotificationStats = {
      total: notifications.length,
      unread: notifications.filter(n => !n.read).length,
      byType: notifications.reduce((acc, n) => {
        acc[n.type] = (acc[n.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      readRate: notifications.length > 0 
        ? notifications.filter(n => n.read).length / notifications.length 
        : 0,
      clickRate: 0 // Implement click tracking
    };

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
    const [startHour, startMinute] = preferences.schedule.quietHours.start.split(':').map(Number);
    const [endHour, endMinute] = preferences.schedule.quietHours.end.split(':').map(Number);
    const quietStart = new Date(now).setHours(startHour, startMinute);
    const quietEnd = new Date(now).setHours(endHour, endMinute);

    const isQuietHours = now >= new Date(quietStart) && now <= new Date(quietEnd);
    if (isQuietHours) return;

    // Check notification type preference
    if (!preferences.types[notification.type]) return;

    // Show browser notification if enabled
    if (preferences.channels.push && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.body,
        icon: notification.icon,
        tag: notification.id
      });
    }

    // Send email notification if enabled
    if (preferences.channels.email) {
      await this.sendEmailNotification(notification);
    }
  }

  private async sendEmailNotification(notification: Notification) {
    try {
      const { error } = await supabase.functions.invoke('send-notification-email', {
        body: { notification }
      });

      if (error) throw error;
    } catch (err) {
      console.error('Failed to send email notification:', err);
    }
  }

  async createNotification(notification: Omit<Notification, 'id' | 'createdAt'>): Promise<Notification> {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .insert({
          ...notification,
          created_at: new Date().toISOString()
        })
        .single();

      if (error) throw error;
      return data;
    } catch (err) {
      console.error('Failed to create notification:', err);
      this.error.set(err.message);
      throw err;
    }
  }

  async markAsRead(notificationId: string | string[]): Promise<void> {
    try {
      const ids = Array.isArray(notificationId) ? notificationId : [notificationId];
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .in('id', ids);

      if (error) throw error;
    } catch (err) {
      console.error('Failed to mark notifications as read:', err);
      this.error.set(err.message);
      throw err;
    }
  }

  async deleteNotification(notificationId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      if (error) throw error;
    } catch (err) {
      console.error('Failed to delete notification:', err);
      this.error.set(err.message);
      throw err;
    }
  }

  async updatePreferences(preferences: Partial<NotificationPreferences>): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('notification_preferences')
        .update(preferences)
        .eq('user_id', user.id);

      if (error) throw error;
      await this.loadPreferences();
    } catch (err) {
      console.error('Failed to update preferences:', err);
      this.error.set(err.message);
      throw err;
    }
  }

  getNotifications() {
    let result: Notification[] = [];
    this.notifications.subscribe(value => {
      result = value;
    })();
    return result;
  }

  getPreferences() {
    let result: NotificationPreferences | null = null;
    this.preferences.subscribe(value => {
      result = value;
    })();
    return result;
  }

  getStats() {
    let result: NotificationStats | null = null;
    this.stats.subscribe(value => {
      result = value;
    })();
    return result;
  }

  cleanup() {
    if (this.realtimeSubscription) {
      this.realtimeSubscription.unsubscribe();
      this.realtimeSubscription = null;
    }

    this.notifications.set([]);
    this.preferences.set(null);
    this.stats.set(null);
    this.error.set(null);
  }
}

export const notificationService = NotificationService.getInstance(); 