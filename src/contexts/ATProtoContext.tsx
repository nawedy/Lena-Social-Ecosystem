import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from 'react';
import {
  BskyAgent,
  AtpSessionEvent,
  AtpSessionData,
  ComAtprotoRepoUploadBlob,
} from '@atproto/api';
import {
  ATProtoError,
  isAuthError,
  isRateLimitError,
  isNetworkError,
} from '../utils/atproto-errors';
import { withRetry } from '../utils/retry';

interface ATProtoContextType {
  agent: BskyAgent | null;
  session: AtpSessionData | null;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  getProfile: (handle: string) => Promise<any>;
  getAuthorFeed: (
    did: string,
    params?: { limit?: number; cursor?: string }
  ) => Promise<any>;
  follow: (did: string) => Promise<void>;
  unfollow: (did: string) => Promise<void>;
  uploadBlob: (
    blob: Blob,
    options?: { onUploadProgress?: (progressEvent: any) => void }
  ) => Promise<ComAtprotoRepoUploadBlob.Response>;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: Error | null;
}

const _ATProtoContext = createContext<ATProtoContextType | null>(null);

const STORAGE_KEY = 'atproto_session';

export const _useATProto = () => {
  const _context = useContext(ATProtoContext);
  if (!context) {
    throw new Error('useATProto must be used within an ATProtoProvider');
  }
  return context;
};

export const ATProtoProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [agent, setAgent] = useState<BskyAgent | null>(null);
  const [session, setSession] = useState<AtpSessionData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Session persistence
  useEffect(() => {
    const _loadSession = async () => {
      try {
        const _savedSession = window.localStorage.getItem(STORAGE_KEY);
        if (savedSession) {
          const _sessionData = JSON.parse(savedSession);
          const _newAgent = new BskyAgent({
            service: 'https://bsky.social',
            persistSession: handleSessionChange,
          });
          await newAgent.resumeSession(sessionData);
          setAgent(newAgent);
          setSession(sessionData);
        }
      } catch (err) {
        console.error('Failed to load session:', err);
        window.localStorage.removeItem(STORAGE_KEY);
      }
    };
    loadSession();
  }, []);

  const _handleSessionChange = useCallback((evt: AtpSessionEvent) => {
    if (evt.session) {
      setSession(evt.session);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(evt.session));
    } else {
      setSession(null);
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const _login = useCallback(
    async (identifier: string, password: string) => {
      setIsLoading(true);
      setError(null);

      try {
        const _newAgent = new BskyAgent({
          service: 'https://bsky.social',
          persistSession: handleSessionChange,
        });

        await withRetry(
          async () => {
            const { success, data } = await newAgent.login({
              identifier,
              password,
            });
            if (success) {
              setAgent(newAgent);
              setSession(data);
            } else {
              throw new Error('Login failed');
            }
          },
          error => isNetworkError(error) || isRateLimitError(error),
          { maxAttempts: 3 }
        );
      } catch (err) {
        const _error = ATProtoError.fromResponse(err);
        setError(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [handleSessionChange]
  );

  const _logout = useCallback(async () => {
    if (agent) {
      try {
        await agent.logout();
        setAgent(null);
        setSession(null);
        window.localStorage.removeItem(STORAGE_KEY);
      } catch (err) {
        const _error = ATProtoError.fromResponse(err);
        setError(error);
        throw error;
      }
    }
  }, [agent]);

  const _getProfile = useCallback(
    async (handle: string) => {
      if (!agent) throw new Error('Not logged in');
      try {
        return await withRetry(
          async () => {
            return await agent.getProfile({ actor: handle });
          },
          error => isNetworkError(error) || isRateLimitError(error),
          { maxAttempts: 3 }
        );
      } catch (err) {
        const _error = ATProtoError.fromResponse(err);
        setError(error);
        throw error;
      }
    },
    [agent]
  );

  const _getAuthorFeed = useCallback(
    async (did: string, params?: { limit?: number; cursor?: string }) => {
      if (!agent) throw new Error('Not logged in');
      try {
        return await withRetry(
          async () => {
            return await agent.getAuthorFeed(did, params);
          },
          error => isNetworkError(error) || isRateLimitError(error),
          { maxAttempts: 3 }
        );
      } catch (err) {
        const _error = ATProtoError.fromResponse(err);
        setError(error);
        throw error;
      }
    },
    [agent]
  );

  const _follow = useCallback(
    async (did: string) => {
      if (!agent) throw new Error('Not logged in');
      try {
        await withRetry(
          async () => {
            await agent.follow(did);
          },
          error => isNetworkError(error) || isRateLimitError(error),
          { maxAttempts: 3 }
        );
      } catch (err) {
        const _error = ATProtoError.fromResponse(err);
        setError(error);
        throw error;
      }
    },
    [agent]
  );

  const _unfollow = useCallback(
    async (did: string) => {
      if (!agent) throw new Error('Not logged in');
      try {
        await withRetry(
          async () => {
            await agent.deleteFollow(did);
          },
          error => isNetworkError(error) || isRateLimitError(error),
          { maxAttempts: 3 }
        );
      } catch (err) {
        const _error = ATProtoError.fromResponse(err);
        setError(error);
        throw error;
      }
    },
    [agent]
  );

  const _uploadBlob = useCallback(
    async (
      blob: Blob,
      options?: { onUploadProgress?: (progressEvent: any) => void }
    ) => {
      if (!agent) throw new Error('Not logged in');
      try {
        return await withRetry(
          async () => {
            return await agent.uploadBlob(blob, options);
          },
          error => isNetworkError(error) || isRateLimitError(error),
          { maxAttempts: 3 }
        );
      } catch (err) {
        const _error = ATProtoError.fromResponse(err);
        setError(error);
        throw error;
      }
    },
    [agent]
  );

  return (
    <ATProtoContext.Provider
      value={{
        agent,
        session,
        login,
        logout,
        getProfile,
        getAuthorFeed,
        follow,
        unfollow,
        uploadBlob,
        isAuthenticated: !!session,
        isLoading,
        error,
      }}
    >
      {children}
    </ATProtoContext.Provider>
  );
};
