import {
  BskyAgent,
  AtpSessionData,
  AtpSessionEvent,
  ComAtprotoRepoUploadBlob,
  AppBskyFeedGetAuthorFeed,
} from '@atproto/api';
import { ProfileViewDetailed } from '@atproto/api/dist/client/types/app/bsky/feed/defs';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

const STORAGE_KEY = 'bsky_session';

interface ATProtoError extends Error {
  status?: number;
  error?: string;
  message: string;
}

interface ATProtoContextType {
  agent: BskyAgent | null;
  session: AtpSessionData | null;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  getProfile: (handle: string) => Promise<ProfileViewDetailed>;
  getAuthorFeed: (
    did: string,
    params?: AppBskyFeedGetAuthorFeed.QueryParams
  ) => Promise<AppBskyFeedGetAuthorFeed.Response>;
  follow: (did: string) => Promise<void>;
  unfollow: (did: string) => Promise<void>;
  uploadBlob: (
    blob: Blob,
    options?: { onUploadProgress?: (progressEvent: ProgressEvent) => void }
  ) => Promise<ComAtprotoRepoUploadBlob.Response>;
  isAuthenticated: boolean;
}

const ATProtoContext = createContext<ATProtoContextType | null>(null);

export const useATProto = () => {
  const context = useContext(ATProtoContext);
  if (!context) {
    throw new Error('useATProto must be used within an ATProtoProvider');
  }
  return context;
};

export const ATProtoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [agent, setAgent] = useState<BskyAgent | null>(null);
  const [session, setSession] = useState<AtpSessionData | null>(null);

  const handleSessionChange = useCallback((evt: AtpSessionEvent) => {
    if (evt.session) {
      setSession(evt.session);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(evt.session));
    } else {
      setSession(null);
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    const initializeAgent = async () => {
      try {
        const savedSession = window.localStorage.getItem(STORAGE_KEY);
        if (savedSession) {
          const sessionData = JSON.parse(savedSession) as AtpSessionData;
          const newAgent = new BskyAgent({
            service: 'https://bsky.social',
            persistSession: handleSessionChange,
          });
          await newAgent.resumeSession(sessionData);
          setAgent(newAgent);
          setSession(sessionData);
        }
      } catch (error) {
        const atpError = error as ATProtoError;
        console.error('Failed to restore session:', atpError.message);
        window.localStorage.removeItem(STORAGE_KEY);
      }
    };

    initializeAgent();
  }, [handleSessionChange]);

  const login = useCallback(async (identifier: string, password: string) => {
    const newAgent = new BskyAgent({
      service: 'https://bsky.social',
      persistSession: handleSessionChange,
    });

    try {
      await newAgent.login({ identifier, password });
      setAgent(newAgent);
    } catch (error) {
      const atpError = error as ATProtoError;
      console.error('Login failed:', atpError.message);
      throw atpError;
    }
  }, [handleSessionChange]);

  const logout = useCallback(async () => {
    if (!agent) return;
    try {
      await agent.logout();
      setAgent(null);
      setSession(null);
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      const atpError = error as ATProtoError;
      console.error('Logout failed:', atpError.message);
      throw atpError;
    }
  }, [agent]);

  const getProfile = useCallback(async (handle: string): Promise<ProfileViewDetailed> => {
    if (!agent) throw new Error('Not logged in');
    try {
      const response = await agent.getProfile({ actor: handle });
      return response.data;
    } catch (error) {
      const atpError = error as ATProtoError;
      console.error('Failed to get profile:', atpError.message);
      throw atpError;
    }
  }, [agent]);

  const getAuthorFeed = useCallback(async (
    did: string,
    params?: AppBskyFeedGetAuthorFeed.QueryParams
  ): Promise<AppBskyFeedGetAuthorFeed.Response> => {
    if (!agent) throw new Error('Not logged in');
    try {
      const response = await agent.getAuthorFeed({ actor: did, ...params });
      return response;
    } catch (error) {
      const atpError = error as ATProtoError;
      console.error('Failed to get author feed:', atpError.message);
      throw atpError;
    }
  }, [agent]);

  const follow = useCallback(async (did: string) => {
    if (!agent) throw new Error('Not logged in');
    try {
      await agent.follow(did);
    } catch (error) {
      const atpError = error as ATProtoError;
      console.error('Failed to follow:', atpError.message);
      throw atpError;
    }
  }, [agent]);

  const unfollow = useCallback(async (did: string) => {
    if (!agent) throw new Error('Not logged in');
    try {
      await agent.deleteFollow(did);
    } catch (error) {
      const atpError = error as ATProtoError;
      console.error('Failed to unfollow:', atpError.message);
      throw atpError;
    }
  }, [agent]);

  const uploadBlob = useCallback(async (
    blob: Blob,
    options?: { onUploadProgress?: (progressEvent: ProgressEvent) => void }
  ): Promise<ComAtprotoRepoUploadBlob.Response> => {
    if (!agent) throw new Error('Not logged in');
    try {
      return await agent.uploadBlob(blob, options);
    } catch (error) {
      const atpError = error as ATProtoError;
      console.error('Failed to upload blob:', atpError.message);
      throw atpError;
    }
  }, [agent]);

  const value = {
    agent,
    session,
    login,
    logout,
    getProfile,
    getAuthorFeed,
    follow,
    unfollow,
    uploadBlob,
    isAuthenticated: !!agent && !!session,
  };

  return (
    <ATProtoContext.Provider value={value}>
      {children}
    </ATProtoContext.Provider>
  );
};
