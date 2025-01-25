import {
  jest,
  describe,
  beforeEach,
  afterEach,
  it,
  expect,
} from '@jest/globals';

import { NotificationService } from '../../services/NotificationService';
import { RBACService } from '../../services/RBACService';

// Mock APM service
jest.mock('@elastic/apm-rum', () => ({
  init: jest.fn(),
  setUserContext: jest.fn(),
  setCustomContext: jest.fn(),
  startTransaction: jest.fn(),
  startSpan: jest.fn(),
}));

describe('NotificationService', () => {
  let notificationService: NotificationService;
  let rbac: RBACService;
  const testUserId = 'test_user';
  const adminUserId = 'admin_user';

  beforeEach(() => {
    notificationService = NotificationService.getInstance();
    rbac = RBACService.getInstance();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      await notificationService.initialize();
      expect(notificationService.isInitialized()).toBe(true);
    });

    it('should not initialize twice', async () => {
      await notificationService.initialize();
      await notificationService.initialize();
      expect(notificationService.isInitialized()).toBe(true);
    });
  });

  describe('Notification Rules', () => {
    beforeEach(async () => {
      await notificationService.initialize();
      // Setup test users
      await rbac.assignRole('system', adminUserId, 'admin');
      await rbac.assignRole('system', testUserId, 'analyst');
    });

    it('should create notification rules', async () => {
      const ruleId = await notificationService.createNotificationRule({
        name: 'Test Rule',
        condition: {
          type: 'metric',
          metric: 'engagement',
          operator: '>',
          threshold: 0.8,
        },
        channels: ['email', 'in_app'],
        template: 'high_engagement',
        recipients: {
          roles: ['analyst'],
        },
      });

      expect(ruleId).toBeDefined();
      expect(typeof ruleId).toBe('string');
    });

    it('should create notification templates', async () => {
      const templateId = await notificationService.createTemplate({
        name: 'High Engagement',
        type: 'email',
        subject: 'High Engagement Alert',
        content:
          'Your content has achieved high engagement: {{engagement_rate}}',
        variables: ['engagement_rate'],
        locale: 'en',
      });

      expect(templateId).toBeDefined();
      expect(typeof templateId).toBe('string');
    });
  });

  describe('Sending Notifications', () => {
    beforeEach(async () => {
      await notificationService.initialize();
    });

    it('should send single notification', async () => {
      const notificationId = await notificationService.sendNotification(
        'in_app',
        'Test Notification',
        'This is a test notification',
        [testUserId],
        {
          type: 'test',
          data: { foo: 'bar' },
        }
      );

      expect(notificationId).toBeDefined();

      const status =
        await notificationService.checkNotificationStatus(notificationId);
      expect(status).toBe('sent');
    });

    it('should send bulk notifications', async () => {
      const notifications = [
        {
          type: 'in_app' as const,
          subject: 'Test 1',
          content: 'Content 1',
          recipients: [testUserId],
        },
        {
          type: 'in_app' as const,
          subject: 'Test 2',
          content: 'Content 2',
          recipients: [testUserId],
        },
      ];

      const notificationIds =
        await notificationService.sendBulkNotifications(notifications);

      expect(notificationIds).toHaveLength(2);
      expect(Array.isArray(notificationIds)).toBe(true);
    });

    it('should handle notification status updates', async () => {
      const notificationId = await notificationService.sendNotification(
        'in_app',
        'Test Notification',
        'This is a test notification',
        [testUserId]
      );

      // Mark as read
      await notificationService.markNotificationAsRead(
        notificationId,
        testUserId
      );

      const status =
        await notificationService.checkNotificationStatus(notificationId);
      expect(status).toBe('read');
    });
  });

  describe('Notification Retrieval', () => {
    beforeEach(async () => {
      await notificationService.initialize();
    });

    it('should get unread notifications', async () => {
      // Send multiple notifications
      await Promise.all([
        notificationService.sendNotification('in_app', 'Test 1', 'Content 1', [
          testUserId,
        ]),
        notificationService.sendNotification('in_app', 'Test 2', 'Content 2', [
          testUserId,
        ]),
      ]);

      const unread =
        await notificationService.getUnreadNotifications(testUserId);

      expect(unread.length).toBeGreaterThan(0);
      expect(unread[0]).toHaveProperty('status', 'sent');
    });

    it('should handle notification subscriptions', async () => {
      await notificationService.subscribeToNotifications(testUserId, [
        'email',
        'push',
      ]);

      // Send notification
      const notificationId = await notificationService.sendNotification(
        'email',
        'Test Notification',
        'This is a test notification',
        [testUserId]
      );

      const status =
        await notificationService.checkNotificationStatus(notificationId);
      expect(status).toBe('sent');
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await notificationService.initialize();
    });

    it('should handle invalid notification types', async () => {
      await expect(
        notificationService.sendNotification(
          'invalid_type' as unknown,
          'Test',
          'Content',
          [testUserId]
        )
      ).rejects.toThrow();
    });

    it('should handle invalid recipients', async () => {
      await expect(
        notificationService.sendNotification('in_app', 'Test', 'Content', [
          'invalid_user',
        ])
      ).rejects.toThrow();
    });

    it('should handle invalid notification IDs', async () => {
      await expect(
        notificationService.checkNotificationStatus('invalid_id')
      ).rejects.toThrow();
    });
  });

  describe('Performance', () => {
    beforeEach(async () => {
      await notificationService.initialize();
    });

    it('should handle large bulk notifications efficiently', async () => {
      const notifications = Array.from({ length: 100 }, (_, i) => ({
        type: 'in_app' as const,
        subject: `Test ${i}`,
        content: `Content ${i}`,
        recipients: [testUserId],
      }));

      const startTime = Date.now();
      const notificationIds =
        await notificationService.sendBulkNotifications(notifications);
      const endTime = Date.now();

      expect(notificationIds).toHaveLength(100);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });

  describe('Template Handling', () => {
    beforeEach(async () => {
      await notificationService.initialize();
    });

    it('should handle template variables correctly', async () => {
      const templateId = await notificationService.createTemplate({
        name: 'Variable Test',
        type: 'in_app',
        content: 'Hello {{name}}, your score is {{score}}',
        variables: ['name', 'score'],
        locale: 'en',
      });

      const notificationId = await notificationService.sendNotification(
        'in_app',
        'Variable Test',
        'Hello John, your score is 100',
        [testUserId],
        {
          template: templateId,
          variables: {
            name: 'John',
            score: '100',
          },
        }
      );

      const status =
        await notificationService.checkNotificationStatus(notificationId);
      expect(status).toBe('sent');
    });
  });
});
