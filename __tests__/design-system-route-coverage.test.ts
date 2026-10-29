import { describe, expect, it } from 'vitest';
import { DS_ROUTES } from '@/app/design-system/_components/ds-nav';
import sitemap from '@/app/sitemap';
import desktop from '../lighthouserc.json';
import mobile from '../lighthouserc.mobile.json';

const LHCI_ORIGIN = 'http://localhost:3000';

describe('design-system routes reach every route list', () => {
  it('lists every sidebar route in the sitemap', () => {
    const paths = sitemap().map((entry) => new URL(entry.url).pathname);
    for (const route of DS_ROUTES) expect(paths, route).toContain(route);
  });

  it.each([
    ['desktop', desktop],
    ['mobile', mobile],
  ])('audits every sidebar route in the %s Lighthouse config', (_name, config) => {
    const urls: string[] = config.ci.collect.url;
    for (const route of DS_ROUTES) expect(urls, route).toContain(`${LHCI_ORIGIN}${route}`);
  });
});
