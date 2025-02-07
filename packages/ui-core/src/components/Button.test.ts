import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import Button from './Button.svelte';

describe('Button', () => {
  it('renders with default props', () => {
    const { getByRole } = render(Button, { props: { label: 'Click me' } });
    const button = getByRole('button');
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent('Click me');
    expect(button).not.toBeDisabled();
  });

  it('renders with different variants', () => {
    const variants = ['primary', 'secondary', 'outline'] as const;
    variants.forEach(variant => {
      const { getByRole } = render(Button, { props: { variant, label: 'Button' } });
      const button = getByRole('button');
      expect(button).toHaveClass(variant === 'primary' ? 'bg-gradient-to-r' : '');
    });
  });

  it('renders with different sizes', () => {
    const sizes = ['sm', 'md', 'lg'] as const;
    sizes.forEach(size => {
      const { getByRole } = render(Button, { props: { size, label: 'Button' } });
      const button = getByRole('button');
      expect(button).toBeInTheDocument();
    });
  });

  it('handles disabled state', () => {
    const { getByRole } = render(Button, { props: { disabled: true, label: 'Disabled' } });
    const button = getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveClass('opacity-50');
  });

  it('handles loading state', () => {
    const { getByRole } = render(Button, { props: { loading: true, label: 'Loading' } });
    const button = getByRole('button');
    expect(button).toBeDisabled();
    expect(button.querySelector('svg')).toBeInTheDocument(); // Loading spinner
  });

  it('handles click events when not disabled or loading', async () => {
    const handleClick = vi.fn();
    const { getByRole } = render(Button, {
      props: { label: 'Click me' }
    });
    const button = getByRole('button');

    await fireEvent.click(button);
    expect(handleClick).toHaveBeenCalled();
  });

  it('does not handle click events when disabled', async () => {
    const handleClick = vi.fn();
    const { getByRole } = render(Button, {
      props: { disabled: true, label: 'Click me' }
    });
    const button = getByRole('button');

    await fireEvent.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('does not handle click events when loading', async () => {
    const handleClick = vi.fn();
    const { getByRole } = render(Button, {
      props: { loading: true, label: 'Click me' }
    });
    const button = getByRole('button');

    await fireEvent.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });
}); 