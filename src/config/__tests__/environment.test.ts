import {
  environment,
  getApiUrl,
  getWebSocketUrl,
  getAssetUrl,
  isDevelopment,
  isProduction,
} from '../environment';

jest.mock('../environment', () => ({
  environment: {
    production: true,
    baseUrl: 'https://eri-ethio.com/tiktoktoe',
    apiUrl: 'https://eri-ethio.com/tiktoktoe/api',
    wsUrl: 'https://eri-ethio.com/tiktoktoe/ws',
    version: '1.0.0',
    buildDate: '2025-01-15T21:37:30-06:00',
  },
  getApiUrl: jest.requireActual('../environment').getApiUrl,
  getWebSocketUrl: jest.requireActual('../environment').getWebSocketUrl,
  getAssetUrl: jest.requireActual('../environment').getAssetUrl,
  isDevelopment: jest.requireActual('../environment').isDevelopment,
  isProduction: jest.requireActual('../environment').isProduction,
}));

describe('Environment Configuration', () => {
  describe('Base Configuration', () => {
    it('should have all required properties', () => {
      expect(environment).toHaveProperty('production');
      expect(environment).toHaveProperty('baseUrl');
      expect(environment).toHaveProperty('apiUrl');
      expect(environment).toHaveProperty('wsUrl');
      expect(environment).toHaveProperty('version');
      expect(environment).toHaveProperty('buildDate');
    });

    it('should use production URL', () => {
      expect(environment.baseUrl).toBe('https://eri-ethio.com/tiktoktoe');
    });

    it('should have correct environment flags', () => {
      expect(environment.production).toBe(true);
      expect(isProduction()).toBe(true);
      expect(isDevelopment()).toBe(false);
    });

    it('should have the correct build date', () => {
      expect(environment.buildDate).toBe('2025-01-15T21:37:30-06:00');
    });
  });

  describe('URL Utility Functions', () => {
    it('should generate correct API URL', () => {
      const endpoint = 'users';
      const url = getApiUrl(endpoint);
      expect(url).toBe('https://eri-ethio.com/tiktoktoe/api/users');
    });

    it('should generate correct WebSocket URL', () => {
      const endpoint = 'game';
      const url = getWebSocketUrl(endpoint);
      expect(url).toBe('https://eri-ethio.com/tiktoktoe/ws/game');
    });

    it('should generate correct asset URL', () => {
      const path = 'images/logo.png';
      const url = getAssetUrl(path);
      expect(url).toBe(
        'https://eri-ethio.com/tiktoktoe/assets/images/logo.png'
      );
    });

    it('should handle leading slashes in endpoints', () => {
      expect(getApiUrl('/users')).toBe(
        'https://eri-ethio.com/tiktoktoe/api/users'
      );
      expect(getWebSocketUrl('/game')).toBe(
        'https://eri-ethio.com/tiktoktoe/ws/game'
      );
      expect(getAssetUrl('/images/logo.png')).toBe(
        'https://eri-ethio.com/tiktoktoe/assets/images/logo.png'
      );
    });

    it('should handle empty endpoints', () => {
      expect(getApiUrl('')).toBe('https://eri-ethio.com/tiktoktoe/api/');
      expect(getWebSocketUrl('')).toBe('https://eri-ethio.com/tiktoktoe/ws/');
      expect(getAssetUrl('')).toBe('https://eri-ethio.com/tiktoktoe/assets/');
    });

    it('should handle multiple slashes', () => {
      expect(getApiUrl('//users///profile')).toBe(
        'https://eri-ethio.com/tiktoktoe/api/users/profile'
      );
      expect(getWebSocketUrl('//game//room')).toBe(
        'https://eri-ethio.com/tiktoktoe/ws/game/room'
      );
      expect(getAssetUrl('//images//logo.png')).toBe(
        'https://eri-ethio.com/tiktoktoe/assets/images/logo.png'
      );
    });
  });
});
