import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'path';
import preprocess from 'svelte-preprocess';

export default defineConfig({
  plugins: [
    svelte({
      preprocess: preprocess(),
      compilerOptions: { 
        customElement: false 
      }
    })
  ],
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      name: 'LenaUI',
      fileName: 'index'
    },
    rollupOptions: {
      external: ['svelte'],
      output: {
        globals: {
          svelte: 'Svelte'
        }
      }
    }
  }
}); 