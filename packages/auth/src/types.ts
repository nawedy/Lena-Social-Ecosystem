export type AuthProvider = 'at-protocol' | 'web3' | 'magic-link' | 'email';

export interface AuthUser {
  id: string;
  did?: string;
  ethAddress?: string;
  email?: string;
  username?: string;
  avatarUrl?: string;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthSession {
  user: AuthUser;
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
}

export interface AuthConfig {
  atProtocolService?: string;
  magicApiKey?: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
}

export interface SignInOptions {
  provider: AuthProvider;
  email?: string;
  password?: string;
  message?: string; // For SIWE
}

export interface SignUpOptions extends SignInOptions {
  username?: string;
}

export type AuthEventType = 
  | 'SIGNED_IN'
  | 'SIGNED_OUT'
  | 'USER_UPDATED'
  | 'SESSION_EXPIRED'
  | 'ERROR';

export interface AuthEventPayload {
  type: AuthEventType;
  user?: AuthUser;
  session?: AuthSession;
  error?: Error;
} 