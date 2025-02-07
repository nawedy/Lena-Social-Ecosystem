import { AtProtocolProvider } from './providers/at-protocol';
import { Web3Provider } from './providers/web3';
import { MagicProvider } from './providers/magic';
import type { 
  AuthConfig, 
  AuthUser, 
  AuthSession, 
  SignInOptions, 
  SignUpOptions,
  AuthEventType,
  AuthEventPayload
} from './types';

export class AuthService {
  private atProtocolProvider: AtProtocolProvider;
  private web3Provider: Web3Provider;
  private magicProvider: MagicProvider;
  private currentSession: AuthSession | null = null;
  private eventListeners: Map<AuthEventType, Set<(payload: AuthEventPayload) => void>> = new Map();

  constructor(config: AuthConfig) {
    if (config.atProtocolService) {
      this.atProtocolProvider = new AtProtocolProvider(config.atProtocolService);
    }
    
    if (config.magicApiKey) {
      this.magicProvider = new MagicProvider(config.magicApiKey);
    }

    this.web3Provider = new Web3Provider(window.location.host);
  }

  async signIn(options: SignInOptions): Promise<AuthSession> {
    try {
      let session: AuthSession;

      switch (options.provider) {
        case 'at-protocol':
          if (!options.email || !options.password) {
            throw new Error('Email and password required for AT Protocol sign in');
          }
          session = await this.atProtocolProvider.signIn(options.email, options.password);
          break;

        case 'web3':
          const accounts = await this.web3Provider.getAccounts();
          if (accounts.length === 0) {
            throw new Error('No Ethereum accounts available');
          }
          session = await this.web3Provider.signIn(accounts[0]);
          break;

        case 'magic-link':
          if (!options.email) {
            throw new Error('Email required for Magic Link sign in');
          }
          session = await this.magicProvider.signInWithMagicLink(options.email);
          break;

        default:
          throw new Error(`Unsupported authentication provider: ${options.provider}`);
      }

      this.currentSession = session;
      this.emitEvent('SIGNED_IN', { session });
      return session;
    } catch (error) {
      this.emitEvent('ERROR', { error });
      throw error;
    }
  }

  async signUp(options: SignUpOptions): Promise<AuthSession> {
    try {
      let session: AuthSession;

      switch (options.provider) {
        case 'at-protocol':
          if (!options.email || !options.password || !options.username) {
            throw new Error('Email, password, and username required for AT Protocol sign up');
          }
          session = await this.atProtocolProvider.createAccount(
            options.email,
            options.password,
            options.username
          );
          break;

        default:
          throw new Error(`Sign up not supported for provider: ${options.provider}`);
      }

      this.currentSession = session;
      this.emitEvent('SIGNED_IN', { session });
      return session;
    } catch (error) {
      this.emitEvent('ERROR', { error });
      throw error;
    }
  }

  async signOut(): Promise<void> {
    try {
      if (this.currentSession?.user.did) {
        // Handle AT Protocol signout if needed
      } else if (this.currentSession?.user.ethAddress) {
        // Handle Web3 signout if needed
      } else if (this.magicProvider) {
        await this.magicProvider.logout();
      }

      this.currentSession = null;
      this.emitEvent('SIGNED_OUT', {});
    } catch (error) {
      this.emitEvent('ERROR', { error });
      throw error;
    }
  }

  getCurrentSession(): AuthSession | null {
    return this.currentSession;
  }

  getCurrentUser(): AuthUser | null {
    return this.currentSession?.user || null;
  }

  onAuthEvent(type: AuthEventType, callback: (payload: AuthEventPayload) => void): () => void {
    if (!this.eventListeners.has(type)) {
      this.eventListeners.set(type, new Set());
    }

    this.eventListeners.get(type)!.add(callback);

    return () => {
      this.eventListeners.get(type)?.delete(callback);
    };
  }

  private emitEvent(type: AuthEventType, payload: Partial<AuthEventPayload>) {
    const listeners = this.eventListeners.get(type);
    if (listeners) {
      const fullPayload = { type, ...payload };
      listeners.forEach(callback => callback(fullPayload));
    }
  }
} 