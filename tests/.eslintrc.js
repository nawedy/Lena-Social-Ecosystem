module.exports = {
  extends: ['../.eslintrc.base.js', 'plugin:jest/recommended'],
  env: {
    jest: true,
  },
  plugins: ['jest'],
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
};
