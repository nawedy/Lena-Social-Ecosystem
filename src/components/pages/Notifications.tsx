import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { BskyAgent } from '@atproto/api';

interface NotificationsProps {
  navigation: any;
}

const Notifications: React.FC<NotificationsProps> = () => {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const _agent = useMemo(
    () => new BskyAgent({ service: 'https://bsky.social' }),
    []
  );

  const _loadNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const _session = window.window.localStorage.getItem('session');
      if (!session) {
        throw new Error('Not logged in');
      }

      await agent.resumeSession(JSON.parse(session));
      const _response = await agent.listNotifications();
      setNotifications(response.data.notifications);
      window.window.localStorage.setItem(
        'lastNotificationCheck',
        new Date().toISOString()
      );
    } catch (err: any) {
      setError(err.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [agent]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const _formatTime = (timestamp: string) => {
    const _date = new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">Loading notifications...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="rounded-md bg-red-50 p-4">
          <div className="text-sm text-red-700">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
          Notifications
        </h1>

        <div className="space-y-4">
          {notifications.map(notification => (
            <div
              key={notification.cid}
              className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow"
            >
              <div className="flex items-start">
                {notification.author.avatar && (
                  <img
                    src={notification.author.avatar}
                    alt={
                      notification.author.displayName ||
                      notification.author.handle
                    }
                    className="h-10 w-10 rounded-full"
                  />
                )}
                <div className="ml-3 flex-1">
                  <p className="text-sm text-gray-900 dark:text-white">
                    <span className="font-medium">
                      {notification.author.displayName ||
                        notification.author.handle}
                    </span>{' '}
                    <span className="text-gray-500">
                      @{notification.author.handle}
                    </span>
                  </p>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                    {notification.reason === 'like'
                      ? 'liked your post'
                      : notification.reason === 'repost'
                        ? 'reposted your post'
                        : notification.reason === 'follow'
                          ? 'followed you'
                          : notification.reason === 'mention'
                            ? 'mentioned you'
                            : notification.reason === 'reply'
                              ? 'replied to your post'
                              : notification.reason === 'quote'
                                ? 'quoted your post'
                                : notification.reason}
                  </p>
                  {notification.record?.text && (
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                      {notification.record.text}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-gray-500">
                    {formatTime(notification.indexedAt)}
                  </p>
                </div>
              </div>
            </div>
          ))}

          {notifications.length === 0 && (
            <div className="text-center text-gray-500 dark:text-gray-400">
              No notifications yet
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Notifications;
