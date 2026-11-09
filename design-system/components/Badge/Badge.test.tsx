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
    expect(container.firstElementChild?.classList.contains('px-2')).toBe(true);
  });
  it('does not apply dot animation class to root span when variant=dot', () => {
    const { container } = render(<Badge variant="dot">Active</Badge>);
    expect(container.firstElementChild?.classList.contains('badge-dot')).toBe(false);
  });
  it('passes consumer attributes through and merges className', () => {
    render(
      <Badge id="status" className="consumer" aria-label="Availability" data-testid="badge">
        Open
      </Badge>,
    );
    const badge = screen.getByTestId('badge');
    expect(badge.id).toBe('status');
    expect(badge.getAttribute('aria-label')).toBe('Availability');
    expect(badge.classList.contains('consumer')).toBe(true);
    expect(badge.classList.contains('badge')).toBe(true);
  });
  it('gives each size its own padding without a competing base padding', () => {
    const { container: small } = render(<Badge size="sm">Small</Badge>);
    const { container: medium } = render(<Badge size="md">Medium</Badge>);
    expect(small.firstElementChild?.classList.contains('px-[10px]')).toBe(false);
    expect(medium.firstElementChild?.classList.contains('px-[10px]')).toBe(true);
    expect(medium.firstElementChild?.classList.contains('px-2')).toBe(false);
  });
});
