import { RBACService, Role, Permission } from '../../services/RBACService';

// Mock analytics service
jest.mock('../../services/AnalyticsService');

describe('RBACService', () => {
  let rbacService: RBACService;
  const testUserId = 'test_user';
  const adminUserId = 'admin_user';

  beforeEach(async () => {
    rbacService = RBACService.getInstance();
    await rbacService.initialize();

    // Setup test data
    await rbacService.setUserRole(adminUserId, Role.ADMIN);
    await rbacService.setUserRole(testUserId, Role.USER);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Role Management', () => {
    it('should assign roles correctly', async () => {
      const userId = 'new_user';
      await rbacService.setUserRole(userId, Role.USER);
      const role = await rbacService.getUserRole(userId);
      expect(role).toBe(Role.USER);
    });

    it('should handle role updates', async () => {
      await rbacService.setUserRole(testUserId, Role.ADMIN);
      const role = await rbacService.getUserRole(testUserId);
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
      const hasPermission = await rbacService.hasPermission(
        testUserId,
        Permission.READ
      );
      expect(hasPermission).toBe(true);
    });

    it('should revoke permissions correctly', async () => {
      await rbacService.grantPermission(testUserId, Permission.WRITE);
      await rbacService.revokePermission(testUserId, Permission.WRITE);
      const hasPermission = await rbacService.hasPermission(
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

  describe('Role-based Permissions', () => {
    it('should grant admin all permissions', async () => {
      const permissions = Object.values(Permission);
      for (const permission of permissions) {
        const hasPermission = await rbacService.hasPermission(
          adminUserId,
          permission
        );
        expect(hasPermission).toBe(true);
      }
    });

    it('should limit user permissions', async () => {
      expect(await rbacService.hasPermission(testUserId, Permission.READ)).toBe(
        true
      );
      expect(
        await rbacService.hasPermission(testUserId, Permission.WRITE)
      ).toBe(false);
      expect(
        await rbacService.hasPermission(testUserId, Permission.DELETE)
      ).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle non-existent users', async () => {
      const hasPermission = await rbacService.hasPermission(
        'non_existent_user',
        Permission.READ
      );
      expect(hasPermission).toBe(false);
    });

    it('should handle invalid permissions', async () => {
      await expect(
        rbacService.grantPermission(
          testUserId,
          'invalid_permission' as Permission
        )
      ).rejects.toThrow();
    });
  });
});
