import Constants from 'expo-constants';

interface Environment {
  firebase: {
    apiKey: string;
    authDomain: string;
    projectId: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
  };
  openai: {
    apiKey: string;
    orgId: string;
  };
  contentGeneration: {
    maxTokensPerRequest: number;
    defaultAiModel: string;
    imageGenerationModel: string;
    defaultImageSize: string;
    maxImagesPerRequest: number;
  };
  templateSettings: {
    maxTemplatesPerUser: number;
    maxTemplateSizeKb: number;
    templateCacheDuration: number;
    autoArchiveDays: number;
  };
  rateLimits: {
    requests: number;
    windowMs: number;
    concurrent: number;
  };
  security: {
    jwtSecret: string;
    jwtExpiry: string;
    encryptionKey: string;
    secureCookie: boolean;
  };
  analytics: {
    enabled: boolean;
    trackingId: string;
    logLevel: string;
  };
  featureFlags: {
    enableTemplateSharing: boolean;
    enableAiGeneration: boolean;
    enableAnalytics: boolean;
    enableNotifications: boolean;
  };
  notifications: {
    smtp: {
      host: string;
      port: number;
      user: string;
      pass: string;
    };
    emailFrom: string;
  };
  storage: {
    maxUploadSizeMb: number;
    allowedFileTypes: string[];
    provider: string;
  };
  cache: {
    redisUrl: string;
    ttl: number;
    prefix: string;
  };
  externalServices: {
    slackWebhookUrl: string;
    discordWebhookUrl: string;
  };
  development: {
    debug: boolean;
    devPort: number;
    apiBaseUrl: string;
  };
}

const getEnvironment = (): Environment => {
  const env = Constants.manifest?.extra?.env || 'development';
  
  // Common configuration
  const common = {
    contentGeneration: {
      maxTokensPerRequest: Number(process.env.MAX_TOKENS_PER_REQUEST) || 2000,
      defaultAiModel: process.env.DEFAULT_AI_MODEL || 'gpt-4',
      imageGenerationModel: process.env.IMAGE_GENERATION_MODEL || 'dall-e-3',
      defaultImageSize: process.env.DEFAULT_IMAGE_SIZE || '1024x1024',
      maxImagesPerRequest: Number(process.env.MAX_IMAGES_PER_REQUEST) || 4,
    },
    templateSettings: {
      maxTemplatesPerUser: Number(process.env.MAX_TEMPLATES_PER_USER) || 100,
      maxTemplateSizeKb: Number(process.env.MAX_TEMPLATE_SIZE_KB) || 500,
      templateCacheDuration: Number(process.env.TEMPLATE_CACHE_DURATION) || 3600,
      autoArchiveDays: Number(process.env.AUTO_ARCHIVE_DAYS) || 90,
    },
    rateLimits: {
      requests: Number(process.env.RATE_LIMIT_REQUESTS) || 100,
      windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 3600000,
      concurrent: Number(process.env.RATE_LIMIT_CONCURRENT) || 5,
    },
    analytics: {
      enabled: process.env.ANALYTICS_ENABLED === 'true',
      trackingId: process.env.TRACKING_ID || '',
      logLevel: process.env.LOG_LEVEL || 'info',
    },
    featureFlags: {
      enableTemplateSharing: process.env.ENABLE_TEMPLATE_SHARING === 'true',
      enableAiGeneration: process.env.ENABLE_AI_GENERATION === 'true',
      enableAnalytics: process.env.ENABLE_ANALYTICS === 'true',
      enableNotifications: process.env.ENABLE_NOTIFICATIONS === 'true',
    },
    storage: {
      maxUploadSizeMb: Number(process.env.MAX_UPLOAD_SIZE_MB) || 10,
      allowedFileTypes: (process.env.ALLOWED_FILE_TYPES || '').split(','),
      provider: process.env.STORAGE_PROVIDER || 'firebase',
    },
    cache: {
      ttl: Number(process.env.CACHE_TTL) || 3600,
      prefix: process.env.CACHE_PREFIX || 'tiktok_toe_',
    },
  };

  const environments: Record<string, Environment> = {
    development: {
      ...common,
      firebase: {
        apiKey: process.env.FIREBASE_API_KEY || '',
        authDomain: process.env.FIREBASE_AUTH_DOMAIN || '',
        projectId: process.env.FIREBASE_PROJECT_ID || '',
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET || '',
        messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '',
        appId: process.env.FIREBASE_APP_ID || '',
      },
      openai: {
        apiKey: process.env.OPENAI_API_KEY || '',
        orgId: process.env.OPENAI_ORG_ID || '',
      },
      security: {
        jwtSecret: process.env.JWT_SECRET || 'dev_secret',
        jwtExpiry: process.env.JWT_EXPIRY || '24h',
        encryptionKey: process.env.ENCRYPTION_KEY || 'dev_key',
        secureCookie: false,
      },
      notifications: {
        smtp: {
          host: process.env.SMTP_HOST || 'localhost',
          port: Number(process.env.SMTP_PORT) || 587,
          user: process.env.SMTP_USER || '',
          pass: process.env.SMTP_PASS || '',
        },
        emailFrom: process.env.EMAIL_FROM || 'noreply@localhost',
      },
      cache: {
        ...common.cache,
        redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
      },
      externalServices: {
        slackWebhookUrl: process.env.SLACK_WEBHOOK_URL || '',
        discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL || '',
      },
      development: {
        debug: true,
        devPort: Number(process.env.DEV_PORT) || 3000,
        apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3000',
      },
    },
    production: {
      ...common,
      firebase: {
        apiKey: process.env.FIREBASE_API_KEY || '',
        authDomain: process.env.FIREBASE_AUTH_DOMAIN || '',
        projectId: process.env.FIREBASE_PROJECT_ID || '',
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET || '',
        messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '',
        appId: process.env.FIREBASE_APP_ID || '',
      },
      openai: {
        apiKey: process.env.OPENAI_API_KEY || '',
        orgId: process.env.OPENAI_ORG_ID || '',
      },
      security: {
        jwtSecret: process.env.JWT_SECRET || '',
        jwtExpiry: process.env.JWT_EXPIRY || '24h',
        encryptionKey: process.env.ENCRYPTION_KEY || '',
        secureCookie: true,
      },
      notifications: {
        smtp: {
          host: process.env.SMTP_HOST || '',
          port: Number(process.env.SMTP_PORT) || 587,
          user: process.env.SMTP_USER || '',
          pass: process.env.SMTP_PASS || '',
        },
        emailFrom: process.env.EMAIL_FROM || '',
      },
      cache: {
        ...common.cache,
        redisUrl: process.env.REDIS_URL || '',
      },
      externalServices: {
        slackWebhookUrl: process.env.SLACK_WEBHOOK_URL || '',
        discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL || '',
      },
      development: {
        debug: false,
        devPort: Number(process.env.DEV_PORT) || 3000,
        apiBaseUrl: process.env.API_BASE_URL || '',
      },
    },
    test: {
      ...common,
      firebase: {
        apiKey: 'test_key',
        authDomain: 'test.firebaseapp.com',
        projectId: 'test-project',
        storageBucket: 'test-bucket',
        messagingSenderId: 'test_sender',
        appId: 'test_app_id',
      },
      openai: {
        apiKey: 'test_key',
        orgId: 'test_org',
      },
      security: {
        jwtSecret: 'test_secret',
        jwtExpiry: '24h',
        encryptionKey: 'test_key',
        secureCookie: false,
      },
      notifications: {
        smtp: {
          host: 'localhost',
          port: 1025,
          user: 'test',
          pass: 'test',
        },
        emailFrom: 'test@localhost',
      },
      cache: {
        ...common.cache,
        redisUrl: 'redis://localhost:6379',
      },
      externalServices: {
        slackWebhookUrl: '',
        discordWebhookUrl: '',
      },
      development: {
        debug: true,
        devPort: 3000,
        apiBaseUrl: 'http://localhost:3000',
      },
    },
  };

  return environments[env];
};

export const environment = getEnvironment();

// Utility functions for environment checks
export const isDevelopment = () => Constants.manifest?.extra?.env === 'development';
export const isProduction = () => Constants.manifest?.extra?.env === 'production';
export const isTest = () => Constants.manifest?.extra?.env === 'test';

// Feature flag checks
export const isFeatureEnabled = (feature: keyof typeof environment.featureFlags) =>
  environment.featureFlags[feature];

// Rate limit checks
export const getRateLimit = (type: keyof typeof environment.rateLimits) =>
  environment.rateLimits[type];

// Content generation settings
export const getContentGenerationSetting = (
  setting: keyof typeof environment.contentGeneration
) => environment.contentGeneration[setting];

// Template settings
export const getTemplateSetting = (
  setting: keyof typeof environment.templateSettings
) => environment.templateSettings[setting];

// Analytics settings
export const getAnalyticsSetting = (
  setting: keyof typeof environment.analytics
) => environment.analytics[setting];

export default environment;
