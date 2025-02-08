import { webPush } from '@core/services/notification/web-push';
import type { PushSubscription } from '@core/services/notification/types';

export function usePushNotifications() {
  const isSupported = 'serviceWorker' in navigator && 'PushManager' in window;

  async function subscribe(): Promise<PushSubscription | null> {
    if (!isSupported) {
      console.warn('Push notifications are not supported');
      return null;
    }

    try {
      // Request notification permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.warn('Notification permission denied');
        return null;
      }

      // Register service worker
      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      // Get push subscription
      const existingSubscription = await registration.pushManager.getSubscription();
      if (existingSubscription) {
        return existingSubscription;
      }

      // Create new subscription
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: webPush.getPublicKey()
      });

      return subscription;
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error);
      return null;
    }
  }

  async function unsubscribe(): Promise<boolean> {
    if (!isSupported) {
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();
        return true;
      }

      return false;
    } catch (error) {
      console.error('Failed to unsubscribe from push notifications:', error);
      return false;
    }
  }

  async function getSubscription(): Promise<PushSubscription | null> {
    if (!isSupported) {
      return null;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      return await registration.pushManager.getSubscription();
    } catch (error) {
      console.error('Failed to get push subscription:', error);
      return null;
    }
  }

  return {
    isSupported,
    subscribe,
    unsubscribe,
    getSubscription
  };
} 