module.exports = {
  extends: ['../.eslintrc.base.js'],
  env: {
    node: true,
  },
  parserOptions: {
    project: ['../tsconfig.json'],
    tsconfigRootDir: __dirname,
  },
  settings: {
    'import/resolver': {
      typescript: {
        project: ['../tsconfig.json'],
      },
    },
  },
  rules: {
    '@typescript-eslint/no-var-requires': 'off',
    'import/no-commonjs': 'off',
  },
};
