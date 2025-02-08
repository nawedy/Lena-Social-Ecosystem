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
      studio: {
        channelId: string | null;
        isVerified: boolean;
        monetizationEnabled: boolean;
        contentSettings: {
          defaultPrivacy: 'public' | 'unlisted' | 'private';
          defaultLicense: 'standard' | 'creative-commons';
          defaultCategory: string;
          autoTranscribe: boolean;
          autoTranslate: boolean;
          autoChapters: boolean;
        };
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
    Hls: typeof import('hls.js').default;
    dashjs: typeof import('dashjs');
    shaka: typeof import('shaka-player');
    videojs: typeof import('video.js').default;
    Plyr: typeof import('plyr');
    WaveSurfer: typeof import('wavesurfer.js').default;
    Howl: typeof import('howler').Howl;
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

  // Video player types
  interface VideoPlayerConfig {
    autoplay?: boolean;
    controls?: boolean;
    loop?: boolean;
    muted?: boolean;
    poster?: string;
    preload?: 'none' | 'metadata' | 'auto';
    quality?: {
      default: string;
      options: {
        label: string;
        value: string;
      }[];
    };
    speed?: {
      default: number;
      options: number[];
    };
    captions?: {
      default?: string;
      options: {
        label: string;
        srclang: string;
        src: string;
      }[];
    };
    chapters?: {
      time: number;
      title: string;
    }[];
    thumbnails?: {
      url: string;
      width: number;
      height: number;
      interval: number;
    };
  }

  interface VideoAnalytics {
    views: number;
    uniqueViewers: number;
    averageWatchTime: number;
    completionRate: number;
    engagementRate: number;
    retention: {
      time: number;
      percentage: number;
    }[];
    demographics: {
      age: Record<string, number>;
      gender: Record<string, number>;
      location: Record<string, number>;
    };
    traffic: {
      source: Record<string, number>;
      referrer: Record<string, number>;
    };
    devices: {
      os: Record<string, number>;
      browser: Record<string, number>;
      device: Record<string, number>;
    };
  }

  interface StudioAnalytics extends VideoAnalytics {
    subscribers: {
      total: number;
      gained: number;
      lost: number;
      history: {
        date: string;
        count: number;
      }[];
    };
    revenue: {
      total: number;
      adsense: number;
      sponsorships: number;
      memberships: number;
      superchats: number;
      history: {
        date: string;
        amount: number;
        source: string;
      }[];
    };
    engagement: {
      likes: number;
      dislikes: number;
      comments: number;
      shares: number;
      history: {
        date: string;
        type: string;
        count: number;
      }[];
    };
  }
}

export {}; 