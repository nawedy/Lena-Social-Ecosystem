declare module 'react-native-push-notification' {
  interface PushNotification {
    configure(options: any): void;
    localNotification(details: any): void;
    cancelAllLocalNotifications(): void;
    removeAllDeliveredNotifications(): void;
  }

  const PushNotificationIOS: PushNotification;
  export default PushNotificationIOS;
}
