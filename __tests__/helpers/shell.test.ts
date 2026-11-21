import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { shellUi } from '@/content/shell-ui';
import { SITE_LOCALE } from '@/content/site-locale';
import type { MountedClient } from './render';
import { askQuestion, renderShell, submitCommand, typeCommand } from './shell';

vi.mock('@/lib/use-breakpoint.client', () => ({ useBreakpoint: () => ({ isMobile: false }) }));
vi.mock('@/lib/motion', () => ({ readMotion: () => false }));

const ANSWER = 'A short answer.';
const QUESTION = 'who is erik?';
const ASK_URL = '/api/ask';
const COMMAND_INPUT = 'input[name="command"]';

const feed = (container: HTMLElement) => container.querySelector('[role="log"]')?.textContent ?? '';
const field = (container: HTMLElement) => container.querySelector<HTMLInputElement>(COMMAND_INPUT);

describe('shell harness', () => {
  let mounted: MountedClient | undefined;

  beforeEach(() => {
    vi.resetModules();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    mounted?.unmount();
    mounted = undefined;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it.each([SITE_LOCALE.en, SITE_LOCALE.pt])('mounts the shell in %s', async (locale) => {
    mounted = await renderShell(locale);
    expect(field(mounted.container)?.getAttribute('aria-label')).toBe(shellUi[locale].inputLabel);
  });

  it('mounts the shell in English by default', async () => {
    mounted = await renderShell();
    expect(field(mounted.container)?.getAttribute('aria-label')).toBe(
      shellUi[SITE_LOCALE.en].inputLabel,
    );
  });

  it('typeCommand reaches the controlled input without submitting', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    mounted = await renderShell();
    await typeCommand(mounted.container, QUESTION);
    expect(field(mounted.container)?.value).toBe(QUESTION);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('submitCommand sends what typeCommand typed and clears the prompt', async () => {
    const fetchSpy = vi.fn(async () => new Response(ANSWER));
    vi.stubGlobal('fetch', fetchSpy);
    mounted = await renderShell();
    await typeCommand(mounted.container, QUESTION);
    await submitCommand(mounted.container);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(ASK_URL);
    expect(String(init.body)).toContain(QUESTION);
    expect(field(mounted.container)?.value).toBe('');
  });

  it('askQuestion types, submits and settles on the streamed answer', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(ANSWER)),
    );
    mounted = await renderShell();
    await askQuestion(mounted.container, QUESTION);
    expect(feed(mounted.container)).toContain(QUESTION);
    expect(feed(mounted.container)).toContain(ANSWER);
  });
});
