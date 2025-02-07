import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: adapter({
      runtime: 'edge',
      regions: ['iad1', 'sfo1', 'hnd1']
    }),
    csrf: {
      checkOrigin: true
    }
  },
  preprocess: vitePreprocess()
};

export default config; 