import type { Config } from '@jest/types';

const config: Config.InitialOptions = {
  // Basic configuration
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '..',
  
  // Test file patterns
  testMatch: [
    '<rootDir>/tests/**/*.test.ts',
    '<rootDir>/tests/**/*.spec.ts'
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/coverage/'
  ],

  // Module resolution
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1'
  },

  // Coverage configuration
  collectCoverage: true,
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/tests/',
    '/dist/'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },

  // Test execution
  maxWorkers: '50%',
  testTimeout: 30000,
  bail: false,
  verbose: true,

  // Reporters
  reporters: [
    'default',
    [
      'jest-junit',
      {
        outputDirectory: '<rootDir>/reports/junit',
        outputName: 'junit.xml',
        classNameTemplate: '{filepath}',
        titleTemplate: '{title}',
        ancestorSeparator: ' › ',
        usePathForSuiteName: true
      }
    ],
    [
      'jest-html-reporter',
      {
        pageTitle: 'Test Report',
        outputPath: '<rootDir>/reports/html/test-report.html',
        includeFailureMsg: true,
        includeSuiteFailure: true
      }
    ]
  ],

  // Global setup and teardown
  globalSetup: '<rootDir>/tests/setup/global-setup.ts',
  globalTeardown: '<rootDir>/tests/setup/global-teardown.ts',
  setupFilesAfterEnv: ['<rootDir>/tests/setup/jest.setup.ts'],

  // Transform configuration
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tests/tsconfig.test.json',
        diagnostics: {
          warnOnly: true
        }
      }
    ]
  },

  // Environment variables
  setupFiles: ['<rootDir>/tests/setup/env.ts'],

  // Custom resolver
  resolver: '<rootDir>/tests/setup/resolver.js',

  // Global variables
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/tests/tsconfig.test.json',
      isolatedModules: true
    }
  },

  // Error handling
  errorOnDeprecated: true,
  detectLeaks: true,
  detectOpenHandles: true,

  // Caching
  cache: true,
  cacheDirectory: '<rootDir>/node_modules/.cache/jest',

  // Display configuration
  notify: true,
  notifyMode: 'failure-change',
  
  // Custom matchers
  snapshotSerializers: [
    'jest-serializer-path',
    'jest-snapshot-serializer-raw'
  ],

  // Project configuration for monorepo support
  projects: [
    {
      displayName: 'API Tests',
      testMatch: ['<rootDir>/tests/api/**/*.test.ts'],
      setupFilesAfterEnv: ['<rootDir>/tests/setup/api.setup.ts']
    },
    {
      displayName: 'Unit Tests',
      testMatch: ['<rootDir>/tests/unit/**/*.test.ts'],
      setupFilesAfterEnv: ['<rootDir>/tests/setup/unit.setup.ts']
    },
    {
      displayName: 'Integration Tests',
      testMatch: ['<rootDir>/tests/integration/**/*.test.ts'],
      setupFilesAfterEnv: ['<rootDir>/tests/setup/integration.setup.ts']
    }
  ]
};

export default config; 