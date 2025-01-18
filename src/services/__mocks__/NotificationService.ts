export const NotificationService = {
  sendNotification: jest.fn(),
  sendEmail: jest.fn(),
  sendPush: jest.fn(),
  subscribe: jest.fn(),
  unsubscribe: jest.fn(),
  getSubscriptions: jest.fn(),
  initialize: jest.fn(),
  isInitialized: jest.fn().mockReturnValue(true),
};
