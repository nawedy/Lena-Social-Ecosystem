import * as firebase from '@react-native-firebase/messaging';
import { Platform } from 'react-native';
import { getStorage, setStorage } from '../../utils/storage';
import { performanceMonitor } from '../../utils/performance';

export class PushNotificationService {
  private static instance: PushNotificationService;
  private messaging: firebase.FirebaseMessagingTypes.Module;

  private constructor() {
    this.messaging = firebase.default();
  }

  public static getInstance(): PushNotificationService {
    if (!PushNotificationService.instance) {
      PushNotificationService.instance = new PushNotificationService();
    }
    return PushNotificationService.instance;
  }

  public async initialize(): Promise<void> {
    try {
      const trace = await performanceMonitor.startTrace(
        'push_notification_init'
      );

      // Request permission
      const authStatus = await this.messaging.requestPermission();
      const enabled =
        authStatus === firebase.AuthorizationStatus.AUTHORIZED ||
        authStatus === firebase.AuthorizationStatus.PROVISIONAL;

      if (enabled) {
        // Get FCM token
        const fcmToken = await this.messaging.getToken();
        await this.saveFCMToken(fcmToken);

        // Listen for token refresh
        this.messaging.onTokenRefresh(async token => {
          await this.saveFCMToken(token);
        });

        // Configure notification handlers
        this.setupNotificationHandlers();
      }

      trace.putMetric('success', 1);
      await trace.stop();
    } catch (error) {
      console.error('Failed to initialize push notifications:', error);
      throw error;
    }
  }

  private async saveFCMToken(token: string): Promise<void> {
    await setStorage('fcmToken', token);
    // TODO: Send token to backend
  }

  private setupNotificationHandlers(): void {
    // Handle background messages
    this.messaging.setBackgroundMessageHandler(async remoteMessage => {
      logger.info('Background message:', remoteMessage);
      await this.handleNotification(remoteMessage);
    });

    // Handle foreground messages
    this.messaging.onMessage(async remoteMessage => {
      logger.info('Foreground message:', remoteMessage);
      await this.handleNotification(remoteMessage);
    });

    // Handle notification open
    this.messaging.onNotificationOpenedApp(async remoteMessage => {
      logger.info('Notification opened app:', remoteMessage);
      await this.handleNotificationOpen(remoteMessage);
    });

    // Handle initial notification
    this.messaging.getInitialNotification().then(async remoteMessage => {
      if (remoteMessage) {
        logger.info('Initial notification:', remoteMessage);
        await this.handleNotificationOpen(remoteMessage);
      }
    });
  }

  private async handleNotification(
    message: firebase.FirebaseMessagingTypes.RemoteMessage
  ): Promise<void> {
    // Handle different notification types
    switch (message.data?.type) {
      case 'message':
        await this.handleMessageNotification(message);
        break;
      case 'follow':
        await this.handleFollowNotification(message);
        break;
      case 'like':
        await this.handleLikeNotification(message);
        break;
      case 'comment':
        await this.handleCommentNotification(message);
        break;
      default:
        logger.info('Unknown notification type:', message.data?.type);
    }
  }

  private async handleNotificationOpen(
    message: firebase.FirebaseMessagingTypes.RemoteMessage
  ): Promise<void> {
    // Navigate based on notification type
    switch (message.data?.type) {
      case 'message':
        // Navigate to chat
        break;
      case 'follow':
        // Navigate to profile
        break;
      case 'like':
        // Navigate to post
        break;
      case 'comment':
        // Navigate to comment thread
        break;
    }
  }

  private async handleMessageNotification(
    message: firebase.FirebaseMessagingTypes.RemoteMessage
  ): Promise<void> {
    // Handle new message notification
  }

  private async handleFollowNotification(
    message: firebase.FirebaseMessagingTypes.RemoteMessage
  ): Promise<void> {
    // Handle new follower notification
  }

  private async handleLikeNotification(
    message: firebase.FirebaseMessagingTypes.RemoteMessage
  ): Promise<void> {
    // Handle new like notification
  }

  private async handleCommentNotification(
    message: firebase.FirebaseMessagingTypes.RemoteMessage
  ): Promise<void> {
    // Handle new comment notification
  }

  public async scheduleLocalNotification(
    title: string,
    body: string,
    data?: any,
    delay?: number
  ): Promise<void> {
    // Schedule local notification
  }

  public async cancelAllNotifications(): Promise<void> {
    await this.messaging.cancelAllNotifications();
  }

  public async getBadgeCount(): Promise<number> {
    if (Platform.OS === 'ios') {
      // Get iOS badge count
      return 0;
    }
    return 0;
  }

  public async setBadgeCount(count: number): Promise<void> {
    if (Platform.OS === 'ios') {
      // Set iOS badge count
    }
  }
}
