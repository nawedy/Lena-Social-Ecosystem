import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import Input from './Input.svelte';

describe('Input', () => {
  it('renders with default props', () => {
    const { getByRole } = render(Input);
    const input = getByRole('textbox');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('type', 'text');
    expect(input).not.toBeDisabled();
  });

  it('renders different input types', () => {
    const types = ['text', 'email', 'password', 'search', 'number'] as const;
    types.forEach(type => {
      const { getByRole } = render(Input, { props: { type } });
      const input = type === 'number' 
        ? getByRole('spinbutton')
        : getByRole(type === 'password' ? 'textbox' : type);
      expect(input).toHaveAttribute('type', type);
    });
  });

  it('handles value binding', async () => {
    const { getByRole } = render(Input, {
      props: { value: 'initial' }
    });
    const input = getByRole('textbox');
    expect(input).toHaveValue('initial');

    await fireEvent.input(input, { target: { value: 'updated' } });
    expect(input).toHaveValue('updated');
  });

  it('shows label when provided', () => {
    const { getByLabelText } = render(Input, {
      props: {
        label: 'Username',
        id: 'username'
      }
    });
    expect(getByLabelText('Username')).toBeInTheDocument();
  });

  it('shows required indicator in label', () => {
    const { getByText } = render(Input, {
      props: {
        label: 'Username',
        required: true
      }
    });
    expect(getByText('*')).toHaveClass('text-red-500');
  });

  it('handles disabled state', () => {
    const { getByRole } = render(Input, {
      props: { disabled: true }
    });
    const input = getByRole('textbox');
    expect(input).toBeDisabled();
    expect(input).toHaveClass('opacity-50', 'cursor-not-allowed');
  });

  it('shows error message', () => {
    const { getByText, container } = render(Input, {
      props: {
        error: 'This field is required'
      }
    });
    expect(getByText('This field is required')).toHaveClass('text-red-500');
    expect(container.querySelector('input')).toHaveClass('border-red-500');
  });

  it('handles placeholder text', () => {
    const { getByPlaceholderText } = render(Input, {
      props: {
        placeholder: 'Enter your username'
      }
    });
    expect(getByPlaceholderText('Enter your username')).toBeInTheDocument();
  });

  it('forwards additional attributes', () => {
    const { getByRole } = render(Input, {
      props: {
        maxlength: '10',
        autocomplete: 'off',
        'data-testid': 'test-input'
      }
    });
    const input = getByRole('textbox');
    expect(input).toHaveAttribute('maxlength', '10');
    expect(input).toHaveAttribute('autocomplete', 'off');
    expect(input).toHaveAttribute('data-testid', 'test-input');
  });

  it('handles input events', async () => {
    const handleInput = vi.fn();
    const handleChange = vi.fn();
    const handleFocus = vi.fn();
    const handleBlur = vi.fn();

    const { getByRole } = render(Input, {
      props: {
        oninput: handleInput,
        onchange: handleChange,
        onfocus: handleFocus,
        onblur: handleBlur
      }
    });

    const input = getByRole('textbox');

    await fireEvent.input(input, { target: { value: 'test' } });
    expect(handleInput).toHaveBeenCalled();

    await fireEvent.change(input, { target: { value: 'test' } });
    expect(handleChange).toHaveBeenCalled();

    await fireEvent.focus(input);
    expect(handleFocus).toHaveBeenCalled();

    await fireEvent.blur(input);
    expect(handleBlur).toHaveBeenCalled();
  });
}); 