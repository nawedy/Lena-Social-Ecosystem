import { Datastore } from '@google-cloud/datastore';
import { config } from '../config';
import { performanceMonitoring } from './performanceMonitoring';

interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  scope: 'global' | 'group' | 'instance';
  customClaims?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

interface Group {
  id: string;
  name: string;
  description: string;
  roles: string[];
  members: Array<{
    userId: string;
    roles: string[];
    joinedAt: string;
  }>;
  settings: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

interface Permission {
  id: string;
  name: string;
  description: string;
  resource: string;
  action: 'create' | 'read' | 'update' | 'delete' | 'manage' | 'execute';
  conditions?: Array<{
    field: string;
    operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'regex';
    value: any;
  }>;
}

export class AdvancedPermissionsService {
  private static instance: AdvancedPermissionsService;
  private datastore: Datastore;
  private permissionCache: Map<string, Permission>;
  private roleCache: Map<string, Role>;
  private groupCache: Map<string, Group>;
  private readonly CACHE_TTL = 300000; // 5 minutes

  private constructor() {
    this.datastore = new Datastore({
      projectId: config.gcp.projectId,
      keyFilename: config.gcp.keyFile,
    });
    this.permissionCache = new Map();
    this.roleCache = new Map();
    this.groupCache = new Map();

    // Refresh caches periodically
    setInterval(() => this.refreshCaches(), this.CACHE_TTL);
  }

  public static getInstance(): AdvancedPermissionsService {
    if (!AdvancedPermissionsService.instance) {
      AdvancedPermissionsService.instance = new AdvancedPermissionsService();
    }
    return AdvancedPermissionsService.instance;
  }

  // Role Management
  async createRole(params: {
    name: string;
    description: string;
    permissions: string[];
    scope: Role['scope'];
    customClaims?: Record<string, any>;
  }): Promise<Role> {
    const role: Role = {
      id: crypto.randomUUID(),
      name: params.name,
      description: params.description,
      permissions: params.permissions,
      scope: params.scope,
      customClaims: params.customClaims,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const key = this.datastore.key(['Role', role.id]);
    await this.datastore.save({
      key,
      data: role,
    });

    this.roleCache.set(role.id, role);
    return role;
  }

  async updateRole(roleId: string, updates: Partial<Role>): Promise<Role> {
    const key = this.datastore.key(['Role', roleId]);
    const [existingRole] = await this.datastore.get(key);

    if (!existingRole) {
      throw new Error('Role not found');
    }

    const updatedRole: Role = {
      ...existingRole,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await this.datastore.save({
      key,
      data: updatedRole,
    });

    this.roleCache.set(roleId, updatedRole);
    return updatedRole;
  }

  // Group Management
  async createGroup(params: {
    name: string;
    description: string;
    roles: string[];
    settings?: Record<string, any>;
  }): Promise<Group> {
    const group: Group = {
      id: crypto.randomUUID(),
      name: params.name,
      description: params.description,
      roles: params.roles,
      members: [],
      settings: params.settings || {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const key = this.datastore.key(['Group', group.id]);
    await this.datastore.save({
      key,
      data: group,
    });

    this.groupCache.set(group.id, group);
    return group;
  }

  async addGroupMember(
    groupId: string,
    userId: string,
    roles: string[]
  ): Promise<void> {
    const key = this.datastore.key(['Group', groupId]);
    const [group] = await this.datastore.get(key);

    if (!group) {
      throw new Error('Group not found');
    }

    group.members.push({
      userId,
      roles,
      joinedAt: new Date().toISOString(),
    });
    group.updatedAt = new Date().toISOString();

    await this.datastore.save({
      key,
      data: group,
    });

    this.groupCache.set(groupId, group);
  }

  // Permission Management
  async createPermission(params: {
    name: string;
    description: string;
    resource: string;
    action: Permission['action'];
    conditions?: Permission['conditions'];
  }): Promise<Permission> {
    const permission: Permission = {
      id: crypto.randomUUID(),
      ...params,
    };

    const key = this.datastore.key(['Permission', permission.id]);
    await this.datastore.save({
      key,
      data: permission,
    });

    this.permissionCache.set(permission.id, permission);
    return permission;
  }

  // Access Control
  async checkPermission(params: {
    userId: string;
    resource: string;
    action: Permission['action'];
    context?: Record<string, any>;
  }): Promise<boolean> {
    const startTime = Date.now();
    try {
      // Get user's roles from all groups
      const userRoles = await this.getUserRoles(params.userId);

      // Get all permissions from these roles
      const permissions = await this.getPermissionsForRoles(userRoles);

      // Check if any permission grants access
      const hasPermission = permissions.some(permission =>
        this.matchesPermission(
          permission,
          params.resource,
          params.action,
          params.context
        )
      );

      // Record performance metrics
      performanceMonitoring.recordCustomMetric({
        name: 'permission-check',
        value: Date.now() - startTime,
        labels: {
          resource: params.resource,
          action: params.action,
          result: hasPermission.toString(),
        },
      });

      return hasPermission;
    } catch (error) {
      performanceMonitoring.recordError(error as Error, {
        operation: 'checkPermission',
        params,
      });
      throw error;
    }
  }

  // Role Inheritance
  async addRoleInheritance(
    childRoleId: string,
    parentRoleId: string
  ): Promise<void> {
    const [childRole, parentRole] = await Promise.all([
      this.getRole(childRoleId),
      this.getRole(parentRoleId),
    ]);

    if (!childRole || !parentRole) {
      throw new Error('Role not found');
    }

    // Add parent's permissions to child
    const updatedPermissions = [
      ...new Set([...childRole.permissions, ...parentRole.permissions]),
    ];

    await this.updateRole(childRoleId, {
      permissions: updatedPermissions,
    });
  }

  // Group Hierarchy
  async addGroupHierarchy(
    childGroupId: string,
    parentGroupId: string
  ): Promise<void> {
    const [childGroup, parentGroup] = await Promise.all([
      this.getGroup(childGroupId),
      this.getGroup(parentGroupId),
    ]);

    if (!childGroup || !parentGroup) {
      throw new Error('Group not found');
    }

    // Add parent's roles to child
    const updatedRoles = [
      ...new Set([...childGroup.roles, ...parentGroup.roles]),
    ];

    await this.updateGroup(childGroupId, {
      roles: updatedRoles,
    });
  }

  // Private Methods
  private async getUserRoles(userId: string): Promise<string[]> {
    const query = this.datastore
      .createQuery('Group')
      .filter('members.userId', '=', userId);

    const [groups] = await this.datastore.runQuery(query);

    const roles = new Set<string>();
    groups.forEach((group: Group) => {
      // Add group-wide roles
      group.roles.forEach(role => roles.add(role));

      // Add user-specific roles within the group
      const member = group.members.find(m => m.userId === userId);
      if (member) {
        member.roles.forEach(role => roles.add(role));
      }
    });

    return Array.from(roles);
  }

  private async getPermissionsForRoles(
    roleIds: string[]
  ): Promise<Permission[]> {
    const permissions = new Set<Permission>();

    for (const roleId of roleIds) {
      const role = await this.getRole(roleId);
      if (role) {
        for (const permissionId of role.permissions) {
          const permission = await this.getPermission(permissionId);
          if (permission) {
            permissions.add(permission);
          }
        }
      }
    }

    return Array.from(permissions);
  }

  private matchesPermission(
    permission: Permission,
    resource: string,
    action: Permission['action'],
    context?: Record<string, any>
  ): boolean {
    if (permission.resource !== resource || permission.action !== action) {
      return false;
    }

    if (!permission.conditions || !context) {
      return true;
    }

    return permission.conditions.every(condition => {
      const contextValue = context[condition.field];
      if (contextValue === undefined) return false;

      switch (condition.operator) {
        case 'equals':
          return contextValue === condition.value;
        case 'contains':
          return contextValue.includes(condition.value);
        case 'startsWith':
          return contextValue.startsWith(condition.value);
        case 'endsWith':
          return contextValue.endsWith(condition.value);
        case 'regex':
          return new RegExp(condition.value).test(contextValue);
        default:
          return false;
      }
    });
  }

  private async getRole(roleId: string): Promise<Role | null> {
    // Check cache first
    if (this.roleCache.has(roleId)) {
      return this.roleCache.get(roleId)!;
    }

    // Fetch from datastore
    const key = this.datastore.key(['Role', roleId]);
    const [role] = await this.datastore.get(key);

    if (role) {
      this.roleCache.set(roleId, role);
    }

    return role || null;
  }

  private async getPermission(
    permissionId: string
  ): Promise<Permission | null> {
    // Check cache first
    if (this.permissionCache.has(permissionId)) {
      return this.permissionCache.get(permissionId)!;
    }

    // Fetch from datastore
    const key = this.datastore.key(['Permission', permissionId]);
    const [permission] = await this.datastore.get(key);

    if (permission) {
      this.permissionCache.set(permissionId, permission);
    }

    return permission || null;
  }

  private async getGroup(groupId: string): Promise<Group | null> {
    // Check cache first
    if (this.groupCache.has(groupId)) {
      return this.groupCache.get(groupId)!;
    }

    // Fetch from datastore
    const key = this.datastore.key(['Group', groupId]);
    const [group] = await this.datastore.get(key);

    if (group) {
      this.groupCache.set(groupId, group);
    }

    return group || null;
  }

  private async refreshCaches(): Promise<void> {
    try {
      // Clear existing caches
      this.permissionCache.clear();
      this.roleCache.clear();
      this.groupCache.clear();

      // Fetch and cache all permissions
      const permissionQuery = this.datastore.createQuery('Permission');
      const [permissions] = await this.datastore.runQuery(permissionQuery);
      permissions.forEach((permission: Permission) => {
        this.permissionCache.set(permission.id, permission);
      });

      // Fetch and cache all roles
      const roleQuery = this.datastore.createQuery('Role');
      const [roles] = await this.datastore.runQuery(roleQuery);
      roles.forEach((role: Role) => {
        this.roleCache.set(role.id, role);
      });

      // Fetch and cache all groups
      const groupQuery = this.datastore.createQuery('Group');
      const [groups] = await this.datastore.runQuery(groupQuery);
      groups.forEach((group: Group) => {
        this.groupCache.set(group.id, group);
      });
    } catch (error) {
      performanceMonitoring.recordError(error as Error, {
        operation: 'refreshCaches',
      });
    }
  }

  private async updateGroup(
    groupId: string,
    updates: Partial<Group>
  ): Promise<Group> {
    const key = this.datastore.key(['Group', groupId]);
    const [existingGroup] = await this.datastore.get(key);

    if (!existingGroup) {
      throw new Error('Group not found');
    }

    const updatedGroup: Group = {
      ...existingGroup,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await this.datastore.save({
      key,
      data: updatedGroup,
    });

    this.groupCache.set(groupId, updatedGroup);
    return updatedGroup;
  }
}

export const advancedPermissions = AdvancedPermissionsService.getInstance();
