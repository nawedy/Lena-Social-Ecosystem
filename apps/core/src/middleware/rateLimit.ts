import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

export class RateLimiter {
  private store: RateLimitStore = {};
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  isRateLimited(ip: string): boolean {
    const now = Date.now();
    const record = this.store[ip];

    if (!record) {
      this.store[ip] = {
        count: 1,
        resetTime: now + this.config.windowMs
      };
      return false;
    }

    if (now > record.resetTime) {
      this.store[ip] = {
        count: 1,
        resetTime: now + this.config.windowMs
      };
      return false;
    }

    record.count += 1;
    return record.count > this.config.maxRequests;
  }

  // Clean up expired records periodically
  cleanup(): void {
    const now = Date.now();
    Object.keys(this.store).forEach(ip => {
      if (now > this.store[ip].resetTime) {
        delete this.store[ip];
      }
    });
  }
}

// Create rate limiter instance
const rateLimiter = new RateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100 // 100 requests per window
});

// Clean up every 5 minutes
setInterval(() => rateLimiter.cleanup(), 5 * 60 * 1000);

export const rateLimitMiddleware: Handle = async ({ event, resolve }) => {
  const clientIp = event.request.headers.get('x-forwarded-for') || 
                  event.getClientAddress();

  // Skip rate limiting for static assets
  const path = new URL(event.request.url).pathname;
  if (path.startsWith('/static/') || path.startsWith('/_app/')) {
    return await resolve(event);
  }

  if (rateLimiter.isRateLimited(clientIp)) {
    return new Response('Too Many Requests', {
      status: 429,
      headers: {
        'Content-Type': 'text/plain',
        'Retry-After': '900' // 15 minutes in seconds
      }
    });
  }

  return await resolve(event);
};

// Export the middleware sequence
export const handle = sequence(rateLimitMiddleware); 