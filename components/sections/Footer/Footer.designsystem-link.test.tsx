import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Footer } from './Footer';

describe('Footer destinations', () => {
  it('keeps design-system links internal and uses the canonical www self-link', () => {
    const host = document.createElement('div');
    host.innerHTML = renderToStaticMarkup(<Footer />);
    const links = [...host.querySelectorAll('a[href="/design-system"]')];
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) expect(link.getAttribute('target')).not.toBe('_blank');
    expect(host.querySelector('a[href="https://erikunha.dev"]')).toBeNull();
    expect(host.querySelector('a[href="https://www.erikunha.dev"]')).not.toBeNull();
  });
});
