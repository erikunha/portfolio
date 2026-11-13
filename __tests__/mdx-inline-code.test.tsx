import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useMDXComponents } from '@/mdx-components';

const IDENTIFIER = 'MOBILE_BREAKPOINT_PX';

describe('MDX inline code', () => {
  const Code = useMDXComponents({}).code as React.ComponentType<{
    children?: React.ReactNode;
    className?: string;
  }>;

  it('offers a break opportunity only after an underscore', () => {
    const { container } = render(<Code>{IDENTIFIER}</Code>);
    const pieces = [...(container.querySelector('code')?.childNodes ?? [])].map((node) =>
      node.nodeName === 'WBR' ? '|' : node.textContent,
    );
    expect(pieces.join('')).toBe('MOBILE_|BREAKPOINT_|PX');
  });

  it('keeps the text exactly as written for copy and search', () => {
    const { container } = render(<Code>{IDENTIFIER}</Code>);
    expect(container.textContent).toBe(IDENTIFIER);
  });

  it('leaves a fenced block with a language untouched', () => {
    const { container } = render(<Code className="language-ts">{IDENTIFIER}</Code>);
    expect(container.querySelectorAll('wbr')).toHaveLength(0);
  });

  it('passes non-text children through', () => {
    const { container } = render(
      <Code>
        <b>x_y</b>
      </Code>,
    );
    expect(container.querySelectorAll('wbr')).toHaveLength(0);
  });
});
