import { writable } from 'svelte/store';
import { supabase } from '$lib/supabase';
import type { User } from '@supabase/supabase-js';
import type { Database } from '$lib/types/supabase';
import { goto } from '$app/navigation';

type Profile = Database['public']['Tables']['profiles']['Row'];

type AuthState = {
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  error: Error | null;
};

const createAuthStore = () => {
  const { subscribe, set, update } = writable<AuthState>({
    user: null,
    profile: null,
    isLoading: true,
    error: null
  });

  return {
    subscribe,
    signUp: async (email: string, password: string) => {
      update(state => ({ ...state, isLoading: true, error: null }));
      try {
        const { data, error } = await supabase.auth.signUp({
          email,
          password
        });
        if (error) throw error;
        update(state => ({ ...state, user: data.user }));
        goto('/verify-email');
      } catch (error) {
        update(state => ({ ...state, error: error as Error }));
      } finally {
        update(state => ({ ...state, isLoading: false }));
      }
    },
    signIn: async (email: string, password: string) => {
      update(state => ({ ...state, isLoading: true, error: null }));
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        if (error) throw error;
        update(state => ({ ...state, user: data.user }));
        goto('/feed');
      } catch (error) {
        update(state => ({ ...state, error: error as Error }));
      } finally {
        update(state => ({ ...state, isLoading: false }));
      }
    },
    signOut: async () => {
      update(state => ({ ...state, isLoading: true, error: null }));
      try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        update(state => ({ ...state, user: null }));
        goto('/');
      } catch (error) {
        update(state => ({ ...state, error: error as Error }));
      } finally {
        update(state => ({ ...state, isLoading: false }));
      }
    },
    resetPassword: async (email: string) => {
      update(state => ({ ...state, isLoading: true, error: null }));
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email);
        if (error) throw error;
        goto('/check-email');
      } catch (error) {
        update(state => ({ ...state, error: error as Error }));
      } finally {
        update(state => ({ ...state, isLoading: false }));
      }
    },
    updatePassword: async (password: string) => {
      update(state => ({ ...state, isLoading: true, error: null }));
      try {
        const { error } = await supabase.auth.updateUser({
          password
        });
        if (error) throw error;
        goto('/profile');
      } catch (error) {
        update(state => ({ ...state, error: error as Error }));
      } finally {
        update(state => ({ ...state, isLoading: false }));
      }
    },
    // Initialize the store with the current session
    init: async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) {
        update(state => ({ ...state, error: error as Error }));
      } else {
        update(state => ({ ...state, user: session?.user || null }));
      }
      update(state => ({ ...state, isLoading: false }));

      // Listen for auth state changes
      supabase.auth.onAuthStateChange((_event, session) => {
        update(state => ({ ...state, user: session?.user || null }));
      });
    }
  };
};

export const auth = createAuthStore(); 