import { useCallback } from 'react';

import { useATProto } from '../contexts/ATProtoContext';
import { ATProtoError } from '../utils/atproto-errors';

export function useATProtoAuth() {
  const { login, logout, isAuthenticated, isLoading, error, session } = useATProto();

  const handleLogin = useCallback(
    async (identifier: string, password: string) => {
      try {
        await login(identifier, password);
        return { success: true };
      } catch (err) {
        if (err instanceof ATProtoError) {
          return {
            success: false,
            error: {
              message: err.message,
              code: err.code,
            },
          };
        }
        return {
          success: false,
          error: {
            message: 'An unexpected error occurred',
            code: 'UNKNOWN_ERROR',
          },
        };
      }
    },
    [login]
  );

  const handleLogout = useCallback(async () => {
    try {
      await logout();
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: {
          message: err instanceof ATProtoError ? err.message : 'Logout failed',
          code: err instanceof ATProtoError ? err.code : 'LOGOUT_ERROR',
        },
      };
    }
  }, [logout]);

  return {
    login: handleLogin,
    logout: handleLogout,
    isAuthenticated,
    isLoading,
    error,
    session,
    did: session?.did,
    handle: session?.handle,
  };
}
