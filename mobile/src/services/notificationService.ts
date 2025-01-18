import messaging from '@react-native-firebase/messaging';
import PushNotification from 'react-native-push-notification';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { store } from '../store';
import { API_URL } from '../config';
import { logger } from '../../../src/utils/logger';

interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, any>;
}

class NotificationService {
  private static instance: NotificationService;
  private fcmToken: string | null = null;
  private readonly NOTIFICATION_SETTINGS_KEY = '@notification_settings';

  private constructor() {
    this.initialize();
  }

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  private async initialize() {
    try {
      // Configure Firebase Messaging
      await this.configureFCM();

      // Configure local notifications
      this.configureLocalNotifications();

      // Get initial notification settings
      await this.loadNotificationSettings();
    } catch (error) {
      console.error('Error initializing notification service:', error);
    }
  }

  private async configureFCM() {
    try {
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (enabled) {
        // Get FCM token
        const token = await messaging().getToken();
        this.fcmToken = token;
        await this.registerDeviceToken(token);

        // Listen for token refresh
        messaging().onTokenRefresh(async token => {
          this.fcmToken = token;
          await this.registerDeviceToken(token);
        });

        // Handle incoming messages
        messaging().onMessage(async remoteMessage => {
          this.handleFCMMessage(remoteMessage);
        });

        // Handle background messages
        messaging().setBackgroundMessageHandler(async remoteMessage => {
          this.handleFCMMessage(remoteMessage);
        });
      }
    } catch (error) {
      console.error('Error configuring FCM:', error);
    }
  }

  private configureLocalNotifications() {
    PushNotification.configure({
      onRegister: function (token) {
        logger.info('Local notification token:', token);
      },
      onNotification: function (notification) {
        logger.info('Local notification:', notification);
      },
      permissions: {
        alert: true,
        badge: true,
        sound: true,
      },
      popInitialNotification: true,
      requestPermissions: Platform.OS === 'ios',
    });

    // Create notification channels for Android
    if (Platform.OS === 'android') {
      PushNotification.createChannel(
        {
          channelId: 'default',
          channelName: 'Default',
          channelDescription: 'Default notifications',
          soundName: 'default',
          importance: 4,
          vibrate: true,
        },
        created => logger.info('Default channel created:', created)
      );

      PushNotification.createChannel(
        {
          channelId: 'messages',
          channelName: 'Messages',
          channelDescription: 'Message notifications',
          soundName: 'default',
          importance: 4,
          vibrate: true,
        },
        created => logger.info('Messages channel created:', created)
      );
    }
  }

  private async registerDeviceToken(token: string) {
    try {
      const state = store.getState();
      const session = state.auth.session;

      if (!session) {
        return;
      }

      const response = await fetch(`${API_URL}/notifications/register-device`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.accessJwt}`,
        },
        body: JSON.stringify({
          token,
          platform: Platform.OS,
          deviceId: await this.getDeviceId(),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to register device token');
      }
    } catch (error) {
      console.error('Error registering device token:', error);
    }
  }

  private async getDeviceId(): Promise<string> {
    try {
      const deviceId = await AsyncStorage.getItem('@device_id');
      if (deviceId) {
        return deviceId;
      }

      const newDeviceId = Math.random().toString(36).substring(2);
      await AsyncStorage.setItem('@device_id', newDeviceId);
      return newDeviceId;
    } catch (error) {
      console.error('Error getting device ID:', error);
      return 'unknown';
    }
  }

  private handleFCMMessage(remoteMessage: any) {
    const notification: NotificationPayload = {
      title: remoteMessage.notification?.title || 'New Notification',
      body: remoteMessage.notification?.body || '',
      data: remoteMessage.data,
    };

    this.showLocalNotification(notification);
  }

  async showLocalNotification(notification: NotificationPayload) {
    const settings = await this.loadNotificationSettings();
    if (!settings.enabled) {
      return;
    }

    PushNotification.localNotification({
      channelId: notification.data?.type === 'message' ? 'messages' : 'default',
      title: notification.title,
      message: notification.body,
      playSound: settings.sound,
      vibrate: settings.vibration,
      userInfo: notification.data,
    });
  }

  async scheduleNotification(notification: NotificationPayload, date: Date) {
    const settings = await this.loadNotificationSettings();
    if (!settings.enabled) {
      return;
    }

    PushNotification.localNotificationSchedule({
      channelId: notification.data?.type === 'message' ? 'messages' : 'default',
      title: notification.title,
      message: notification.body,
      date,
      playSound: settings.sound,
      vibrate: settings.vibration,
      userInfo: notification.data,
    });
  }

  async updateNotificationSettings(settings: {
    enabled: boolean;
    sound: boolean;
    vibration: boolean;
    messages: boolean;
    likes: boolean;
    comments: boolean;
    follows: boolean;
  }) {
    try {
      await AsyncStorage.setItem(
        this.NOTIFICATION_SETTINGS_KEY,
        JSON.stringify(settings)
      );

      // Update server settings
      const state = store.getState();
      const session = state.auth.session;

      if (session) {
        await fetch(`${API_URL}/notifications/settings`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.accessJwt}`,
          },
          body: JSON.stringify(settings),
        });
      }
    } catch (error) {
      console.error('Error updating notification settings:', error);
    }
  }

  private async loadNotificationSettings() {
    try {
      const settings = await AsyncStorage.getItem(
        this.NOTIFICATION_SETTINGS_KEY
      );
      if (settings) {
        return JSON.parse(settings);
      }

      const defaultSettings = {
        enabled: true,
        sound: true,
        vibration: true,
        messages: true,
        likes: true,
        comments: true,
        follows: true,
      };

      await AsyncStorage.setItem(
        this.NOTIFICATION_SETTINGS_KEY,
        JSON.stringify(defaultSettings)
      );

      return defaultSettings;
    } catch (error) {
      console.error('Error loading notification settings:', error);
      return {
        enabled: true,
        sound: true,
        vibration: true,
        messages: true,
        likes: true,
        comments: true,
        follows: true,
      };
    }
  }

  async clearAllNotifications() {
    PushNotification.cancelAllLocalNotifications();
  }

  async getBadgeCount(): Promise<number> {
    try {
      const count = await AsyncStorage.getItem('@badge_count');
      return count ? parseInt(count, 10) : 0;
    } catch (error) {
      console.error('Error getting badge count:', error);
      return 0;
    }
  }

  async setBadgeCount(count: number) {
    try {
      await AsyncStorage.setItem('@badge_count', count.toString());
      PushNotification.setApplicationIconBadgeNumber(count);
    } catch (error) {
      console.error('Error setting badge count:', error);
    }
  }
}

export const notificationService = NotificationService.getInstance();
