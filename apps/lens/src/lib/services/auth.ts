import { supabase } from '$lib/supabase';
import { api } from './api';
import type { UserProfile } from '$lib/types';
import { writable, derived } from 'svelte/store';

interface AuthState {
  user: UserProfile | null;
  session: any | null;
  loading: boolean;
  initialized: boolean;
}

// Create auth store
function createAuthStore() {
  const { subscribe, set, update } = writable<AuthState>({
    user: null,
    session: null,
    loading: true,
    initialized: false
  });

  return {
    subscribe,
    set,
    update,
    initialize: async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          const { data: profile } = await api.get<UserProfile>(`/users/${session.user.id}`);
          update(state => ({ ...state, user: profile || null, session, initialized: true }));
        } else {
          update(state => ({ ...state, initialized: true }));
        }
      } catch (error) {
        console.error('Auth initialization failed:', error);
        update(state => ({ ...state, initialized: true }));
      } finally {
        update(state => ({ ...state, loading: false }));
      }
    },
    signIn: async (provider: 'email' | 'magic_link' | 'google' | 'twitter' | 'github', options?: any) => {
      update(state => ({ ...state, loading: true }));

      try {
        let authResponse;

        switch (provider) {
          case 'email':
            authResponse = await supabase.auth.signInWithPassword(options);
            break;
          case 'magic_link':
            authResponse = await supabase.auth.signInWithOtp({ email: options.email });
            break;
          default:
            authResponse = await supabase.auth.signInWithOAuth({ provider });
        }

        const { data: { session }, error } = authResponse;
        if (error) throw error;

        if (session) {
          const { data: profile } = await api.get<UserProfile>(`/users/${session.user.id}`);
          update(state => ({ ...state, user: profile || null, session }));
        }

        return { error: null };
      } catch (error) {
        console.error('Sign in failed:', error);
        return { error };
      } finally {
        update(state => ({ ...state, loading: false }));
      }
    },
    signUp: async (options: { email: string; password: string; username: string }) => {
      update(state => ({ ...state, loading: true }));

      try {
        const { data: { session }, error } = await supabase.auth.signUp({
          email: options.email,
          password: options.password,
          options: {
            data: {
              username: options.username
            }
          }
        });

        if (error) throw error;

        if (session) {
          // Create user profile
          const { data: profile } = await api.post<UserProfile>('/users', {
            username: options.username
          });

          update(state => ({ ...state, user: profile || null, session }));
        }

        return { error: null };
      } catch (error) {
        console.error('Sign up failed:', error);
        return { error };
      } finally {
        update(state => ({ ...state, loading: false }));
      }
    },
    signOut: async () => {
      update(state => ({ ...state, loading: true }));

      try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;

        update(state => ({ ...state, user: null, session: null }));
        return { error: null };
      } catch (error) {
        console.error('Sign out failed:', error);
        return { error };
      } finally {
        update(state => ({ ...state, loading: false }));
      }
    },
    updateProfile: async (updates: Partial<UserProfile>) => {
      update(state => ({ ...state, loading: true }));

      try {
        if (!state.user) throw new Error('No user logged in');

        const { data: profile, error } = await api.put<UserProfile>(`/users/${state.user.id}`, updates);
        if (error) throw error;

        update(state => ({ ...state, user: profile || state.user }));
        return { error: null };
      } catch (error) {
        console.error('Profile update failed:', error);
        return { error };
      } finally {
        update(state => ({ ...state, loading: false }));
      }
    },
    resetPassword: async (email: string) => {
      update(state => ({ ...state, loading: true }));

      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email);
        if (error) throw error;

        return { error: null };
      } catch (error) {
        console.error('Password reset failed:', error);
        return { error };
      } finally {
        update(state => ({ ...state, loading: false }));
      }
    },
    updatePassword: async (password: string) => {
      update(state => ({ ...state, loading: true }));

      try {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;

        return { error: null };
      } catch (error) {
        console.error('Password update failed:', error);
        return { error };
      } finally {
        update(state => ({ ...state, loading: false }));
      }
    }
  };
}

// Create auth store instance
export const auth = createAuthStore();

// Derived stores
export const user = derived(auth, $auth => $auth.user);
export const isAuthenticated = derived(auth, $auth => !!$auth.session);
export const isLoading = derived(auth, $auth => $auth.loading);
export const isInitialized = derived(auth, $auth => $auth.initialized);

// Initialize auth on app start
supabase.auth.onAuthStateChange(async (event, session) => {
  if (event === 'SIGNED_IN' && session) {
    const { data: profile } = await api.get<UserProfile>(`/users/${session.user.id}`);
    auth.update(state => ({ ...state, user: profile || null, session }));
  } else if (event === 'SIGNED_OUT') {
    auth.update(state => ({ ...state, user: null, session: null }));
  }
}); 