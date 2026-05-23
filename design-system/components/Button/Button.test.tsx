import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button } from './Button';
import styles from './Button.module.css';

describe('Button', () => {
  it('renders as <button> by default', () => {
    render(<Button>Click</Button>);
    expect(screen.getByRole('button')).toBeDefined();
  });
  it('renders as <a> when as="a"', () => {
    render(
      <Button as="a" href="/test">
        Link
      </Button>,
    );
    expect(screen.getByRole('link')).toBeDefined();
  });
  it('applies disabled state and aria-disabled on anchor', () => {
    const { container } = render(
      <Button as="a" href="/test" disabled>
        Disabled
      </Button>,
    );
    const el = container.querySelector('a');
    expect(el?.getAttribute('aria-disabled')).toBe('true');
    expect(el?.getAttribute('href')).toBeNull();
    expect(el?.getAttribute('tabindex')).toBe('-1');
  });
  it('does not allow caller aria-disabled to override disabled=true on anchor', () => {
    const { container } = render(
      <Button as="a" href="/test" disabled aria-disabled="false">
        Disabled
      </Button>,
    );
    const el = container.querySelector('a');
    expect(el?.getAttribute('aria-disabled')).toBe('true');
  });
  it('applies primary variant class by default', () => {
    const { container } = render(<Button>Primary</Button>);
    expect(container.firstElementChild?.classList.contains(styles.primary as string)).toBe(true);
  });
  it('applies secondary variant class', () => {
    const { container } = render(<Button variant="secondary">Secondary</Button>);
    expect(container.firstElementChild?.classList.contains(styles.secondary as string)).toBe(true);
  });
  it('applies size classes', () => {
    const { container: smContainer } = render(<Button size="sm">Sm</Button>);
    expect(smContainer.firstElementChild?.classList.contains(styles.sm as string)).toBe(true);
    const { container: lgContainer } = render(<Button size="lg">Lg</Button>);
    expect(lgContainer.firstElementChild?.classList.contains(styles.lg as string)).toBe(true);
  });
});
