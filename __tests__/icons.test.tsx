import type * as React from 'react';
import { createElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { type MountedClient, mountClient } from './helpers/render';

describe('Icons — SVG smoke renders', () => {
  let mounted: MountedClient;

  afterEach(() => {
    mounted?.unmount();
  });

  async function renderIcon(name: string): Promise<HTMLElement> {
    const icons = await import('@/components/Icons/Icons');
    const Icon = icons[name as keyof typeof icons] as () => React.ReactElement;
    mounted = await mountClient(createElement(Icon));
    return mounted.container;
  }

  const iconNames = [
    'IconReadme',
    'IconManPage',
    'IconNow',
    'IconProjects',
    'IconGitLog',
    'IconNpmStack',
    'IconSysHealth',
    'IconShell',
    'IconLivePerf',
    'IconPerfReceipts',
    'IconGuitar',
    'IconVisa',
    'IconCredentials',
    'IconCommunity',
    'IconHottestTakes',
    'IconResponsibilities',
    'IconUnknowns',
    'IconAiMetrics',
    'IconContact',
  ] as const;

  for (const name of iconNames) {
    it(`renders ${name} as an SVG element`, async () => {
      const container = await renderIcon(name);
      const svg = container.querySelector('svg');
      expect(svg).not.toBeNull();
    });

    it(`${name} has aria-hidden attribute`, async () => {
      const container = await renderIcon(name);
      const svg = container.querySelector('svg');
      expect(svg?.getAttribute('aria-hidden')).toBe('true');
    });
  }
});
