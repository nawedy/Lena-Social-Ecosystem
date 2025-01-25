declare module '../utils/email' {
  export function validateEmail(email: string): boolean;
  export function generateEmailTemplate(
    template: string,
    data: Record<string, any>
  ): string;
  export function parseEmailTemplate(templatePath: string): Promise<string>;
  export function sanitizeEmailContent(content: string): string;
}

declare module '../utils/crypto' {
  export function generateSalt(length?: number): string;
  export function hashPassword(password: string, salt: string): string;
  export function comparePasswords(
    password: string,
    hashedPassword: string,
    salt: string
  ): boolean;
  export function generateToken(length?: number): string;
  export function encryptData(data: string, key: string): string;
  export function decryptData(encryptedData: string, key: string): string;
}

declare module '../hooks/useAuth' {
  interface AuthUser {
    id: string;
    email: string;
    displayName?: string;
    photoURL?: string;
    isVerified: boolean;
  }

  interface AuthContextType {
    user: AuthUser | null;
    loading: boolean;
    error: Error | null;
    signIn: (email: string, password: string) => Promise<void>;
    signOut: () => Promise<void>;
    signUp: (
      email: string,
      password: string,
      displayName?: string
    ) => Promise<void>;
    resetPassword: (email: string) => Promise<void>;
    updateProfile: (data: Partial<AuthUser>) => Promise<void>;
  }

  export function useAuth(): AuthContextType;
}

declare module '../types/blocking' {
  export interface BlockedUser {
    userId: string;
    blockedUserId: string;
    reason?: string;
    createdAt: Date;
    expiresAt?: Date;
  }

  export interface BlockingRules {
    duration: number;
    maxWarnings: number;
    autoExpire: boolean;
  }
}

declare module '../types/follow' {
  export interface FollowRelation {
    followerId: string;
    followingId: string;
    createdAt: Date;
  }

  export interface FollowStats {
    followers: number;
    following: number;
  }
}

declare module '../types/user' {
  export interface User {
    id: string;
    email: string;
    displayName?: string;
    photoURL?: string;
    bio?: string;
    location?: string;
    website?: string;
    createdAt: Date;
    updatedAt: Date;
    isVerified: boolean;
    followStats?: {
      followers: number;
      following: number;
    };
    settings: {
      notifications: boolean;
      privacy: {
        profileVisibility: 'public' | 'private';
        showOnlineStatus: boolean;
      };
      theme: 'light' | 'dark' | 'system';
      language: string;
    };
  }
}
