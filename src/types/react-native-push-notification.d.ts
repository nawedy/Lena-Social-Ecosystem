declare module 'react-native-push-notification' {
  interface PushNotificationConfig {
    onRegister?: (token: { os: string; token: string }) => void;
    onNotification?: (notification: object) => void;
    onAction?: (notification: object) => void;
    onRegistrationError?: (error: Error) => void;
    permissions?: {
      alert?: boolean;
      badge?: boolean;
      sound?: boolean;
    };
    popInitialNotification?: boolean;
    requestPermissions?: boolean;
  }

  interface NotificationDetails {
    id?: string | number;
    title?: string;
    message: string;
    userInfo?: object;
    playSound?: boolean;
    soundName?: string;
    number?: number;
    repeatType?: 'week' | 'day' | 'hour' | 'minute' | 'time';
    repeatTime?: number;
    when?: Date | number;
    channelId?: string;
  }

  interface PushNotification {
    configure(options: PushNotificationConfig): void;
    localNotification(details: NotificationDetails): void;
    cancelAllLocalNotifications(): void;
    removeAllDeliveredNotifications(): void;
    getScheduledLocalNotifications(callback: (notifications: NotificationDetails[]) => void): void;
    abandonPermissions(): void;
    checkPermissions(callback: (permissions: { alert: boolean; badge: boolean; sound: boolean }) => void): void;
    requestPermissions(): Promise<{ alert: boolean; badge: boolean; sound: boolean }>;
  }

  const PushNotification: PushNotification;
  export default PushNotification;
}
