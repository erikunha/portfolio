import { act } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { flushFrames, flushMicrotasks, type MountedClient } from '@/__tests__/helpers/render';
import { renderShell, submitCommand, typeCommand } from '@/__tests__/helpers/shell';

const MODULE_WARMUP_TIMEOUT_MS = 30_000;
const QUESTION = 'what are your strengths?';
const FRAMES = ['alphamark', ' bravomark', ' charliemark'];

beforeAll(async () => {
  await Promise.all([import('./InteractiveShell'), import('react-dom/client')]);
}, MODULE_WARMUP_TIMEOUT_MS);

function occurrences(text: string, needle: string): number {
  return text.split(needle).length - 1;
}

describe('InteractiveShell streamed answer', () => {
  let mounted: MountedClient;

  afterEach(() => {
    mounted?.unmount();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('shows each streamed frame exactly once while the stream grows and after it settles', async () => {
    const encoder = new TextEncoder();
    let controller: ReadableStreamDefaultController<Uint8Array> | undefined;
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
    await typeCommand(mounted.container, QUESTION);
    await submitCommand(mounted.container);
    await flushMicrotasks();

    const marks = FRAMES.map((frame) => frame.trim());
    for (const [index, frame] of FRAMES.entries()) {
      await act(async () => controller?.enqueue(encoder.encode(frame)));
      await flushMicrotasks();
      await flushFrames();
      const text = mounted.container.textContent ?? '';
      for (const mark of marks.slice(0, index + 1)) expect(occurrences(text, mark)).toBe(1);
      for (const mark of marks.slice(index + 1)) expect(occurrences(text, mark)).toBe(0);
    }

    await act(async () => controller?.close());
    await flushMicrotasks();
    await flushFrames();
    const settled = mounted.container.textContent ?? '';
    for (const mark of marks) expect(occurrences(settled, mark)).toBe(1);
  });
});
