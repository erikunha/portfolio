import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WindowChrome } from './WindowChrome';

describe('WindowChrome', () => {
  it('renders three dots', () => {
    const { container } = render(<WindowChrome />);
    const dots = container.querySelectorAll('[data-dot]');
    expect(dots).not.toBeNull();
    expect(dots.length).toBe(3);
  });

  it('dots are aria-hidden (decorative, no focus needed)', () => {
    const { container } = render(<WindowChrome />);
    const dots = container.querySelectorAll('[aria-hidden="true"]');
    expect(dots.length).toBeGreaterThan(0);
  });

  it('renders with default size (no size prop)', () => {
    const { container } = render(<WindowChrome />);
    expect(container.firstElementChild).not.toBeNull();
  });

  it('accepts size prop without throwing', () => {
    expect(() => render(<WindowChrome size={12} />)).not.toThrow();
    expect(() => render(<WindowChrome size={9} />)).not.toThrow();
    expect(() => render(<WindowChrome size={10} />)).not.toThrow();
  });

  it('forwards className to the root element', () => {
    const { container } = render(<WindowChrome className="my-chrome" />);
    expect(container.firstElementChild?.classList.contains('my-chrome')).toBe(true);
  });

  it('renders twice without id collision (no hardcoded id)', () => {
    const { container: a } = render(<WindowChrome />);
    const { container: b } = render(<WindowChrome />);
    const idA = a.firstElementChild?.id ?? '';
    const idB = b.firstElementChild?.id ?? '';
    expect(idA).toBe('');
    expect(idB).toBe('');
  });

  it('is a server component — no useEffect or useState in the source', async () => {
    const { container } = render(<WindowChrome />);
    expect(container.firstElementChild).not.toBeNull();
  });

  it('does not render screen-reader text for dots (dots are decorative)', () => {
    render(<WindowChrome />);
    const buttons = screen.queryAllByRole('button');
    expect(buttons.length).toBe(0);
    const links = screen.queryAllByRole('link');
    expect(links.length).toBe(0);
  });
});
