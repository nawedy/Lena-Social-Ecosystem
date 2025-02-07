import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      name: 'LenaStorage',
      fileName: 'index'
    },
    rollupOptions: {
      external: [
        'ipfs-http-client',
        '@web3.storage/w3up-client',
        'multiformats',
        'uint8arrays',
        '@supabase/storage-js',
        'browser-image-compression'
      ],
      output: {
        globals: {
          'ipfs-http-client': 'IpfsHttpClient',
          '@web3.storage/w3up-client': 'Web3Storage',
          'multiformats': 'Multiformats',
          'uint8arrays': 'Uint8arrays',
          '@supabase/storage-js': 'SupabaseStorage',
          'browser-image-compression': 'BrowserImageCompression'
        }
      }
    }
  },
  test: {
    globals: true,
    environment: 'node'
  }
}); 