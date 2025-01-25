import { Ionicons } from '@expo/vector-icons';
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';

import {
  TemplateApprovalService,
  ApprovalRequest,
  ApprovalStatus,
  ApprovalComment,
} from '../../services/TemplateApprovalService';

interface TemplateApprovalWorkflowProps {
  requestId: string;
  userId: string;
  isReviewer: boolean;
  onStatusChange?: (status: ApprovalStatus) => void;
}

export function TemplateApprovalWorkflow({
  requestId,
  userId,
  isReviewer,
  onStatusChange,
}: TemplateApprovalWorkflowProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [request, setRequest] = useState<ApprovalRequest | null>(null);
  const [comment, setComment] = useState('');
  const [changes, setChanges] = useState<string[]>([]);
  const [newChange, setNewChange] = useState('');
  const [expandedComments, setExpandedComments] = useState<Set<string>>(
    new Set()
  );

  const _approvalService = TemplateApprovalService.getInstance();

  useEffect(() => {
    loadRequest();
  }, [requestId]);

  const _loadRequest = async () => {
    setLoading(true);
    try {
      const _data = await approvalService.getApprovalRequest(requestId);
      setRequest(data);
    } catch (error) {
      console.error('Error loading approval request:', error);
    } finally {
      setLoading(false);
    }
  };

  const _handleStatusUpdate = async (status: ApprovalStatus) => {
    try {
      await approvalService.updateApprovalStatus(
        requestId,
        status,
        userId,
        comment
      );
      setComment('');
      await loadRequest();
      onStatusChange?.(status);
    } catch (error) {
      console.error('Error updating status:', error);
      Alert.window.alert(t('error.title'), t('error.updateStatus'));
    }
  };

  const _handleAddComment = async () => {
    if (!comment.trim()) return;

    try {
      await approvalService.addComment(requestId, userId, comment);
      setComment('');
      await loadRequest();
    } catch (error) {
      console.error('Error adding comment:', error);
      Alert.window.alert(t('error.title'), t('error.addComment'));
    }
  };

  const _handleRequestChanges = async () => {
    if (changes.length === 0) {
      Alert.window.alert(t('error.title'), t('error.noChanges'));
      return;
    }

    try {
      await approvalService.requestChanges(requestId, userId, changes, comment);
      setComment('');
      setChanges([]);
      await loadRequest();
    } catch (error) {
      console.error('Error requesting changes:', error);
      Alert.window.alert(t('error.title'), t('error.requestChanges'));
    }
  };

  const _handleAddChange = () => {
    if (!newChange.trim()) return;
    setChanges([...changes, newChange.trim()]);
    setNewChange('');
  };

  const _handleRemoveChange = (index: number) => {
    setChanges(changes.filter((_, i) => i !== index));
  };

  const _toggleCommentExpansion = (commentId: string) => {
    const _newExpanded = new Set(expandedComments);
    if (newExpanded.has(commentId)) {
      newExpanded.delete(commentId);
    } else {
      newExpanded.add(commentId);
    }
    setExpandedComments(newExpanded);
  };

  const _renderStatusBadge = (status: ApprovalStatus) => (
    <View style={[styles.statusBadge, getStatusStyle(status)]}>
      <Text style={styles.statusText}>{t(`status.${status}`)}</Text>
    </View>
  );

  const _renderCommentType = (type: ApprovalComment['type']) => {
    let icon: string;
    let color: string;

    switch (type) {
      case 'approval':
        icon = 'checkmark-circle';
        color = '#28a745';
        break;
      case 'rejection':
        icon = 'close-circle';
        color = '#dc3545';
        break;
      case 'change_request':
        icon = 'git-pull-request';
        color = '#ffc107';
        break;
      default:
        icon = 'chatbubble';
        color = '#6c757d';
    }

    return <Ionicons name={icon as any} size={20} color={color} />;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!request) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{t('error.requestNotFound')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Text style={styles.title}>
              {t('approval.requestTitle', { id: request.id })}
            </Text>
            {renderStatusBadge(request.status)}
          </View>
          <Text style={styles.subtitle}>
            {t('approval.submittedBy', {
              user: request.submittedBy,
              date: new Date(request.submittedAt).toLocaleDateString(),
            })}
          </Text>
        </View>

        {request.changes.length > 0 && (
          <View style={styles.changesContainer}>
            <Text style={styles.sectionTitle}>
              {t('approval.requestedChanges')}
            </Text>
            {request.changes.map((change, index) => (
              <View key={index} style={styles.changeItem}>
                <Ionicons name="alert-circle" size={20} color="#ffc107" />
                <Text style={styles.changeText}>{change}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.commentsContainer}>
          <Text style={styles.sectionTitle}>{t('approval.comments')}</Text>
          {request.comments?.map(comment => (
            <View key={comment.id} style={styles.commentCard}>
              <View style={styles.commentHeader}>
                {renderCommentType(comment.type)}
                <Text style={styles.commentAuthor}>{comment.userId}</Text>
                <Text style={styles.commentTime}>
                  {new Date(comment.timestamp).toLocaleString()}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => toggleCommentExpansion(comment.id)}
              >
                <Text
                  style={[
                    styles.commentText,
                    !expandedComments.has(comment.id) &&
                      styles.commentCollapsed,
                  ]}
                >
                  {comment.message}
                </Text>
              </TouchableOpacity>
              {comment.location && (
                <View style={styles.commentLocation}>
                  <Text style={styles.locationText}>
                    {comment.location.field}
                    {comment.location.context &&
                      `: ${comment.location.context}`}
                  </Text>
                </View>
              )}
            </View>
          ))}
        </View>

        {isReviewer && request.status === 'pending' && (
          <View style={styles.reviewActions}>
            <Text style={styles.sectionTitle}>
              {t('approval.requestChanges')}
            </Text>
            <View style={styles.changeInput}>
              <TextInput
                style={styles.input}
                value={newChange}
                onChangeText={setNewChange}
                placeholder={t('approval.changePlaceholder')}
                multiline
              />
              <TouchableOpacity
                style={styles.addButton}
                onPress={handleAddChange}
              >
                <Ionicons name="add" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            {changes.map((change, index) => (
              <View key={index} style={styles.changeItem}>
                <Text style={styles.changeText}>{change}</Text>
                <TouchableOpacity onPress={() => handleRemoveChange(index)}>
                  <Ionicons name="close" size={20} color="#dc3545" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <View style={styles.commentInput}>
          <TextInput
            style={styles.input}
            value={comment}
            onChangeText={setComment}
            placeholder={t('approval.commentPlaceholder')}
            multiline
          />
          <TouchableOpacity
            style={styles.sendButton}
            onPress={handleAddComment}
          >
            <Ionicons name="send" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {isReviewer && request.status === 'pending' && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.button, styles.rejectButton]}
            onPress={() => handleStatusUpdate('rejected')}
          >
            <Text style={styles.buttonText}>{t('approval.reject')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.changesButton]}
            onPress={handleRequestChanges}
          >
            <Text style={styles.buttonText}>
              {t('approval.requestChanges')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.approveButton]}
            onPress={() => handleStatusUpdate('approved')}
          >
            <Text style={styles.buttonText}>{t('approval.approve')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const _styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
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
    padding: 16,
  },
  errorText: {
    fontSize: 16,
    color: '#dc3545',
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  changesContainer: {
    padding: 16,
    backgroundColor: '#fff9db',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  changeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  changeText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
  },
  commentsContainer: {
    padding: 16,
  },
  commentCard: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  commentAuthor: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  commentTime: {
    fontSize: 12,
    color: '#666',
    marginLeft: 'auto',
  },
  commentText: {
    fontSize: 14,
    lineHeight: 20,
  },
  commentCollapsed: {
    maxHeight: 60,
    overflow: 'hidden',
  },
  commentLocation: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#e9ecef',
    borderRadius: 4,
  },
  locationText: {
    fontSize: 12,
    color: '#495057',
  },
  reviewActions: {
    padding: 16,
    backgroundColor: '#f8f9fa',
  },
  changeInput: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  input: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginRight: 8,
    fontSize: 14,
  },
  addButton: {
    backgroundColor: '#28a745',
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  commentInput: {
    padding: 16,
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  sendButton: {
    backgroundColor: '#007AFF',
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  button: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  rejectButton: {
    backgroundColor: '#dc3545',
  },
  changesButton: {
    backgroundColor: '#ffc107',
  },
  approveButton: {
    backgroundColor: '#28a745',
  },
});

function getStatusStyle(status: ApprovalStatus): any {
  switch (status) {
    case 'approved':
      return { backgroundColor: '#28a745' };
    case 'rejected':
      return { backgroundColor: '#dc3545' };
    case 'changes_requested':
      return { backgroundColor: '#ffc107' };
    case 'pending':
      return { backgroundColor: '#007AFF' };
    default:
      return { backgroundColor: '#6c757d' };
  }
}
