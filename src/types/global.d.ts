declare module 'browser-image-compression';
declare module 'replicate';
declare module '@google-cloud/video-intelligence';
declare module 'openai';
declare module 'googleapis';
declare module 'k6';
declare module 'k6/http';
declare module '@google-cloud/error-reporting';
declare module '@google-cloud/monitoring';
declare module '@google-cloud/profiler';
declare module '@google-cloud/trace-agent';
declare module '@opentelemetry/metrics';

declare global {
  interface Window {
    localStorage: Storage;
    crypto: Crypto;
  }

  var console: Console;
  var process: NodeJS.Process;
  var Buffer: typeof import('buffer').Buffer;
  var setTimeout: typeof import('timers').setTimeout;
  var clearTimeout: typeof import('timers').clearTimeout;
  var setInterval: typeof import('timers').setInterval;
  var clearInterval: typeof import('timers').clearInterval;
  var crypto: Crypto;
  var window: Window & typeof globalThis;

  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: 'development' | 'production' | 'test';
      [key: string]: string | undefined;
    }
  }
}
