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
  it('applies sm size padding', () => {
    const { container } = render(<KbdKey size="sm">Tab</KbdKey>);
    expect(container.firstElementChild?.classList.contains('px-1')).toBe(true);
  });
  it('passes consumer attributes through and merges className', () => {
    render(
      <KbdKey id="shortcut" className="consumer" aria-label="Control key" data-testid="key">
        Ctrl
      </KbdKey>,
    );
    const key = screen.getByTestId('key');
    expect(key.id).toBe('shortcut');
    expect(key.getAttribute('aria-label')).toBe('Control key');
    expect(key.classList.contains('consumer')).toBe(true);
    expect(key.classList.contains('kbd-key')).toBe(true);
  });
});
