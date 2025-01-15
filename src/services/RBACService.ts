import { AnalyticsService } from './AnalyticsService';

export enum Permission {
  // Analytics Permissions
  VIEW_ANALYTICS = 'view_analytics',
  VIEW_CONSOLIDATED_ANALYTICS = 'view_consolidated_analytics',
  EXPORT_ANALYTICS = 'export_analytics',
  SHARE_ANALYTICS = 'share_analytics',
  CREATE_CUSTOM_REPORTS = 'create_custom_reports',
  
  // Account Management
  MANAGE_ACCOUNTS = 'manage_accounts',
  VIEW_ACCOUNTS = 'view_accounts',
  LINK_ACCOUNTS = 'link_accounts',
  UNLINK_ACCOUNTS = 'unlink_accounts',
  
  // Migration Permissions
  INITIATE_MIGRATION = 'initiate_migration',
  VIEW_MIGRATION_STATUS = 'view_migration_status',
  CANCEL_MIGRATION = 'cancel_migration',
  CONFIGURE_MIGRATION = 'configure_migration',
  SCHEDULE_MIGRATION = 'schedule_migration',
  
  // Content Management
  CREATE_CONTENT = 'create_content',
  EDIT_CONTENT = 'edit_content',
  DELETE_CONTENT = 'delete_content',
  PUBLISH_CONTENT = 'publish_content',
  SCHEDULE_CONTENT = 'schedule_content',
  
  // User Management
  MANAGE_USERS = 'manage_users',
  VIEW_USERS = 'view_users',
  ASSIGN_ROLES = 'assign_roles',
  REVOKE_ROLES = 'revoke_roles',
  
  // System Configuration
  MANAGE_SYSTEM = 'manage_system',
  VIEW_SYSTEM = 'view_system',
  CONFIGURE_AI = 'configure_ai',
  MANAGE_INTEGRATIONS = 'manage_integrations',
  
  // Notification Management
  MANAGE_NOTIFICATIONS = 'manage_notifications',
  VIEW_NOTIFICATIONS = 'view_notifications',
  SEND_NOTIFICATIONS = 'send_notifications',
  
  // Audit Management
  VIEW_AUDIT_LOGS = 'view_audit_logs',
  EXPORT_AUDIT_LOGS = 'export_audit_logs'
}

export enum Role {
  ADMIN = 'admin',
  MANAGER = 'manager',
  ANALYST = 'analyst',
  CREATOR = 'creator',
  VIEWER = 'viewer'
}

interface RoleDefinition {
  name: Role;
  permissions: Permission[];
  inherits?: Role[];
}

interface UserRole {
  userId: string;
  role: Role;
  scope: {
    accounts?: string[];
    teams?: string[];
    features?: string[];
  };
  grantedAt: Date;
  grantedBy: string;
  expiresAt?: Date;
}

interface AuditLog {
  id: string;
  timestamp: Date;
  userId: string;
  action: string;
  resource: string;
  resourceId?: string;
  oldValue?: any;
  newValue?: any;
  metadata: {
    ip?: string;
    userAgent?: string;
    location?: string;
    status: 'success' | 'failure';
    reason?: string;
  };
}

export class RBACService {
  private static instance: RBACService;
  private roleDefinitions: Map<Role, RoleDefinition>;
  private userRoles: Map<string, UserRole[]>;
  private auditLogs: AuditLog[];
  private permissionCache: Map<string, Set<Permission>>;

  private constructor() {
    this.roleDefinitions = this.initializeRoleDefinitions();
    this.userRoles = new Map();
    this.auditLogs = [];
    this.permissionCache = new Map();
  }

  public static getInstance(): RBACService {
    if (!RBACService.instance) {
      RBACService.instance = new RBACService();
    }
    return RBACService.instance;
  }

  private initializeRoleDefinitions(): Map<Role, RoleDefinition> {
    const definitions = new Map<Role, RoleDefinition>();

    // Admin Role
    definitions.set(Role.ADMIN, {
      name: Role.ADMIN,
      permissions: Object.values(Permission),
    });

    // Manager Role
    definitions.set(Role.MANAGER, {
      name: Role.MANAGER,
      permissions: [
        Permission.VIEW_ANALYTICS,
        Permission.VIEW_CONSOLIDATED_ANALYTICS,
        Permission.EXPORT_ANALYTICS,
        Permission.SHARE_ANALYTICS,
        Permission.CREATE_CUSTOM_REPORTS,
        Permission.MANAGE_ACCOUNTS,
        Permission.VIEW_ACCOUNTS,
        Permission.LINK_ACCOUNTS,
        Permission.UNLINK_ACCOUNTS,
        Permission.INITIATE_MIGRATION,
        Permission.VIEW_MIGRATION_STATUS,
        Permission.CANCEL_MIGRATION,
        Permission.CONFIGURE_MIGRATION,
        Permission.SCHEDULE_MIGRATION,
        Permission.CREATE_CONTENT,
        Permission.EDIT_CONTENT,
        Permission.DELETE_CONTENT,
        Permission.PUBLISH_CONTENT,
        Permission.SCHEDULE_CONTENT,
        Permission.VIEW_USERS,
        Permission.MANAGE_NOTIFICATIONS,
        Permission.VIEW_NOTIFICATIONS,
        Permission.SEND_NOTIFICATIONS,
        Permission.VIEW_AUDIT_LOGS,
      ],
    });

    // Analyst Role
    definitions.set(Role.ANALYST, {
      name: Role.ANALYST,
      permissions: [
        Permission.VIEW_ANALYTICS,
        Permission.VIEW_CONSOLIDATED_ANALYTICS,
        Permission.EXPORT_ANALYTICS,
        Permission.CREATE_CUSTOM_REPORTS,
        Permission.VIEW_ACCOUNTS,
        Permission.VIEW_MIGRATION_STATUS,
        Permission.VIEW_NOTIFICATIONS,
      ],
    });

    // Creator Role
    definitions.set(Role.CREATOR, {
      name: Role.CREATOR,
      permissions: [
        Permission.VIEW_ANALYTICS,
        Permission.CREATE_CONTENT,
        Permission.EDIT_CONTENT,
        Permission.PUBLISH_CONTENT,
        Permission.SCHEDULE_CONTENT,
        Permission.VIEW_ACCOUNTS,
        Permission.VIEW_MIGRATION_STATUS,
        Permission.VIEW_NOTIFICATIONS,
      ],
    });

    // Viewer Role
    definitions.set(Role.VIEWER, {
      name: Role.VIEWER,
      permissions: [
        Permission.VIEW_ANALYTICS,
        Permission.VIEW_ACCOUNTS,
        Permission.VIEW_MIGRATION_STATUS,
        Permission.VIEW_NOTIFICATIONS,
      ],
    });

    return definitions;
  }

  public async assignRole(
    adminUserId: string,
    targetUserId: string,
    role: Role,
    scope?: UserRole['scope'],
    expiresAt?: Date
  ): Promise<void> {
    // Validate admin permissions
    await this.validateAccess(adminUserId, 'system', Permission.ASSIGN_ROLES);

    const userRole: UserRole = {
      userId: targetUserId,
      role,
      scope: scope || {},
      grantedAt: new Date(),
      grantedBy: adminUserId,
      expiresAt,
    };

    const userRoles = this.userRoles.get(targetUserId) || [];
    userRoles.push(userRole);
    this.userRoles.set(targetUserId, userRoles);

    // Clear permission cache
    this.permissionCache.delete(targetUserId);

    // Log audit
    await this.logAudit({
      userId: adminUserId,
      action: 'assign_role',
      resource: 'user_role',
      resourceId: targetUserId,
      newValue: userRole,
      metadata: {
        status: 'success',
      },
    });
  }

  public async revokeRole(
    adminUserId: string,
    targetUserId: string,
    role: Role
  ): Promise<void> {
    // Validate admin permissions
    await this.validateAccess(adminUserId, 'system', Permission.REVOKE_ROLES);

    const userRoles = this.userRoles.get(targetUserId) || [];
    const oldRoles = [...userRoles];
    const newRoles = userRoles.filter(r => r.role !== role);
    this.userRoles.set(targetUserId, newRoles);

    // Clear permission cache
    this.permissionCache.delete(targetUserId);

    // Log audit
    await this.logAudit({
      userId: adminUserId,
      action: 'revoke_role',
      resource: 'user_role',
      resourceId: targetUserId,
      oldValue: oldRoles,
      newValue: newRoles,
      metadata: {
        status: 'success',
      },
    });
  }

  public async validateAccess(
    userId: string,
    resource: string,
    permission: Permission
  ): Promise<boolean> {
    const userPermissions = await this.getUserPermissions(userId);
    
    if (!userPermissions.has(permission)) {
      await this.logAudit({
        userId,
        action: 'access_denied',
        resource,
        metadata: {
          status: 'failure',
          reason: `Missing permission: ${permission}`,
        },
      });
      throw new Error(`Access denied: Missing permission ${permission}`);
    }

    await this.logAudit({
      userId,
      action: 'access_granted',
      resource,
      metadata: {
        status: 'success',
      },
    });

    return true;
  }

  public async getUserPermissions(userId: string): Promise<Set<Permission>> {
    // Check cache first
    if (this.permissionCache.has(userId)) {
      return this.permissionCache.get(userId)!;
    }

    const userRoles = this.userRoles.get(userId) || [];
    const permissions = new Set<Permission>();

    // Filter out expired roles
    const activeRoles = userRoles.filter(
      role => !role.expiresAt || role.expiresAt > new Date()
    );

    // Collect permissions from all active roles
    for (const userRole of activeRoles) {
      const roleDefinition = this.roleDefinitions.get(userRole.role);
      if (roleDefinition) {
        roleDefinition.permissions.forEach(p => permissions.add(p));
        
        // Add inherited permissions
        if (roleDefinition.inherits) {
          for (const inheritedRole of roleDefinition.inherits) {
            const inheritedDefinition = this.roleDefinitions.get(inheritedRole);
            if (inheritedDefinition) {
              inheritedDefinition.permissions.forEach(p => permissions.add(p));
            }
          }
        }
      }
    }

    // Cache the permissions
    this.permissionCache.set(userId, permissions);

    return permissions;
  }

  public async getAccessibleAccounts(
    userId: string,
    permission: Permission
  ): Promise<string[]> {
    const userRoles = this.userRoles.get(userId) || [];
    const accounts = new Set<string>();

    // Check each role for account access
    for (const role of userRoles) {
      if (role.expiresAt && role.expiresAt <= new Date()) continue;

      const roleDefinition = this.roleDefinitions.get(role.role);
      if (roleDefinition?.permissions.includes(permission)) {
        // Add accounts from role scope
        role.scope.accounts?.forEach(account => accounts.add(account));
      }
    }

    return Array.from(accounts);
  }

  public async getAuditLogs(
    userId: string,
    filters?: {
      startDate?: Date;
      endDate?: Date;
      actions?: string[];
      resources?: string[];
      status?: 'success' | 'failure';
    }
  ): Promise<AuditLog[]> {
    // Validate access
    await this.validateAccess(userId, 'audit_logs', Permission.VIEW_AUDIT_LOGS);

    let logs = [...this.auditLogs];

    // Apply filters
    if (filters) {
      if (filters.startDate) {
        logs = logs.filter(log => log.timestamp >= filters.startDate!);
      }
      if (filters.endDate) {
        logs = logs.filter(log => log.timestamp <= filters.endDate!);
      }
      if (filters.actions) {
        logs = logs.filter(log => filters.actions!.includes(log.action));
      }
      if (filters.resources) {
        logs = logs.filter(log => filters.resources!.includes(log.resource));
      }
      if (filters.status) {
        logs = logs.filter(log => log.metadata.status === filters.status);
      }
    }

    return logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  private async logAudit(
    log: Omit<AuditLog, 'id' | 'timestamp'>
  ): Promise<void> {
    const auditLog: AuditLog = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      ...log,
    };

    this.auditLogs.push(auditLog);

    // Trim old logs if needed
    if (this.auditLogs.length > 10000) {
      this.auditLogs = this.auditLogs.slice(-10000);
    }
  }
}
