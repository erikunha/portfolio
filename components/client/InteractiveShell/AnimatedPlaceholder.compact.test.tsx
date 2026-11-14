import { act, createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type MountedClient, mountClient } from '@/__tests__/helpers/render';
import { shellUi } from '@/content/shell-ui';
import { SITE_LOCALE } from '@/content/site-locale';
import { applyMotion } from '@/lib/motion';
import { AnimatedPlaceholder, StaticPlaceholder } from './AnimatedPlaceholder.client';

const ui = shellUi[SITE_LOCALE.en];
const TYPING_MS = 30_000;
const SAMPLE_MS = 250;
const PLACEHOLDER_TEXT = '[data-testid="shell-placeholder"] > span:first-child';

class ObserverStub {
  observe = vi.fn();
  disconnect = vi.fn();
}

describe('compact placeholders for a narrow input', () => {
  let mounted: MountedClient;

  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.stubGlobal('IntersectionObserver', ObserverStub);
  });

  afterEach(() => {
    mounted?.unmount();
    localStorage.clear();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('the static placeholder shows the short text', async () => {
    mounted = await mountClient(createElement(StaticPlaceholder, { ui, compact: true }));
    expect(mounted.container.querySelector(PLACEHOLDER_TEXT)?.textContent).toBe(
      ui.mobilePlaceholder,
    );
  });

  it('the static placeholder keeps the full text by default', async () => {
    mounted = await mountClient(createElement(StaticPlaceholder, { ui }));
    expect(mounted.container.querySelector(PLACEHOLDER_TEXT)?.textContent).toBe(ui.placeholder);
  });

  it('the motion-off placeholder shows the short text', async () => {
    mounted = await mountClient(createElement(AnimatedPlaceholder, { ui, compact: true }));
    await act(async () => {
      applyMotion(false);
    });
    expect(mounted.container.querySelector(PLACEHOLDER_TEXT)?.textContent).toBe(
      ui.mobilePlaceholder,
    );
  });

  it('types only the short suggestions', async () => {
    mounted = await mountClient(createElement(AnimatedPlaceholder, { ui, compact: true }));
    const text = mounted.container.querySelector(PLACEHOLDER_TEXT);
    const seen = new Set<string>();
    for (let elapsed = 0; elapsed < TYPING_MS; elapsed += SAMPLE_MS) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(SAMPLE_MS);
      });
      seen.add(text?.textContent ?? '');
    }
    const longest = Math.max(...ui.mobileSuggestions.map((phrase) => phrase.length));
    expect(Math.max(...[...seen].map((phrase) => phrase.length))).toBeLessThanOrEqual(longest);
    expect(seen.has(ui.mobileSuggestions.at(-1) ?? '')).toBe(true);
  });
});
