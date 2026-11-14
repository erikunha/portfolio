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
    const pieces = [...(container.firstElementChild?.childNodes ?? [])].map((node) =>
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

  describe('with a pieceClassName', () => {
    const PIECE = 'break-piece';

    it('wraps each run of non-space characters between break points in one element', () => {
      const { container } = render(
        <BreakAfter chars="/>" pieceClassName={PIECE}>
          {'<dt>{label}</dt> and more'}
        </BreakAfter>,
      );
      const pieces = [...container.querySelectorAll(`.${PIECE}`)].map((node) => node.textContent);
      expect(pieces).toEqual(['<dt>', '{label}</', 'dt>', 'and', 'more']);
    });

    it('keeps spaces outside the wrapped pieces so a phrase still wraps at them', () => {
      const { container } = render(
        <BreakAfter chars="_" pieceClassName={PIECE}>
          pnpm test --run
        </BreakAfter>,
      );
      const outside = [...(container.firstElementChild?.childNodes ?? [])]
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent);
      expect(outside).toEqual([' ', ' ']);
    });

    it('keeps the text and the break points unchanged', () => {
      const { container } = render(
        <BreakAfter chars="_" pieceClassName={PIECE}>
          FORWARD_DEPLOYED_ENGINEER
        </BreakAfter>,
      );
      expect(container.textContent).toBe('FORWARD_DEPLOYED_ENGINEER');
      expect(container.querySelectorAll('wbr')).toHaveLength(2);
    });

    it('adds no wrapper without it', () => {
      const { container } = render(<BreakAfter chars="_">FORWARD_DEPLOYED</BreakAfter>);
      expect(container.querySelectorAll('span span')).toHaveLength(0);
    });
  });

  it('renders text without a break character as plain text', () => {
    const { container } = render(<BreakAfter chars="_">ENGINEER</BreakAfter>);
    expect(container.querySelectorAll('wbr')).toHaveLength(0);
    expect(container.textContent).toBe('ENGINEER');
  });
});
