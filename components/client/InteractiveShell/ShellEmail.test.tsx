import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { shellUi } from '@/content/shell-ui';
import { SITE_LOCALE } from '@/content/site-locale';
import { ShellEmail } from './ShellEmail';

const ui = shellUi[SITE_LOCALE.en];

describe('ShellEmail', () => {
  it('links the address and keeps its text whole for copy and screen readers', () => {
    const { container } = render(<ShellEmail ui={ui} />);
    const link = container.querySelector('a');
    expect(link?.getAttribute('href')).toBe(ui.emailHref);
    expect(link?.textContent).toBe(ui.email);
  });

  it('offers a line break after the at sign and nowhere else in the address', () => {
    const { container } = render(<ShellEmail ui={ui} />);
    const pieces = [...(container.querySelector('a > span')?.childNodes ?? [])].map((node) =>
      node.nodeName === 'WBR' ? '|' : node.textContent,
    );
    expect(pieces.join('')).toBe(ui.email.replace('@', '@|'));
  });
});
