import { render, type RenderResult } from '@testing-library/svelte';
import { readable } from 'svelte/store';
import type { User } from '@supabase/supabase-js';
import { vi } from 'vitest';

// Mock user data
export const mockUser: User = {
  id: 'test-user-id',
  email: 'test@example.com',
  role: 'authenticated',
  aud: 'authenticated',
  app_metadata: {},
  user_metadata: {
    username: 'testuser',
    avatar_url: 'https://example.com/avatar.png'
  },
  created_at: new Date().toISOString()
};

// Mock Supabase client
export const mockSupabase = {
  auth: {
    getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    signInWithPassword: vi.fn(),
    signInWithOAuth: vi.fn(),
    signOut: vi.fn(),
    onAuthStateChange: vi.fn()
  },
  from: vi.fn().mockReturnValue({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn()
  }),
  storage: {
    from: vi.fn().mockReturnValue({
      upload: vi.fn(),
      download: vi.fn(),
      remove: vi.fn(),
      getPublicUrl: vi.fn()
    })
  }
};

// Mock IPFS service
export const mockIpfsService = {
  upload: vi.fn(),
  get: vi.fn(),
  pin: vi.fn(),
  unpin: vi.fn(),
  status: vi.fn()
};

// Mock moderation service
export const mockModerationService = {
  moderateContent: vi.fn(),
  submitAction: vi.fn(),
  getQueue: vi.fn(),
  updateSettings: vi.fn(),
  getSettings: vi.fn()
};

// Mock analytics service
export const mockAnalyticsService = {
  track: vi.fn(),
  trackPageView: vi.fn(),
  trackEngagement: vi.fn(),
  getUserMetrics: vi.fn(),
  getEngagementMetrics: vi.fn()
};

// Custom render function with providers
interface RenderOptions {
  user?: User | null;
  path?: string;
  props?: Record<string, any>;
}

export function renderWithProviders(
  Component: any,
  options: RenderOptions = {}
): RenderResult {
  const {
    user = null,
    path = '/',
    props = {}
  } = options;

  // Mock stores
  vi.mock('$lib/stores/auth', () => ({
    user: readable(user),
    isAuthenticated: readable(!!user)
  }));

  // Mock page store
  vi.mock('$app/stores', () => ({
    page: readable({
      url: new URL(`http://localhost:5173${path}`),
      params: {},
      route: { id: null },
      status: 200,
      error: null,
      data: {},
      form: undefined
    })
  }));

  return render(Component, { props });
}

// Wait for component to update
export function waitForComponentToUpdate(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

// Create a mock file
export function createMockFile(
  name = 'test.jpg',
  type = 'image/jpeg',
  size = 1024
): File {
  const blob = new Blob(['test'], { type });
  return new File([blob], name, { type });
}

// Mock fetch response
export function mockFetchResponse(data: any, ok = true): Response {
  return {
    ok,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
    blob: () => Promise.resolve(new Blob()),
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    headers: new Headers(),
    status: ok ? 200 : 400,
    statusText: ok ? 'OK' : 'Bad Request',
    type: 'basic',
    url: 'http://localhost',
    clone: function() { return this }
  } as Response;
}

// Mock event
export function createEvent(type: string, detail?: any): CustomEvent {
  return new CustomEvent(type, { detail });
}

// Mock intersection observer entry
export function createIntersectionObserverEntry(
  isIntersecting = true,
  ratio = 1
): IntersectionObserverEntry {
  return {
    boundingClientRect: new DOMRectReadOnly(),
    intersectionRatio: ratio,
    intersectionRect: new DOMRectReadOnly(),
    isIntersecting,
    rootBounds: new DOMRectReadOnly(),
    target: document.createElement('div'),
    time: Date.now()
  };
}

// Clean up utilities
export function cleanupMocks(): void {
  vi.clearAllMocks();
  localStorage.clear();
  document.body.innerHTML = '';
} 