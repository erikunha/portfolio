import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TerminalPanel } from './TerminalPanel';

describe('TerminalPanel', () => {
  it('renders children', () => {
    render(<TerminalPanel>content</TerminalPanel>);
    expect(screen.getByText('content')).toBeDefined();
  });
  it('renders as div by default', () => {
    const { container } = render(<TerminalPanel>x</TerminalPanel>);
    expect(container.firstElementChild?.nodeName).toBe('DIV');
  });
  it('renders as section when as="section"', () => {
    const { container } = render(<TerminalPanel as="section">x</TerminalPanel>);
    expect(container.firstElementChild?.nodeName).toBe('SECTION');
  });
  it('applies dashed border class when borderStyle=dashed', () => {
    const { container } = render(<TerminalPanel borderStyle="dashed">x</TerminalPanel>);
    expect(container.firstElementChild?.classList.contains('border-dashed')).toBe(true);
  });
  it('renders header bar when header prop provided', () => {
    render(<TerminalPanel header="[ PANEL ]">x</TerminalPanel>);
    expect(screen.getByText('[ PANEL ]')).toBeDefined();
  });
  it('does not apply an undefined solid class when borderStyle=solid (default)', () => {
    const { container } = render(<TerminalPanel>x</TerminalPanel>);
    const classList = container.firstElementChild?.classList.toString() ?? '';
    expect(classList).not.toContain('undefined');
    expect(classList).not.toContain('solid');
  });
  it('forwards className to the root element', () => {
    const { container } = render(<TerminalPanel className="my-panel">x</TerminalPanel>);
    expect(container.firstElementChild?.classList.contains('my-panel')).toBe(true);
  });
  it('renders twice without id collision (no hardcoded id)', () => {
    const { container: a } = render(<TerminalPanel>first</TerminalPanel>);
    const { container: b } = render(<TerminalPanel>second</TerminalPanel>);
    const idA = a.firstElementChild?.id ?? '';
    const idB = b.firstElementChild?.id ?? '';
    expect(idA).toBe('');
    expect(idB).toBe('');
  });
});
