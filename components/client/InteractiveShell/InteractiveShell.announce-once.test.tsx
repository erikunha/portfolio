import { act } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { flushFrames, flushMicrotasks, type MountedClient } from '@/__tests__/helpers/render';
import { renderShell, submitCommand, typeCommand } from '@/__tests__/helpers/shell';
import { shellUi } from '@/content/shell-ui';
import { SITE_LOCALE } from '@/content/site-locale';

const MODULE_WARMUP_TIMEOUT_MS = 30_000;
const QUESTION = 'what are your strengths?';
const FRAMES = ['alphamark', ' bravomark', ' charliemark'];
const ANSWER = FRAMES.join('');
const HIDDEN = '[aria-hidden="true"]';
const ui = shellUi[SITE_LOCALE.en];

beforeAll(async () => {
  await Promise.all([import('./InteractiveShell'), import('react-dom/client')]);
}, MODULE_WARMUP_TIMEOUT_MS);

function accessibleText(node: Node): string {
  if (node instanceof Element && node.matches(HIDDEN)) return '';
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
  return Array.from(node.childNodes, accessibleText).join('');
}

function exposed(node: Node): boolean {
  const element = node instanceof Element ? node : node.parentElement;
  return element !== null && element.closest(HIDDEN) === null;
}

const OBSERVED = { childList: true, subtree: true, characterData: true } as const;

function recordMutations(target: Node): { records: MutationRecord[]; stop: () => void } {
  const records: MutationRecord[] = [];
  const observer = new MutationObserver((batch) => records.push(...batch));
  observer.observe(target, OBSERVED);
  return {
    records,
    stop: () => {
      records.push(...observer.takeRecords());
      observer.disconnect();
    },
  };
}

function accessibleChanges(records: MutationRecord[]): string[] {
  const changes: string[] = [];
  for (const record of records) {
    if (record.type === 'characterData' && exposed(record.target)) {
      changes.push(record.target.textContent ?? '');
    }
    for (const added of record.addedNodes) {
      if (exposed(added)) changes.push(accessibleText(added));
    }
  }
  return changes;
}

describe('InteractiveShell streamed answer reaches assistive tech once', () => {
  let mounted: MountedClient;
  let controller: ReadableStreamDefaultController<Uint8Array> | undefined;
  const encoder = new TextEncoder();

  afterEach(() => {
    mounted?.unmount();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  async function startAnswer(): Promise<{ log: HTMLElement; status: HTMLElement }> {
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        controller = c;
      },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(body, { status: 200 })),
    );
    mounted = await renderShell();
    const log = mounted.container.querySelector<HTMLElement>('[role="log"]');
    const status = mounted.container.querySelector<HTMLElement>('[role="status"]');
    expect(log).not.toBeNull();
    expect(status).not.toBeNull();
    await typeCommand(mounted.container, QUESTION);
    await submitCommand(mounted.container);
    await flushMicrotasks();
    return { log: log as HTMLElement, status: status as HTMLElement };
  }

  async function push(frame: string): Promise<void> {
    await act(async () => controller?.enqueue(encoder.encode(frame)));
    await flushMicrotasks();
    await flushFrames();
  }

  async function close(): Promise<void> {
    await act(async () => controller?.close());
    await flushMicrotasks();
    await flushFrames();
  }

  it('keeps the in-flight text visible but out of the accessibility tree', async () => {
    const { log } = await startAnswer();
    for (const [index, frame] of FRAMES.entries()) {
      await push(frame);
      const sofar = FRAMES.slice(0, index + 1).join('');
      expect(log.textContent).toContain(sofar);
      expect(accessibleText(log)).not.toContain(frame.trim());
    }
    await close();
    expect(accessibleText(log)).toContain(ANSWER);
  });

  it('adds the finished answer to the accessibility tree as one complete node', async () => {
    const { log } = await startAnswer();
    const watch = recordMutations(log);
    for (const frame of FRAMES) await push(frame);
    await close();
    watch.stop();
    const changes = accessibleChanges(watch.records).filter((text) =>
      FRAMES.some((frame) => text.includes(frame.trim())),
    );
    expect(changes).toEqual([`${ui.aiLabel}: ${ANSWER}`]);
  });

  it('announces the answer once as started and once as complete however many frames arrive', async () => {
    const { status } = await startAnswer();
    const watch = recordMutations(status);
    for (const frame of FRAMES) await push(frame);
    await close();
    watch.stop();
    const spoken = accessibleChanges(watch.records).filter(Boolean);
    expect(spoken).toEqual([ui.started, ui.complete]);
  });
});
