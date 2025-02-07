import '@testing-library/jest-dom';
import { vi } from 'vitest';
import { tick } from 'svelte';

// Mock requestAnimationFrame and cancelAnimationFrame
global.requestAnimationFrame = vi.fn((callback) => {
  return setTimeout(callback, 0);
});

global.cancelAnimationFrame = vi.fn((id) => {
  clearTimeout(id);
});

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Helper to wait for the next tick
export async function nextTick() {
  await tick();
  await new Promise(resolve => setTimeout(resolve, 0));
}

// Helper to wait for animations
export async function waitForAnimation() {
  await new Promise(resolve => setTimeout(resolve, 300));
} 