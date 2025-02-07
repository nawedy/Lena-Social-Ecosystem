import { writable } from 'svelte/store';

interface Toast {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  duration?: number;
}

function createToastStore() {
  const { subscribe, update } = writable<Toast[]>([]);

  function show(toast: Omit<Toast, 'id'>) {
    const id = Math.random().toString(36).substring(2, 9);
    const duration = toast.duration || 3000;

    update(toasts => [...toasts, { ...toast, id }]);

    setTimeout(() => {
      dismiss(id);
    }, duration);
  }

  function dismiss(id: string) {
    update(toasts => toasts.filter(t => t.id !== id));
  }

  return {
    subscribe,
    success: (message: string, duration?: number) =>
      show({ type: 'success', message, duration }),
    error: (message: string, duration?: number) =>
      show({ type: 'error', message, duration }),
    info: (message: string, duration?: number) =>
      show({ type: 'info', message, duration }),
    warning: (message: string, duration?: number) =>
      show({ type: 'warning', message, duration }),
    dismiss
  };
}

export const toast = createToastStore(); 