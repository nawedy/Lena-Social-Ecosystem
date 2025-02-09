import { config } from 'dotenv';
import { join } from 'path';

// Load environment variables from .env files
config({ path: join(__dirname, '../../.env') });
config({ path: join(__dirname, '../../.env.test') });

// Set default environment variables for testing
process.env.NODE_ENV = 'test';
process.env.TEST_API_URL = process.env.TEST_API_URL || 'http://localhost:3000/api';
process.env.TEST_WEB_URL = process.env.TEST_WEB_URL || 'http://localhost:3000';

// Database configuration
process.env.MONGODB_URI = process.env.TEST_MONGODB_URI || 'mongodb://localhost:27017/test-db';
process.env.REDIS_URL = process.env.TEST_REDIS_URL || 'redis://localhost:6379/1';

// Storage configuration
process.env.MINIO_ENDPOINT = process.env.TEST_MINIO_ENDPOINT || 'localhost';
process.env.MINIO_PORT = process.env.TEST_MINIO_PORT || '9000';
process.env.MINIO_ACCESS_KEY = process.env.TEST_MINIO_ACCESS_KEY || 'minioadmin';
process.env.MINIO_SECRET_KEY = process.env.TEST_MINIO_SECRET_KEY || 'minioadmin';
process.env.MINIO_BUCKET = process.env.TEST_MINIO_BUCKET || 'test-bucket';

// Search configuration
process.env.ELASTICSEARCH_NODE = process.env.TEST_ELASTICSEARCH_NODE || 'http://localhost:9200';
process.env.ELASTICSEARCH_INDEX = process.env.TEST_ELASTICSEARCH_INDEX || 'test-index';

// Authentication configuration
process.env.JWT_SECRET = process.env.TEST_JWT_SECRET || 'test-secret';
process.env.JWT_EXPIRY = process.env.TEST_JWT_EXPIRY || '1h';
process.env.REFRESH_TOKEN_SECRET = process.env.TEST_REFRESH_TOKEN_SECRET || 'test-refresh-secret';
process.env.REFRESH_TOKEN_EXPIRY = process.env.TEST_REFRESH_TOKEN_EXPIRY || '7d';

// Email configuration
process.env.SMTP_HOST = process.env.TEST_SMTP_HOST || 'localhost';
process.env.SMTP_PORT = process.env.TEST_SMTP_PORT || '1025';
process.env.SMTP_USER = process.env.TEST_SMTP_USER || 'test';
process.env.SMTP_PASS = process.env.TEST_SMTP_PASS || 'test';
process.env.EMAIL_FROM = process.env.TEST_EMAIL_FROM || 'test@example.com';

// API rate limiting
process.env.RATE_LIMIT_WINDOW = process.env.TEST_RATE_LIMIT_WINDOW || '15';
process.env.RATE_LIMIT_MAX = process.env.TEST_RATE_LIMIT_MAX || '100';

// Content processing
process.env.MAX_FILE_SIZE = process.env.TEST_MAX_FILE_SIZE || '10485760'; // 10MB
process.env.ALLOWED_FILE_TYPES = process.env.TEST_ALLOWED_FILE_TYPES || 'image/jpeg,image/png,video/mp4';
process.env.VIDEO_PROCESSING_TIMEOUT = process.env.TEST_VIDEO_PROCESSING_TIMEOUT || '300000'; // 5 minutes

// Analytics
process.env.ANALYTICS_ENABLED = process.env.TEST_ANALYTICS_ENABLED || 'true';
process.env.ANALYTICS_SAMPLE_RATE = process.env.TEST_ANALYTICS_SAMPLE_RATE || '1.0';

// Feature flags
process.env.ENABLE_VIDEO_PROCESSING = process.env.TEST_ENABLE_VIDEO_PROCESSING || 'true';
process.env.ENABLE_IMAGE_OPTIMIZATION = process.env.TEST_ENABLE_IMAGE_OPTIMIZATION || 'true';
process.env.ENABLE_SEARCH = process.env.TEST_ENABLE_SEARCH || 'true';
process.env.ENABLE_CACHING = process.env.TEST_ENABLE_CACHING || 'true';

// Test configuration
process.env.TEST_TIMEOUT = process.env.TEST_TIMEOUT || '30000';
process.env.TEST_RETRIES = process.env.TEST_RETRIES || '3';
process.env.JEST_HIDE_LOGS = process.env.JEST_HIDE_LOGS || 'false';

// Validate required environment variables
const requiredEnvVars = [
  'MONGODB_URI',
  'REDIS_URL',
  'JWT_SECRET',
  'MINIO_ENDPOINT',
  'ELASTICSEARCH_NODE'
];

requiredEnvVars.forEach(envVar => {
  if (!process.env[envVar]) {
    throw new Error(`Required environment variable ${envVar} is not set`);
  }
});

// Export environment configuration
export default {
  apiUrl: process.env.TEST_API_URL,
  webUrl: process.env.TEST_WEB_URL,
  mongodb: {
    uri: process.env.MONGODB_URI
  },
  redis: {
    url: process.env.REDIS_URL
  },
  minio: {
    endpoint: process.env.MINIO_ENDPOINT,
    port: parseInt(process.env.MINIO_PORT || '9000', 10),
    accessKey: process.env.MINIO_ACCESS_KEY,
    secretKey: process.env.MINIO_SECRET_KEY,
    bucket: process.env.MINIO_BUCKET
  },
  elasticsearch: {
    node: process.env.ELASTICSEARCH_NODE,
    index: process.env.ELASTICSEARCH_INDEX
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiry: process.env.JWT_EXPIRY,
    refreshSecret: process.env.REFRESH_TOKEN_SECRET,
    refreshExpiry: process.env.REFRESH_TOKEN_EXPIRY
  },
  email: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '1025', 10),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.EMAIL_FROM
  },
  rateLimit: {
    window: parseInt(process.env.RATE_LIMIT_WINDOW || '15', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10)
  },
  content: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10),
    allowedFileTypes: process.env.ALLOWED_FILE_TYPES?.split(',') || [],
    videoProcessingTimeout: parseInt(process.env.VIDEO_PROCESSING_TIMEOUT || '300000', 10)
  },
  analytics: {
    enabled: process.env.ANALYTICS_ENABLED === 'true',
    sampleRate: parseFloat(process.env.ANALYTICS_SAMPLE_RATE || '1.0')
  },
  features: {
    videoProcessing: process.env.ENABLE_VIDEO_PROCESSING === 'true',
    imageOptimization: process.env.ENABLE_IMAGE_OPTIMIZATION === 'true',
    search: process.env.ENABLE_SEARCH === 'true',
    caching: process.env.ENABLE_CACHING === 'true'
  },
  test: {
    timeout: parseInt(process.env.TEST_TIMEOUT || '30000', 10),
    retries: parseInt(process.env.TEST_RETRIES || '3', 10),
    hideLogs: process.env.JEST_HIDE_LOGS === 'true'
  }
}; 