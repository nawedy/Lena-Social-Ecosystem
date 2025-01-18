export const Role = {
  ADMIN: 'admin',
  USER: 'user',
  GUEST: 'guest',
};

export const Permission = {
  READ: 'read',
  WRITE: 'write',
  DELETE: 'delete',
  EXECUTE: 'execute',
};

export const RBACService = {
  hasPermission: jest.fn().mockReturnValue(true),
  grantPermission: jest.fn(),
  revokePermission: jest.fn(),
  getUserRole: jest.fn().mockReturnValue(Role.USER),
  setUserRole: jest.fn(),
  initialize: jest.fn(),
  isInitialized: jest.fn().mockReturnValue(true),
};
