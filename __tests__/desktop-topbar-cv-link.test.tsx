import { createElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { SectionNavigationProvider } from '@/components/responsive/SectionNavigation';
import { type MountedClient, mountClient } from './helpers/render';

describe('DesktopTopbar CV link', () => {
  let mounted: MountedClient;

  afterEach(() => {
    mounted?.unmount();
  });

  it('opens the text CV reading view, not the static PDF download', async () => {
    const { DesktopTopbar } = await import(
      '@/components/responsive/DesktopTopbar/DesktopTopbar.client'
    );
    mounted = await mountClient(
      createElement(SectionNavigationProvider, null, createElement(DesktopTopbar)),
    );
    const links = Array.from(mounted.container.querySelectorAll('a'));
    const cv = links.find((link) => link.textContent === 'VIEW_CV');

    expect(cv?.getAttribute('href')).toBe('/cv');
    expect(cv?.hasAttribute('download')).toBe(false);
    expect(links.some((link) => link.getAttribute('href')?.endsWith('.pdf'))).toBe(false);
  });
});
