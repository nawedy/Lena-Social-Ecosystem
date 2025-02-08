import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  plugins: [sveltekit()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@core': path.resolve(__dirname, '../core/src')
    }
  },
  server: {
    fs: {
      allow: ['..']
    }
  },
  optimizeDeps: {
    exclude: ['@lena/ui-core'],
    include: [
      'wavesurfer.js',
      'howler',
      'music-metadata-browser',
      'tone',
      '@tensorflow/tfjs',
      '@tensorflow-models/pitch-detection',
      'lamejs'
    ]
  },
  build: {
    sourcemap: true,
    target: 'esnext',
    rollupOptions: {
      output: {
        manualChunks: {
          'audio-engine': [
            'wavesurfer.js',
            'howler',
            'tone'
          ],
          'audio-processing': [
            'music-metadata-browser',
            '@tensorflow/tfjs',
            '@tensorflow-models/pitch-detection',
            'lamejs'
          ],
          'web3': [
            'ethers',
            'web3.storage',
            '@magic-sdk/admin'
          ],
          'charts': [
            'chart.js',
            'svelte-chartjs'
          ]
        }
      }
    }
  },
  test: {
    include: ['src/**/*.{test,spec}.{js,ts}'],
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts']
  }
}); 