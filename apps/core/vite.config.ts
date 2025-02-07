import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  test: {
    include: ['src/**/*.{test,spec}.{js,ts}'],
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'src/setupTests.ts',
        '**/*.d.ts',
        '**/*.config.{js,ts}',
        '**/*.{spec,test}.{js,ts}',
        '**/__mocks__/**'
      ]
    }
  },
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'web3': ['web3.storage', 'ethers'],
          'auth': ['@supabase/supabase-js', 'magic-sdk'],
          'ui': ['@lena/ui', 'svelte-french-toast']
        }
      }
    }
  },
  ssr: {
    noExternal: ['three', 'gsap', '@threlte/core', '@threlte/extras']
  }
}); 