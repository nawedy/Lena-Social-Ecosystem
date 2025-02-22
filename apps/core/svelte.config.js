import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
export default {
  kit: {
    adapter: adapter({
      runtime: 'edge',
      regions: ['iad1']
    }),
    csrf: {
      checkOrigin: true
    }
  },
  preprocess: vitePreprocess()
}; 