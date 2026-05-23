import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { KbdKey } from './KbdKey';

describe('KbdKey', () => {
  it('renders as <kbd> element', () => {
    const { container } = render(<KbdKey>Ctrl</KbdKey>);
    expect(container.firstElementChild?.nodeName).toBe('KBD');
  });
  it('renders children text', () => {
    render(<KbdKey>Enter</KbdKey>);
    expect(screen.getByText('Enter')).toBeDefined();
  });
  it('applies sm size class', () => {
    const { container } = render(<KbdKey size="sm">Tab</KbdKey>);
    expect(container.firstElementChild?.classList.toString()).toContain('sm');
  });
});
