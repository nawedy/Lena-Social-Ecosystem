import { RBACService, Role, Permission } from '../../services/RBACService';

describe('RBACService', () => {
  let rbacService: RBACService;
  const adminUserId = 'admin_user';
  const testUserId = 'test_user';

  beforeEach(() => {
    rbacService = RBACService.getInstance();
  });

  describe('Role Assignment', () => {
    it('should allow admin to assign roles', async () => {
      // Setup admin role
      await rbacService.assignRole('system', adminUserId, Role.ADMIN);

      // Test role assignment
      await expect(
        rbacService.assignRole(adminUserId, testUserId, Role.VIEWER)
      ).resolves.not.toThrow();

      // Verify role assignment
      const permissions = await rbacService.getUserPermissions(testUserId);
      expect(permissions).toContain(Permission.VIEW_ANALYTICS);
    });

    it('should prevent non-admin from assigning roles', async () => {
      await rbacService.assignRole('system', testUserId, Role.VIEWER);

      await expect(
        rbacService.assignRole(testUserId, 'other_user', Role.VIEWER)
      ).rejects.toThrow('Access denied');
    });

    it('should handle role expiration', async () => {
      await rbacService.assignRole('system', adminUserId, Role.ADMIN);

      const expiresAt = new Date(Date.now() + 1000); // 1 second from now
      await rbacService.assignRole(adminUserId, testUserId, Role.VIEWER, {}, expiresAt);

      // Initially should have permissions
      let permissions = await rbacService.getUserPermissions(testUserId);
      expect(permissions).toContain(Permission.VIEW_ANALYTICS);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Should no longer have permissions
      permissions = await rbacService.getUserPermissions(testUserId);
      expect(permissions).not.toContain(Permission.VIEW_ANALYTICS);
    });
  });

  describe('Permission Validation', () => {
    it('should validate permissions correctly', async () => {
      await rbacService.assignRole('system', testUserId, Role.ANALYST);

      // Should allow permitted actions
      await expect(
        rbacService.validateAccess(testUserId, 'analytics', Permission.VIEW_ANALYTICS)
      ).resolves.toBe(true);

      // Should deny unpermitted actions
      await expect(
        rbacService.validateAccess(testUserId, 'system', Permission.MANAGE_SYSTEM)
      ).rejects.toThrow('Access denied');
    });

    it('should handle role inheritance', async () => {
      await rbacService.assignRole('system', testUserId, Role.MANAGER);

      const permissions = await rbacService.getUserPermissions(testUserId);
      expect(permissions).toContain(Permission.VIEW_ANALYTICS);
      expect(permissions).toContain(Permission.MANAGE_ACCOUNTS);
      expect(permissions).not.toContain(Permission.MANAGE_SYSTEM);
    });
  });

  describe('Account Access', () => {
    it('should return accessible accounts', async () => {
      const scope = {
        accounts: ['account1', 'account2'],
      };

      await rbacService.assignRole('system', testUserId, Role.ANALYST, scope);

      const accounts = await rbacService.getAccessibleAccounts(
        testUserId,
        Permission.VIEW_ANALYTICS
      );

      expect(accounts).toContain('account1');
      expect(accounts).toContain('account2');
      expect(accounts).toHaveLength(2);
    });
  });

  describe('Audit Logging', () => {
    it('should log role assignments', async () => {
      await rbacService.assignRole('system', adminUserId, Role.ADMIN);
      await rbacService.assignRole(adminUserId, testUserId, Role.VIEWER);

      const logs = await rbacService.getAuditLogs(adminUserId, {
        actions: ['assign_role'],
      });

      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].action).toBe('assign_role');
      expect(logs[0].metadata.status).toBe('success');
    });

    it('should log access denials', async () => {
      await rbacService.assignRole('system', testUserId, Role.VIEWER);

      try {
        await rbacService.validateAccess(
          testUserId,
          'system',
          Permission.MANAGE_SYSTEM
        );
      } catch (error) {
        // Expected error
      }

      const logs = await rbacService.getAuditLogs(adminUserId, {
        actions: ['access_denied'],
      });

      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].action).toBe('access_denied');
      expect(logs[0].metadata.status).toBe('failure');
    });
  });
});
