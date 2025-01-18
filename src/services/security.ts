import crypto from 'crypto';
import { createClient } from 'redis';
import { config } from '../config';
import { BskyAgent } from '@atproto/api';
import { atproto } from './atproto';
import { logger } from '../utils/logger';

interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  action: string;
  resource: string;
  status: 'success' | 'failure';
  ipAddress: string;
  userAgent: string;
  details?: any;
}

interface SecurityAlert {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: string;
  description: string;
  timestamp: string;
  metadata?: any;
}

export class SecurityService {
  private agent: BskyAgent;
  private redisClient: ReturnType<typeof createClient>;
  private static instance: SecurityService;
  private encryptionKey: Buffer;

  private constructor() {
    this.agent = atproto.getAgent();
    this.redisClient = createClient({
      url: config.redis.url,
      password: config.redis.password,
    });
    this.encryptionKey = crypto.scryptSync(
      config.security.secretKey,
      'salt',
      32
    );
  }

  public static getInstance(): SecurityService {
    if (!SecurityService.instance) {
      SecurityService.instance = new SecurityService();
    }
    return SecurityService.instance;
  }

  // Data Encryption
  async encryptData(
    data: string
  ): Promise<{ iv: string; encryptedData: string }> {
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(
        'aes-256-gcm',
        this.encryptionKey,
        iv
      );

      let encryptedData = cipher.update(data, 'utf8', 'hex');
      encryptedData += cipher.final('hex');

      const authTag = cipher.getAuthTag();

      return {
        iv: iv.toString('hex'),
        encryptedData: encryptedData + authTag.toString('hex'),
      };
    } catch (error) {
      console.error('Data encryption error:', error);
      throw error;
    }
  }

  async decryptData(encryptedData: string, iv: string): Promise<string> {
    try {
      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        this.encryptionKey,
        Buffer.from(iv, 'hex')
      );

      const authTag = Buffer.from(encryptedData.slice(-32), 'hex');
      const encryptedText = encryptedData.slice(0, -32);

      decipher.setAuthTag(authTag);

      let decryptedData = decipher.update(encryptedText, 'hex', 'utf8');
      decryptedData += decipher.final('utf8');

      return decryptedData;
    } catch (error) {
      console.error('Data decryption error:', error);
      throw error;
    }
  }

  // Security Audit Logging
  async logAuditEvent(
    event: Omit<AuditLog, 'id' | 'timestamp'>
  ): Promise<void> {
    try {
      const auditLog: AuditLog = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        ...event,
      };

      await this.agent.api.com.atproto.repo.createRecord({
        repo: this.agent.session?.did ?? '',
        collection: 'app.bsky.security.auditLog',
        record: auditLog,
      });

      // Store in Redis for quick access
      await this.redisClient.setEx(
        `audit:${auditLog.id}`,
        86400, // 24 hours
        JSON.stringify(auditLog)
      );
    } catch (error) {
      console.error('Audit logging error:', error);
      throw error;
    }
  }

  // Security Alerts
  async createSecurityAlert(
    alert: Omit<SecurityAlert, 'id' | 'timestamp'>
  ): Promise<void> {
    try {
      const securityAlert: SecurityAlert = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        ...alert,
      };

      await this.agent.api.com.atproto.repo.createRecord({
        repo: this.agent.session?.did ?? '',
        collection: 'app.bsky.security.alert',
        record: securityAlert,
      });

      if (alert.severity === 'high' || alert.severity === 'critical') {
        await this.notifySecurityTeam(securityAlert);
      }
    } catch (error) {
      console.error('Security alert creation error:', error);
      throw error;
    }
  }

  // Rate Limiting Check
  async checkRateLimit(
    key: string,
    limit: number,
    windowMs: number
  ): Promise<boolean> {
    try {
      const count = await this.redisClient.incr(key);
      if (count === 1) {
        await this.redisClient.expire(key, windowMs / 1000);
      }
      return count <= limit;
    } catch (error) {
      console.error('Rate limit check error:', error);
      return false;
    }
  }

  // Security Scanning
  async scanContent(content: string): Promise<{
    isSafe: boolean;
    threats: string[];
  }> {
    try {
      // Implement content scanning logic
      // This could integrate with security services or AI models
      return {
        isSafe: true,
        threats: [],
      };
    } catch (error) {
      console.error('Content scanning error:', error);
      throw error;
    }
  }

  // Token Management
  generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  // Password Hashing
  async hashPassword(password: string): Promise<string> {
    return new Promise((resolve, reject) => {
      crypto.scrypt(
        password,
        config.security.saltRounds,
        64,
        (err, derivedKey) => {
          if (err) reject(err);
          resolve(derivedKey.toString('hex'));
        }
      );
    });
  }

  // Security Headers Configuration
  getSecurityHeaders() {
    return {
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'Content-Security-Policy':
        "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline';",
      'X-Frame-Options': 'SAMEORIGIN',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
    };
  }

  private async notifySecurityTeam(alert: SecurityAlert): Promise<void> {
    // Implement security team notification logic
    logger.info('Security team notified:', alert);
  }
}

export const securityService = SecurityService.getInstance();
