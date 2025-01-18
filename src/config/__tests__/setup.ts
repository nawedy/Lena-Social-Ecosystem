import { describe, it, expect } from '@jest/globals';

declare global {
  let __DEV__: boolean;
}

globalThis.__DEV__ = true;

// Mock process.env
process.env = {
  ...process.env,
  NODE_ENV: 'test',
  REACT_APP_ENVIRONMENT: 'test',
};

describe('Test Environment Setup', () => {
  it('should have proper test environment variables', () => {
    expect(process.env.NODE_ENV).toBe('test');
    expect(process.env.REACT_APP_ENVIRONMENT).toBe('test');
  });

  it('should have proper mocks configured', () => {
    expect(globalThis.__DEV__).toBe(true);
  });
});
