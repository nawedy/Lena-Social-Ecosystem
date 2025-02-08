import adapter from '@sveltejs/adapter-auto';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: adapter(),
    alias: {
      '@': 'src',
      '@core': '../core/src'
    },
    csrf: {
      checkOrigin: true
    },
    serviceWorker: {
      register: true
    },
    files: {
      serviceWorker: 'src/service-worker.ts'
    }
  },
  preprocess: vitePreprocess({
    postcss: true,
    preserve: ['ld+json']
  })
};

export default config; 