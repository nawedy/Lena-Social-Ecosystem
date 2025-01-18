// Mock process.env
process.env = {
  ...process.env,
  REACT_APP_PRODUCTION_URL: 'https://eri-ethio.com/tiktoktoe',
  REACT_APP_ENVIRONMENT: 'test',
  NODE_ENV: 'test',
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
