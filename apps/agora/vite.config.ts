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
    exclude: ['@lena/ui-core']
  },
  build: {
    sourcemap: true,
    target: 'esnext',
    rollupOptions: {
      output: {
        manualChunks: {
          'web3': ['ethers', 'web3', '@web3modal/ethereum', '@web3modal/html', 'wagmi'],
          'stripe': ['@stripe/stripe-js', 'stripe'],
          'charts': ['chart.js', 'svelte-chartjs'],
          'storage': ['ipfs-http-client', 'web3.storage']
        }
      }
    }
  }
}); 