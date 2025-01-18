module.exports = {
  extends: ['../.eslintrc.base.js', 'plugin:react-native/all', 'plugin:react-native-a11y/all'],
  plugins: ['react-native'],
  env: {
    'react-native/react-native': true,
  },
  parserOptions: {
    project: ['../tsconfig.json', './tsconfig.json'],
    tsconfigRootDir: __dirname,
  },
  settings: {
    'import/resolver': {
      typescript: {
        project: ['../tsconfig.json', './tsconfig.json'],
      },
    },
  },
};
