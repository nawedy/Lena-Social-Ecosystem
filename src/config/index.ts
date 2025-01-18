import dotenv from 'dotenv';

dotenv.config();

export const config = {
  app: {
    name: 'TikTokToe',
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000', 10),
    apiUrl: process.env.API_BASE_URL || 'http://localhost:3000',
  },
  db: {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    max: parseInt(process.env.DB_POOL_MAX || '10', 10),
    min: parseInt(process.env.DB_POOL_MIN || '2', 10),
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  gcp: {
    projectId: process.env.GOOGLE_CLOUD_PROJECT,
    keyFilePath: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    storageBucket: process.env.GCP_STORAGE_BUCKET,
    region: process.env.GCP_REGION,
  },
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
  },
  email: {
    from: process.env.EMAIL_FROM,
    smtp: {
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  },
  monitoring: {
    logName: process.env.LOGGING_LOG_NAME || 'tiktoktoe-app',
    metricPrefix:
      process.env.MONITORING_METRIC_PREFIX || 'custom.googleapis.com/tiktoktoe',
  },
};
