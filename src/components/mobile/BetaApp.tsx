import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  _KeyboardAvoidingView,
  RefreshControl,
  _useWindowDimensions,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { useATProto } from '../../contexts/ATProtoContext';
import { ATProtoProvider } from '../../contexts/ATProtoContext';
import { AuthProvider } from '../../contexts/AuthContext';
import { BetaProvider } from '../../contexts/BetaContext';
import { beta } from '../../services/beta';
import { ThemeProvider } from '../../theme';
import { colors } from '../../theme/colors';
import type { _BetaStats } from '../../types/beta';

import { BetaProfile } from './BetaProfile';
import { FeedbackForm } from './FeedbackForm';
import { InviteScreen } from './InviteScreen';

const _Tab = createBottomTabNavigator();

interface BetaStats {
  users: {
    total_users: number;
    active_users: number;
    total_invitations: number;
    accepted_invitations: number;
  };
  feedback: Array<{
    type: string;
    count: number;
    avg_rating: number;
  }>;
}

export function BetaApp() {
  const { session } = useATProto();
  const _navigation = useNavigation();
  const [stats, setStats] = useState<BetaStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (session?.did) {
      loadBetaStats();
    }
  }, [session?.did]);

  const _loadBetaStats = async () => {
    try {
      const _stats = await beta.getBetaStats();
      setStats(_stats);
    } catch (error) {
      console.error('Error loading beta stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const _HomeScreen = () => (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={loadBetaStats} />}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Beta Testing Hub</Text>
        {stats && (
          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.users.active_users}</Text>
              <Text style={styles.statLabel}>Active Testers</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.users.accepted_invitations}</Text>
              <Text style={styles.statLabel}>Invites Accepted</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>
                {stats.feedback.reduce((sum, item) => sum + item.count, 0)}
              </Text>
              <Text style={styles.statLabel}>Feedback Items</Text>
            </View>
          </View>
        )}

        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#4CAF50' }]}
            onPress={() => navigation.navigate('Invite')}
          >
            <Icon name='account-plus' size={24} color='#fff' />
            <Text style={styles.buttonText}>Invite Friends</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#2196F3' }]}
            onPress={() => navigation.navigate('Feedback')}
          >
            <Icon name='message-draw' size={24} color='#fff' />
            <Text style={styles.buttonText}>Submit Feedback</Text>
          </TouchableOpacity>
        </View>
      </View>

      {stats && (
        <View style={styles.feedbackSummary}>
          <Text style={styles.sectionTitle}>Feedback Summary</Text>
          {stats.feedback.map((item) => (
            <View key={item.type} style={styles.feedbackItem}>
              <View style={styles.feedbackType}>
                <Icon
                  name={
                    item.type === 'bug'
                      ? 'bug'
                      : item.type === 'feature'
                      ? 'lightbulb'
                      : 'message-text'
                  }
                  size={24}
                  color='#666'
                />
                <Text style={styles.feedbackTypeText}>
                  {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
                </Text>
              </View>
              <View style={styles.feedbackStats}>
                <Text style={styles.feedbackCount}>{item.count}</Text>
                {item.avg_rating && (
                  <Text style={styles.feedbackRating}>⭐️ {item.avg_rating.toFixed(1)}</Text>
                )}
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar
        barStyle={Platform.OS === 'ios' ? 'dark-content' : 'light-content'}
        backgroundColor={colors.background}
      />
      <NavigationContainer>
        <ATProtoProvider agent={session}>
          <AuthProvider>
            <BetaProvider>
              <ThemeProvider>
                <View style={styles.content}>
                  <Tab.Navigator
                    screenOptions={{
                      tabBarActiveTintColor: colors.primary,
                      tabBarInactiveTintColor: colors.text,
                      tabBarStyle: styles.tabBar,
                      headerShown: false,
                      tabBarShowLabel: Platform.OS === 'ios',
                    }}
                  >
                    <Tab.Screen name='Home' component={_HomeScreen} />
                    <Tab.Screen name='Invite' component={InviteScreen} />
                    <Tab.Screen name='Feedback' component={FeedbackForm} />
                    <Tab.Screen name='Profile' component={BetaProfile} />
                  </Tab.Navigator>
                </View>
              </ThemeProvider>
            </BetaProvider>
          </AuthProvider>
        </ATProtoProvider>
      </NavigationContainer>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 10,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 5,
    textAlign: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 10,
    marginHorizontal: 5,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 10,
  },
  feedbackSummary: {
    backgroundColor: '#fff',
    padding: 20,
    margin: 10,
    borderRadius: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  feedbackItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  feedbackType: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  feedbackTypeText: {
    marginLeft: 10,
    fontSize: 16,
  },
  feedbackStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  feedbackCount: {
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 10,
  },
  feedbackRating: {
    fontSize: 14,
    color: '#666',
  },
  tabBar: {
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingBottom: Platform.OS === 'ios' ? 20 : 0,
    height: Platform.OS === 'ios' ? 85 : 60,
    ...Platform.select({
      ios: {
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 8,
      },
    }),
  },
});
