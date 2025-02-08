import webpush from 'web-push';

// Load VAPID keys from environment variables
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

if (!vapidPublicKey || !vapidPrivateKey) {
  throw new Error('VAPID keys must be set in environment variables');
}

// Configure web-push with VAPID details
webpush.setVapidDetails(
  'mailto:support@yourdomain.com', // Replace with your contact email
  vapidPublicKey,
  vapidPrivateKey
);

export const webPush = {
  /**
   * Get the public VAPID key for subscribing to push notifications
   */
  getPublicKey(): string {
    return vapidPublicKey;
  },

  /**
   * Send a push notification to a subscription
   */
  async sendNotification(
    subscription: webpush.PushSubscription,
    payload: string | Buffer | null | undefined
  ): Promise<webpush.SendResult> {
    try {
      return await webpush.sendNotification(subscription, payload);
    } catch (error) {
      if (error.statusCode === 410 || error.statusCode === 404) {
        // Subscription has expired or is no longer valid
        throw new Error('Subscription is no longer valid');
      }
      throw error;
    }
  },

  /**
   * Generate VAPID keys for push notifications
   * This should only be used once to generate keys for your application
   */
  generateVAPIDKeys(): { publicKey: string; privateKey: string } {
    return webpush.generateVAPIDKeys();
  }
}; 