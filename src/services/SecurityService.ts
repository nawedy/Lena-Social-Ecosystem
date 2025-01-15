import { RBACService, Permission } from './RBACService';
import { NotificationService } from './NotificationService';
import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';

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
  details: any;
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
        details: { error: error.message },
        severity: 'medium',
      });

      throw error;
    }
  }

  public async validateToken(token: string): Promise<any> {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!);
      const session = this.sessions.get(decoded.sessionId);

      if (!session || session.token !== token) {
        throw new Error('Invalid session');
      }

      if (session.expiresAt < new Date()) {
        throw new Error('Session expired');
      }

      if (this.config.session.extendOnActivity) {
        this.extendSession(session);
      }

      return decoded;
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  public async refreshToken(
    refreshToken: string,
    ip: string,
    userAgent: string
  ): Promise<{ token: string; refreshToken: string }> {
    try {
      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!);
      const session = this.sessions.get(decoded.sessionId);

      if (!session || session.refreshToken !== refreshToken) {
        throw new Error('Invalid refresh token');
      }

      // Create new session
      const newSession = await this.createSession(
        session.userId,
        ip,
        userAgent
      );

      // Invalidate old session
      this.sessions.delete(session.id);

      return {
        token: newSession.token,
        refreshToken: newSession.refreshToken,
      };
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }

  public async setupMFA(
    userId: string,
    method: MFAMethod['type']
  ): Promise<MFAMethod> {
    const userMethods = this.mfaMethods.get(userId) || [];

    // Check if method already exists
    const existingMethod = userMethods.find(m => m.type === method);
    if (existingMethod) {
      throw new Error(`MFA method ${method} already exists`);
    }

    // Create new MFA method
    const newMethod: MFAMethod = {
      type: method,
      enabled: false,
      verified: false,
    };

    switch (method) {
      case 'totp':
        newMethod.secret = this.generateTOTPSecret();
        break;
      case 'sms':
        // Implementation for SMS setup
        break;
      case 'email':
        // Implementation for email setup
        break;
      case 'hardware':
        // Implementation for hardware key setup
        break;
    }

    userMethods.push(newMethod);
    this.mfaMethods.set(userId, userMethods);

    return newMethod;
  }

  public async verifyMFA(
    userId: string,
    method: MFAMethod['type'],
    code: string
  ): Promise<boolean> {
    const userMethods = this.mfaMethods.get(userId) || [];
    const mfaMethod = userMethods.find(m => m.type === method);

    if (!mfaMethod) {
      throw new Error(`MFA method ${method} not found`);
    }

    let verified = false;
    switch (method) {
      case 'totp':
        verified = this.verifyTOTP(mfaMethod.secret!, code);
        break;
      case 'sms':
        verified = await this.verifySMS(mfaMethod.phoneNumber!, code);
        break;
      case 'email':
        verified = await this.verifyEmail(mfaMethod.email!, code);
        break;
      case 'hardware':
        verified = await this.verifyHardwareKey(code);
        break;
    }

    if (verified) {
      mfaMethod.verified = true;
      mfaMethod.enabled = true;
      this.mfaMethods.set(userId, userMethods);
    }

    return verified;
  }

  public async validateAccountAccess(
    userId: string,
    accountId: string
  ): Promise<boolean> {
    try {
      await this.rbac.validateAccess(
        userId,
        accountId,
        Permission.VIEW_ACCOUNTS
      );
      return true;
    } catch (error) {
      await this.logSecurityEvent({
        type: 'unauthorized_account_access',
        userId,
        details: {
          accountId,
          error: error.message,
        },
        severity: 'high',
      });
      throw error;
    }
  }

  public async encryptSensitiveData(
    data: string,
    context?: string
  ): Promise<string> {
    const iv = crypto.randomBytes(12);
    const salt = crypto.randomBytes(16);
    const key = await this.deriveKey(process.env.ENCRYPTION_KEY!, salt);

    const cipher = crypto.createCipheriv(
      this.config.encryption.algorithm,
      key,
      iv
    );

    const encrypted = Buffer.concat([
      cipher.update(data, 'utf8'),
      cipher.final(),
    ]);

    const authTag = cipher.getAuthTag();

    // Combine IV, salt, auth tag, and encrypted data
    const combined = Buffer.concat([iv, salt, authTag, encrypted]);
    return combined.toString('base64');
  }

  public async decryptSensitiveData(
    encryptedData: string,
    context?: string
  ): Promise<string> {
    const combined = Buffer.from(encryptedData, 'base64');

    // Extract components
    const iv = combined.slice(0, 12);
    const salt = combined.slice(12, 28);
    const authTag = combined.slice(28, 44);
    const encrypted = combined.slice(44);

    const key = await this.deriveKey(process.env.ENCRYPTION_KEY!, salt);

    const decipher = crypto.createDecipheriv(
      this.config.encryption.algorithm,
      key,
      iv
    );
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  }

  public async logSecurityEvent(
    event: Omit<SecurityEvent, 'id' | 'timestamp'>
  ): Promise<void> {
    const securityEvent: SecurityEvent = {
      id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      ...event,
    };

    this.securityEvents.push(securityEvent);

    // Notify security team of high-severity events
    if (
      securityEvent.severity === 'high' ||
      securityEvent.severity === 'critical'
    ) {
      await this.notifications.sendNotification(
        'email',
        'Security Alert',
        `High-severity security event detected: ${securityEvent.type}`,
        ['security-team@company.com'],
        {
          type: 'security_alert',
          event: securityEvent,
        }
      );
    }

    // Trim old events if needed
    if (this.securityEvents.length > 10000) {
      this.securityEvents = this.securityEvents.slice(-10000);
    }
  }

  private async verifyCredentials(
    username: string,
    password: string
  ): Promise<any> {
    // Implementation for credential verification
    return null;
  }

  private async createSession(
    userId: string,
    ip: string,
    userAgent: string
  ): Promise<Session> {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create JWT token
    const token = jwt.sign(
      {
        userId,
        sessionId,
      },
      process.env.JWT_SECRET!,
      {
        expiresIn: this.config.auth.tokenExpiration,
      }
    );

    // Create refresh token
    const refreshToken = jwt.sign(
      {
        userId,
        sessionId,
      },
      process.env.JWT_REFRESH_SECRET!,
      {
        expiresIn: this.config.auth.refreshTokenExpiration,
      }
    );

    const session: Session = {
      id: sessionId,
      userId,
      token,
      refreshToken,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + this.config.session.duration * 1000),
      lastActivity: new Date(),
      ip,
      userAgent,
      mfaVerified: false,
    };

    this.sessions.set(sessionId, session);

    // If single session mode is enabled, invalidate other sessions
    if (this.config.session.singleSession) {
      for (const [id, existingSession] of this.sessions.entries()) {
        if (existingSession.userId === userId && id !== sessionId) {
          this.sessions.delete(id);
        }
      }
    }

    return session;
  }

  private isAccountLocked(username: string): boolean {
    const attempts = this.loginAttempts.get(username) || 0;
    return attempts >= this.config.auth.maxLoginAttempts;
  }

  private incrementLoginAttempts(username: string): void {
    const attempts = (this.loginAttempts.get(username) || 0) + 1;
    this.loginAttempts.set(username, attempts);

    if (attempts >= this.config.auth.maxLoginAttempts) {
      setTimeout(() => {
        this.loginAttempts.delete(username);
      }, this.config.auth.lockoutDuration * 1000);
    }
  }

  private extendSession(session: Session): void {
    session.lastActivity = new Date();
    session.expiresAt = new Date(
      Date.now() + this.config.session.duration * 1000
    );
  }

  private generateTOTPSecret(): string {
    return crypto.randomBytes(20).toString('base64');
  }

  private verifyTOTP(secret: string, code: string): boolean {
    // Implementation for TOTP verification
    return false;
  }

  private async verifySMS(
    phoneNumber: string,
    code: string
  ): Promise<boolean> {
    // Implementation for SMS verification
    return false;
  }

  private async verifyEmail(
    email: string,
    code: string
  ): Promise<boolean> {
    // Implementation for email verification
    return false;
  }

  private async verifyHardwareKey(
    code: string
  ): Promise<boolean> {
    // Implementation for hardware key verification
    return false;
  }

  private async deriveKey(
    password: string,
    salt: Buffer
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      crypto.pbkdf2(
        password,
        salt,
        100000,
        this.config.encryption.keySize,
        'sha512',
        (err, key) => {
          if (err) reject(err);
          resolve(key);
        }
      );
    });
  }
}
