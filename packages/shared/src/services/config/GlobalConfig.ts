import { writable, derived } from 'svelte/store';

interface SecurityConfig {
  mfaEnabled: boolean;
  passwordPolicy: {
    minLength: number;
    requireNumbers: boolean;
    requireSymbols: boolean;
    requireUppercase: boolean;
  };
  sessionTimeout: number;
  jwtExpiration: number;
  rateLimiting: {
    enabled: boolean;
    maxRequests: number;
    windowMs: number;
  };
  corsOrigins: string[];
}

interface StorageConfig {
  ipfsGateway: string;
  cdnEndpoint: string;
  allowedFileTypes: string[];
  maxUploadSize: number;
  encryption: {
    enabled: boolean;
    algorithm: string;
    keySize: number;
  };
  backupStrategy: {
    enabled: boolean;
    interval: number;
    retention: number;
  };
}

interface DatabaseConfig {
  type: 'postgres' | 'mysql';
  host: string;
  port: number;
  maxConnections: number;
  ssl: boolean;
  replication: {
    enabled: boolean;
    readReplicas: number;
  };
  poolConfig: {
    min: number;
    max: number;
    idleTimeout: number;
  };
}

interface CacheConfig {
  type: 'redis' | 'memcached';
  host: string;
  port: number;
  ttl: number;
  maxMemory: number;
  evictionPolicy: 'lru' | 'lfu' | 'fifo';
  cluster: {
    enabled: boolean;
    nodes: number;
  };
}

interface MonitoringConfig {
  enabled: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  metrics: {
    enabled: boolean;
    interval: number;
    retention: number;
  };
  alerts: {
    enabled: boolean;
    channels: string[];
    thresholds: {
      cpu: number;
      memory: number;
      errors: number;
    };
  };
  tracing: {
    enabled: boolean;
    samplingRate: number;
  };
}

interface Web3Config {
  networks: {
    [key: string]: {
      rpcUrl: string;
      chainId: number;
      explorer: string;
    };
  };
  ipfs: {
    gateway: string;
    pinningService: string;
  };
  contracts: {
    [key: string]: {
      address: string;
      abi: any;
    };
  };
}

interface PlatformConfig {
  name: string;
  version: string;
  environment: 'development' | 'staging' | 'production';
  features: {
    [key: string]: boolean;
  };
  limits: {
    [key: string]: number;
  };
  optimization: {
    enabled: boolean;
    autoScale: boolean;
    caching: boolean;
    compression: boolean;
  };
}

interface GlobalConfig {
  platform: PlatformConfig;
  security: SecurityConfig;
  storage: StorageConfig;
  database: DatabaseConfig;
  cache: CacheConfig;
  monitoring: MonitoringConfig;
  web3: Web3Config;
}

class ConfigService {
  private config: GlobalConfig;
  private configStore = writable<GlobalConfig>(null);

  constructor() {
    this.loadConfig();
  }

  private async loadConfig() {
    try {
      // Load config from environment variables or config file
      this.config = await this.loadConfigFromSource();
      this.validateConfig(this.config);
      this.configStore.set(this.config);
    } catch (error) {
      console.error('Failed to load configuration:', error);
      throw error;
    }
  }

  private async loadConfigFromSource(): Promise<GlobalConfig> {
    // Implementation would load from env vars, config files, etc.
    const config: GlobalConfig = {
      platform: {
        name: 'LenaSocialEcosystem',
        version: '1.0.0',
        environment: process.env.NODE_ENV as any || 'development',
        features: {
          web3Auth: true,
          ipfsStorage: true,
          decentralizedSocial: true
        },
        limits: {
          maxUploadSize: 1024 * 1024 * 1024, // 1GB
          maxConcurrentUploads: 10,
          maxRequestsPerMinute: 1000
        },
        optimization: {
          enabled: true,
          autoScale: true,
          caching: true,
          compression: true
        }
      },
      security: {
        mfaEnabled: true,
        passwordPolicy: {
          minLength: 12,
          requireNumbers: true,
          requireSymbols: true,
          requireUppercase: true
        },
        sessionTimeout: 3600,
        jwtExpiration: 86400,
        rateLimiting: {
          enabled: true,
          maxRequests: 100,
          windowMs: 60000
        },
        corsOrigins: ['https://*.lena.social']
      },
      storage: {
        ipfsGateway: process.env.IPFS_GATEWAY || 'https://ipfs.io',
        cdnEndpoint: process.env.CDN_ENDPOINT || 'https://cdn.lena.social',
        allowedFileTypes: ['image/*', 'video/*', 'audio/*'],
        maxUploadSize: 1024 * 1024 * 1024,
        encryption: {
          enabled: true,
          algorithm: 'aes-256-gcm',
          keySize: 256
        },
        backupStrategy: {
          enabled: true,
          interval: 86400,
          retention: 30
        }
      },
      database: {
        type: 'postgres',
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        maxConnections: 100,
        ssl: process.env.NODE_ENV === 'production',
        replication: {
          enabled: process.env.NODE_ENV === 'production',
          readReplicas: 2
        },
        poolConfig: {
          min: 5,
          max: 20,
          idleTimeout: 10000
        }
      },
      cache: {
        type: 'redis',
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        ttl: 3600,
        maxMemory: 1024 * 1024 * 1024,
        evictionPolicy: 'lru',
        cluster: {
          enabled: process.env.NODE_ENV === 'production',
          nodes: 3
        }
      },
      monitoring: {
        enabled: true,
        logLevel: 'info',
        metrics: {
          enabled: true,
          interval: 60,
          retention: 7
        },
        alerts: {
          enabled: true,
          channels: ['email', 'slack'],
          thresholds: {
            cpu: 80,
            memory: 85,
            errors: 50
          }
        },
        tracing: {
          enabled: true,
          samplingRate: 0.1
        }
      },
      web3: {
        networks: {
          ethereum: {
            rpcUrl: process.env.ETH_RPC_URL || 'https://mainnet.infura.io/v3/',
            chainId: 1,
            explorer: 'https://etherscan.io'
          },
          polygon: {
            rpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
            chainId: 137,
            explorer: 'https://polygonscan.com'
          }
        },
        ipfs: {
          gateway: process.env.IPFS_GATEWAY || 'https://ipfs.io',
          pinningService: process.env.IPFS_PINNING_SERVICE || 'pinata'
        },
        contracts: {}
      }
    };

    return config;
  }

  private validateConfig(config: GlobalConfig) {
    // Implement validation logic for each config section
    this.validatePlatformConfig(config.platform);
    this.validateSecurityConfig(config.security);
    this.validateStorageConfig(config.storage);
    this.validateDatabaseConfig(config.database);
    this.validateCacheConfig(config.cache);
    this.validateMonitoringConfig(config.monitoring);
    this.validateWeb3Config(config.web3);
  }

  private validatePlatformConfig(config: PlatformConfig) {
    if (!config.name || !config.version) {
      throw new Error('Platform name and version are required');
    }
  }

  private validateSecurityConfig(config: SecurityConfig) {
    if (config.passwordPolicy.minLength < 8) {
      throw new Error('Minimum password length must be at least 8 characters');
    }
  }

  private validateStorageConfig(config: StorageConfig) {
    if (!config.ipfsGateway || !config.cdnEndpoint) {
      throw new Error('Storage endpoints are required');
    }
  }

  private validateDatabaseConfig(config: DatabaseConfig) {
    if (!config.host || !config.port) {
      throw new Error('Database connection details are required');
    }
  }

  private validateCacheConfig(config: CacheConfig) {
    if (!config.host || !config.port) {
      throw new Error('Cache connection details are required');
    }
  }

  private validateMonitoringConfig(config: MonitoringConfig) {
    if (config.enabled && !config.metrics.interval) {
      throw new Error('Monitoring interval must be specified when enabled');
    }
  }

  private validateWeb3Config(config: Web3Config) {
    if (!config.networks.ethereum || !config.networks.polygon) {
      throw new Error('Required blockchain networks not configured');
    }
  }

  // Public methods
  get<T extends keyof GlobalConfig>(key: T): GlobalConfig[T] {
    return this.config[key];
  }

  getStore() {
    return {
      subscribe: this.configStore.subscribe,
      platform: derived(this.configStore, $config => $config?.platform),
      security: derived(this.configStore, $config => $config?.security),
      storage: derived(this.configStore, $config => $config?.storage),
      database: derived(this.configStore, $config => $config?.database),
      cache: derived(this.configStore, $config => $config?.cache),
      monitoring: derived(this.configStore, $config => $config?.monitoring),
      web3: derived(this.configStore, $config => $config?.web3)
    };
  }

  async update(key: keyof GlobalConfig, value: any) {
    try {
      // Validate new config value
      const newConfig = { ...this.config, [key]: value };
      this.validateConfig(newConfig);

      // Update config
      this.config = newConfig;
      this.configStore.set(this.config);

      // Persist changes if needed
      await this.persistConfig();
    } catch (error) {
      console.error(`Failed to update ${key} configuration:`, error);
      throw error;
    }
  }

  private async persistConfig() {
    // Implementation would persist config changes to storage
  }

  isFeatureEnabled(feature: string): boolean {
    return this.config.platform.features[feature] || false;
  }

  getLimit(limit: string): number {
    return this.config.platform.limits[limit] || 0;
  }

  isDevelopment(): boolean {
    return this.config.platform.environment === 'development';
  }

  isProduction(): boolean {
    return this.config.platform.environment === 'production';
  }

  isOptimizationEnabled(): boolean {
    return this.config.platform.optimization.enabled;
  }
}

// Create and export singleton instance
export const configService = new ConfigService(); 