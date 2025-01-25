import { z } from 'zod';

// Provider-specific configurations
export const OpenAIConfig = z.object({
  apiKey: z.string(),
  orgId: z.string().optional(),
  model: z.string(),
  temperature: z.number().min(0).max(2),
  maxTokens: z.number().positive(),
  topP: z.number().min(0).max(1),
  frequencyPenalty: z.number().min(-2).max(2),
  presencePenalty: z.number().min(-2).max(2),
  stop: z.array(z.string()).optional(),
});

export const AnthropicConfig = z.object({
  apiKey: z.string(),
  model: z.string(),
  maxTokens: z.number().positive(),
  temperature: z.number().min(0).max(1),
  topK: z.number().positive().optional(),
  topP: z.number().min(0).max(1),
  metadata: z.record(z.string()).optional(),
});

export const StabilityConfig = z.object({
  apiKey: z.string(),
  engine: z.string(),
  steps: z.number().positive(),
  cfgScale: z.number().positive(),
  samples: z.number().positive(),
  seed: z.number().optional(),
  stylePreset: z.string().optional(),
});

// Load balancing configuration
export const LoadBalancingConfig = z.object({
  strategy: z.enum(['round-robin', 'weighted', 'latency-based', 'cost-based']),
  providers: z.array(
    z.object({
      name: z.string(),
      weight: z.number().min(0).max(1),
      maxConcurrent: z.number().positive(),
      cooldown: z.number().nonnegative(),
    })
  ),
  failover: z.object({
    enabled: z.boolean(),
    maxAttempts: z.number().positive(),
    backoffMultiplier: z.number().positive(),
    initialDelay: z.number().positive(),
  }),
});

// Rate limiting configuration
export const RateLimitConfig = z.object({
  enabled: z.boolean(),
  windowMs: z.number().positive(),
  maxRequests: z.number().positive(),
  keyBy: z.enum(['ip', 'user', 'token']),
  strategy: z.enum(['fixed', 'sliding', 'token-bucket']),
  cost: z.object({
    default: z.number().positive(),
    byEndpoint: z.record(z.number().positive()),
  }),
});

// Content filtering configuration
export const ContentFilterConfig = z.object({
  enabled: z.boolean(),
  mode: z.enum(['strict', 'moderate', 'permissive']),
  filters: z.array(
    z.object({
      type: z.enum([
        'toxicity',
        'profanity',
        'bias',
        'personal-info',
        'custom',
      ]),
      threshold: z.number().min(0).max(1),
      action: z.enum(['block', 'flag', 'replace']),
      replacement: z.string().optional(),
    })
  ),
  customPatterns: z.array(
    z.object({
      pattern: z.string(),
      flags: z.string(),
      action: z.enum(['block', 'flag', 'replace']),
      replacement: z.string().optional(),
    })
  ),
});

// Monitoring configuration
export const MonitoringConfig = z.object({
  metrics: z.object({
    enabled: z.boolean(),
    interval: z.number().positive(),
    retention: z.object({
      raw: z.number().positive(),
      aggregated: z.number().positive(),
    }),
  }),
  alerts: z.object({
    enabled: z.boolean(),
    channels: z.array(z.enum(['email', 'slack', 'webhook'])),
    thresholds: z.object({
      errorRate: z.number().min(0).max(1),
      latency: z.number().positive(),
      costPerHour: z.number().positive(),
    }),
  }),
  logging: z.object({
    level: z.enum(['debug', 'info', 'warn', 'error']),
    format: z.enum(['json', 'text']),
    destination: z.enum(['console', 'file', 'service']),
    rotation: z.object({
      enabled: z.boolean(),
      maxSize: z.string(),
      maxFiles: z.number().positive(),
    }),
  }),
});

// Cache configuration
export const CacheConfig = z.object({
  enabled: z.boolean(),
  provider: z.enum(['memory', 'redis', 'memcached']),
  ttl: z.number().positive(),
  maxSize: z.number().positive(),
  strategy: z.enum(['lru', 'lfu', 'fifo']),
  compression: z.object({
    enabled: z.boolean(),
    algorithm: z.enum(['gzip', 'brotli', 'lz4']),
    level: z.number().min(1).max(9),
  }),
});

// Security configuration
export const SecurityConfig = z.object({
  encryption: z.object({
    enabled: z.boolean(),
    algorithm: z.string(),
    keyRotation: z.object({
      enabled: z.boolean(),
      interval: z.number().positive(),
    }),
  }),
  rateLimit: RateLimitConfig,
  authentication: z.object({
    required: z.boolean(),
    methods: z.array(z.enum(['api-key', 'oauth', 'jwt'])),
    session: z.object({
      duration: z.number().positive(),
      renewalThreshold: z.number().positive(),
    }),
  }),
  validation: z.object({
    enabled: z.boolean(),
    sanitize: z.boolean(),
    maxContentLength: z.number().positive(),
    allowedMimeTypes: z.array(z.string()),
  }),
});

// Analytics configuration
export const AnalyticsConfig = z.object({
  enabled: z.boolean(),
  sampling: z.object({
    enabled: z.boolean(),
    rate: z.number().min(0).max(1),
  }),
  retention: z.object({
    raw: z.number().positive(),
    aggregated: z.number().positive(),
  }),
  export: z.object({
    enabled: z.boolean(),
    format: z.enum(['csv', 'json', 'parquet']),
    schedule: z.string(),
    destination: z.enum(['s3', 'gcs', 'azure']),
  }),
});

// Cost management configuration
export const CostConfig = z.object({
  tracking: z.object({
    enabled: z.boolean(),
    granularity: z.enum(['request', 'hour', 'day']),
    breakdown: z.array(z.enum(['provider', 'model', 'user', 'feature'])),
  }),
  budgets: z.array(
    z.object({
      name: z.string(),
      limit: z.number().positive(),
      period: z.enum(['daily', 'weekly', 'monthly']),
      alerts: z.array(
        z.object({
          threshold: z.number().min(0).max(1),
          channels: z.array(z.string()),
        })
      ),
    })
  ),
  optimization: z.object({
    enabled: z.boolean(),
    strategies: z.array(
      z.enum(['model-selection', 'batch-processing', 'caching', 'compression'])
    ),
    rules: z.array(
      z.object({
        condition: z.string(),
        action: z.string(),
        priority: z.number(),
      })
    ),
  }),
});

// Complete AI configuration
export const AIConfig = z.object({
  providers: z.object({
    openai: OpenAIConfig,
    anthropic: AnthropicConfig,
    stability: StabilityConfig,
  }),
  loadBalancing: LoadBalancingConfig,
  rateLimit: RateLimitConfig,
  contentFilter: ContentFilterConfig,
  monitoring: MonitoringConfig,
  cache: CacheConfig,
  security: SecurityConfig,
  analytics: AnalyticsConfig,
  cost: CostConfig,
});

export type AIConfiguration = z.infer<typeof AIConfig>;

// Configuration validation and loading
export class AIConfigurationManager {
  private static instance: AIConfigurationManager;
  private config: AIConfiguration;

  private constructor() {
    this.config = this.loadConfiguration();
  }

  public static getInstance(): AIConfigurationManager {
    if (!AIConfigurationManager.instance) {
      AIConfigurationManager.instance = new AIConfigurationManager();
    }
    return AIConfigurationManager.instance;
  }

  private loadConfiguration(): AIConfiguration {
    try {
      // Load configuration from environment variables or configuration file
      const config = {
        // ... load configuration values
      };

      // Validate configuration
      return AIConfig.parse(config);
    } catch (error) {
      console.error('Error loading AI configuration:', error);
      throw error;
    }
  }

  public getConfig(): AIConfiguration {
    return this.config;
  }

  public updateConfig(newConfig: Partial<AIConfiguration>): void {
    try {
      // Merge existing config with new config
      const mergedConfig = {
        ...this.config,
        ...newConfig,
      };

      // Validate merged configuration
      this.config = AIConfig.parse(mergedConfig);
    } catch (error) {
      console.error('Error updating AI configuration:', error);
      throw error;
    }
  }

  public validateConfig(config: Partial<AIConfiguration>): boolean {
    try {
      AIConfig.parse(config);
      return true;
    } catch (_error) {
      return false;
    }
  }
}
