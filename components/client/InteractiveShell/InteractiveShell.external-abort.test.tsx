import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { accessibleText, HIDDEN, heldStream } from '@/__tests__/helpers/accessibility-tree';
import type { MountedClient } from '@/__tests__/helpers/render';
import { renderShell, submitCommand, typeCommand } from '@/__tests__/helpers/shell';
import { shellUi } from '@/content/shell-ui';
import { SITE_LOCALE } from '@/content/site-locale';

const MODULE_WARMUP_TIMEOUT_MS = 30_000;
const QUESTION = 'what are your strengths?';
const PARTIAL = 'partialmark so far';
const ui = shellUi[SITE_LOCALE.en];

const outside = vi.hoisted(() => ({ aborted: false }));

vi.mock('./ask-request', () => ({
  createAskRequest: () => ({
    send: () => fetch('/api/ask'),
    openReader: (response: Response) => response.body?.getReader(),
    abort: () => undefined,
    get aborted() {
      return outside.aborted;
    },
  }),
}));

beforeAll(async () => {
  await Promise.all([import('./InteractiveShell'), import('react-dom/client')]);
}, MODULE_WARMUP_TIMEOUT_MS);

describe('a request aborted from outside the shell', () => {
  let mounted: MountedClient;

  afterEach(() => {
    outside.aborted = false;
    mounted?.unmount();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('leaves no hidden streaming text and no busy log once the stream ends', async () => {
    const stream = heldStream();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(stream.body, { status: 200 })),
    );
    mounted = await renderShell();
    const log = mounted.container.querySelector<HTMLElement>('[role="log"]') as HTMLElement;
    await typeCommand(mounted.container, QUESTION);
    await submitCommand(mounted.container);
    await stream.push(PARTIAL);
    expect(log.getAttribute('aria-busy')).toBe('true');

    outside.aborted = true;
    await stream.close();

    expect(log.getAttribute('aria-busy')).toBe('false');
    expect(log.querySelector(`${HIDDEN}.shell-line-output`)).toBeNull();
    expect(accessibleText(log)).toContain(`${ui.aiLabel}: ${PARTIAL}`);
    expect(mounted.container.querySelector('.shell-stop-pill')).toBeNull();
  });
});
