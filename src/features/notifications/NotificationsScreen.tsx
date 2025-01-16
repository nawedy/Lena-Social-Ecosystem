import React, { useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../hooks/useAuth';

interface Notification {
  id: string;
  type: 'like' | 'comment' | 'follow' | 'mention';
  sourceUserId: string;
  targetId?: string;
  read: boolean;
  createdAt: Date;
}

interface NotificationsScreenProps {
  navigation: any;
}

export const NotificationsScreen: React.FC<NotificationsScreenProps> = ({ navigation }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      // TODO: Implement notification fetching logic
      setNotifications([
        {
          id: '1',
          type: 'like',
          sourceUserId: 'user123',
          targetId: 'post123',
          read: false,
          createdAt: new Date(),
        },
        // Add more mock notifications
      ]);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      // TODO: Implement mark as read logic
      setNotifications(notifications.map(n => 
        n.id === notificationId ? { ...n, read: true } : n
      ));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleNotificationPress = (notification: Notification) => {
    markAsRead(notification.id);
    
    // Navigate based on notification type
    switch (notification.type) {
      case 'like':
      case 'comment':
        navigation.navigate('Post', { postId: notification.targetId });
        break;
      case 'follow':
        navigation.navigate('Profile', { userId: notification.sourceUserId });
        break;
      case 'mention':
        navigation.navigate('Post', { postId: notification.targetId });
        break;
    }
  };

  const renderNotification = ({ item }: { item: Notification }) => {
    const getNotificationText = (notification: Notification) => {
      switch (notification.type) {
        case 'like':
          return 'liked your post';
        case 'comment':
          return 'commented on your post';
        case 'follow':
          return 'started following you';
        case 'mention':
          return 'mentioned you in a post';
        default:
          return '';
      }
    };

    return (
      <TouchableOpacity
        style={[styles.notificationItem, !item.read && styles.unread]}
        onPress={() => handleNotificationPress(item)}
      >
        <LinearGradient
          colors={item.read ? ['#f8f8f8', '#f8f8f8'] : ['#fff5f5', '#fff0f0']}
          style={styles.gradient}
        >
          <Text style={styles.notificationText}>
            <Text style={styles.username}>User </Text>
            {getNotificationText(item)}
          </Text>
          <Text style={styles.timestamp}>
            {new Date(item.createdAt).toLocaleDateString()}
          </Text>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <Text>Loading notifications...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={notifications}
        renderItem={renderNotification}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text>No notifications yet</Text>
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
  list: {
    padding: 10,
  },
  notificationItem: {
    marginBottom: 10,
    borderRadius: 10,
    overflow: 'hidden',
  },
  unread: {
    backgroundColor: '#fff5f5',
  },
  gradient: {
    padding: 15,
  },
  notificationText: {
    fontSize: 16,
    marginBottom: 5,
  },
  username: {
    fontWeight: 'bold',
  },
  timestamp: {
    fontSize: 12,
    color: '#666',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
});
