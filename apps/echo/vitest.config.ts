import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte({ hot: !process.env.VITEST })],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{js,ts,svelte}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'src/test/**',
        '**/*.d.ts',
        '**/*.config.{js,ts}',
        '**/types/**'
      ]
    },
    alias: {
      '$lib': '/src/lib',
      '$app': '/node_modules/@sveltejs/kit/src/runtime/app'
    }
  }
}); 