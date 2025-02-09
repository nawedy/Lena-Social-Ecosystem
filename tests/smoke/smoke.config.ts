import { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
  testDir: './specs',
  timeout: 30000,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'smoke-report' }],
    ['junit', { outputFile: 'smoke-results.xml' }]
  ],
  use: {
    baseURL: process.env.APP_URL || 'http://localhost:3000',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure'
  },
  projects: [
    {
      name: 'critical-path',
      testMatch: /critical-path\.spec\.ts/
    },
    {
      name: 'core-features',
      testMatch: /core-features\.spec\.ts/
    },
    {
      name: 'integrations',
      testMatch: /integrations\.spec\.ts/
    }
  ],
  globalSetup: require.resolve('./global-setup'),
  globalTeardown: require.resolve('./global-teardown')
};

export default config; 