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
  resolve: {
    alias: {
      '$lib': path.resolve(__dirname, './src/lib')
    }
  },
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      name: '@lena/ui-core',
      fileName: (format) => `index.${format}.js`
    },
    rollupOptions: {
      external: [
        'svelte',
        'three',
        '@threlte/core',
        '@threlte/extras',
        'gsap'
      ],
      output: {
        globals: {
          svelte: 'Svelte',
          three: 'THREE',
          '@threlte/core': 'Threlte',
          '@threlte/extras': 'ThrelteExtras',
          'gsap': 'gsap'
        }
      }
    }
  },
  test: {
    include: ['src/**/*.{test,spec}.{js,ts}'],
    globals: true,
    environment: 'jsdom'
  }
}); 