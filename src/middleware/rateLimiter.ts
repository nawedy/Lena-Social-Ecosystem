import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { createClient } from 'redis';
import { config } from '../config';

const redisClient = createClient({
  url: config.redis.url,
  password: config.redis.password,
});

redisClient.on('error', err => console.error('Redis Client Error:', err));

// Different rate limit configurations for various endpoints
export const rateLimiters = {
  // General API rate limiter
  api: rateLimit({
    store: new RedisStore({
      sendCommand: (...args: string[]) => redisClient.sendCommand(args),
    }),
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
  }),

  // Auth endpoints rate limiter (more strict)
  auth: rateLimit({
    store: new RedisStore({
      sendCommand: (...args: string[]) => redisClient.sendCommand(args),
    }),
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // Limit each IP to 5 login attempts per hour
    message: 'Too many login attempts, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
  }),

  // Content creation rate limiter
  content: rateLimit({
    store: new RedisStore({
      sendCommand: (...args: string[]) => redisClient.sendCommand(args),
    }),
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 50, // Limit each IP to 50 content creations per hour
    message: 'Content creation limit reached, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
  }),

  // Custom rate limiter factory
  createCustomLimiter: (options: {
    windowMs: number;
    max: number;
    message?: string;
  }) =>
    rateLimit({
      store: new RedisStore({
        sendCommand: (...args: string[]) => redisClient.sendCommand(args),
      }),
      ...options,
      standardHeaders: true,
      legacyHeaders: false,
    }),
};

// Middleware to track API usage for analytics
export const apiUsageTracker = async (req: any, res: any, next: any) => {
  try {
    const key = `api:usage:${req.ip}:${new Date().toISOString().split('T')[0]}`;
    await redisClient.incr(key);
    await redisClient.expire(key, 86400); // Expire after 24 hours
    next();
  } catch (error) {
    console.error('API usage tracking error:', error);
    next(); // Continue even if tracking fails
  }
};
