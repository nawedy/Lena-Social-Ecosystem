import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import sveltePreprocess from 'svelte-preprocess';

export default defineConfig({
  plugins: [
    svelte({
      preprocess: sveltePreprocess(),
      compilerOptions: {
        customElement: false
      }
    })
  ],
  build: {
    lib: {
      entry: './src/lib/index.ts',
      name: '@lena/ui',
      fileName: 'index'
    },
    rollupOptions: {
      external: ['svelte', 'svelte/internal', 'svelte/store'],
      output: {
        globals: {
          svelte: 'Svelte'
        }
      }
    }
  }
}); 