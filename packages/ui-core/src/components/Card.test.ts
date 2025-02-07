import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import Card from './Card.svelte';

describe('Card', () => {
  it('renders with default props', () => {
    const { container } = render(Card, {
      props: {},
      slots: {
        default: 'Card content'
      }
    });

    const card = container.firstChild;
    expect(card).toHaveClass('bg-black/50', 'backdrop-blur-lg', 'border', 'rounded-xl');
    expect(card).toHaveTextContent('Card content');
  });

  it('renders with different variants', () => {
    const variants = ['default', 'hover', 'interactive'] as const;
    variants.forEach(variant => {
      const { container } = render(Card, {
        props: { variant },
        slots: {
          default: 'Card content'
        }
      });

      const card = container.firstChild;
      if (variant === 'hover') {
        expect(card).toHaveClass('border-primary-900/50', 'hover:border-primary-700/50');
      } else if (variant === 'interactive') {
        expect(card).toHaveClass('border-primary-900/50', 'hover:border-primary-500/50', 'hover:shadow-neon', 'cursor-pointer');
      }
    });
  });

  it('applies different padding sizes', () => {
    const paddings = {
      none: '',
      sm: 'p-3',
      md: 'p-4',
      lg: 'p-6'
    };

    Object.entries(paddings).forEach(([size, className]) => {
      const { container } = render(Card, {
        props: { padding: size },
        slots: {
          default: 'Card content'
        }
      });

      const card = container.firstChild;
      if (className) {
        expect(card).toHaveClass(className);
      } else {
        expect(card).not.toHaveClass('p-3', 'p-4', 'p-6');
      }
    });
  });

  it('handles click events on interactive variant', async () => {
    const { container } = render(Card, {
      props: { variant: 'interactive' },
      slots: {
        default: 'Interactive card'
      }
    });

    const card = container.firstChild;
    expect(card).toHaveClass('cursor-pointer');

    await fireEvent.click(card!);
    // The click event should be dispatched to the parent
  });

  it('forwards additional attributes', () => {
    const { container } = render(Card, {
      props: {
        'data-testid': 'test-card',
        style: 'width: 300px'
      },
      slots: {
        default: 'Card content'
      }
    });

    const card = container.firstChild;
    expect(card).toHaveAttribute('data-testid', 'test-card');
    expect(card).toHaveStyle({ width: '300px' });
  });

  it('combines classes correctly', () => {
    const { container } = render(Card, {
      props: {
        variant: 'interactive',
        padding: 'lg',
        class: 'custom-class'
      },
      slots: {
        default: 'Card content'
      }
    });

    const card = container.firstChild;
    expect(card).toHaveClass(
      'bg-black/50',
      'backdrop-blur-lg',
      'border',
      'rounded-xl',
      'p-6',
      'custom-class'
    );
  });
}); 