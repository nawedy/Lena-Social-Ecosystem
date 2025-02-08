import { supabase } from '$lib/supabaseClient';
import { writable } from 'svelte/store';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface NotificationConfig {
  webPush: {
    enabled: boolean;
    vapidPublicKey: string;
    vapidPrivateKey: string;
  };
  email: {
    enabled: boolean;
    provider: 'sendgrid' | 'postmark' | 'ses';
    fromAddress: string;
  };
  inApp: {
    enabled: boolean;
    maxUnread: number;
    batchInterval: number;
  };
  quietHours: {
    enabled: boolean;
    start: string; // HH:mm format
    end: string; // HH:mm format
    timezone: string;
  };
}

interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  read: boolean;
  readAt?: Date;
  createdAt: Date;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  channel: 'inApp' | 'email' | 'webPush' | 'all';
  status: 'pending' | 'sent' | 'failed' | 'delivered' | 'read';
  error?: string;
}

interface NotificationPreferences {
  userId: string;
  channels: {
    inApp: boolean;
    email: boolean;
    webPush: boolean;
  };
  types: Record<string, {
    enabled: boolean;
    channel: 'inApp' | 'email' | 'webPush' | 'all';
  }>;
  quietHours: {
    enabled: boolean;
    start: string;
    end: string;
    timezone: string;
  };
}

// Create notification stores
const createNotificationStore = () => {
  const { subscribe, set, update } = writable<{
    notifications: Notification[];
    unreadCount: number;
    loading: boolean;
    error: string | null;
  }>({
    notifications: [],
    unreadCount: 0,
    loading: false,
    error: null
  });

  return {
    subscribe,
    set,
    update,
    markAsRead: async (notificationId: string) => {
      try {
        const { error } = await supabase
          .from('notifications')
          .update({
            read: true,
            readAt: new Date().toISOString()
          })
          .eq('id', notificationId);

        if (error) throw error;

        update(state => ({
          ...state,
          notifications: state.notifications.map(n =>
            n.id === notificationId ? { ...n, read: true, readAt: new Date() } : n
          ),
          unreadCount: Math.max(0, state.unreadCount - 1)
        }));
      } catch (error) {
        console.error('Error marking notification as read:', error);
      }
    },
    clear: () => {
      set({
        notifications: [],
        unreadCount: 0,
        loading: false,
        error: null
      });
    }
  };
};

export const notificationStore = createNotificationStore();

class NotificationService {
  private config: NotificationConfig = {
    webPush: {
      enabled: true,
      vapidPublicKey: import.meta.env.VITE_VAPID_PUBLIC_KEY,
      vapidPrivateKey: import.meta.env.VITE_VAPID_PRIVATE_KEY
    },
    email: {
      enabled: true,
      provider: 'sendgrid',
      fromAddress: 'notifications@lena.app'
    },
    inApp: {
      enabled: true,
      maxUnread: 100,
      batchInterval: 60000 // 1 minute
    },
    quietHours: {
      enabled: true,
      start: '22:00',
      end: '08:00',
      timezone: 'local'
    }
  };

  private channel: RealtimeChannel | null = null;
  private pushSubscription: PushSubscription | null = null;

  constructor() {
    this.initializeNotifications();
  }

  private async initializeNotifications() {
    try {
      notificationStore.update(state => ({ ...state, loading: true }));

      // Subscribe to real-time notifications
      this.subscribeToNotifications();

      // Load initial notifications
      await this.loadNotifications();

      // Request push notification permission
      if (this.config.webPush.enabled) {
        await this.initializePushNotifications();
      }
    } catch (error) {
      console.error('Error initializing notifications:', error);
      notificationStore.update(state => ({
        ...state,
        error: 'Failed to initialize notifications'
      }));
    } finally {
      notificationStore.update(state => ({ ...state, loading: false }));
    }
  }

  private async loadNotifications() {
    const { data: notifications, error } = await supabase
      .from('notifications')
      .select('*')
      .order('createdAt', { ascending: false })
      .limit(50);

    if (error) throw error;

    const unreadCount = notifications.filter(n => !n.read).length;

    notificationStore.update(state => ({
      ...state,
      notifications,
      unreadCount
    }));
  }

  private subscribeToNotifications() {
    const { data: { user } } = supabase.auth.getUser();
    if (!user) return;

    this.channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        async (payload) => {
          await this.handleNotificationChange(payload);
        }
      )
      .subscribe();
  }

  private async handleNotificationChange(payload: any) {
    notificationStore.update(state => {
      const notifications = [...state.notifications];
      let unreadCount = state.unreadCount;

      switch (payload.eventType) {
        case 'INSERT':
          notifications.unshift(payload.new);
          if (!payload.new.read) unreadCount++;
          this.showNotification(payload.new);
          break;
        case 'UPDATE':
          const index = notifications.findIndex(n => n.id === payload.new.id);
          if (index !== -1) {
            if (notifications[index].read !== payload.new.read) {
              unreadCount += payload.new.read ? -1 : 1;
            }
            notifications[index] = payload.new;
          }
          break;
        case 'DELETE':
          const deleteIndex = notifications.findIndex(n => n.id === payload.old.id);
          if (deleteIndex !== -1) {
            if (!notifications[deleteIndex].read) unreadCount--;
            notifications.splice(deleteIndex, 1);
          }
          break;
      }

      return {
        ...state,
        notifications,
        unreadCount: Math.max(0, unreadCount)
      };
    });
  }

  private async initializePushNotifications() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return;
    }

    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      const permission = await Notification.requestPermission();

      if (permission === 'granted') {
        this.pushSubscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: this.config.webPush.vapidPublicKey
        });

        await this.savePushSubscription();
      }
    } catch (error) {
      console.error('Error initializing push notifications:', error);
    }
  }

  private async savePushSubscription() {
    if (!this.pushSubscription) return;

    const { data: { user } } = supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('push_subscriptions')
      .upsert({
        user_id: user.id,
        subscription: this.pushSubscription.toJSON(),
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.error('Error saving push subscription:', error);
    }
  }

  private showNotification(notification: Notification) {
    if (!('Notification' in window)) return;

    if (Notification.permission === 'granted' && !this.isQuietHours()) {
      new Notification(notification.title, {
        body: notification.body,
        icon: '/notification-icon.png',
        data: notification.data
      });
    }
  }

  private isQuietHours(): boolean {
    if (!this.config.quietHours.enabled) return false;

    const now = new Date();
    const [startHour, startMinute] = this.config.quietHours.start.split(':').map(Number);
    const [endHour, endMinute] = this.config.quietHours.end.split(':').map(Number);

    const start = new Date(now);
    start.setHours(startHour, startMinute, 0);

    const end = new Date(now);
    end.setHours(endHour, endMinute, 0);

    if (end < start) {
      end.setDate(end.getDate() + 1);
    }

    return now >= start && now <= end;
  }

  async getUserPreferences(userId: string): Promise<NotificationPreferences> {
    const { data, error } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) throw error;
    return data;
  }

  async updateUserPreferences(
    userId: string,
    preferences: Partial<NotificationPreferences>
  ): Promise<void> {
    const { error } = await supabase
      .from('notification_preferences')
      .upsert({
        user_id: userId,
        ...preferences,
        updated_at: new Date().toISOString()
      });

    if (error) throw error;
  }

  async send(
    userId: string,
    notification: Omit<Notification, 'id' | 'userId' | 'read' | 'readAt' | 'createdAt' | 'status'>
  ): Promise<void> {
    try {
      const preferences = await this.getUserPreferences(userId);
      const notificationType = preferences.types[notification.type];

      if (!notificationType?.enabled) return;

      const { error } = await supabase
        .from('notifications')
        .insert({
          user_id: userId,
          ...notification,
          read: false,
          created_at: new Date().toISOString(),
          status: 'pending'
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error sending notification:', error);
      throw error;
    }
  }

  async markAllAsRead(userId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({
          read: true,
          readAt: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('read', false);

      if (error) throw error;

      notificationStore.update(state => ({
        ...state,
        notifications: state.notifications.map(n => ({ ...n, read: true, readAt: new Date() })),
        unreadCount: 0
      }));
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      throw error;
    }
  }

  async delete(notificationId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      if (error) throw error;

      notificationStore.update(state => ({
        ...state,
        notifications: state.notifications.filter(n => n.id !== notificationId),
        unreadCount: state.notifications.find(n => n.id === notificationId && !n.read)
          ? state.unreadCount - 1
          : state.unreadCount
      }));
    } catch (error) {
      console.error('Error deleting notification:', error);
      throw error;
    }
  }

  async clearAll(userId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', userId);

      if (error) throw error;

      notificationStore.update(state => ({
        ...state,
        notifications: [],
        unreadCount: 0
      }));
    } catch (error) {
      console.error('Error clearing notifications:', error);
      throw error;
    }
  }

  destroy() {
    if (this.channel) {
      this.channel.unsubscribe();
    }
    notificationStore.clear();
  }
}

export const notificationService = new NotificationService(); 