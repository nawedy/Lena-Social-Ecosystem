import { writable } from 'svelte/store';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '$lib/supabaseClient';

export const user = writable<User | null>(null);
export const session = writable<Session | null>(null);

// Initialize the stores with the current session
supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
  session.set(currentSession);
  user.set(currentSession?.user ?? null);
});

// Listen for auth changes
supabase.auth.onAuthStateChange((_event, currentSession) => {
  session.set(currentSession);
  user.set(currentSession?.user ?? null);
}); 