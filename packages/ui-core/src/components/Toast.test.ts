import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { waitForAnimation } from '../test/setup';
import Toast from './Toast.svelte';

describe('Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders with default props', () => {
    const { getByRole } = render(Toast, {
      props: {
        id: 'test',
        message: 'Test message',
        onClose: vi.fn()
      }
    });

    const toast = getByRole('alert');
    expect(toast).toBeInTheDocument();
    expect(toast).toHaveTextContent('Test message');
  });

  it('renders different types with correct icons and colors', () => {
    const types = ['success', 'error', 'info', 'warning'] as const;
    const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };

    types.forEach(type => {
      const { getByRole } = render(Toast, {
        props: {
          id: 'test',
          type,
          message: 'Test message',
          onClose: vi.fn()
        }
      });

      const toast = getByRole('alert');
      expect(toast.querySelector(`[role="img"][aria-label="${type}"]`)).toHaveTextContent(icons[type]);
    });
  });

  it('shows title when provided', () => {
    const { getByText } = render(Toast, {
      props: {
        id: 'test',
        title: 'Test Title',
        message: 'Test message',
        onClose: vi.fn()
      }
    });

    expect(getByText('Test Title')).toBeInTheDocument();
  });

  it('auto-closes after duration', async () => {
    const onClose = vi.fn();
    render(Toast, {
      props: {
        id: 'test',
        message: 'Test message',
        duration: 5000,
        onClose
      }
    });

    vi.advanceTimersByTime(5000);
    expect(onClose).toHaveBeenCalledWith('test');
  });

  it('pauses auto-close on hover', async () => {
    const onClose = vi.fn();
    const { getByRole } = render(Toast, {
      props: {
        id: 'test',
        message: 'Test message',
        duration: 5000,
        onClose
      }
    });

    const toast = getByRole('alert');
    await fireEvent.mouseEnter(toast);
    vi.advanceTimersByTime(5000);
    expect(onClose).not.toHaveBeenCalled();

    await fireEvent.mouseLeave(toast);
    vi.advanceTimersByTime(5000);
    expect(onClose).toHaveBeenCalledWith('test');
  });

  it('closes on button click', async () => {
    const onClose = vi.fn();
    const { getByRole } = render(Toast, {
      props: {
        id: 'test',
        message: 'Test message',
        onClose
      }
    });

    const closeButton = getByRole('button', { name: /close notification/i });
    await fireEvent.click(closeButton);
    expect(onClose).toHaveBeenCalledWith('test');
  });

  it('shows progress bar', async () => {
    const { container } = render(Toast, {
      props: {
        id: 'test',
        message: 'Test message',
        duration: 5000,
        onClose: vi.fn()
      }
    });

    const progressBar = container.querySelector('.h-1');
    expect(progressBar).toBeInTheDocument();
    expect(progressBar).toHaveStyle({ width: '100%' });

    vi.advanceTimersByTime(2500);
    await waitForAnimation();
    expect(progressBar).toHaveStyle({ width: '50%' });
  });
}); 