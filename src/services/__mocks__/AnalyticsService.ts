export const trackEvent = jest.fn();
export const trackError = jest.fn();
export const trackMetric = jest.fn();
export const startSpan = jest.fn();
export const endSpan = jest.fn();

export const AnalyticsService = {
  trackEvent: jest.fn(),
  trackMetric: jest.fn(),
  trackError: jest.fn(),
  getInstance: jest.fn().mockReturnValue({
    initialize: jest.fn().mockResolvedValue(undefined),
    isInitialized: jest.fn().mockReturnValue(true),
    trackEvent: jest.fn(),
    trackMetric: jest.fn(),
    trackError: jest.fn(),
  }),
  initialize: jest.fn().mockResolvedValue(undefined),
  isInitialized: jest.fn().mockReturnValue(true),
};
