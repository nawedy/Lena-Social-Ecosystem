import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../../types/supabase';
import { NotificationConfig, NotificationPreferences, PushSubscription } from './types';
import { webPush } from './web-push';
import { emailService } from '../email/email.service';

export class NotificationService {
  private supabase: SupabaseClient<Database>;
  private userId: string;

  constructor(supabase: SupabaseClient<Database>, userId: string) {
    this.supabase = supabase;
    this.userId = userId;
  }

  async initialize() {
    // Initialize user preferences if they don't exist
    const { data: existingPrefs } = await this.supabase
      .from('notification_preferences')
      .select()
      .eq('user_id', this.userId)
      .single();

    if (!existingPrefs) {
      await this.supabase.from('notification_preferences').insert({
        user_id: this.userId,
        channels: {
          inApp: true,
          email: true,
          webPush: true
        },
        types: {},
        quiet_hours: {
          enabled: false,
          start: '22:00',
          end: '08:00',
          timezone: 'UTC'
        }
      });
    }

    // Subscribe to real-time notifications
    this.supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${this.userId}`
        },
        this.handleNewNotification.bind(this)
      )
      .subscribe();
  }

  async getNotifications(params: {
    page?: number;
    limit?: number;
    unreadOnly?: boolean;
    type?: string;
  }) {
    const { page = 1, limit = 20, unreadOnly = false, type } = params;
    const offset = (page - 1) * limit;

    let query = this.supabase
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', this.userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (unreadOnly) {
      query = query.eq('read', false);
    }

    if (type) {
      query = query.eq('type', type);
    }

    const { data: notifications, count } = await query;

    return {
      notifications,
      total: count || 0,
      page,
      limit
    };
  }

  async markAsRead(notificationId: string) {
    await this.supabase
      .from('notifications')
      .update({
        read: true,
        read_at: new Date().toISOString()
      })
      .eq('id', notificationId)
      .eq('user_id', this.userId);
  }

  async markAllAsRead() {
    await this.supabase
      .from('notifications')
      .update({
        read: true,
        read_at: new Date().toISOString()
      })
      .eq('user_id', this.userId)
      .eq('read', false);
  }

  async getPreferences(): Promise<NotificationPreferences> {
    const { data } = await this.supabase
      .from('notification_preferences')
      .select()
      .eq('user_id', this.userId)
      .single();

    return data as NotificationPreferences;
  }

  async updatePreferences(preferences: Partial<NotificationPreferences>) {
    await this.supabase
      .from('notification_preferences')
      .update(preferences)
      .eq('user_id', this.userId);
  }

  async subscribeToPush(subscription: PushSubscription) {
    await this.supabase.from('push_subscriptions').insert({
      user_id: this.userId,
      subscription
    });
  }

  async unsubscribeFromPush(endpoint: string) {
    await this.supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', this.userId)
      .eq('subscription->>endpoint', endpoint);
  }

  private async handleNewNotification(payload: any) {
    const notification = payload.new;
    const preferences = await this.getPreferences();

    // Check if notification type is enabled
    const typeConfig = preferences.types[notification.type];
    if (!typeConfig?.enabled) {
      return;
    }

    // Check quiet hours
    if (this.isInQuietHours(preferences.quiet_hours)) {
      return;
    }

    // Send through enabled channels
    if (preferences.channels.webPush && notification.channel !== 'email') {
      await this.sendPushNotification(notification);
    }

    if (preferences.channels.email && notification.channel !== 'webPush') {
      await this.sendEmailNotification(notification);
    }
  }

  private async sendPushNotification(notification: NotificationConfig) {
    const { data: subscriptions } = await this.supabase
      .from('push_subscriptions')
      .select('subscription')
      .eq('user_id', this.userId);

    if (!subscriptions?.length) {
      return;
    }

    for (const sub of subscriptions) {
      try {
        await webPush.sendNotification(
          sub.subscription,
          JSON.stringify({
            title: notification.title,
            body: notification.body,
            data: notification.data
          })
        );
      } catch (error) {
        if (error.statusCode === 410) {
          // Subscription expired or no longer valid
          await this.unsubscribeFromPush(sub.subscription.endpoint);
        }
        console.error('Failed to send push notification:', error);
      }
    }
  }

  private async sendEmailNotification(notification: NotificationConfig) {
    const { data: user } = await this.supabase.auth.getUser();
    if (!user?.email) {
      return;
    }

    try {
      await emailService.sendEmail({
        to: user.email,
        subject: notification.title,
        text: notification.body,
        html: this.generateEmailHtml(notification)
      });
    } catch (error) {
      console.error('Failed to send email notification:', error);
    }
  }

  private generateEmailHtml(notification: NotificationConfig) {
    // Generate HTML email template
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${notification.title}</title>
        </head>
        <body>
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #333;">${notification.title}</h1>
            <p style="color: #666;">${notification.body}</p>
            ${
              notification.data?.actionUrl
                ? `<a href="${notification.data.actionUrl}" 
                     style="display: inline-block; 
                            padding: 10px 20px; 
                            background-color: #007bff; 
                            color: white; 
                            text-decoration: none; 
                            border-radius: 5px;">
                     View Details
                   </a>`
                : ''
            }
          </div>
        </body>
      </html>
    `;
  }

  private isInQuietHours(quietHours: NotificationPreferences['quiet_hours']) {
    if (!quietHours.enabled) {
      return false;
    }

    const now = new Date();
    const userTz = quietHours.timezone || 'UTC';
    const userTime = new Date(now.toLocaleString('en-US', { timeZone: userTz }));
    const [startHour, startMinute] = quietHours.start.split(':').map(Number);
    const [endHour, endMinute] = quietHours.end.split(':').map(Number);

    const startTime = new Date(userTime);
    startTime.setHours(startHour, startMinute, 0);

    const endTime = new Date(userTime);
    endTime.setHours(endHour, endMinute, 0);

    // Handle case where quiet hours span midnight
    if (endTime < startTime) {
      endTime.setDate(endTime.getDate() + 1);
    }

    return userTime >= startTime && userTime <= endTime;
  }
} 