import * as crypto from 'crypto';

import * as jwt from 'jsonwebtoken';

import { NotificationService } from './NotificationService';
import { RBACService } from './RBACService';
import { User } from './UserService';

interface SecurityConfig {
  auth: {
    tokenExpiration: number;
    refreshTokenExpiration: number;
    maxLoginAttempts: number;
    lockoutDuration: number;
    requireMFA: boolean;
    passwordPolicy: {
      minLength: number;
      requireUppercase: boolean;
      requireLowercase: boolean;
      requireNumbers: boolean;
      requireSpecialChars: boolean;
      maxAge: number;
      preventReuse: number;
    };
  };
  rateLimit: {
    enabled: boolean;
    windowMs: number;
    maxRequests: number;
  };
  encryption: {
    algorithm: string;
    keySize: number;
    saltRounds: number;
  };
  session: {
    duration: number;
    extendOnActivity: boolean;
    singleSession: boolean;
  };
}

interface SecurityEvent {
  id: string;
  timestamp: Date;
  type: string;
  userId?: string;
  ip?: string;
  userAgent?: string;
  location?: string;
  details: Record<string, unknown>;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

interface Session {
  id: string;
  userId: string;
  token: string;
  refreshToken: string;
  createdAt: Date;
  expiresAt: Date;
  lastActivity: Date;
  ip: string;
  userAgent: string;
  mfaVerified: boolean;
}

interface MFAMethod {
  type: 'totp' | 'sms' | 'email' | 'hardware';
  enabled: boolean;
  verified: boolean;
  secret?: string;
  phoneNumber?: string;
  email?: string;
}

interface TokenPayload {
  sessionId: string;
  userId: string;
  exp: number;
}

export class SecurityService {
  private static instance: SecurityService;
  private config: SecurityConfig;
  private rbac: RBACService;
  private notifications: NotificationService;
  private sessions: Map<string, Session>;
  private loginAttempts: Map<string, number>;
  private securityEvents: SecurityEvent[];
  private mfaMethods: Map<string, MFAMethod[]>;

  private constructor() {
    this.config = this.initializeConfig();
    this.rbac = RBACService.getInstance();
    this.notifications = NotificationService.getInstance();
    this.sessions = new Map();
    this.loginAttempts = new Map();
    this.securityEvents = [];
    this.mfaMethods = new Map();
  }

  public static getInstance(): SecurityService {
    if (!SecurityService.instance) {
      SecurityService.instance = new SecurityService();
    }
    return SecurityService.instance;
  }

  private initializeConfig(): SecurityConfig {
    return {
      auth: {
        tokenExpiration: 3600, // 1 hour
        refreshTokenExpiration: 2592000, // 30 days
        maxLoginAttempts: 5,
        lockoutDuration: 900, // 15 minutes
        requireMFA: true,
        passwordPolicy: {
          minLength: 12,
          requireUppercase: true,
          requireLowercase: true,
          requireNumbers: true,
          requireSpecialChars: true,
          maxAge: 90, // days
          preventReuse: 5,
        },
      },
      rateLimit: {
        enabled: true,
        windowMs: 900000, // 15 minutes
        maxRequests: 100,
      },
      encryption: {
        algorithm: 'aes-256-gcm',
        keySize: 32,
        saltRounds: 10,
      },
      session: {
        duration: 3600, // 1 hour
        extendOnActivity: true,
        singleSession: false,
      },
    };
  }

  public async authenticate(
    username: string,
    password: string,
    ip: string,
    userAgent: string
  ): Promise<{ token: string; refreshToken: string }> {
    // Check login attempts
    if (this.isAccountLocked(username)) {
      await this.logSecurityEvent({
        type: 'login_attempt_locked',
        userId: username,
        ip,
        userAgent,
        details: { reason: 'Account locked due to too many failed attempts' },
        severity: 'high',
      });
      throw new Error('Account is locked. Please try again later.');
    }

    try {
      // Verify credentials
      const user = await this.verifyCredentials(username, password);

      // Reset login attempts
      this.loginAttempts.delete(username);

      // Create session
      const session = await this.createSession(user.id, ip, userAgent);

      // Log successful login
      await this.logSecurityEvent({
        type: 'login_success',
        userId: user.id,
        ip,
        userAgent,
        details: { sessionId: session.id },
        severity: 'low',
      });

      return {
        token: session.token,
        refreshToken: session.refreshToken,
      };
    } catch (error) {
      // Increment login attempts
      this.incrementLoginAttempts(username);

      // Log failed login
      await this.logSecurityEvent({
        type: 'login_failure',
        userId: username,
        ip,
        userAgent,
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        severity: 'medium',
      });

      throw error;
    }
  }

  public async validateToken(token: string): Promise<TokenPayload> {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as TokenPayload;
      const session = this.sessions.get(decoded.sessionId);

      if (!session) {
        throw new Error('Invalid session');
      }

      if (session.expiresAt < new Date()) {
        throw new Error('Session expired');
      }

      if (this.config.session.extendOnActivity) {
        session.lastActivity = new Date();
        session.expiresAt = new Date(Date.now() + this.config.session.duration * 1000);
      }

      return decoded;
    } catch (_error) {
      throw new Error('Invalid token');
    }
  }

  public async refreshToken(refreshToken: string): Promise<string> {
    try {
      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as TokenPayload;

      const session = this.sessions.get(decoded.sessionId);
      if (!session || session.refreshToken !== refreshToken) {
        throw new Error('Invalid refresh token');
      }

      const newToken = this.generateToken(session);
      session.token = newToken;
      session.lastActivity = new Date();

      return newToken;
    } catch (_error) {
      throw new Error('Invalid refresh token');
    }
  }

  public async logout(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.sessions.delete(sessionId);
      await this.logSecurityEvent({
        type: 'logout',
        userId: session.userId,
        details: { sessionId },
        severity: 'low',
      });
    }
  }

  public async logSecurityEvent(event: Omit<SecurityEvent, 'id' | 'timestamp'>): Promise<void> {
    const securityEvent: SecurityEvent = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      ...event,
    };

    this.securityEvents.push(securityEvent);

    // Notify admins for high severity events
    if (event.severity === 'high' || event.severity === 'critical') {
      await this.notifications.notifyAdmins('security_alert', {
        event: securityEvent,
      });
    }
  }

  private async verifyCredentials(_username: string, _password: string): Promise<User> {
    // Implementation would verify against user service/database
    throw new Error('Not implemented');
  }

  private async createSession(userId: string, ip: string, userAgent: string): Promise<Session> {
    if (this.config.session.singleSession) {
      // Remove existing sessions for user
      for (const [id, session] of this.sessions.entries()) {
        if (session.userId === userId) {
          this.sessions.delete(id);
        }
      }
    }

    const session: Session = {
      id: crypto.randomUUID(),
      userId,
      token: '',
      refreshToken: '',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + this.config.session.duration * 1000),
      lastActivity: new Date(),
      ip,
      userAgent,
      mfaVerified: false,
    };

    session.token = this.generateToken(session);
    session.refreshToken = this.generateRefreshToken(session);

    this.sessions.set(session.id, session);
    return session;
  }

  private generateToken(session: Session): string {
    return jwt.sign(
      {
        sessionId: session.id,
        userId: session.userId,
      },
      process.env.JWT_SECRET!,
      {
        expiresIn: this.config.auth.tokenExpiration,
      }
    );
  }

  private generateRefreshToken(session: Session): string {
    return jwt.sign(
      {
        sessionId: session.id,
        userId: session.userId,
      },
      process.env.JWT_REFRESH_SECRET!,
      {
        expiresIn: this.config.auth.refreshTokenExpiration,
      }
    );
  }

  private isAccountLocked(username: string): boolean {
    const attempts = this.loginAttempts.get(username) || 0;
    return attempts >= this.config.auth.maxLoginAttempts;
  }

  private incrementLoginAttempts(username: string): void {
    const attempts = (this.loginAttempts.get(username) || 0) + 1;
    this.loginAttempts.set(username, attempts);
  }
}
