import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';
import { auth, isAuthenticated, authError } from './store';
import { mockUser, mockSupabase } from '../../test/utils';

// Mock Supabase client
vi.mock('$lib/supabaseClient', () => ({
  supabase: mockSupabase
}));

describe('Auth Store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.set({
      user: null,
      session: null,
      loading: false,
      error: null,
      provider: null,
      web3: {
        address: null,
        chainId: null,
        provider: null
      }
    });
  });

  describe('initialization', () => {
    it('should start with initial state', () => {
      const state = get(auth);
      expect(state.user).toBeNull();
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.provider).toBeNull();
    });

    it('should initialize with existing session', async () => {
      mockSupabase.auth.getSession.mockResolvedValueOnce({
        data: { session: { user: mockUser } },
        error: null
      });

      await auth.init();
      const state = get(auth);

      expect(state.user).toEqual(mockUser);
      expect(state.provider).toBe('supabase');
      expect(state.loading).toBe(false);
    });
  });

  describe('email authentication', () => {
    it('should sign in with email and password', async () => {
      mockSupabase.auth.signInWithPassword.mockResolvedValueOnce({
        data: { user: mockUser, session: { user: mockUser } },
        error: null
      });

      await auth.signInWithEmail('test@example.com', 'password');
      const state = get(auth);

      expect(state.user).toEqual(mockUser);
      expect(state.provider).toBe('supabase');
      expect(state.error).toBeNull();
      expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password'
      });
    });

    it('should handle sign in errors', async () => {
      const error = new Error('Invalid credentials');
      mockSupabase.auth.signInWithPassword.mockRejectedValueOnce(error);

      await auth.signInWithEmail('test@example.com', 'wrong-password');
      const state = get(auth);

      expect(state.user).toBeNull();
      expect(state.error).toBe('Invalid credentials');
      expect(get(authError)).toBe('Invalid credentials');
    });
  });

  describe('web3 authentication', () => {
    it('should sign in with web3 wallet', async () => {
      const mockAddress = '0x123...';
      const mockSignature = '0xabc...';
      const mockProvider = {
        send: vi.fn().mockResolvedValue([mockAddress]),
        getSigner: vi.fn().mockReturnValue({
          getAddress: vi.fn().mockResolvedValue(mockAddress),
          signMessage: vi.fn().mockResolvedValue(mockSignature)
        }),
        getNetwork: vi.fn().mockResolvedValue({ chainId: 1 })
      };

      // @ts-ignore
      global.window.ethereum = {
        request: vi.fn().mockResolvedValue([mockAddress])
      };

      mockSupabase.auth.signInWithPassword.mockResolvedValueOnce({
        data: { user: mockUser, session: { user: mockUser } },
        error: null
      });

      await auth.signInWithWeb3();
      const state = get(auth);

      expect(state.provider).toBe('web3');
      expect(state.web3.address).toBe(mockAddress);
      expect(state.web3.chainId).toBe(1);
    });
  });

  describe('magic link authentication', () => {
    it('should sign in with magic link', async () => {
      const mockMagicUser = {
        email: 'test@example.com',
        publicAddress: '0x123...'
      };

      vi.mock('$lib/auth/config', () => ({
        magic: {
          auth: {
            loginWithMagicLink: vi.fn().mockResolvedValue(true)
          },
          user: {
            getMetadata: vi.fn().mockResolvedValue(mockMagicUser)
          }
        }
      }));

      mockSupabase.auth.signInWithPassword.mockResolvedValueOnce({
        data: { user: mockUser, session: { user: mockUser } },
        error: null
      });

      await auth.signInWithMagic('test@example.com');
      const state = get(auth);

      expect(state.provider).toBe('magic');
      expect(state.user).toEqual(mockUser);
      expect(state.error).toBeNull();
    });
  });

  describe('sign out', () => {
    it('should clear auth state on sign out', async () => {
      // Set initial authenticated state
      auth.set({
        user: mockUser,
        session: { user: mockUser },
        loading: false,
        error: null,
        provider: 'supabase',
        web3: {
          address: null,
          chainId: null,
          provider: null
        }
      });

      mockSupabase.auth.signOut.mockResolvedValueOnce({ error: null });

      await auth.signOut();
      const state = get(auth);

      expect(state.user).toBeNull();
      expect(state.session).toBeNull();
      expect(state.provider).toBeNull();
      expect(get(isAuthenticated)).toBe(false);
    });
  });

  describe('derived stores', () => {
    it('should update isAuthenticated store', () => {
      expect(get(isAuthenticated)).toBe(false);

      auth.set({
        user: mockUser,
        session: { user: mockUser },
        loading: false,
        error: null,
        provider: 'supabase',
        web3: {
          address: null,
          chainId: null,
          provider: null
        }
      });

      expect(get(isAuthenticated)).toBe(true);
    });

    it('should update authError store', () => {
      expect(get(authError)).toBeNull();

      const error = 'Authentication failed';
      auth.update(state => ({ ...state, error }));

      expect(get(authError)).toBe(error);
    });
  });
}); 