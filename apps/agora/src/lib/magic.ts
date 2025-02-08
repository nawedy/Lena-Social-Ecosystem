import { Magic } from 'magic-sdk';
import { env } from '$env/dynamic/public';

export const magic = typeof window !== 'undefined'
  ? new Magic(env.VITE_MAGIC_PUBLISHABLE_KEY, {
      network: {
        rpcUrl: env.VITE_WEB3_NETWORK === 'localhost' 
          ? 'http://localhost:8545'
          : `https://${env.VITE_WEB3_NETWORK}.infura.io/v3/${env.VITE_INFURA_PROJECT_ID}`,
        chainId: env.VITE_WEB3_NETWORK === 'localhost' ? 1337 : 1
      }
    })
  : null; 