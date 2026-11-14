import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TerminalChromeBar } from './TerminalChromeBar';

const CHROME = { promptLabel: 'p', rightTag: 't' } as const;

describe('TerminalChromeBar dots', () => {
  it('renders the window dots at the WindowChrome default size', () => {
    const { container } = render(
      <TerminalChromeBar chrome={CHROME} className="c" tagClassName="t" />,
    );
    const dots = container.querySelector('[style*="--wc-dot-size"]');
    expect(dots?.getAttribute('style')).toContain('--wc-dot-size: 10px');
  });
});
