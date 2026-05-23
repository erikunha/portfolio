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
    expect(container.firstChild?.nodeName).toBe('DIV');
  });
  it('renders as section when as="section"', () => {
    const { container } = render(<TerminalPanel as="section">x</TerminalPanel>);
    expect(container.firstChild?.nodeName).toBe('SECTION');
  });
  it('applies dashed border class when borderStyle=dashed', () => {
    const { container } = render(<TerminalPanel borderStyle="dashed">x</TerminalPanel>);
    expect(container.firstChild?.classList.toString()).toContain('dashed');
  });
  it('renders header bar when header prop provided', () => {
    render(<TerminalPanel header="[ PANEL ]">x</TerminalPanel>);
    expect(screen.getByText('[ PANEL ]')).toBeDefined();
  });
});
