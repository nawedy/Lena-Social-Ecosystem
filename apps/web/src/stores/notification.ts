import { writable } from 'svelte/store';
import type { NotificationConfig } from '@core/services/notification/types';

interface NotificationStore {
  notifications: NotificationConfig[];
  position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

const createNotificationStore = () => {
  const { subscribe, update } = writable<NotificationStore>({
    notifications: [],
    position: 'top-right'
  });

  return {
    subscribe,

    /**
     * Add a new notification
     */
    add: (notification: NotificationConfig) => {
      update(store => ({
        ...store,
        notifications: [...store.notifications, notification]
      }));
    },

    /**
     * Remove a notification by ID
     */
    remove: (id: string) => {
      update(store => ({
        ...store,
        notifications: store.notifications.filter(n => n.id !== id)
      }));
    },

    /**
     * Clear all notifications
     */
    clear: () => {
      update(store => ({
        ...store,
        notifications: []
      }));
    },

    /**
     * Update notification position
     */
    setPosition: (position: NotificationStore['position']) => {
      update(store => ({
        ...store,
        position
      }));
    }
  };
};

export const notificationStore = createNotificationStore(); 