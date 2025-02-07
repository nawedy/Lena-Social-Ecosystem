import '@testing-library/jest-dom';
import { vi } from 'vitest';
import { readable } from 'svelte/store';

// Mock SvelteKit's environment variables
vi.mock('$env/dynamic/public', () => ({
  env: {
    PUBLIC_SUPABASE_URL: 'http://localhost:54321',
    PUBLIC_SUPABASE_ANON_KEY: 'mock-anon-key',
    PUBLIC_WEB3_STORAGE_TOKEN: 'mock-web3-storage-token',
    PUBLIC_IPFS_GATEWAY: 'https://w3s.link',
    PUBLIC_PLAUSIBLE_DOMAIN: 'localhost',
    PUBLIC_MAGIC_PUBLISHABLE_KEY: 'mock-magic-key',
    PUBLIC_ETHEREUM_NETWORK: 'localhost',
    PUBLIC_INFURA_PROJECT_ID: 'mock-infura-id'
  }
}));

// Mock SvelteKit's navigation
vi.mock('$app/navigation', () => ({
  goto: vi.fn(),
  beforeNavigate: vi.fn(),
  afterNavigate: vi.fn()
}));

// Mock SvelteKit's stores
vi.mock('$app/stores', () => ({
  page: readable({
    url: new URL('http://localhost:5173'),
    params: {},
    route: { id: null }
  }),
  navigating: readable(null),
  updated: readable(false)
})); 