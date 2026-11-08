import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installMatchMedia } from '@/__tests__/helpers/match-media';
import { flushMicrotasks, hydrateClient, type MountedClient } from '@/__tests__/helpers/render';
import { shellUi } from '@/content/shell-ui';
import { SITE_LOCALE } from '@/content/site-locale';
import { shellChrome } from '@/content/terminal-chrome';
import { InteractiveShell } from './InteractiveShell';

vi.mock('@/lib/motion', () => ({ readMotion: () => false }));

const ui = shellUi[SITE_LOCALE.en];

function stubViewport(matches: boolean) {
  installMatchMedia(matches);
}

function feedText(mounted: MountedClient): string {
  return mounted.container.querySelector('[role="log"]')?.textContent ?? '';
}

function hydrateShell() {
  return hydrateClient(
    createElement(InteractiveShell, {
      locale: SITE_LOCALE.en,
      ui,
      chrome: shellChrome[SITE_LOCALE.en],
    }),
    () => undefined,
  );
}

describe('InteractiveShell welcome line across hydration', () => {
  let mounted: MountedClient;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    mounted?.unmount();
    vi.unstubAllGlobals();
  });

  it('shows the mobile welcome on first load when the client viewport is mobile', async () => {
    stubViewport(true);
    mounted = await hydrateShell();
    await flushMicrotasks();

    expect(
      feedText(mounted),
      'the server snapshot says desktop, so hydration must re-derive the welcome once the real viewport is read',
    ).toContain(ui.mobileWelcome);
    expect(feedText(mounted)).not.toContain(ui.welcome);
  });

  it('keeps the desktop welcome when the client viewport is desktop', async () => {
    stubViewport(false);
    mounted = await hydrateShell();
    await flushMicrotasks();

    expect(feedText(mounted)).toContain(ui.welcome);
    expect(feedText(mounted)).not.toContain(ui.mobileWelcome);
  });
});
