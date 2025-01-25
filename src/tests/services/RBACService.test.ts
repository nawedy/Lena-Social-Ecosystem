/// <reference types="jest" />

import type { Mock } from 'jest';

import { AnalyticsService } from '../../services/AnalyticsService';
import { RBACService, Role, Permission } from '../../services/RBACService';

// Import Jest types

// Mock analytics service
jest.mock('../../services/AnalyticsService');

describe('RBACService', () => {
  let rbacService: RBACService;
  const testUserId = 'test_user';
  const adminUserId = 'admin_user';

  beforeEach(async () => {
    rbacService = RBACService.getInstance();
    await rbacService.initialize();

    // Reset mocks
    const mockAnalytics =
      AnalyticsService.getInstance() as jest.Mocked<AnalyticsService>;
    mockAnalytics.trackEvent.mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Role Management', () => {
    it('should assign roles correctly', async () => {
      const userId = 'new_user';
      await rbacService.setUserRole(userId, Role.USER);
      const role: Role = await rbacService.getUserRole(userId);
      expect(role).toBe(Role.USER);
    });

    it('should handle role updates', async () => {
      await rbacService.setUserRole(testUserId, Role.ADMIN);
      const role: Role = await rbacService.getUserRole(testUserId);
      expect(role).toBe(Role.ADMIN);
    });

    it('should prevent assigning invalid roles', async () => {
      await expect(
        rbacService.setUserRole(testUserId, 'invalid_role' as Role)
      ).rejects.toThrow();
    });
  });

  describe('Permission Management', () => {
    it('should grant permissions correctly', async () => {
      await rbacService.grantPermission(testUserId, Permission.READ);
      const hasPermission: boolean = await rbacService.hasPermission(
        testUserId,
        Permission.READ
      );
      expect(hasPermission).toBe(true);
    });

    it('should revoke permissions correctly', async () => {
      await rbacService.grantPermission(testUserId, Permission.WRITE);
      await rbacService.revokePermission(testUserId, Permission.WRITE);
      const hasPermission: boolean = await rbacService.hasPermission(
        testUserId,
        Permission.WRITE
      );
      expect(hasPermission).toBe(false);
    });

    it('should handle multiple permissions', async () => {
      await rbacService.grantPermission(testUserId, Permission.READ);
      await rbacService.grantPermission(testUserId, Permission.WRITE);

      expect(await rbacService.hasPermission(testUserId, Permission.READ)).toBe(
        true
      );
      expect(
        await rbacService.hasPermission(testUserId, Permission.WRITE)
      ).toBe(true);
      expect(
        await rbacService.hasPermission(testUserId, Permission.DELETE)
      ).toBe(false);
    });
  });
});
