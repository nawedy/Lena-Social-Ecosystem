import { AtpSessionData, BskyAgent } from '@atproto/api';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface AuthUser {
  did: string;
  handle: string;
  email?: string;
  displayName?: string;
  avatar?: string;
  session: AtpSessionData;
}

interface AuthError extends Error {
  code?: string;
  details?: unknown;
}

interface AuthContextType {
  currentUser: AuthUser | null;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  loading: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const agent = new BskyAgent({ service: 'https://bsky.social' });

  useEffect(() => {
    // Check for stored session
    const session = window.localStorage.getItem('session');
    if (session) {
      const sessionData = JSON.parse(session);
      agent
        .resumeSession(sessionData)
        .then(() => {
          setCurrentUser({ did: sessionData.did, handle: sessionData.handle, session: sessionData });
          setLoading(false);
        })
        .catch(() => {
          window.localStorage.removeItem('session');
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (identifier: string, password: string) => {
    try {
      setLoading(true);
      const { data: session } = await agent.login({
        identifier,
        password,
      });

      const { data: profile } = await agent.getProfile({
        actor: session.handle,
      });

      const user: AuthUser = {
        did: session.did,
        handle: session.handle,
        displayName: profile.displayName,
        avatar: profile.avatar,
        session,
      };

      setCurrentUser(user);
      window.localStorage.setItem('session', JSON.stringify(session));
      setError(null);
    } catch (err) {
      const authError = err as AuthError;
      setError(authError.message || 'Failed to login');
      throw authError;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      setLoading(true);
      await agent.logout();
      setCurrentUser(null);
      window.localStorage.removeItem('session');
      setError(null);
    } catch (err) {
      const authError = err as AuthError;
      setError(authError.message || 'Failed to logout');
      throw authError;
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(async (_email: string, _password: string) => {
    try {
      setLoading(true);
      // Implement registration logic here
      setError(null);
    } catch (err) {
      const authError = err as AuthError;
      setError(authError.message || 'Failed to register');
      throw authError;
    } finally {
      setLoading(false);
    }
  }, []);

  const value = {
    currentUser,
    login,
    logout,
    register,
    loading,
    error,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
