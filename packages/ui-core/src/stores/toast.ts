import { writable } from 'svelte/store';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title?: string;
  message: string;
  duration?: number;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

function createToastStore() {
  const { subscribe, update } = writable<Toast[]>([]);

  return {
    subscribe,
    add: (toast: Omit<Toast, 'id'>) => {
      const id = Math.random().toString(36).slice(2);
      update(toasts => [...toasts, { ...toast, id }]);
      return id;
    },
    success: (message: string, title?: string) => {
      const id = Math.random().toString(36).slice(2);
      update(toasts => [...toasts, {
        id,
        type: 'success',
        title,
        message,
        duration: 5000,
        position: 'top-right'
      }]);
      return id;
    },
    error: (message: string, title?: string) => {
      const id = Math.random().toString(36).slice(2);
      update(toasts => [...toasts, {
        id,
        type: 'error',
        title,
        message,
        duration: 5000,
        position: 'top-right'
      }]);
      return id;
    },
    info: (message: string, title?: string) => {
      const id = Math.random().toString(36).slice(2);
      update(toasts => [...toasts, {
        id,
        type: 'info',
        title,
        message,
        duration: 5000,
        position: 'top-right'
      }]);
      return id;
    },
    warning: (message: string, title?: string) => {
      const id = Math.random().toString(36).slice(2);
      update(toasts => [...toasts, {
        id,
        type: 'warning',
        title,
        message,
        duration: 5000,
        position: 'top-right'
      }]);
      return id;
    },
    remove: (id: string) => {
      update(toasts => toasts.filter(t => t.id !== id));
    },
    clear: () => {
      update(() => []);
    }
  };
}

export const toasts = createToastStore(); 