import React, { createContext, useContext, useState, useEffect } from 'react';
import { BskyAgent } from '@atproto/api';

interface AuthContextType {
  currentUser: any;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  loading: boolean;
  error: string | null;
}

const _AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const _context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const _agent = new BskyAgent({ service: 'https://bsky.social' });

  useEffect(() => {
    // Check for stored session
    const _session = window.localStorage.getItem('session');
    if (session) {
      const _sessionData = JSON.parse(session);
      agent
        .resumeSession(sessionData)
        .then(() => {
          setCurrentUser(sessionData.handle);
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

  async function login(identifier: string, password: string) {
    try {
      const { success, data } = await agent.login({ identifier, password });
      if (success) {
        setCurrentUser(data.handle);
        window.localStorage.setItem('session', JSON.stringify(data));
        setError(null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to login');
      throw err;
    }
  }

  async function logout() {
    try {
      await agent.logout();
      setCurrentUser(null);
      window.localStorage.removeItem('session');
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to logout');
      throw err;
    }
  }

  async function register(email: string, password: string) {
    try {
      // Implement registration logic here
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to register');
      throw err;
    }
  }

  const _value = {
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
