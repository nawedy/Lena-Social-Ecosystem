import { writable } from 'svelte/store';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '$lib/supabaseClient';
import { magic } from '$lib/magic';
import type { Web3Provider } from '@ethersproject/providers';
import { ethers } from 'ethers';

export const user = writable<User | null>(null);
export const session = writable<Session | null>(null);
export const isAuthenticated = writable<boolean>(false);
export const web3Provider = writable<Web3Provider | null>(null);
export const walletAddress = writable<string | null>(null);
export const chainId = writable<number | null>(null);

class AuthStore {
  async init() {
    try {
      // Initialize Supabase auth
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

      // Initialize Web3
      if (window.ethereum) {
        const provider = new ethers.BrowserProvider(window.ethereum);
        web3Provider.set(provider);

        // Get initial wallet state
        const accounts = await provider.listAccounts();
        walletAddress.set(accounts[0]?.address ?? null);
        const network = await provider.getNetwork();
        chainId.set(Number(network.chainId));

        // Listen for account changes
        window.ethereum.on('accountsChanged', (accounts: string[]) => {
          walletAddress.set(accounts[0] ?? null);
        });

        // Listen for chain changes
        window.ethereum.on('chainChanged', (chainId: string) => {
          chainId.set(Number(chainId));
        });
      }
    } catch (error) {
      console.error('Failed to initialize auth:', error);
    }
  }

  async signIn(provider: 'email' | 'google' | 'github' | 'twitter' | 'magic' | 'web3', options?: any) {
    try {
      if (provider === 'email') {
        const { data, error } = await supabase.auth.signInWithPassword(options);
        if (error) throw error;
        return data;
      } else if (provider === 'magic') {
        const didToken = await magic.auth.loginWithMagicLink({ email: options.email });
        const { data, error } = await supabase.auth.signInWithIdToken({
          token: didToken
        });
        if (error) throw error;
        return data;
      } else if (provider === 'web3') {
        if (!window.ethereum) throw new Error('No Web3 provider found');
        
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const address = await signer.getAddress();
        const nonce = await this.getNonce(address);
        const signature = await signer.signMessage(
          `Sign this message to authenticate with Agora.\n\nNonce: ${nonce}`
        );

        const { data, error } = await supabase.auth.signInWithIdToken({
          token: signature,
          nonce
        });
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
    } catch (error) {
      console.error('Failed to sign in:', error);
      throw error;
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
    walletAddress.set(null);
    chainId.set(null);
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

  private async getNonce(address: string): Promise<string> {
    const { data, error } = await supabase
      .from('auth_nonces')
      .insert({ address })
      .select()
      .single();

    if (error) throw error;
    return data.nonce;
  }
}

export const auth = new AuthStore(); 