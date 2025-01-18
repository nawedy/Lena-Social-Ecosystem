module.exports = {
  extends: ['../../.eslintrc.base.js'],
  env: {
    node: true,
    browser: true,
  },
  parserOptions: {
    project: ['../../tsconfig.json', '../tsconfig.json'],
    tsconfigRootDir: __dirname,
  },
  settings: {
    'import/resolver': {
      typescript: {
        project: ['../../tsconfig.json', '../tsconfig.json'],
      },
    },
  },
  rules: {
    '@typescript-eslint/no-var-requires': 'off',
    'import/no-commonjs': 'off',
    'import/no-default-export': 'off',
  },
};
