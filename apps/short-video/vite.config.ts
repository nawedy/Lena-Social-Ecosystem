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
      'recordrtc',
      'ffmpeg.wasm',
      '@tensorflow/tfjs',
      '@tensorflow-models/blazeface',
      '@tensorflow-models/body-pix',
      '@tensorflow-models/pose-detection',
      '@mediapipe/tasks-vision',
      'three',
      'gsap'
    ]
  },
  build: {
    sourcemap: true,
    target: 'esnext',
    rollupOptions: {
      output: {
        manualChunks: {
          'video-engine': [
            'recordrtc',
            'ffmpeg.wasm'
          ],
          'ai-processing': [
            '@tensorflow/tfjs',
            '@tensorflow-models/blazeface',
            '@tensorflow-models/body-pix',
            '@tensorflow-models/pose-detection',
            '@mediapipe/tasks-vision'
          ],
          'web3': [
            'ethers',
            'web3.storage',
            '@magic-sdk/admin'
          ],
          'charts': [
            'chart.js',
            'svelte-chartjs'
          ],
          'animation': [
            'three',
            'gsap',
            '@threlte/core',
            '@threlte/extras'
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