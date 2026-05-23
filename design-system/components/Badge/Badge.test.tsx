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
    expect(dot).toBeDefined();
  });
  it('does not render dot when variant=default', () => {
    const { container } = render(<Badge variant="default">Status</Badge>);
    const dot = container.querySelector('[aria-hidden="true"]');
    expect(dot).toBeNull();
  });
  it('applies sm size class', () => {
    const { container } = render(<Badge size="sm">Small</Badge>);
    expect(container.firstElementChild?.classList.toString()).toContain('sm');
  });
});
