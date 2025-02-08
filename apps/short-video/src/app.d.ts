/// <reference types="@sveltejs/kit" />

declare global {
  namespace App {
    interface Locals {
      user: import('@supabase/supabase-js').User | null;
      session: import('@supabase/supabase-js').Session | null;
      web3: {
        address: string | null;
        chainId: number | null;
        isConnected: boolean;
      };
    }
    interface PageData {
      session: import('@supabase/supabase-js').Session | null;
    }
    interface Error {
      message: string;
      code?: string;
      context?: Record<string, any>;
    }
    interface Platform {}
  }

  interface Window {
    ethereum?: {
      isMetaMask?: boolean;
      request: (args: { method: string; params?: any[] }) => Promise<any>;
      on: (event: string, callback: (params: any) => void) => void;
      removeListener: (event: string, callback: (params: any) => void) => void;
    };
    MediaRecorder: typeof MediaRecorder;
    webkitMediaRecorder?: typeof MediaRecorder;
    AudioContext: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
    createFFmpeg?: (options: any) => any;
    TensorFlow?: {
      tf: any;
      blazeface: any;
      bodyPix: any;
      poseDetection: any;
    };
  }

  // MediaRecorder types
  interface MediaRecorderOptions {
    mimeType?: string;
    audioBitsPerSecond?: number;
    videoBitsPerSecond?: number;
    bitsPerSecond?: number;
  }

  interface MediaRecorderErrorEvent extends Event {
    name: string;
  }

  interface MediaRecorderDataAvailableEvent extends Event {
    data: Blob;
  }

  interface MediaRecorder {
    readonly state: 'inactive' | 'recording' | 'paused';
    readonly stream: MediaStream;
    readonly mimeType: string;
    readonly videoBitsPerSecond: number;
    readonly audioBitsPerSecond: number;

    ondataavailable: ((event: MediaRecorderDataAvailableEvent) => void) | null;
    onerror: ((event: MediaRecorderErrorEvent) => void) | null;
    onpause: (() => void) | null;
    onresume: (() => void) | null;
    onstart: (() => void) | null;
    onstop: (() => void) | null;

    start(timeslice?: number): void;
    stop(): void;
    pause(): void;
    resume(): void;
    requestData(): void;
  }
}

export {}; 