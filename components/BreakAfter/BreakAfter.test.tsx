import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BreakAfter } from './BreakAfter';

describe('BreakAfter', () => {
  it('keeps the text unchanged for copy, search and screen readers', () => {
    const { container } = render(<BreakAfter chars="_">FORWARD_DEPLOYED_ENGINEER</BreakAfter>);
    expect(container.textContent).toBe('FORWARD_DEPLOYED_ENGINEER');
  });

  it('offers a break opportunity after each listed character and nowhere else', () => {
    const { container } = render(<BreakAfter chars="_">FORWARD_DEPLOYED_ENGINEER</BreakAfter>);
    const pieces = [...container.childNodes].map((node) =>
      node.nodeName === 'WBR' ? '|' : node.textContent,
    );
    expect(pieces.join('')).toBe('FORWARD_|DEPLOYED_|ENGINEER');
  });

  it('accepts several break characters', () => {
    const { container } = render(<BreakAfter chars="_.">matrix_rain.daemon</BreakAfter>);
    expect(container.querySelectorAll('wbr')).toHaveLength(2);
  });

  it('adds no break opportunity after a trailing break character', () => {
    const { container } = render(<BreakAfter chars="/">example.com/</BreakAfter>);
    expect(container.querySelectorAll('wbr')).toHaveLength(0);
  });

  it('renders text without a break character as plain text', () => {
    const { container } = render(<BreakAfter chars="_">ENGINEER</BreakAfter>);
    expect(container.querySelectorAll('wbr')).toHaveLength(0);
    expect(container.textContent).toBe('ENGINEER');
  });
});
