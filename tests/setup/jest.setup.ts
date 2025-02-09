import '@testing-library/jest-dom';
import { setGlobalDispatcher, MockAgent } from 'undici';
import { loadEnvConfig } from '@next/env';
import { api } from '../api/utils/api-client';

// Load environment variables
loadEnvConfig(process.cwd());

// Extend Jest matchers
expect.extend({
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () =>
          `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },
  toBeValidUrl(received: string) {
    try {
      new URL(received);
      return {
        message: () => `expected ${received} not to be a valid URL`,
        pass: true,
      };
    } catch {
      return {
        message: () => `expected ${received} to be a valid URL`,
        pass: false,
      };
    }
  },
  toBeISODate(received: string) {
    const isValid = !isNaN(Date.parse(received));
    return {
      message: () =>
        isValid
          ? `expected ${received} not to be an ISO date string`
          : `expected ${received} to be an ISO date string`,
      pass: isValid,
    };
  },
});

// Configure global test timeout
jest.setTimeout(30000);

// Configure mock HTTP client
const mockAgent = new MockAgent();
mockAgent.disableNetConnect();
setGlobalDispatcher(mockAgent);

// Configure API client for testing
api.defaults.baseURL = process.env.TEST_API_URL || 'http://localhost:3000/api';
api.defaults.validateStatus = null;

// Global beforeAll hook
beforeAll(async () => {
  // Add any global setup here
});

// Global afterAll hook
afterAll(async () => {
  // Add any global cleanup here
  await mockAgent.close();
});

// Global beforeEach hook
beforeEach(() => {
  // Reset all mocks before each test
  jest.clearAllMocks();
  mockAgent.reset();
});

// Global afterEach hook
afterEach(() => {
  // Clean up after each test
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: any) => {
  console.error('Unhandled Promise Rejection:', reason);
});

// Configure console to not pollute test output
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleLog = console.log;

console.error = (...args: any[]) => {
  if (
    typeof args[0] === 'string' &&
    args[0].includes('Warning: An update to') &&
    args[0].includes('inside a test was not wrapped in act')
  ) {
    return;
  }
  originalConsoleError.apply(console, args);
};

console.warn = (...args: any[]) => {
  if (
    typeof args[0] === 'string' &&
    args[0].includes('Warning: componentWillReceiveProps')
  ) {
    return;
  }
  originalConsoleWarn.apply(console, args);
};

if (process.env.JEST_HIDE_LOGS) {
  console.log = () => {};
  console.warn = () => {};
  console.error = () => {};
} else {
  console.log = originalConsoleLog;
  console.warn = originalConsoleWarn;
  console.error = originalConsoleError;
}

// Add custom matchers to TypeScript
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeWithinRange(floor: number, ceiling: number): R;
      toBeValidUrl(): R;
      toBeISODate(): R;
    }
  }
} 