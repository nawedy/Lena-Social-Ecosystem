import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'path';

export default defineConfig({
  plugins: [svelte({ hot: !process.env.VITEST })],
  test: {
    include: ['src/**/*.{test,spec}.{js,ts}'],
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'coverage/**',
        'dist/**',
        '**/[.]**',
        'packages/*/test{,s}/**',
        '**/*.d.ts',
        '**/virtual:*',
        '**/__mocks__/*',
        '**/test/**',
        '**/.{idea,git,cache,output,temp}/**',
        'src/test/**',
      ],
    },
    mockReset: true,
    restoreMocks: true,
    clearMocks: true,
    deps: {
      inline: [/^(?!.*(?:node_modules)).*$/],
    },
    alias: {
      '@': path.resolve(__dirname, './src'),
      '$lib': path.resolve(__dirname, './src/lib'),
      '$app': path.resolve(__dirname, './.svelte-kit/runtime/app'),
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '$lib': path.resolve(__dirname, './src/lib'),
      '$app': path.resolve(__dirname, './.svelte-kit/runtime/app'),
    },
  },
}); 