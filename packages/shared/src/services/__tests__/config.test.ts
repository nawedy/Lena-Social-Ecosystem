import { configService } from '../config/GlobalConfig';

describe('Config Service', () => {
  beforeEach(() => {
    // Reset environment variables
    process.env.NODE_ENV = 'test';
  });

  describe('Configuration Loading', () => {
    it('should load default configuration', () => {
      const platform = configService.get('platform');
      expect(platform.name).toBe('LenaSocialEcosystem');
      expect(platform.version).toBe('1.0.0');
      expect(platform.environment).toBe('test');
    });

    it('should validate configuration on load', () => {
      expect(() => {
        configService['validateConfig']({
          ...configService['config'],
          platform: {
            ...configService['config'].platform,
            name: ''
          }
        });
      }).toThrow('Platform name and version are required');
    });
  });

  describe('Feature Management', () => {
    it('should check if feature is enabled', () => {
      expect(configService.isFeatureEnabled('web3Auth')).toBe(true);
      expect(configService.isFeatureEnabled('nonexistentFeature')).toBe(false);
    });

    it('should get platform limits', () => {
      expect(configService.getLimit('maxUploadSize')).toBe(1024 * 1024 * 1024); // 1GB
      expect(configService.getLimit('nonexistentLimit')).toBe(0);
    });
  });

  describe('Environment Detection', () => {
    it('should detect development environment', () => {
      process.env.NODE_ENV = 'development';
      expect(configService.isDevelopment()).toBe(true);
      expect(configService.isProduction()).toBe(false);
    });

    it('should detect production environment', () => {
      process.env.NODE_ENV = 'production';
      expect(configService.isProduction()).toBe(true);
      expect(configService.isDevelopment()).toBe(false);
    });
  });

  describe('Security Configuration', () => {
    it('should validate password policy', () => {
      expect(() => {
        configService['validateSecurityConfig']({
          ...configService['config'].security,
          passwordPolicy: {
            ...configService['config'].security.passwordPolicy,
            minLength: 6
          }
        });
      }).toThrow('Minimum password length must be at least 8 characters');
    });

    it('should have proper CORS configuration', () => {
      const security = configService.get('security');
      expect(security.corsOrigins).toContain('https://*.lena.social');
    });
  });

  describe('Storage Configuration', () => {
    it('should validate storage endpoints', () => {
      expect(() => {
        configService['validateStorageConfig']({
          ...configService['config'].storage,
          ipfsGateway: ''
        });
      }).toThrow('Storage endpoints are required');
    });

    it('should have proper file type restrictions', () => {
      const storage = configService.get('storage');
      expect(storage.allowedFileTypes).toContain('image/*');
      expect(storage.allowedFileTypes).toContain('video/*');
      expect(storage.allowedFileTypes).toContain('audio/*');
    });
  });

  describe('Database Configuration', () => {
    it('should validate database connection details', () => {
      expect(() => {
        configService['validateDatabaseConfig']({
          ...configService['config'].database,
          host: ''
        });
      }).toThrow('Database connection details are required');
    });

    it('should configure replication based on environment', () => {
      const database = configService.get('database');
      expect(database.replication.enabled).toBe(process.env.NODE_ENV === 'production');
    });
  });

  describe('Cache Configuration', () => {
    it('should validate cache connection details', () => {
      expect(() => {
        configService['validateCacheConfig']({
          ...configService['config'].cache,
          host: ''
        });
      }).toThrow('Cache connection details are required');
    });

    it('should have proper eviction policy', () => {
      const cache = configService.get('cache');
      expect(['lru', 'lfu', 'fifo']).toContain(cache.evictionPolicy);
    });
  });

  describe('Monitoring Configuration', () => {
    it('should validate monitoring settings', () => {
      expect(() => {
        configService['validateMonitoringConfig']({
          ...configService['config'].monitoring,
          enabled: true,
          metrics: {
            ...configService['config'].monitoring.metrics,
            interval: 0
          }
        });
      }).toThrow('Monitoring interval must be specified when enabled');
    });

    it('should have proper alert thresholds', () => {
      const monitoring = configService.get('monitoring');
      expect(monitoring.alerts.thresholds.cpu).toBeLessThanOrEqual(100);
      expect(monitoring.alerts.thresholds.memory).toBeLessThanOrEqual(100);
    });
  });

  describe('Web3 Configuration', () => {
    it('should validate blockchain network configuration', () => {
      expect(() => {
        configService['validateWeb3Config']({
          ...configService['config'].web3,
          networks: {}
        });
      }).toThrow('Required blockchain networks not configured');
    });

    it('should have proper IPFS configuration', () => {
      const web3 = configService.get('web3');
      expect(web3.ipfs.gateway).toBeTruthy();
      expect(web3.ipfs.pinningService).toBeTruthy();
    });
  });

  describe('Configuration Updates', () => {
    it('should update configuration with validation', async () => {
      const newPlatform = {
        ...configService.get('platform'),
        version: '1.1.0'
      };

      await configService.update('platform', newPlatform);
      expect(configService.get('platform').version).toBe('1.1.0');
    });

    it('should reject invalid configuration updates', async () => {
      const invalidPlatform = {
        ...configService.get('platform'),
        name: ''
      };

      await expect(configService.update('platform', invalidPlatform))
        .rejects.toThrow('Platform name and version are required');
    });
  });

  describe('Store Functionality', () => {
    it('should provide reactive store interface', () => {
      const store = configService.getStore();
      expect(store.subscribe).toBeDefined();
      expect(store.platform).toBeDefined();
      expect(store.security).toBeDefined();
      expect(store.storage).toBeDefined();
      expect(store.database).toBeDefined();
      expect(store.cache).toBeDefined();
      expect(store.monitoring).toBeDefined();
      expect(store.web3).toBeDefined();
    });

    it('should notify subscribers of changes', (done) => {
      const store = configService.getStore();
      const unsubscribe = store.platform.subscribe(platform => {
        if (platform?.version === '1.2.0') {
          expect(platform.name).toBe('LenaSocialEcosystem');
          unsubscribe();
          done();
        }
      });

      configService.update('platform', {
        ...configService.get('platform'),
        version: '1.2.0'
      });
    });
  });
}); 