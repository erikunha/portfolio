import { createElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { type MountedClient, mountClient } from './helpers/render';

describe('ColorSwatch small text', () => {
  let mounted: MountedClient;

  afterEach(() => {
    mounted?.unmount();
  });

  it('sets the usage note and the token name in body or secondary text, never the signal ramp', async () => {
    const { ColorSwatch } = await import(
      '@/app/(en)/design-system/_components/ColorSwatch/ColorSwatch'
    );
    mounted = await mountClient(
      createElement(ColorSwatch, { token: 'primary-500', usage: 'signal accent' }),
    );
    const small = [...mounted.container.querySelectorAll('code, span')].filter((node) =>
      node.className.includes('text-xs'),
    );
    expect(small.length).toBeGreaterThan(0);
    for (const node of small) {
      expect(node.className, `${node.textContent} is 12px text in the signal ramp`).not.toMatch(
        /text-primary-/,
      );
    }
  });
});
