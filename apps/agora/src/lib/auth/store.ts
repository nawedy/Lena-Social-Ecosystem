import { writable } from 'svelte/store';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '$lib/supabaseClient';
import { magic } from '$lib/magic';
import type { Web3Provider } from '@ethersproject/providers';
import { ethers } from 'ethers';
import { browser } from '$app/environment';

export const user = writable<User | null>(null);
export const session = writable<Session | null>(null);
export const isAuthenticated = writable<boolean>(false);
export const web3Provider = writable<ethers.BrowserProvider | null>(null);
export const walletAddress = writable<string | null>(null);
export const chainId = writable<number | null>(null);
export const userAddress = writable<string | null>(null);
export const isConnected = writable<boolean>(false);

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
      if (browser) {
        await initializeWeb3();
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

// Initialize Web3 provider
export async function initializeWeb3() {
  if (!browser) return;

  try {
    if (window.ethereum) {
      const provider = new ethers.BrowserProvider(window.ethereum);
      web3Provider.set(provider);

      // Listen for account changes
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      
      // Listen for chain changes
      window.ethereum.on('chainChanged', handleChainChanged);

      // Check if already connected
      const accounts = await provider.listAccounts();
      if (accounts.length > 0) {
        handleAccountsChanged(accounts);
      }

      // Get current chain ID
      const network = await provider.getNetwork();
      chainId.set(Number(network.chainId));
    }
  } catch (error) {
    console.error('Failed to initialize Web3:', error);
    disconnectWallet();
  }
}

// Connect wallet
export async function connectWallet() {
  if (!browser) return;

  try {
    if (!window.ethereum) {
      throw new Error('No Web3 provider available');
    }

    const provider = new ethers.BrowserProvider(window.ethereum);
    const accounts = await provider.send('eth_requestAccounts', []);
    
    web3Provider.set(provider);
    handleAccountsChanged(accounts);
  } catch (error) {
    console.error('Failed to connect wallet:', error);
    throw error;
  }
}

// Disconnect wallet
export function disconnectWallet() {
  web3Provider.set(null);
  userAddress.set(null);
  isConnected.set(false);
  chainId.set(null);
}

// Handle account changes
function handleAccountsChanged(accounts: string[]) {
  if (accounts.length === 0) {
    disconnectWallet();
  } else {
    userAddress.set(accounts[0]);
    isConnected.set(true);
  }
}

// Handle chain changes
function handleChainChanged(newChainId: string) {
  chainId.set(parseInt(newChainId));
  window.location.reload();
}

// Initialize on browser
if (browser) {
  initializeWeb3();
} 