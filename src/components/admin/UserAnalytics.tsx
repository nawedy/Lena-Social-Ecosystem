import { format } from 'date-fns';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { PieChart } from 'react-native-chart-kit';

import { admin } from '../../services/admin';
import { atproto } from '../../services/atproto';


interface UserStats {
  profile: any;
  activity: Array<{
    event_type: string;
    count: number;
    last_activity: string;
  }>;
  feedback: Array<any>;
}

export function UserAnalytics() {
  const [searchQuery, setSearchQuery] = useState('');
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery) {
      Alert.alert('Error', 'Please enter a handle or DID');
      return;
    }

    setIsLoading(true);
    try {
      let did = searchQuery;
      if (!searchQuery.startsWith('did:')) {
        const resolved = await atproto.agent.com.atproto.identity.resolveHandle(
          {
            handle: searchQuery,
          }
        );
        did = resolved.data.did;
      }

      const stats = await admin.getUserAnalytics(did);
      setUserStats(stats);
    } catch (error) {
      console.error('Error fetching user analytics:', error);
      Alert.alert('Error', 'Failed to fetch user analytics');
    } finally {
      setIsLoading(false);
    }
  };

  const exportAnalytics = async () => {
    if (!userStats) return;

    setIsExporting(true);
    try {
      const data = {
        profile: userStats.profile,
        activity: userStats.activity,
        feedback: userStats.feedback,
        exportDate: new Date().toISOString(),
      };

      const fileName = `${userStats.profile.handle}_analytics.json`;
      const filePath = `${FileSystem.documentDirectory}${fileName}`;

      await FileSystem.writeAsStringAsync(
        filePath,
        JSON.stringify(data, null, 2)
      );

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(filePath);
      }
    } catch (error) {
      console.error('Error exporting analytics:', error);
      Alert.alert('Error', 'Failed to export analytics');
    } finally {
      setIsExporting(false);
    }
  };

  const renderActivityChart = () => {
    if (!userStats?.activity.length) return null;

    const eventCounts = userStats.activity.reduce(
      (acc, event) => {
        acc[event.event_type] = event.count;
        return acc;
      },
      {} as Record<string, number>
    );

    const chartData = Object.entries(eventCounts).map(
      ([label, value], index) => ({
        name: label,
        count: value,
        color: `hsl(${index * 45}, 70%, 50%)`,
        legendFontColor: '#7F7F7F',
        legendFontSize: 12,
      })
    );

    return (
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>Activity Distribution</Text>
        <PieChart
          data={chartData}
          width={350}
          height={200}
          chartConfig={{
            backgroundColor: '#ffffff',
            backgroundGradientFrom: '#ffffff',
            backgroundGradientTo: '#ffffff',
            color: (opacity = 1) => `rgba(0, 122, 255, ${opacity})`,
          }}
          accessor="count"
          backgroundColor="transparent"
          paddingLeft="15"
          absolute
        />
      </View>
    );
  };

  const renderFeedbackHistory = () => {
    if (!userStats?.feedback.length) return null;

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Feedback History</Text>
        {userStats.feedback.map((item, index) => (
          <View key={index} style={styles.feedbackItem}>
            <Text style={styles.feedbackType}>{item.type}</Text>
            <Text style={styles.feedbackContent}>{item.description}</Text>
            <Text style={styles.feedbackDate}>
              {format(new Date(item.created_at), 'PPp')}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Enter handle or DID"
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
        />
        <TouchableOpacity
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={handleSearch}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Search</Text>
          )}
        </TouchableOpacity>
      </View>

      {userStats && (
        <View style={styles.content}>
          <View style={styles.profileCard}>
            <Text style={styles.handle}>@{userStats.profile.handle}</Text>
            <Text style={styles.did}>{userStats.profile.did}</Text>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {userStats.profile.followersCount}
                </Text>
                <Text style={styles.statLabel}>Followers</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {userStats.profile.followsCount}
                </Text>
                <Text style={styles.statLabel}>Following</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {userStats.profile.postsCount}
                </Text>
                <Text style={styles.statLabel}>Posts</Text>
              </View>
            </View>
          </View>

          {renderActivityChart()}
          {renderFeedbackHistory()}

          <TouchableOpacity
            style={[styles.exportButton, isExporting && styles.buttonDisabled]}
            onPress={exportAnalytics}
            disabled={isExporting}
          >
            {isExporting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Export Analytics</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  searchContainer: {
    flexDirection: 'row',
    padding: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  searchInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 10,
    marginRight: 10,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    borderRadius: 8,
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  content: {
    padding: 15,
  },
  profileCard: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  handle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  did: {
    color: '#666',
    marginBottom: 10,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 10,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  statLabel: {
    color: '#666',
    marginTop: 5,
  },
  chartContainer: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  section: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  feedbackItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingVertical: 10,
  },
  feedbackType: {
    fontWeight: 'bold',
    color: '#007AFF',
  },
  feedbackContent: {
    marginVertical: 5,
  },
  feedbackDate: {
    color: '#666',
    fontSize: 12,
  },
  exportButton: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
});
