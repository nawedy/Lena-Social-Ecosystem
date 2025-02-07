import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import FileUpload from './FileUpload.svelte';

describe('FileUpload', () => {
  it('renders with default props', () => {
    const { getByRole, getByText } = render(FileUpload);
    expect(getByRole('button')).toBeInTheDocument();
    expect(getByText('Drag and drop files here, or click to select')).toBeInTheDocument();
  });

  it('shows file type restrictions', () => {
    const { getByText } = render(FileUpload, {
      props: {
        accept: '.jpg,.png'
      }
    });
    expect(getByText(/accepted file types:/i)).toHaveTextContent('.jpg,.png');
  });

  it('shows max file size', () => {
    const { getByText } = render(FileUpload, {
      props: {
        maxSize: 5 * 1024 * 1024 // 5MB
      }
    });
    expect(getByText(/max size:/i)).toHaveTextContent('5MB');
  });

  it('handles disabled state', () => {
    const { getByRole } = render(FileUpload, {
      props: {
        disabled: true
      }
    });
    const button = getByRole('button');
    expect(button).toHaveClass('cursor-not-allowed', 'opacity-50');
  });

  it('shows upload progress', () => {
    const { getByRole, getByText } = render(FileUpload, {
      props: {
        uploading: true,
        progress: 45
      }
    });
    expect(getByText('Uploading... 45%')).toBeInTheDocument();
    expect(getByRole('button')).toHaveClass('cursor-not-allowed');
  });

  it('handles file selection through input', async () => {
    const handleSelect = vi.fn();
    const { container } = render(FileUpload, {
      props: {
        onselect: handleSelect
      }
    });

    const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
    const input = container.querySelector('input[type="file"]')!;

    await fireEvent.change(input, {
      target: { files: [file] }
    });

    expect(handleSelect).toHaveBeenCalledWith({
      detail: { files: [file] }
    });
  });

  it('validates file size', async () => {
    const handleError = vi.fn();
    const { container } = render(FileUpload, {
      props: {
        maxSize: 5,
        onerror: handleError
      }
    });

    const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
    const input = container.querySelector('input[type="file"]')!;

    await fireEvent.change(input, {
      target: { files: [file] }
    });

    expect(handleError).toHaveBeenCalledWith({
      detail: { message: expect.stringContaining('too large') }
    });
  });

  it('validates file type', async () => {
    const handleError = vi.fn();
    const { container } = render(FileUpload, {
      props: {
        accept: '.jpg,.png',
        onerror: handleError
      }
    });

    const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
    const input = container.querySelector('input[type="file"]')!;

    await fireEvent.change(input, {
      target: { files: [file] }
    });

    expect(handleError).toHaveBeenCalledWith({
      detail: { message: expect.stringContaining('type not allowed') }
    });
  });

  it('handles drag and drop', async () => {
    const handleSelect = vi.fn();
    const { container } = render(FileUpload, {
      props: {
        onselect: handleSelect
      }
    });

    const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
    const dropzone = container.firstChild!;

    await fireEvent.dragOver(dropzone);
    expect(dropzone.querySelector('div')).toHaveClass('border-primary-500');

    await fireEvent.drop(dropzone, {
      dataTransfer: {
        files: [file]
      }
    });

    expect(handleSelect).toHaveBeenCalledWith({
      detail: { files: [file] }
    });
  });

  it('prevents multiple file selection when not allowed', async () => {
    const handleError = vi.fn();
    const { container } = render(FileUpload, {
      props: {
        multiple: false,
        onerror: handleError
      }
    });

    const files = [
      new File(['content 1'], 'test1.txt', { type: 'text/plain' }),
      new File(['content 2'], 'test2.txt', { type: 'text/plain' })
    ];
    const input = container.querySelector('input[type="file"]')!;

    await fireEvent.change(input, {
      target: { files }
    });

    expect(handleError).toHaveBeenCalledWith({
      detail: { message: expect.stringContaining('one file') }
    });
  });
}); 