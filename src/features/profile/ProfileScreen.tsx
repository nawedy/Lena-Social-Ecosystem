import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';

import { UserIdentity } from '../../core/identity/did';
import { ApiService } from '../../services/api';

export function ProfileScreen() {
  const [profile, setProfile] = useState<UserIdentity | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchProfile = async () => {
    try {
      const api = ApiService.getInstance();
      const session = api.getAgent().session;
      if (!session) return;

      const response = await api.getAgent().getProfile({
        actor: session.handle,
      });

      setProfile({
        did: response.data.did,
        handle: response.data.handle,
        profileData: {
          displayName: response.data.displayName,
          description: response.data.description,
          avatar: response.data.avatar,
        },
      });
    } catch (error) {
      console.error('Failed to fetch profile:', error);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void fetchProfile();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    void fetchProfile();
  };

  if (!profile) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading profile...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        {profile?.profileData?.avatar ? (
          <Image
            source={{ uri: profile.profileData.avatar }}
            style={styles.avatar}
          />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarPlaceholderText}>
              {profile?.handle?.charAt(0)?.toUpperCase() || '?'}
            </Text>
          </View>
        )}

        <View style={styles.profileInfo}>
          <Text style={styles.displayName}>
            {profile?.profileData?.displayName ||
              profile?.handle ||
              'Anonymous'}
          </Text>
          <Text style={styles.handle}>@{profile?.handle}</Text>
          {profile?.profileData?.description && (
            <Text style={styles.bio}>{profile.profileData.description}</Text>
          )}
        </View>
      </View>

      <View style={styles.stats}>
        <TouchableOpacity style={styles.statItem}>
          <Text style={styles.statValue}>0</Text>
          <Text style={styles.statLabel}>Posts</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.statItem}>
          <Text style={styles.statValue}>0</Text>
          <Text style={styles.statLabel}>Following</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.statItem}>
          <Text style={styles.statValue}>0</Text>
          <Text style={styles.statLabel}>Followers</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.editButton}>
        <Text style={styles.editButtonText}>Edit Profile</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    padding: 16,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 12,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#e1e1e1',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarPlaceholderText: {
    fontSize: 36,
    color: '#666',
  },
  profileInfo: {
    alignItems: 'center',
  },
  displayName: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 4,
  },
  handle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  bio: {
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
  },
  editButton: {
    margin: 20,
    padding: 15,
    backgroundColor: '#007AFF',
    borderRadius: 25,
    alignItems: 'center',
  },
  editButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
