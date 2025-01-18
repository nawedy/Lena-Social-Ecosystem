import { StackNavigationProp } from '@react-navigation/stack';
import React, { useEffect, useState } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';

import { LoadingSpinner } from '../../components/LoadingSpinner';
import { Text } from '../../components/Text';
import { useNotifications } from '../../hooks/useNotifications';

import { NotificationItem } from './NotificationItem';


interface Notification {
  id: string;
  type: 'like' | 'repost' | 'follow' | 'mention';
  actor: {
    did: string;
    handle: string;
    displayName?: string;
    avatar?: string;
  };
  uri?: string;
  cid?: string;
  indexedAt: string;
  read: boolean;
}

type RootStackParamList = {
  Notifications: undefined;
  Profile: { did: string };
  Post: { uri: string; cid: string };
};

type NotificationsScreenProps = {
  navigation: StackNavigationProp<RootStackParamList, 'Notifications'>;
};

export const NotificationsScreen: React.FC<NotificationsScreenProps> = ({ navigation }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const { fetchNotifications, markAsRead } = useNotifications();

  useEffect(() => {
    const loadNotifications = async () => {
      try {
        const data = await fetchNotifications();
        setNotifications(data);
      } catch (error) {
        console.error('Error fetching notifications:', error);
      } finally {
        setLoading(false);
      }
    };

    loadNotifications();
  }, [fetchNotifications]);

  const handleNotificationPress = async (notification: Notification) => {
    try {
      await markAsRead(notification.id);

      // Update local state to mark notification as read
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notification.id ? { ...n, read: true } : n
        )
      );

      // Navigate based on notification type
      switch (notification.type) {
        case 'follow':
          navigation.navigate('Profile', { did: notification.actor.did });
          break;
        case 'like':
        case 'repost':
        case 'mention':
          if (notification.uri && notification.cid) {
            navigation.navigate('Post', {
              uri: notification.uri,
              cid: notification.cid,
            });
          }
          break;
      }
    } catch (error) {
      console.error('Error handling notification:', error);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <NotificationItem
            notification={item}
            onPress={() => handleNotificationPress(item)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No notifications yet</Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
  },
});
