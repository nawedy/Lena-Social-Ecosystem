interface SecurityConfig {
  session: {
    timeout: number;
    refreshThreshold: number;
  };
  authentication: {
    web3Enabled: boolean;
    magicEnabled: boolean;
    emailEnabled: boolean;
    mfaRequired: boolean;
    password: {
      minLength: number;
      requireSpecialChar: boolean;
      requireNumber: boolean;
      requireUppercase: boolean;
      maxLoginAttempts: number;
      lockoutDuration: number;
    };
  };
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
  cors: {
    allowedOrigins: string[];
  };
  encryption: {
    keySize: number;
    rotationInterval: number;
  };
  ipfs: {
    gateway: string;
    pinEnabled: boolean;
  };
  monitoring: {
    enableAuditLogs: boolean;
    logLevel: string;
  };
}

class SecurityConfigService {
  private config: SecurityConfig;

  constructor() {
    this.config = {
      session: {
        timeout: Number(import.meta.env.VITE_SESSION_TIMEOUT || 60),
        refreshThreshold: 5 // minutes before expiry
      },
      authentication: {
        web3Enabled: import.meta.env.VITE_ENABLE_WEB3_AUTH === 'true',
        magicEnabled: import.meta.env.VITE_ENABLE_MAGIC_AUTH === 'true',
        emailEnabled: import.meta.env.VITE_ENABLE_EMAIL_AUTH === 'true',
        mfaRequired: import.meta.env.VITE_MFA_REQUIRED === 'true',
        password: {
          minLength: Number(import.meta.env.VITE_MIN_PASSWORD_LENGTH || 12),
          requireSpecialChar: import.meta.env.VITE_REQUIRE_SPECIAL_CHAR === 'true',
          requireNumber: import.meta.env.VITE_REQUIRE_NUMBER === 'true',
          requireUppercase: import.meta.env.VITE_REQUIRE_UPPERCASE === 'true',
          maxLoginAttempts: Number(import.meta.env.VITE_MAX_LOGIN_ATTEMPTS || 5),
          lockoutDuration: Number(import.meta.env.VITE_LOCKOUT_DURATION || 15)
        }
      },
      rateLimit: {
        windowMs: Number(import.meta.env.VITE_RATE_LIMIT_WINDOW || 900000),
        maxRequests: Number(import.meta.env.VITE_RATE_LIMIT_MAX_REQUESTS || 100)
      },
      cors: {
        allowedOrigins: (import.meta.env.VITE_ALLOWED_ORIGINS || '')
          .split(',')
          .filter(Boolean)
          .map(origin => origin.trim())
      },
      encryption: {
        keySize: Number(import.meta.env.VITE_ENCRYPTION_KEY_SIZE || 256),
        rotationInterval: Number(import.meta.env.VITE_KEY_ROTATION_INTERVAL || 30)
      },
      ipfs: {
        gateway: import.meta.env.VITE_IPFS_GATEWAY || 'https://ipfs.io/ipfs/',
        pinEnabled: import.meta.env.VITE_IPFS_PIN_ENABLED === 'true'
      },
      monitoring: {
        enableAuditLogs: import.meta.env.VITE_ENABLE_AUDIT_LOGS === 'true',
        logLevel: import.meta.env.VITE_LOG_LEVEL || 'info'
      }
    };
  }

  // Session configuration
  getSessionTimeout(): number {
    return this.config.session.timeout;
  }

  getSessionRefreshThreshold(): number {
    return this.config.session.refreshThreshold;
  }

  // Authentication configuration
  isWeb3Enabled(): boolean {
    return this.config.authentication.web3Enabled;
  }

  isMagicEnabled(): boolean {
    return this.config.authentication.magicEnabled;
  }

  isEmailEnabled(): boolean {
    return this.config.authentication.emailEnabled;
  }

  isMFARequired(): boolean {
    return this.config.authentication.mfaRequired;
  }

  getPasswordConfig() {
    return this.config.authentication.password;
  }

  // Rate limiting configuration
  getRateLimitConfig() {
    return this.config.rateLimit;
  }

  // CORS configuration
  getAllowedOrigins(): string[] {
    return this.config.cors.allowedOrigins;
  }

  // Encryption configuration
  getEncryptionConfig() {
    return this.config.encryption;
  }

  // IPFS configuration
  getIPFSConfig() {
    return this.config.ipfs;
  }

  // Monitoring configuration
  getMonitoringConfig() {
    return this.config.monitoring;
  }

  // Validate password against requirements
  validatePassword(password: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const config = this.config.authentication.password;

    if (password.length < config.minLength) {
      errors.push(`Password must be at least ${config.minLength} characters long`);
    }

    if (config.requireSpecialChar && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    if (config.requireNumber && !/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (config.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // Check if an origin is allowed
  isOriginAllowed(origin: string): boolean {
    return this.config.cors.allowedOrigins.includes(origin);
  }

  // Get full IPFS URL for a CID
  getIPFSUrl(cid: string): string {
    return `${this.config.ipfs.gateway}${cid}`;
  }
}

// Export singleton instance
export const securityConfig = new SecurityConfigService(); 