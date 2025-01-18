module.exports = {
  root: true,
  extends: ['./.eslintrc.base.js'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: ['./tsconfig.json'],
    tsconfigRootDir: __dirname,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true
    }
  },
  plugins: [
    '@typescript-eslint',
    'react',
    'react-hooks',
    'import',
    'jest',
    'prettier',
    'react-native-a11y'
  ],
  env: {
    browser: true,
    node: true,
    es6: true,
    jest: true,
    'react-native/react-native': true
  },
  globals: {
    window: true,
    document: true,
    navigator: true,
    fetch: true,
    console: true,
    process: true,
    setTimeout: true,
    clearTimeout: true,
    setInterval: true,
    clearInterval: true,
    Buffer: true,
    NodeModule: true,
    auth: true,
    logger: true,
    FullMetadata: true,
    userDoc: true,
    userData: true,
    unsubscribe: true,
    global: true,
    jest: true,
    expect: true,
    describe: true,
    it: true,
    beforeAll: true,
    beforeEach: true,
    afterAll: true,
    afterEach: true,
    require: true,
    module: true,
    performance: true,
    PerformanceObserver: true,
    __dirname: true
  },
  settings: {
    react: {
      version: 'detect'
    },
    'import/parsers': {
      '@typescript-eslint/parser': ['.ts', '.tsx']
    },
    'import/resolver': {
      typescript: {
        alwaysTryTypes: true,
        project: ['./tsconfig.json']
      },
      node: {
        extensions: ['.js', '.jsx', '.ts', '.tsx'],
        moduleDirectory: ['node_modules', 'src/', 'mobile/src/'],
        paths: ['src', 'mobile/src']
      }
    }
  },
  rules: {
    'prettier/prettier': 'error',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-vars': ['error', { 
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_'
    }],
    '@typescript-eslint/ban-types': ['error', {
      types: {
        '{}': false
      },
      extendDefaults: true
    }],
    '@typescript-eslint/no-non-null-assertion': 'warn',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    'react/react-in-jsx-scope': 'off',
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'no-undef': 'error',
    'import/no-unresolved': ['error', { 
      ignore: ['^@', 'react-native', 'react-native-.*', '@react-native.*', 'detox'] 
    }],
    'import/order': [
      'error',
      {
        groups: [
          'builtin',
          'external',
          'internal',
          ['parent', 'sibling'],
          'index'
        ],
        'newlines-between': 'always',
        alphabetize: {
          order: 'asc',
          caseInsensitive: true
        },
        pathGroups: [
          {
            pattern: 'react',
            group: 'external',
            position: 'before'
          },
          {
            pattern: '@atproto/**',
            group: 'external',
            position: 'after'
          }
        ],
        pathGroupsExcludedImportTypes: ['react']
      }
    ],
    'react-native-a11y/has-accessibility-hint': 'error',
    'react-native-a11y/has-accessibility-props': 'error',
    'react-native-a11y/has-valid-accessibility-role': 'error'
  }
}
