import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button } from './Button';

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
    render(
      <Button as="a" href="/test" disabled>
        Disabled
      </Button>,
    );
    const el = screen.getByRole('link');
    expect(el.getAttribute('aria-disabled')).toBe('true');
  });
  it('applies primary variant class by default', () => {
    const { container } = render(<Button>Primary</Button>);
    expect(container.firstElementChild?.classList.toString()).toContain('primary');
  });
  it('applies secondary variant class', () => {
    const { container } = render(<Button variant="secondary">Secondary</Button>);
    expect(container.firstElementChild?.classList.toString()).toContain('secondary');
  });
  it('applies size classes', () => {
    const { container: smContainer } = render(<Button size="sm">Sm</Button>);
    expect(smContainer.firstElementChild?.classList.toString()).toContain('sm');
    const { container: lgContainer } = render(<Button size="lg">Lg</Button>);
    expect(lgContainer.firstElementChild?.classList.toString()).toContain('lg');
  });
});
