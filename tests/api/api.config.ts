import { defineConfig } from '@jest/types';

const config = defineConfig({
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/setup.ts'],
  testMatch: ['**/*.api.test.ts'],
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: 'reports/api',
      outputName: 'api-test-results.xml',
      classNameTemplate: '{filepath}',
      titleTemplate: '{title}'
    }],
    ['./reporters/api-report.ts', {
      outputFile: 'reports/api/detailed-report.html',
      includeConsoleLog: true,
      includeSuccessfulRequests: true
    }]
  ],
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.test.json'
    }
  },
  testTimeout: 30000,
  maxConcurrency: 5,
  verbose: true,
  collectCoverage: true,
  coverageDirectory: 'coverage/api',
  coverageReporters: ['text', 'html', 'lcov'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
});

export default config; 