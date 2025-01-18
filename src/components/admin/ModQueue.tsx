import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { admin } from '../../services/admin';
import { format } from 'date-fns';

interface ModItem {
  id: string;
  type: string;
  reporter_handle: string;
  reporter_at_handle: string;
  target_did: string;
  reason: string;
  evidence: string;
  created_at: string;
  status: 'pending' | 'resolved';
}

interface ActionModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (action: string, reason: string, duration?: number) => void;
  targetDid: string;
}

const ActionModal: React.FC<ActionModalProps> = ({
  visible,
  onClose,
  onSubmit,
  targetDid,
}) => {
  const [action, setAction] = useState<'warn' | 'mute' | 'block' | 'report'>(
    'warn'
  );
  const [reason, setReason] = useState('');
  const [duration, setDuration] = useState('24');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!reason) {
      Alert.alert('Error', 'Please provide a reason');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(
        action,
        reason,
        action === 'mute' ? parseInt(duration) : undefined
      );
      onClose();
    } catch (error) {
      Alert.alert('Error', 'Failed to take action');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Take Action</Text>
          <Text style={styles.modalSubtitle}>Target: {targetDid}</Text>

          <View style={styles.actionButtons}>
            {(['warn', 'mute', 'block', 'report'] as const).map(a => (
              <TouchableOpacity
                key={a}
                style={[
                  styles.actionButtonPrimary,
                  action === a && styles.actionButtonActive,
                ]}
                onPress={() => setAction(a)}
              >
                <Text
                  style={[
                    styles.actionButtonTextPrimary,
                    action === a && styles.actionButtonTextActive,
                  ]}
                >
                  {a.charAt(0).toUpperCase() + a.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {action === 'mute' && (
            <View style={styles.durationContainer}>
              <Text style={styles.label}>Duration (hours):</Text>
              <TextInput
                style={styles.durationInput}
                value={duration}
                onChangeText={setDuration}
                keyboardType="numeric"
                maxLength={3}
              />
            </View>
          )}

          <View style={styles.reasonContainer}>
            <Text style={styles.label}>Reason:</Text>
            <TextInput
              style={styles.reasonInput}
              value={reason}
              onChangeText={setReason}
              multiline
              numberOfLines={3}
              placeholder="Enter reason for action..."
              placeholderTextColor="#999"
            />
          </View>

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton]}
              onPress={onClose}
            >
              <Text style={styles.modalButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.modalButton,
                styles.submitButton,
                isSubmitting && styles.buttonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.modalButtonText}>Submit</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export function ModQueue() {
  const [queue, setQueue] = useState<ModItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<ModItem | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const loadModQueue = useCallback(async () => {
    try {
      setLoading(true);
      const items = await admin.getModQueue();
      setQueue(items);
    } catch (error) {
      console.error('Error loading mod queue:', error);
      Alert.alert('Error', 'Failed to load moderation queue');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadModQueue();
  }, [loadModQueue]);

  const handleAction = async (
    action: string,
    reason: string,
    duration?: number
  ) => {
    if (!selectedItem) return;

    try {
      await admin.takeModAction({
        itemId: selectedItem.id,
        action,
        reason,
        duration,
        targetDid: selectedItem.target_did,
      });
      await loadModQueue();
      Alert.alert('Success', 'Action taken successfully');
    } catch (error) {
      console.error('Error taking action:', error);
      Alert.alert('Error', 'Failed to take action');
    }
  };

  const renderItem = ({ item }: { item: ModItem }) => (
    <View style={styles.item}>
      <View style={styles.itemHeader}>
        <Text style={styles.itemType}>{item.type}</Text>
        <Text style={styles.itemDate}>
          {format(new Date(item.created_at), 'MMM d, yyyy HH:mm')}
        </Text>
      </View>

      <View style={styles.itemContent}>
        <Text style={styles.label}>Reporter:</Text>
        <Text style={styles.value}>
          {item.reporter_handle} ({item.reporter_at_handle})
        </Text>

        <Text style={styles.label}>Target:</Text>
        <Text style={styles.value}>{item.target_did}</Text>

        <Text style={styles.label}>Reason:</Text>
        <Text style={styles.value}>{item.reason}</Text>

        {item.evidence && (
          <>
            <Text style={styles.label}>Evidence:</Text>
            <Text style={styles.value}>{item.evidence}</Text>
          </>
        )}
      </View>

      <TouchableOpacity
        style={styles.actionButton}
        onPress={() => {
          setSelectedItem(item);
          setModalVisible(true);
        }}
      >
        <Text style={styles.actionButtonText}>Take Action</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={queue}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No items in moderation queue</Text>
          </View>
        }
      />

      <ActionModal
        visible={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setSelectedItem(null);
        }}
        onSubmit={handleAction}
        targetDid={selectedItem?.target_did || ''}
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
  list: {
    padding: 16,
  },
  item: {
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
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  itemType: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
    textTransform: 'capitalize',
  },
  itemDate: {
    fontSize: 14,
    color: '#666',
  },
  itemContent: {
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
  actionButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
  },
  actionButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 24,
  },
  actionButtonPrimary: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  actionButtonActive: {
    backgroundColor: '#007AFF',
  },
  actionButtonTextPrimary: {
    color: '#333',
    fontSize: 14,
    fontWeight: '500',
  },
  actionButtonTextActive: {
    color: '#fff',
  },
  durationContainer: {
    marginBottom: 24,
  },
  durationInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 8,
    fontSize: 14,
  },
  reasonContainer: {
    marginBottom: 24,
  },
  reasonInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 8,
    fontSize: 14,
    height: 80,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  modalButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 8,
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  submitButton: {
    backgroundColor: '#007AFF',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
