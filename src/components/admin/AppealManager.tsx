import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { Appeal } from '../../types';

interface AppealManagerProps {
  onRefresh?: () => void;
}

const AppealManager: React.FC<AppealManagerProps> = ({ onRefresh }) => {
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
  });

  const loadAppeals = async () => {
    try {
      setLoading(true);
      // Add your API call here to fetch appeals
      const response = await fetch('/api/admin/appeals');
      const data = await response.json();
      setAppeals(data.appeals);
      setStats(data.stats);
      setError(null);
    } catch (err) {
      setError('Failed to load appeals');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (
    appealId: string,
    status: 'approved' | 'rejected'
  ) => {
    try {
      const response = await fetch(`/api/admin/appeals/${appealId}/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        throw new Error('Failed to update appeal');
      }

      Alert.alert('Success', `Appeal ${status} successfully`);
      loadAppeals();
      onRefresh?.();
    } catch (err) {
      Alert.alert('Error', 'Failed to update appeal status');
      console.error(err);
    }
  };

  useEffect(() => {
    loadAppeals();
  }, []);

  const renderStats = () => (
    <View style={styles.statsContainer}>
      <View style={styles.statItem}>
        <Text style={styles.statValue}>{stats.total}</Text>
        <Text style={styles.statLabel}>Total</Text>
      </View>
      <View style={styles.statItem}>
        <Text style={styles.statValue}>{stats.pending}</Text>
        <Text style={styles.statLabel}>Pending</Text>
      </View>
      <View style={styles.statItem}>
        <Text style={styles.statValue}>{stats.approved}</Text>
        <Text style={styles.statLabel}>Approved</Text>
      </View>
      <View style={styles.statItem}>
        <Text style={styles.statValue}>{stats.rejected}</Text>
        <Text style={styles.statLabel}>Rejected</Text>
      </View>
    </View>
  );

  const renderAppealItem = (appeal: Appeal) => (
    <View key={appeal.id} style={styles.appealItem}>
      <View style={styles.appealHeader}>
        <Text style={styles.appealId}>Appeal #{appeal.id}</Text>
        <Text style={styles.appealDate}>
          {new Date(appeal.createdAt).toLocaleDateString()}
        </Text>
      </View>
      <Text style={styles.appealReason}>{appeal.reason}</Text>
      <View style={styles.appealActions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.approveButton]}
          onPress={() => handleReview(appeal.id, 'approved')}
        >
          <Text style={styles.actionButtonText}>Approve</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.rejectButton]}
          onPress={() => handleReview(appeal.id, 'rejected')}
        >
          <Text style={styles.actionButtonText}>Reject</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading appeals...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadAppeals}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Appeal Manager</Text>
      {renderStats()}
      <View style={styles.appealsList}>
        {appeals.map(appeal => renderAppealItem(appeal))}
      </View>
      <TouchableOpacity style={styles.refreshButton} onPress={loadAppeals}>
        <Text style={styles.refreshButtonText}>Refresh Appeals</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  loadingText: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    color: '#ff0000',
    marginBottom: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  appealsList: {
    marginTop: 16,
  },
  appealItem: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  appealHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  appealId: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  appealDate: {
    fontSize: 14,
    color: '#666',
  },
  appealReason: {
    fontSize: 14,
    color: '#333',
    marginBottom: 16,
  },
  appealActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 8,
  },
  approveButton: {
    backgroundColor: '#34C759',
  },
  rejectButton: {
    backgroundColor: '#FF3B30',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  retryButton: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  refreshButton: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  refreshButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default AppealManager;
