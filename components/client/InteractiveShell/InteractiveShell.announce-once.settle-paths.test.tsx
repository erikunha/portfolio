import { act } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  accessibleChanges,
  accessibleText,
  HIDDEN,
  heldStream,
  recordMutations,
} from '@/__tests__/helpers/accessibility-tree';
import type { MountedClient } from '@/__tests__/helpers/render';
import { renderShell, submitCommand, typeCommand } from '@/__tests__/helpers/shell';
import { shellUi } from '@/content/shell-ui';
import { SITE_LOCALE } from '@/content/site-locale';
import { STREAM_ERR_SENTINEL } from '@/lib/stream-protocol';

const MODULE_WARMUP_TIMEOUT_MS = 30_000;
const QUESTION = 'what are your strengths?';
const PARTIAL = 'partialmark so far';
const FAILURE = 'upstream broke';
const ui = shellUi[SITE_LOCALE.en];

beforeAll(async () => {
  await Promise.all([import('./InteractiveShell'), import('react-dom/client')]);
}, MODULE_WARMUP_TIMEOUT_MS);

function hiddenText(log: HTMLElement): string {
  return Array.from(log.querySelectorAll(HIDDEN), (node) => node.textContent).join('');
}

describe('a partial answer that ends early reaches assistive tech once', () => {
  let mounted: MountedClient;

  afterEach(() => {
    mounted?.unmount();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  async function streamPartial() {
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
    expect(hiddenText(log)).toContain(PARTIAL);
    return { stream, log, watch: recordMutations(log) };
  }

  it('stopped mid-stream, the partial text enters the tree once and leaves the hidden node', async () => {
    const { log, watch } = await streamPartial();
    const stop = mounted.container.querySelector<HTMLButtonElement>(
      `button[aria-label="${ui.stopLabel}"]`,
    );
    expect(stop).not.toBeNull();
    await act(async () => stop?.click());
    watch.stop();

    const entries = accessibleChanges(watch.records).filter((text) => text.includes(PARTIAL));
    expect(entries).toEqual([`${ui.aiLabel}: ${PARTIAL}`]);
    expect(accessibleText(log)).toContain(ui.stoppedPartial);
    expect(hiddenText(log)).not.toContain(PARTIAL);
  });

  it('cut by an error sentinel, the partial text enters the tree once beside the error', async () => {
    const { stream, log, watch } = await streamPartial();
    await stream.push(`${STREAM_ERR_SENTINEL}${FAILURE}`);
    await stream.close();
    watch.stop();

    const entries = accessibleChanges(watch.records).filter((text) => text.includes(PARTIAL));
    expect(entries).toEqual([`${ui.aiLabel}: ${PARTIAL}`]);
    expect(accessibleText(log)).toContain(FAILURE);
    expect(accessibleText(log)).not.toContain(STREAM_ERR_SENTINEL);
    expect(hiddenText(log)).not.toContain(PARTIAL);
  });
});
