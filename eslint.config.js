import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import prettierPlugin from 'eslint-plugin-prettier';

export default [
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2021,
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true
        },
        project: './tsconfig.json'
      },
      globals: {
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        console: 'readonly',
        process: 'readonly',
        require: 'readonly',
        module: 'readonly',
        __dirname: 'readonly',
        global: 'readonly',
        Buffer: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        crypto: 'readonly',
        Blob: 'readonly',
        WebSocket: 'readonly',
        IDBKeyRange: 'readonly',
        IDBIndexParameters: 'readonly',
        jest: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeAll: 'readonly',
        beforeEach: 'readonly',
        afterAll: 'readonly',
        afterEach: 'readonly',
        NodeJS: 'readonly',
        performance: 'readonly',
        PerformanceObserver: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        Response: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        registration: 'readonly',
        // React Native globals
        TextInput: 'readonly',
        ActivityIndicator: 'readonly',
        Platform: 'readonly',
        View: 'readonly',
        Image: 'readonly',
        File: 'readonly',
        HTMLCanvasElement: 'readonly',
        CanvasRenderingContext2D: 'readonly',
        HTMLImageElement: 'readonly',
        PushSubscription: 'readonly',
        Request: 'readonly',
        HandlebarsTemplateDelegate: 'readonly',
        HTMLInputElement: 'readonly'
      }
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      'react': reactPlugin,
      'react-hooks': reactHooksPlugin,
      'prettier': prettierPlugin
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      ...reactPlugin.configs.recommended.rules,
      ...reactHooksPlugin.configs.recommended.rules,
      'prettier/prettier': 'error',
      'react/react-in-jsx-scope': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { 
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        ignoreRestSiblings: true
      }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-undef': 'error',
      'react/jsx-no-undef': 'off',
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/rules-of-hooks': 'error',
      '@typescript-eslint/no-var-requires': 'off',
      'no-case-declarations': 'off',
      'no-prototype-builtins': 'off',
      'no-constant-condition': 'off',
      'no-unreachable': 'off',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      'no-unexpected-multiline': 'error',
      'no-redeclare': 'error'
    },
    settings: {
      react: {
        version: 'detect'
      }
    }
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      globals: {
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        console: 'readonly',
        process: 'readonly',
        require: 'readonly',
        module: 'readonly',
        __dirname: 'readonly',
        global: 'readonly',
        performance: 'readonly',
        PerformanceObserver: 'readonly'
      }
    }
  },
  {
    ignores: [
      'node_modules/',
      'build/',
      'dist/',
      '*.config.js',
      'eslint.config.js',
      '.eslintrc.js',
      'jest.config.js',
      'jest.setup.js',
      'jest.setup.tsx',
      'coverage/',
      'public/',
      'scripts/',
      'mobile/e2e/',
      'mobile/.loki/'
    ]
  }
];
