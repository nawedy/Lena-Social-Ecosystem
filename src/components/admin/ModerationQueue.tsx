import React, { useState, useEffect, useCallback } from 'react';
import { useATProto } from '../../hooks/useATProto';
import { ContentModerationService } from '../../services/moderation/ContentModerationService';
import { Table, Tag, Button, Modal, Space, Alert, Input, Select } from 'antd';
import { PubSub } from '@google-cloud/pubsub';

interface ModerationItem {
  id: string;
  timestamp: string;
  contentType: 'text' | 'image' | 'video';
  content: string;
  moderationResult: {
    confidence: number;
    categories: string[];
    reasons?: string[];
  };
  status: 'pending' | 'approved' | 'rejected';
  reviewer?: string;
  notes?: string;
}

export function ModerationQueue() {
  const { agent } = useATProto();
  const [items, setItems] = useState<ModerationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<ModerationItem | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewDecision, setReviewDecision] = useState<
    'approved' | 'rejected'
  >();
  const [showReviewModal, setShowReviewModal] = useState(false);

  const _moderationService = new ContentModerationService(agent);
  const _pubsub = new PubSub();

  const _loadModerationQueue = useCallback(async () => {
    try {
      setLoading(true);
      const _subscription = pubsub.subscription('human-review-queue');

      // Get messages from the queue
      const [messages] = await subscription.pull({
        maxMessages: 100,
      });

      const _queueItems = messages.map(message => ({
        id: message.id,
        ...JSON.parse(message.data.toString()),
      }));

      setItems(queueItems);
    } catch (err: any) {
      setError(err.message || 'Failed to load moderation queue');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadModerationQueue();
  }, [loadModerationQueue]);

  const _handleReview = useCallback(async () => {
    if (!selectedItem || !reviewDecision) return;

    try {
      setLoading(true);

      // Update the item status in your database
      const _topic = pubsub.topic('moderation-decisions');
      await topic.publish(
        Buffer.from(
          JSON.stringify({
            itemId: selectedItem.id,
            decision: reviewDecision,
            notes: reviewNotes,
            reviewer: agent.session?.did,
            timestamp: new Date().toISOString(),
          })
        )
      );

      // Acknowledge the message in the queue
      const _subscription = pubsub.subscription('human-review-queue');
      await subscription.ack(selectedItem.id);

      // Update local state
      setItems(prev =>
        prev.map(item =>
          item.id === selectedItem.id
            ? {
                ...item,
                status: reviewDecision,
                reviewer: agent.session?.did,
                notes: reviewNotes,
              }
            : item
        )
      );

      setShowReviewModal(false);
      setSelectedItem(null);
      setReviewNotes('');
      setReviewDecision(undefined);
    } catch (err: any) {
      setError(err.message || 'Failed to submit review');
    } finally {
      setLoading(false);
    }
  }, [selectedItem, reviewDecision, reviewNotes, agent.session?.did]);

  const _columns = [
    {
      title: 'Time',
      dataIndex: 'timestamp',
      key: 'timestamp',
      render: (text: string) => new Date(text).toLocaleString(),
    },
    {
      title: 'Type',
      dataIndex: 'contentType',
      key: 'contentType',
      render: (type: string) => (
        <Tag
          color={
            type === 'text' ? 'blue' : type === 'image' ? 'green' : 'purple'
          }
        >
          {type.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Categories',
      dataIndex: ['moderationResult', 'categories'],
      key: 'categories',
      render: (categories: string[]) => (
        <>
          {categories.map(cat => (
            <Tag key={cat} color="orange">
              {cat}
            </Tag>
          ))}
        </>
      ),
    },
    {
      title: 'Confidence',
      dataIndex: ['moderationResult', 'confidence'],
      key: 'confidence',
      render: (confidence: number) => `${(confidence * 100).toFixed(1)}%`,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag
          color={
            status === 'pending'
              ? 'gold'
              : status === 'approved'
                ? 'green'
                : 'red'
          }
        >
          {status.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Action',
      key: 'action',
      render: (_: any, record: ModerationItem) => (
        <Space>
          <Button
            type="primary"
            onClick={() => {
              setSelectedItem(record);
              setShowReviewModal(true);
            }}
            disabled={record.status !== 'pending'}
          >
            Review
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-4">Content Moderation Queue</h2>
        {error && (
          <Alert message={error} type="error" showIcon className="mb-4" />
        )}
      </div>

      <Table
        columns={columns}
        dataSource={items}
        loading={loading}
        rowKey="id"
      />

      <Modal
        title="Review Content"
        open={showReviewModal}
        onCancel={() => {
          setShowReviewModal(false);
          setSelectedItem(null);
          setReviewNotes('');
          setReviewDecision(undefined);
        }}
        footer={[
          <Button
            key="reject"
            danger
            onClick={() => setReviewDecision('rejected')}
            type={reviewDecision === 'rejected' ? 'primary' : 'default'}
          >
            Reject
          </Button>,
          <Button
            key="approve"
            type={reviewDecision === 'approved' ? 'primary' : 'default'}
            onClick={() => setReviewDecision('approved')}
          >
            Approve
          </Button>,
          <Button
            key="submit"
            type="primary"
            onClick={handleReview}
            disabled={!reviewDecision}
            loading={loading}
          >
            Submit Review
          </Button>,
        ]}
      >
        {selectedItem && (
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Content</h4>
              {selectedItem.contentType === 'text' ? (
                <p className="whitespace-pre-wrap">{selectedItem.content}</p>
              ) : (
                <img
                  src={selectedItem.content}
                  alt="Content for review"
                  className="max-w-full h-auto"
                />
              )}
            </div>
            <div>
              <h4 className="font-semibold mb-2">AI Moderation Results</h4>
              <div className="space-y-2">
                <p>
                  Confidence:{' '}
                  {(selectedItem.moderationResult.confidence * 100).toFixed(1)}%
                </p>
                <div>
                  Categories:
                  {selectedItem.moderationResult.categories.map(cat => (
                    <Tag key={cat} color="orange" className="ml-2">
                      {cat}
                    </Tag>
                  ))}
                </div>
                {selectedItem.moderationResult.reasons && (
                  <div>
                    <p>Reasons:</p>
                    <ul className="list-disc pl-5">
                      {selectedItem.moderationResult.reasons.map(
                        (reason, idx) => (
                          <li key={idx}>{reason}</li>
                        )
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Review Notes</h4>
              <Input.TextArea
                value={reviewNotes}
                onChange={e => setReviewNotes(e.target.value)}
                placeholder="Add notes about your decision..."
                rows={4}
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
