import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      name: 'LenaAuth',
      fileName: 'index'
    },
    rollupOptions: {
      external: [
        '@atproto/api',
        'magic-sdk',
        'ethers',
        '@supabase/supabase-js',
        'siwe',
        'svelte'
      ],
      output: {
        globals: {
          '@atproto/api': 'AtProtoApi',
          'magic-sdk': 'Magic',
          'ethers': 'ethers',
          '@supabase/supabase-js': 'Supabase',
          'siwe': 'SiweMessage',
          'svelte': 'Svelte'
        }
      }
    }
  },
  test: {
    globals: true,
    environment: 'node'
  }
}); 