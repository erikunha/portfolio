import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ usePathname: () => '/design-system' }));

describe('design-system layout', () => {
  it('offers a skip link to the sidebar navigation, which follows main in the DOM', async () => {
    const { default: Layout } = await import('@/app/design-system/layout');
    const { DS_NAV_ID } = await import('@/app/design-system/_components/ds-nav');
    const html = renderToStaticMarkup(<Layout>content</Layout>);
    expect(html).toContain(`href="#${DS_NAV_ID}"`);
    expect(html).toContain(`<nav id="${DS_NAV_ID}"`);
    expect(html.indexOf(`href="#${DS_NAV_ID}"`)).toBeLessThan(html.indexOf('<main'));
  });
});
