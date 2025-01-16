// Mock process.env
process.env = {
  ...process.env,
  REACT_APP_PRODUCTION_URL: 'https://eri-ethio.com/tiktoktoe',
  REACT_APP_ENVIRONMENT: 'production',
  NODE_ENV: 'production',
};
