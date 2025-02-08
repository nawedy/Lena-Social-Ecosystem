import { writable } from 'svelte/store';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '$lib/supabaseClient';

export const user = writable<User | null>(null);
export const session = writable<Session | null>(null);
export const isAuthenticated = writable<boolean>(false);

class AuthStore {
  async init() {
    // Initialize the stores with the current session
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    session.set(currentSession);
    user.set(currentSession?.user ?? null);
    isAuthenticated.set(!!currentSession);

    // Listen for auth changes
    supabase.auth.onAuthStateChange((_event, currentSession) => {
      session.set(currentSession);
      user.set(currentSession?.user ?? null);
      isAuthenticated.set(!!currentSession);
    });
  }

  async signIn(provider: 'email' | 'google' | 'github' | 'twitter', options?: any) {
    if (provider === 'email') {
      const { data, error } = await supabase.auth.signInWithPassword(options);
      if (error) throw error;
      return data;
    } else {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`
        }
      });
      if (error) throw error;
      return data;
    }
  }

  async signUp(email: string, password: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`
      }
    });
    if (error) throw error;
    return data;
  }

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }

  async resetPassword(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`
    });
    if (error) throw error;
  }

  async updatePassword(password: string) {
    const { error } = await supabase.auth.updateUser({
      password
    });
    if (error) throw error;
  }

  async updateProfile(profile: Partial<User['user_metadata']>) {
    const { error } = await supabase.auth.updateUser({
      data: profile
    });
    if (error) throw error;
  }
}

export const auth = new AuthStore(); 