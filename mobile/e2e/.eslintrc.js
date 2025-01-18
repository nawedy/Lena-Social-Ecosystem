module.exports = {
  extends: ['../../.eslintrc.base.js'],
  env: {
    jest: true,
    'detox/detox': true,
  },
  plugins: ['detox'],
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
    'import/no-unresolved': ['error', {
      ignore: ['detox']
    }]
  }
};
