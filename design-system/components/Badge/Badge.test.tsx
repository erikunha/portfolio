import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Badge } from './Badge';
import styles from './Badge.module.css';

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
  it('applies sm size class', () => {
    const { container } = render(<Badge size="sm">Small</Badge>);
    expect(container.firstElementChild?.classList.contains(styles.sm as string)).toBe(true);
  });
  it('does not apply dot animation class to root span when variant=dot', () => {
    const { container } = render(<Badge variant="dot">Active</Badge>);
    expect(container.firstElementChild?.classList.contains(styles.dot as string)).toBe(false);
  });
});
