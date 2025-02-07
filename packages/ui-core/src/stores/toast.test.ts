import { describe, it, expect, vi } from 'vitest';
import { get } from 'svelte/store';
import { toasts } from './toast';

describe('Toast Store', () => {
  beforeEach(() => {
    toasts.clear();
  });

  it('starts with an empty array', () => {
    expect(get(toasts)).toEqual([]);
  });

  it('adds a toast with generated id', () => {
    const id = toasts.add({
      type: 'info',
      message: 'Test message'
    });

    const currentToasts = get(toasts);
    expect(currentToasts).toHaveLength(1);
    expect(currentToasts[0]).toEqual({
      id,
      type: 'info',
      message: 'Test message'
    });
  });

  it('removes a toast by id', () => {
    const id = toasts.add({
      type: 'info',
      message: 'Test message'
    });

    expect(get(toasts)).toHaveLength(1);

    toasts.remove(id);
    expect(get(toasts)).toHaveLength(0);
  });

  it('clears all toasts', () => {
    toasts.add({ type: 'info', message: 'Test 1' });
    toasts.add({ type: 'success', message: 'Test 2' });
    toasts.add({ type: 'error', message: 'Test 3' });

    expect(get(toasts)).toHaveLength(3);

    toasts.clear();
    expect(get(toasts)).toHaveLength(0);
  });

  it('maintains toast order', () => {
    const id1 = toasts.add({ type: 'info', message: 'First' });
    const id2 = toasts.add({ type: 'success', message: 'Second' });
    const id3 = toasts.add({ type: 'error', message: 'Third' });

    const currentToasts = get(toasts);
    expect(currentToasts.map(t => t.id)).toEqual([id1, id2, id3]);
  });

  it('handles all toast types', () => {
    const types = ['success', 'error', 'info', 'warning'] as const;

    types.forEach(type => {
      const id = toasts.add({
        type,
        message: `${type} message`
      });

      const toast = get(toasts).find(t => t.id === id);
      expect(toast).toBeDefined();
      expect(toast?.type).toBe(type);
    });
  });

  it('preserves additional toast properties', () => {
    const id = toasts.add({
      type: 'info',
      message: 'Test message',
      title: 'Test Title',
      duration: 3000,
      position: 'top-right'
    });

    const toast = get(toasts)[0];
    expect(toast).toEqual({
      id,
      type: 'info',
      message: 'Test message',
      title: 'Test Title',
      duration: 3000,
      position: 'top-right'
    });
  });
}); 