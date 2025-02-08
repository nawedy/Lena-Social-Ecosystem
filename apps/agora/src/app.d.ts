/// <reference types="@sveltejs/kit" />

// See https://kit.svelte.dev/docs/types#app
declare global {
  namespace App {
    interface Locals {
      user: import('@supabase/supabase-js').User | null;
      session: import('@supabase/supabase-js').Session | null;
      web3: {
        address: string | null;
        chainId: number | null;
        isConnected: boolean;
      };
    }
    interface PageData {
      session: import('@supabase/supabase-js').Session | null;
    }
    interface Error {
      message: string;
      code?: string;
      context?: Record<string, any>;
    }
    interface Platform {}
  }

  interface Window {
    ethereum?: {
      isMetaMask?: boolean;
      request: (args: { method: string; params?: any[] }) => Promise<any>;
      on: (event: string, callback: (params: any) => void) => void;
      removeListener: (event: string, callback: (params: any) => void) => void;
    };
  }
}

export {}; 