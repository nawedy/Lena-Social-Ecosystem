import { createClient } from '@supabase/supabase-js';
import { Magic } from 'magic-sdk';
import { SiweMessage } from 'siwe';
import { ethers } from 'ethers';
import { writable } from 'svelte/store';
import type { User, Session } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// Create stores for auth state
export const user = writable<User | null>(null);
export const session = writable<any>(null);

// Types
interface AuthConfig {
  providers: {
    web3: boolean;
    magicLink: boolean;
    oauth: boolean;
    email: boolean;
  };
  mfa: {
    required: boolean;
    methods: ('totp' | 'sms')[];
  };
  session: {
    timeoutMinutes: number;
    refreshThresholdMinutes: number;
  };
  security: {
    passwordMinLength: number;
    requireSpecialChar: boolean;
    requireNumber: boolean;
    requireUppercase: boolean;
    maxLoginAttempts: number;
    lockoutMinutes: number;
  };
}

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
}

// Create auth store
const createAuthStore = () => {
  const { subscribe, set, update } = writable<AuthState>({
    user: null,
    session: null,
    loading: true,
    error: null
  });

  return {
    subscribe,
    set,
    update,
    reset: () => set({ user: null, session: null, loading: false, error: null })
  };
};

export const authStore = createAuthStore();

export class AuthService {
  private magic: Magic;
  private config: AuthConfig = {
    providers: {
      web3: true,
      magicLink: true,
      oauth: true,
      email: true
    },
    mfa: {
      required: false,
      methods: ['totp', 'sms']
    },
    session: {
      timeoutMinutes: 60,
      refreshThresholdMinutes: 5
    },
    security: {
      passwordMinLength: 12,
      requireSpecialChar: true,
      requireNumber: true,
      requireUppercase: true,
      maxLoginAttempts: 5,
      lockoutMinutes: 15
    }
  };

  constructor() {
    // Initialize Magic SDK
    this.magic = new Magic(import.meta.env.VITE_MAGIC_PUBLISHABLE_KEY, {
      network: import.meta.env.VITE_MAGIC_NETWORK || 'mainnet'
    });

    // Initialize session handling
    this.initializeSession();
  }

  private async initializeSession() {
    try {
      authStore.update(state => ({ ...state, loading: true }));

      // Get initial session
      const { data: { session: currentSession }, error } = await supabase.auth.getSession();
      if (error) throw error;

      // Set up auth state change listener
      supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN') {
          await this.handleSignIn(session);
        } else if (event === 'SIGNED_OUT') {
          await this.handleSignOut();
        } else if (event === 'TOKEN_REFRESHED') {
          await this.handleTokenRefresh(session);
        }
      });

      // Set initial state
      authStore.set({
        user: currentSession?.user || null,
        session: currentSession,
        loading: false,
        error: null
      });

      // Start session refresh timer
      if (currentSession) {
        this.startSessionRefreshTimer(currentSession);
      }
    } catch (error) {
      authStore.update(state => ({
        ...state,
        loading: false,
        error: error.message
      }));
    }
  }

  // Web3 Authentication
  async signInWithEthereum(address: string) {
    try {
      const nonce = await this.generateNonce();
      const message = new SiweMessage({
        domain: window.location.host,
        address,
        statement: 'Sign in with Ethereum to TikTokToe',
        uri: window.location.origin,
        version: '1',
        chainId: 1,
        nonce
      });

      // Request signature from wallet
      const signature = await window.ethereum.request({
        method: 'personal_sign',
        params: [message.prepareMessage(), address]
      });

      // Verify signature with Supabase
      const { data, error } = await supabase.auth.signInWithWeb3({
        provider: 'ethereum',
        message: message.prepareMessage(),
        signature
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error signing in with Ethereum:', error);
      throw error;
    }
  }

  // Magic Link Authentication
  async signInWithMagicLink(email: string): Promise<void> {
    try {
      const didToken = await this.magic.auth.loginWithMagicLink({
        email,
        showUI: true
      });

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: didToken
      });

      if (error) throw error;
    } catch (error) {
      throw new Error(`Magic link sign in failed: ${error.message}`);
    }
  }

  // OAuth Authentication
  async signInWithOAuth(provider: 'github' | 'google' | 'twitter'): Promise<void> {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`
        }
      });

      if (error) throw error;
    } catch (error) {
      throw new Error(`OAuth sign in failed: ${error.message}`);
    }
  }

  // Traditional email/password authentication with MFA
  async signInWithEmail(email: string, password: string) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      // Check if MFA is required
      if (data.session && await this.isMFARequired(data.user.id)) {
        return { requiresMFA: true, session: data.session };
      }

      return data;
    } catch (error) {
      console.error('Error signing in with email:', error);
      throw error;
    }
  }

  // MFA verification
  async verifyMFA(userId: string, code: string) {
    try {
      const { data, error } = await supabase
        .from('mfa_settings')
        .select('totp_secret')
        .eq('user_id', userId)
        .single();

      if (error) throw error;

      // Verify TOTP code
      const isValid = this.verifyTOTPCode(code, data.totp_secret);
      if (!isValid) {
        throw new Error('Invalid MFA code');
      }

      return true;
    } catch (error) {
      console.error('Error verifying MFA:', error);
      throw error;
    }
  }

  // Enable MFA for a user
  async enableMFA(userId: string) {
    try {
      const secret = this.generateTOTPSecret();
      const { error } = await supabase
        .from('mfa_settings')
        .upsert({
          user_id: userId,
          totp_enabled: true,
          totp_secret: secret
        });

      if (error) throw error;

      return {
        secret,
        qrCode: this.generateTOTPQRCode(secret)
      };
    } catch (error) {
      console.error('Error enabling MFA:', error);
      throw error;
    }
  }

  // Session Management
  private async handleSignIn(session: Session | null) {
    if (session) {
      // Update user profile
      await this.updateUserProfile(session.user);

      // Start session refresh timer
      this.startSessionRefreshTimer(session);

      // Log authentication event
      await this.logAuthEvent(session.user.id, 'SIGN_IN');
    }
  }

  private async handleSignOut() {
    // Clear session data
    authStore.reset();

    // Log authentication event
    const user = (await supabase.auth.getUser()).data.user;
    if (user) {
      await this.logAuthEvent(user.id, 'SIGN_OUT');
    }
  }

  private async handleTokenRefresh(session: Session | null) {
    if (session) {
      authStore.update(state => ({
        ...state,
        session,
        user: session.user
      }));
    }
  }

  private startSessionRefreshTimer(session: Session) {
    const expiresIn = session.expires_in || this.config.session.timeoutMinutes * 60;
    const refreshThreshold = this.config.session.refreshThresholdMinutes * 60;
    const refreshTime = (expiresIn - refreshThreshold) * 1000;

    setTimeout(async () => {
      const { data: { session }, error } = await supabase.auth.refreshSession();
      if (!error && session) {
        this.startSessionRefreshTimer(session);
      }
    }, refreshTime);
  }

  // Security Utilities
  private validatePassword(password: string): boolean {
    const { security } = this.config;
    return (
      password.length >= security.passwordMinLength &&
      (!security.requireSpecialChar || /[!@#$%^&*]/.test(password)) &&
      (!security.requireNumber || /\d/.test(password)) &&
      (!security.requireUppercase || /[A-Z]/.test(password))
    );
  }

  private async isAccountLocked(email: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('auth_attempts')
      .select('attempts, last_attempt')
      .eq('email', email)
      .single();

    if (error || !data) return false;

    const lockoutPeriod = this.config.security.lockoutMinutes * 60 * 1000;
    const timeSinceLastAttempt = Date.now() - new Date(data.last_attempt).getTime();

    return (
      data.attempts >= this.config.security.maxLoginAttempts &&
      timeSinceLastAttempt < lockoutPeriod
    );
  }

  private async incrementLoginAttempts(email: string): Promise<void> {
    await supabase.from('auth_attempts').upsert({
      email,
      attempts: 1,
      last_attempt: new Date().toISOString()
    }, {
      onConflict: 'email',
      update: {
        attempts: sql`auth_attempts.attempts + 1`,
        last_attempt: new Date().toISOString()
      }
    });
  }

  private async resetLoginAttempts(email: string): Promise<void> {
    await supabase
      .from('auth_attempts')
      .delete()
      .eq('email', email);
  }

  private async updateUserProfile(user: User): Promise<void> {
    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        email: user.email,
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.error('Error updating user profile:', error);
    }
  }

  private async logAuthEvent(
    userId: string,
    eventType: string,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    try {
      await supabase.from('auth_events').insert({
        user_id: userId,
        event_type: eventType,
        metadata: {
          ...metadata,
          ip_address: await this.getClientIP(),
          user_agent: navigator.userAgent,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Error logging auth event:', error);
    }
  }

  private async getClientIP(): Promise<string> {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch {
      return 'unknown';
    }
  }

  private generateNonce(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  private async isMFARequired(userId: string): Promise<boolean> {
    const { data } = await supabase
      .from('mfa_settings')
      .select('totp_enabled')
      .eq('user_id', userId)
      .single();

    return data?.totp_enabled ?? false;
  }

  private generateTOTPSecret(): string {
    return Array.from(crypto.getRandomValues(new Uint8Array(20)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  private generateTOTPQRCode(secret: string): string {
    const issuer = 'TikTokToe';
    const uri = `otpauth://totp/${issuer}?secret=${secret}&issuer=${issuer}`;
    return uri;
  }

  private verifyTOTPCode(code: string, secret: string): boolean {
    // Implementation would use a TOTP library
    // This is a placeholder that should be replaced with actual TOTP verification
    return code.length === 6;
  }

  // Public Methods
  async signOut(): Promise<void> {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }

  async updatePassword(newPassword: string): Promise<void> {
    if (!this.validatePassword(newPassword)) {
      throw new Error('Invalid password format');
    }

    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (error) throw error;
  }

  async resetPassword(email: string): Promise<void> {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`
    });

    if (error) throw error;
  }

  getUser(): User | null {
    return supabase.auth.getUser()?.data?.user || null;
  }

  getSession(): Session | null {
    return supabase.auth.getSession()?.data?.session || null;
  }
}

export const auth = new AuthService(); 