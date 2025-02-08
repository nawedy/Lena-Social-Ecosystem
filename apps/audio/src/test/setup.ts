import '@testing-library/jest-dom';
import { vi } from 'vitest';
import { readable } from 'svelte/store';

// Mock SvelteKit's app stores
vi.mock('$app/stores', () => ({
  page: readable({
    url: new URL('http://localhost'),
    params: {},
    route: { id: null },
    status: 200,
    error: null,
    data: {},
  }),
  navigating: readable(null),
  updated: readable(false),
}));

// Mock SvelteKit's navigation functions
vi.mock('$app/navigation', () => ({
  goto: vi.fn(),
  invalidate: vi.fn(),
  prefetch: vi.fn(),
  prefetchRoutes: vi.fn(),
}));

// Mock environment variables
vi.mock('$env/dynamic/public', () => ({
  env: {
    PUBLIC_APP_URL: 'http://localhost:5173',
    PUBLIC_API_URL: 'http://localhost:5173/api',
  },
}));

// Mock Web Audio API
class AudioContextMock {
  createMediaElementSource = vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
  }));
  createAnalyser = vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    frequencyBinCount: 1024,
    getByteFrequencyData: vi.fn(),
  }));
  createGain = vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    gain: { value: 1 },
  }));
  destination = {};
}

global.AudioContext = vi.fn().mockImplementation(() => new AudioContextMock());
global.webkitAudioContext = global.AudioContext;

// Mock Web Storage API
class StorageMock {
  private store: Record<string, string> = {};

  clear() {
    this.store = {};
  }

  getItem(key: string) {
    return this.store[key] || null;
  }

  setItem(key: string, value: string) {
    this.store[key] = String(value);
  }

  removeItem(key: string) {
    delete this.store[key];
  }

  key(index: number) {
    return Object.keys(this.store)[index] || null;
  }

  get length() {
    return Object.keys(this.store).length;
  }
}

global.localStorage = new StorageMock();
global.sessionStorage = new StorageMock();

// Mock IndexedDB
const indexedDB = {
  open: vi.fn(),
  deleteDatabase: vi.fn(),
};

global.indexedDB = indexedDB as any;

// Mock Web Workers
class WorkerMock {
  onmessage: ((this: Worker, ev: MessageEvent) => any) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();
}

global.Worker = vi.fn().mockImplementation(() => new WorkerMock());

// Mock MediaSession API
navigator.mediaSession = {
  metadata: null,
  playbackState: 'none',
  setActionHandler: vi.fn(),
  setPositionState: vi.fn(),
} as any;

// Mock Intersection Observer
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock Web Share API
navigator.share = vi.fn();
navigator.canShare = vi.fn().mockReturnValue(true);

// Mock Clipboard API
navigator.clipboard = {
  writeText: vi.fn(),
  readText: vi.fn(),
} as any;

// Mock Web Animations API
Element.prototype.animate = vi.fn().mockReturnValue({
  finished: Promise.resolve(),
  cancel: vi.fn(),
  pause: vi.fn(),
  play: vi.fn(),
});

// Mock fetch
global.fetch = vi.fn();

// Clean up after each test
afterEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
}); 