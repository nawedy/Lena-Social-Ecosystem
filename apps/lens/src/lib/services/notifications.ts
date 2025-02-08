import { api } from './api';
import type { Notification, PaginatedResponse, ApiResponse } from '$lib/types';
import { writable, derived } from 'svelte/store';
import { supabase } from '$lib/supabase';

interface NotificationsState {
  notifications: Record<string, Notification>;
  unreadCount: number;
  loading: boolean;
  error: string | null;
}

function createNotificationsStore() {
  const { subscribe, set, update } = writable<NotificationsState>({
    notifications: {},
    unreadCount: 0,
    loading: false,
    error: null
  });

  let realtimeSubscription: any = null;

  return {
    subscribe,
    set,
    update,

    /**
     * Initialize notifications and subscribe to real-time updates
     */
    initialize: async () => {
      update(state => ({ ...state, loading: true, error: null }));

      try {
        // Get initial notifications
        const { data: notifications } = await api.get<{ notifications: Notification[]; unreadCount: number }>('/notifications/init');

        if (notifications) {
          update(state => ({
            ...state,
            notifications: Object.fromEntries(notifications.notifications.map(n => [n.id, n])),
            unreadCount: notifications.unreadCount
          }));
        }

        // Subscribe to real-time notifications
        realtimeSubscription = supabase
          .channel('notifications')
          .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `recipient_id=eq.${supabase.auth.user()?.id}`
          }, payload => {
            const notification = payload.new as Notification;
            update(state => ({
              ...state,
              notifications: {
                ...state.notifications,
                [notification.id]: notification
              },
              unreadCount: state.unreadCount + 1
            }));
          })
          .subscribe();

        return { error: null };
      } catch (error) {
        console.error('Failed to initialize notifications:', error);
        update(state => ({ ...state, error: error.message }));
        return { error };
      } finally {
        update(state => ({ ...state, loading: false }));
      }
    },

    /**
     * Get notifications with pagination
     */
    get: async (params?: {
      page?: number;
      perPage?: number;
    }): Promise<PaginatedResponse<Notification>> => {
      update(state => ({ ...state, loading: true, error: null }));

      try {
        const response = await api.getPaginated<Notification>('/notifications', params);

        update(state => ({
          ...state,
          notifications: {
            ...state.notifications,
            ...Object.fromEntries(response.items.map(notification => [notification.id, notification]))
          }
        }));

        return response;
      } catch (error) {
        console.error('Failed to get notifications:', error);
        update(state => ({ ...state, error: error.message }));
        throw error;
      } finally {
        update(state => ({ ...state, loading: false }));
      }
    },

    /**
     * Mark a notification as read
     */
    markAsRead: async (id: string): Promise<ApiResponse<void>> => {
      try {
        const { error } = await api.put<void>(`/notifications/${id}/read`);
        if (error) throw error;

        update(state => ({
          ...state,
          notifications: {
            ...state.notifications,
            [id]: {
              ...state.notifications[id],
              read: true
            }
          },
          unreadCount: Math.max(0, state.unreadCount - 1)
        }));

        return { error: null };
      } catch (error) {
        console.error('Failed to mark notification as read:', error);
        return { error };
      }
    },

    /**
     * Mark all notifications as read
     */
    markAllAsRead: async (): Promise<ApiResponse<void>> => {
      try {
        const { error } = await api.put<void>('/notifications/read-all');
        if (error) throw error;

        update(state => ({
          ...state,
          notifications: Object.fromEntries(
            Object.entries(state.notifications).map(([id, notification]) => [
              id,
              { ...notification, read: true }
            ])
          ),
          unreadCount: 0
        }));

        return { error: null };
      } catch (error) {
        console.error('Failed to mark all notifications as read:', error);
        return { error };
      }
    },

    /**
     * Delete a notification
     */
    delete: async (id: string): Promise<ApiResponse<void>> => {
      try {
        const { error } = await api.delete<void>(`/notifications/${id}`);
        if (error) throw error;

        update(state => {
          const { [id]: deletedNotification, ...remainingNotifications } = state.notifications;
          const unreadCount = deletedNotification?.read ? state.unreadCount : Math.max(0, state.unreadCount - 1);

          return {
            ...state,
            notifications: remainingNotifications,
            unreadCount
          };
        });

        return { error: null };
      } catch (error) {
        console.error('Failed to delete notification:', error);
        return { error };
      }
    },

    /**
     * Clear all notifications
     */
    clearAll: async (): Promise<ApiResponse<void>> => {
      try {
        const { error } = await api.delete<void>('/notifications');
        if (error) throw error;

        update(state => ({
          ...state,
          notifications: {},
          unreadCount: 0
        }));

        return { error: null };
      } catch (error) {
        console.error('Failed to clear notifications:', error);
        return { error };
      }
    },

    /**
     * Update notification preferences
     */
    updatePreferences: async (preferences: {
      pushEnabled?: boolean;
      emailEnabled?: boolean;
      types?: string[];
    }): Promise<ApiResponse<void>> => {
      try {
        const { error } = await api.put<void>('/notifications/preferences', preferences);
        return { error };
      } catch (error) {
        console.error('Failed to update notification preferences:', error);
        return { error };
      }
    },

    /**
     * Clean up subscriptions
     */
    cleanup: () => {
      if (realtimeSubscription) {
        realtimeSubscription.unsubscribe();
        realtimeSubscription = null;
      }
    },

    /**
     * Clear store state
     */
    clear: () => {
      set({
        notifications: {},
        unreadCount: 0,
        loading: false,
        error: null
      });
    }
  };
}

// Create notifications store instance
export const notifications = createNotificationsStore();

// Derived stores
export const allNotifications = derived(notifications, $notifications => 
  Object.values($notifications.notifications).sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
);
export const unreadNotifications = derived(notifications, $notifications => 
  Object.values($notifications.notifications).filter(n => !n.read)
);
export const unreadCount = derived(notifications, $notifications => $notifications.unreadCount);
export const isLoading = derived(notifications, $notifications => $notifications.loading);
export const error = derived(notifications, $notifications => $notifications.error); 