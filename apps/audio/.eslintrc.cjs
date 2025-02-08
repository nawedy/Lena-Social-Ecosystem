module.exports = {
  root: true,
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:svelte/recommended',
    'prettier'
  ],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'svelte'],
  parserOptions: {
    sourceType: 'module',
    ecmaVersion: 2020,
    extraFileExtensions: ['.svelte']
  },
  env: {
    browser: true,
    es2017: true,
    node: true
  },
  overrides: [
    {
      files: ['*.svelte'],
      parser: 'svelte-eslint-parser',
      parserOptions: {
        parser: '@typescript-eslint/parser'
      }
    }
  ],
  settings: {
    'svelte/typescript': () => require('typescript')
  },
  rules: {
    // TypeScript
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-non-null-assertion': 'warn',
    '@typescript-eslint/no-empty-interface': 'warn',
    '@typescript-eslint/ban-ts-comment': 'warn',

    // Svelte
    'svelte/valid-compile': 'error',
    'svelte/no-at-html-tags': 'warn',
    'svelte/require-store-callbacks-use-set-param': 'error',
    'svelte/require-store-reactive-access': 'error',
    'svelte/valid-each-key': 'error',
    'svelte/no-reactive-functions': 'error',
    'svelte/no-reactive-literals': 'error',
    'svelte/no-store-async': 'error',

    // General
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'no-debugger': 'warn',
    'no-alert': 'warn',
    'no-var': 'error',
    'prefer-const': 'error',
    'prefer-template': 'error',
    'prefer-destructuring': ['error', { object: true, array: false }],
    'object-shorthand': 'error',
    'arrow-body-style': ['error', 'as-needed'],
    'no-unused-expressions': ['error', { allowShortCircuit: true, allowTernary: true }],
    'no-param-reassign': ['error', { props: false }],
    'no-use-before-define': ['error', { functions: false, classes: true }],
    'no-shadow': 'off',
    '@typescript-eslint/no-shadow': ['error'],
    'import/prefer-default-export': 'off',
    'import/no-extraneous-dependencies': 'off',

    // Accessibility
    'jsx-a11y/alt-text': 'error',
    'jsx-a11y/anchor-has-content': 'error',
    'jsx-a11y/anchor-is-valid': 'error',
    'jsx-a11y/aria-props': 'error',
    'jsx-a11y/aria-proptypes': 'error',
    'jsx-a11y/aria-role': 'error',
    'jsx-a11y/role-has-required-aria-props': 'error',
    'jsx-a11y/role-supports-aria-props': 'error',
    'jsx-a11y/tabindex-no-positive': 'error',

    // Security
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    'security/detect-object-injection': 'off',
    'security/detect-non-literal-regexp': 'off',
    'security/detect-non-literal-require': 'off',

    // Performance
    'no-await-in-loop': 'warn',
    'no-iterator': 'error',
    'no-restricted-syntax': [
      'error',
      'ForInStatement',
      'LabeledStatement',
      'WithStatement'
    ]
  },
  ignorePatterns: [
    'build',
    'dist',
    'node_modules',
    '.svelte-kit',
    '*.cjs',
    'vite.config.ts',
    'svelte.config.js'
  ]
}; 