import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { createClient } from 'redis';

import { config } from '../config';
import { Logger } from '../utils/logger';

const logger = new Logger('RateLimiter');

const redisClient = createClient({
  url: config.redis.url,
  password: config.redis.password,
});

redisClient.on('error', (err) => logger.error('Redis Client Error:', { error: err }));

// Different rate limit configurations for various endpoints
export const rateLimiters = {
  // General API rate limiter
  api: rateLimit({
    store: new RedisStore({
      sendCommand: (...args: string[]) => redisClient.sendCommand(args),
    }),
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
  }),

  // Login rate limiter
  login: rateLimit({
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
};

// Custom rate limiter factory
export const createCustomLimiter = (options: {
  windowMs: number;
  max: number;
  message?: string;
}) => {
  return rateLimit({
    store: new RedisStore({
      sendCommand: (...args: string[]) => redisClient.sendCommand(args),
    }),
    windowMs: options.windowMs,
    max: options.max,
    message: options.message || 'Too many requests, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
  });
};

// Middleware to track API usage for analytics
export const apiUsageTracker = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const key = `api:usage:${req.ip}:${new Date().toISOString().split('T')[0]}`;
    await redisClient.incr(key);
    // Set expiry for 30 days
    await redisClient.expire(key, 60 * 60 * 24 * 30);
    next();
  } catch (error) {
    if (error instanceof Error) {
      logger.error('Error tracking API usage', { error: error.message });
    }
    // Don't block the request if tracking fails
    next();
  }
};
