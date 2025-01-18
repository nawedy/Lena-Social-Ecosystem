import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { admin } from '../../services/admin';
import { format } from 'date-fns';
import { AppealStatus, AppealType, Appeal } from '../../types/appeals';

interface AppealManagerProps {
  onStatusChange?: (appealId: string, newStatus: AppealStatus) => void;
}

export function AppealManager({ onStatusChange }: AppealManagerProps) {
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAppeals = useCallback(async () => {
    try {
      setError(null);
      const data = await admin.getAppeals();
      setAppeals(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load appeals');
      Alert.alert('Error', 'Failed to load appeals. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAppeals();
  }, [loadAppeals]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAppeals();
  }, [loadAppeals]);

  const handleStatusChange = useCallback(async (appealId: string, newStatus: AppealStatus) => {
    try {
      await admin.updateAppealStatus(appealId, newStatus);
      setAppeals(prev => 
        prev.map(appeal => 
          appeal.id === appealId ? { ...appeal, status: newStatus } : appeal
        )
      );
      onStatusChange?.(appealId, newStatus);
      Alert.alert('Success', 'Appeal status updated successfully');
    } catch (err) {
      Alert.alert('Error', 'Failed to update appeal status. Please try again.');
    }
  }, [onStatusChange]);

  const sortedAppeals = useMemo(() => {
    return [...appeals].sort((a, b) => {
      // Sort by status (pending first)
      if (a.status === 'pending' && b.status !== 'pending') return -1;
      if (a.status !== 'pending' && b.status === 'pending') return 1;
      
      // Then by date (newest first)
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [appeals]);

  const renderAppealItem = useCallback(({ item }: { item: Appeal }) => (
    <View style={styles.appealItem}>
      <View style={styles.appealHeader}>
        <Text style={styles.appealType}>{item.type}</Text>
        <Text style={styles.appealDate}>
          {format(new Date(item.created_at), 'MMM d, yyyy HH:mm')}
        </Text>
      </View>

      <View style={styles.appealContent}>
        <Text style={styles.label}>User:</Text>
        <Text style={styles.value}>{item.user_id}</Text>

        <Text style={styles.label}>Reason:</Text>
        <Text style={styles.value}>{item.reason}</Text>

        {item.evidence && (
          <>
            <Text style={styles.label}>Evidence:</Text>
            <Text style={styles.value}>{item.evidence}</Text>
          </>
        )}

        <Text style={styles.label}>Status:</Text>
        <Text style={[
          styles.statusText,
          item.status === 'approved' && styles.statusApproved,
          item.status === 'rejected' && styles.statusRejected,
          item.status === 'pending' && styles.statusPending
        ]}>
          {item.status.toUpperCase()}
        </Text>
      </View>

      {item.status === 'pending' && (
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.approveButton]}
            onPress={() => handleStatusChange(item.id, 'approved')}
          >
            <Text style={styles.actionButtonText}>Approve</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.rejectButton]}
            onPress={() => handleStatusChange(item.id, 'rejected')}
          >
            <Text style={styles.actionButtonText}>Reject</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  ), [handleStatusChange]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadAppeals}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={sortedAppeals}
        renderItem={renderAppealItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No appeals found</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#ff3b30',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  list: {
    padding: 16,
  },
  appealItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
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
    alignItems: 'center',
    marginBottom: 12,
  },
  appealType: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
    textTransform: 'capitalize',
  },
  appealDate: {
    fontSize: 14,
    color: '#666',
  },
  appealContent: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  value: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  statusApproved: {
    color: '#34c759',
  },
  statusRejected: {
    color: '#ff3b30',
  },
  statusPending: {
    color: '#ff9500',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  approveButton: {
    backgroundColor: '#34c759',
  },
  rejectButton: {
    backgroundColor: '#ff3b30',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
  },
});
