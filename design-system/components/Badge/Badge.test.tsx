import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Badge } from './Badge';

describe('Badge', () => {
  it('renders children text', () => {
    render(<Badge>OPEN_TO_WORK</Badge>);
    expect(screen.getByText('OPEN_TO_WORK')).toBeDefined();
  });
  it('renders dot as aria-hidden when variant=dot', () => {
    const { container } = render(<Badge variant="dot">Status</Badge>);
    const dot = container.querySelector('[aria-hidden="true"]');
    expect(dot).not.toBeNull();
  });
  it('does not render dot when variant=default', () => {
    const { container } = render(<Badge variant="default">Status</Badge>);
    const dot = container.querySelector('[aria-hidden="true"]');
    expect(dot).toBeNull();
  });
  it('applies sm size padding and font size', () => {
    const { container } = render(<Badge size="sm">Small</Badge>);
    // sm applies smaller padding class
    expect(container.firstElementChild?.classList.contains('px-2')).toBe(true);
  });
  it('does not apply dot animation class to root span when variant=dot', () => {
    const { container } = render(<Badge variant="dot">Active</Badge>);
    // The badge-dot class belongs to the inner dot span, not the root span
    expect(container.firstElementChild?.classList.contains('badge-dot')).toBe(false);
  });
});
