import { BskyAgent } from '@atproto/api';
import { CloudKMSClient } from '@google-cloud/kms';
import { PubSub } from '@google-cloud/pubsub';
import { SecretManagerServiceClient, protos } from '@google-cloud/secret-manager';
import config from '../../config';
import { time } from 'console';

if (!process.env.SECURITY_CONFIG_SECRET_NAME) {
  throw new Error('Missing environment variable: SECURITY_CONFIG_SECRET_NAME');
}
import { SecurityCenterClient } from '@google-cloud/security-center';

interface SecurityEvent {


  
  if (!process.env.SECURITY_CONFIG_SECRET_NAME) {
      throw new Error('Missing environment variable: SECURITY_CONFIG_SECRET_NAME');
    }
    if (!process.env.SECURITY_CENTER_ORG_ID) {
      throw new Error('Missing environment variable: SECURITY_CENTER_ORG_ID');
    }
    if (!process.env.SECURITY_EVENTS_TOPIC) {
      throw new Error('Missing environment variable: SECURITY_EVENTS_TOPIC');
    }
    if (!process.env.ENCRYPTION_KEY) {
      throw new Error('Missing environment variable: ENCRYPTION_KEY');
    }
    
    if (!config.rateLimit) {
      throw new Error('Missing rate limit configuration in config file');
    }
    
interface SecurityEvent {
  type: 'auth' | 'content' | 'api' | 'system';

interface SecurityConfig {
  rateLimit: {
    enabled: boolean;
    requestsPerMinute: number;
  };
  contentSecurity: {
    enabled: boolean;
    scanUploads: boolean;
    blockMaliciousContent: boolean;
  };
  authentication: {
    mfaRequired: boolean;
    sessionTimeout: number;
    maxLoginAttempts: number;
  };
}

export class SecurityService {
  private agent: BskyAgent;
  private secretManager: SecretManagerServiceClient;
  private securityCenter: SecurityCenterClient;
  private kms: CloudKMSClient;
  private pubsub: PubSub;
  private config: SecurityConfig;
  private requestCounts: Map<string, { timestamp: number; requestType: string }[]> = new Map();

  constructor(agent: BskyAgent) {
    this.agent = agent;
    this.secretManager = new SecretManagerServiceClient();
    this.securityCenter = new SecurityCenterClient();
    this.kms = new CloudKMSClient();
    this.pubsub = new PubSub();

    // Default security configuration
    this.config = {
      rateLimit: {
        enabled: true,
        requestsPerMinute: config.rateLimit.requestsPerMinute,
      },
      contentSecurity: {
        enabled: true,
        scanUploads: true,
        blockMaliciousContent: true,
      },
      authentication: {
        mfaRequired: true,
        sessionTimeout: 3600, // 1 hour
        maxLoginAttempts: 5,
      },
    };
  }

  async initialize(): Promise<void> {
    try {
      // Load security configuration from Secret Manager
      const config = await this.loadSecurityConfig();
      if (config) {
        this.config = { ...this.config, ...config };
      }

      // Initialize security monitoring
      await this.initializeSecurityMonitoring();

      // Set up event handlers
      await this.setupSecurityEventHandlers();
    } catch (error) {
      console.error('Error initializing security service:', error);
      throw new Error('Failed to initialize security service');
    }
  }

  async validateRequest(userId: string, requestType: string): Promise<boolean> {
    try {
      // Check rate limiting
      if (this.config.rateLimit.enabled) {
        const isRateLimited = await this.checkRateLimit(userId, requestType);
        if (isRateLimited) {
          await this.logSecurityEvent({
            type: 'api',
            severity: 'medium',
            details: {
              userId,
              requestType,
              reason: 'Rate limit exceeded',
            },
            timestamp: new Date().toISOString(),
          });
          return false;
        }
      }

      // Validate session
      const isValidSession = await this.validateSession(userId);
      if (!isValidSession) {
        await this.logSecurityEvent({
          type: 'auth',
          severity: 'high',
          details: {
            userId,
            reason: 'Invalid session',
          },
          timestamp: new Date().toISOString(),
        });
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error validating request:', error);
      return false;
    }
  }

  async encryptSensitiveData(data: string): Promise<string> {
    try {
      const keyName = process.env.ENCRYPTION_KEY;
      const [result] = await this.kms.encrypt({
        name: keyName,
        plaintext: Buffer.from(data).toString('base64'),
      });

      return result.ciphertext;
    } catch (error) {
      console.error('Error encrypting data:', error);
      throw new Error('Failed to encrypt sensitive data');
    }
  }

  async decryptSensitiveData(encryptedData: string): Promise<string> {
    try {
      const keyName = process.env.ENCRYPTION_KEY;
      const [result] = await this.kms.decrypt({
        name: keyName,
        ciphertext: encryptedData,
      });

      return Buffer.from(result.plaintext, 'base64').toString();
    } catch (error) {
      console.error('Error decrypting data:', error);
      throw new Error('Failed to decrypt sensitive data');
    }
  }

  async validateContentSecurity(
    content: string | Buffer,
    contentType: string
  ): Promise<boolean> {
    if (!this.config.contentSecurity.enabled) return true;

    try {
      // Scan content for security threats
      const threats = await this.scanForThreats(content, contentType);

      if (threats.length > 0) {
        await this.logSecurityEvent({
          type: 'content',
          severity: 'high',
          details: {
            contentType,
            threats,
          },
          timestamp: new Date().toISOString(),
        });

        if (this.config.contentSecurity.blockMaliciousContent) {
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('Error validating content security:', error);
      return false;
    }
  }

  async rotateSecrets(): Promise<void> {
    try {
      // Rotate encryption keys
      await this.rotateEncryptionKeys();

      // Rotate API keys
      await this.rotateAPIKeys();

      // Log rotation event
      await this.logSecurityEvent({
        type: 'system',
        severity: 'medium',
        details: {
          action: 'secret_rotation',
          status: 'success',
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error rotating secrets:', error);
      throw new Error('Failed to rotate secrets');
    }
  }

  private async loadSecurityConfig(): Promise<SecurityConfig | null> {
    let config = null;
    try {
      const [version] = await this.secretManager.accessSecretVersion({
        name: process.env.SECURITY_CONFIG_SECRET_NAME,
      });

      if (!version.payload?.data) {
        throw new Error(
          'Failed to load security config from secret manager'
        );
      }

      if (version.payload?.data) {
        return JSON.parse(version.payload.data.toString());
      }
      return null;
    } catch (error) {
      console.error('Error loading security config:', error);
      return null;
    }
  }

  private async initializeSecurityMonitoring(): Promise<void> {
    try {
      // Set up Security Command Center notifications
      const [parent] = await this.securityCenter.getOrganization({
        organizationId: process.env.SECURITY_ORG_ID,
      });

      await this.securityCenter.createNotificationConfig({
        parent,
        configId: 'security-notifications',
        notificationConfig: {
          description: 'Security event notifications',
          pubsubTopic: process.env.SECURITY_EVENTS_TOPIC,
          streamingConfig: {
            filter: 'severity >= MEDIUM',
          },
        },
      });
    } catch (error) {
      console.error('Error initializing security monitoring:', error);
      throw error;
    }
  }

  private async setupSecurityEventHandlers(): Promise<void> {
    const _subscription = this.pubsub
      .subscription('security-events')
      .on('message', this.handleSecurityEvent.bind(this))
      .on('error', this.handleSecurityError.bind(this));
  }

  private async handleSecurityEvent(message: any): Promise<void> {
    try {
      const event = JSON.parse(message.data.toString());

      // Process security event
      switch (event.type) {
        case 'auth':
          await this.handleAuthEvent(event);
          break;
        case 'content':
          await this.handleContentEvent(event);
          break;
        case 'api':
          await this.handleAPIEvent(event);
          break;
        case 'system':
          await this.handleSystemEvent(event);
          break;
      }

      message.ack();
    } catch (error) {
      console.error('Error handling security event:', error);
      message.nack();
    }
  }

  private handleSecurityError(error: Error): void {
    console.error('Security event handler error:', error);
  }

  private async checkRateLimit(userId: string, requestType: string): Promise<boolean> {
    const now = Date.now();
  
    let userRequests = this.requestCounts.get(userId) || [];
  
    userRequests.push({ timestamp: now, requestType });
  
    userRequests = userRequests.filter(
      (request) => now - request.timestamp <= 60000 // 1 minute
    );
  
    this.requestCounts.set(userId, userRequests);
  
    if (userRequests.length > this.config.rateLimit.requestsPerMinute) {
      await this.logSecurityEvent({
        type: 'api',
        severity: 'medium',
        details: {
          userId,
          requestType,
          reason: 'Rate limit exceeded',
        },
        timestamp: new Date().toISOString(),
      });
      return true;
    }
    return false;
  }

  private async validateSession(userId: string): Promise<boolean> {
    try {
      // Check if session is still valid
      const session = await this.agent.getSession();
      return session?.did === userId;
    } catch {
      return false;
    }
  }

  private async scanForThreats(_content: string | Buffer, _contentType: string): Promise<string[]> {
    
    // Implement threat scanning (placeholder)
    // This is a placeholder implementation
    return [];
  }

  private async rotateEncryptionKeys(): Promise<void> {
    // Implement key rotation logic
    await this.kms.createCryptoKeyVersion({ parent: process.env.ENCRYPTION_KEY });
  }

  private async rotateAPIKeys(): Promise<void> {
    // Implement API key rotation logic
    console.log('API keys rotated');
  }

  private async logSecurityEvent(event: SecurityEvent): Promise<void> {
    const topic = this.pubsub.topic('security-events');
    await topic.publish(Buffer.from(JSON.stringify(event)));
  }

  private async handleAuthEvent(_event: SecurityEvent): Promise<void> {
    // Handle authentication-related security events
  }

  private async handleContentEvent(_event: SecurityEvent): Promise<void> {
    // Handle content-related security events
  }

  private async handleAPIEvent(_event: SecurityEvent): Promise<void> {
    // Handle API-related security events
  }

  private async handleSystemEvent(_event: SecurityEvent): Promise<void> {
    // Handle system-related security events
  }
}

