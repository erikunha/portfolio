import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ usePathname: () => '/design-system' }));

import { DS_NAV_ID } from '@/app/(en)/design-system/_components/ds-nav';
import DesignSystemLayout from '@/app/(en)/design-system/layout';
import { MAIN_CONTENT_ID } from '@/components/PageMain';

const IN_PAGE_PREFIX = '#';

describe('design-system skip link sits with the page skip link', () => {
  it('follows the main skip link and comes before every link that leaves the page position', () => {
    const { container } = render(
      <DesignSystemLayout>
        <p>body</p>
      </DesignSystemLayout>,
    );
    const hrefs = [...container.ownerDocument.querySelectorAll('a[href]')].map(
      (link) => link.getAttribute('href') ?? '',
    );
    expect(hrefs.slice(0, 2)).toEqual([
      `${IN_PAGE_PREFIX}${MAIN_CONTENT_ID}`,
      `${IN_PAGE_PREFIX}${DS_NAV_ID}`,
    ]);
    const firstPageLink = hrefs.findIndex((href) => !href.startsWith(IN_PAGE_PREFIX));
    expect(
      hrefs.indexOf(`${IN_PAGE_PREFIX}${DS_NAV_ID}`),
      'a skip link after the header links is outside every landmark (axe region)',
    ).toBeLessThan(firstPageLink);
  });
});
