import { expect, type Page, test } from '@playwright/test';
import { settleFrames } from './_helpers/geometry';
import { installMockBackend } from './_helpers/mock-backend';
import { askShell, openShell, SHELL_SELECTOR, shellCopy, stopButton } from './_helpers/shell';

// The bound. Two readings are held to it, and both come from numbers the repo
// and the web platform already state:
//  - a key press must reach a painted frame inside 200 ms, the INP "good"
//    threshold (web.dev/articles/inp). The cross-cutting keystroke guard is
//    stricter (the commit lands inside the dispatch, under 50 ms) because it
//    runs on an idle page; a streaming page is allowed the full INP budget.
//  - no task may block the main thread for 100 ms or more, the same
//    LONG_TASK_MS cutoff the cross-cutting guard uses. Tasks over the 50 ms
//    browser threshold are still counted and reported.
const INP_GOOD_MS = 200;
const LONG_TASK_FAIL_MS = 100;
const EVENT_TIMING_THRESHOLD_MS = 16;

const CPU_RATES = [1, 4] as const;
const CHUNK_INTERVAL_MS = 25;
const CHUNK_COUNT = 300;
const TYPE_AFTER_CHUNKS = 150;
const STREAM_STALL_MS = 2_000;
const CHUNK_CHARS = 24;
const TYPED = 'and what about evaluation harnesses';
const KEY_DELAY_MS = 40;
const QUESTION = 'tell me about the agent platform';

type KeyRecord = { key: string; toFrameMs: number };
type EventRecord = { name: string; durationMs: number };
type Probe = {
  longTasks: number[];
  keys: KeyRecord[];
  events: EventRecord[];
};
type ProbeWindow = Window & { __probe: Probe; __stream: { sent: number; closed: boolean } };

// The route cannot hand a body over in pieces, so the stream is a page-side
// fetch stand-in: it enqueues one chunk per timer tick, the way the network
// delivers tokens, on the same main thread the shell renders on.
async function installPacedAsk(page: Page): Promise<void> {
  await page.addInitScript(
    ({ interval, count, chars }) => {
      const state = { sent: 0, closed: false };
      (window as unknown as ProbeWindow).__stream = state;
      const sentence =
        'Erik builds agent platforms, evaluation harnesses and the tooling around them. ';
      const answer = sentence.repeat(Math.ceil((count * chars) / sentence.length));
      const realFetch = window.fetch.bind(window);
      window.fetch = (input, init) => {
        const url = input instanceof Request ? input.url : String(input);
        if (!url.includes('/api/ask')) return realFetch(input, init);
        let timer: ReturnType<typeof setInterval> | undefined;
        const body = new ReadableStream<Uint8Array>({
          start(controller) {
            timer = setInterval(() => {
              if (state.sent >= count) {
                clearInterval(timer);
                state.closed = true;
                controller.close();
                return;
              }
              const from = state.sent * chars;
              controller.enqueue(new TextEncoder().encode(answer.slice(from, from + chars)));
              state.sent += 1;
            }, interval);
            init?.signal?.addEventListener('abort', () => {
              clearInterval(timer);
              state.closed = true;
              controller.error(new DOMException('aborted', 'AbortError'));
            });
          },
        });
        return Promise.resolve(
          new Response(body, {
            status: 200,
            headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Request-Id': 'paced-ask' },
          }),
        );
      };
    },
    { interval: CHUNK_INTERVAL_MS, count: CHUNK_COUNT, chars: CHUNK_CHARS },
  );
}

// The producer is a timer on the throttled main thread, so the chunks per
// second it manages falls with the CPU: a runner a few times slower than a
// laptop delivers 150 chunks in 6 s or more, not the 3.75 s the interval says.
// The wait therefore names the progress it needs, the next chunk, and fails only
// when the stream stops delivering for STREAM_STALL_MS, never on a wall clock
// that assumes the speed of the machine it was written on.
async function waitForStreamedChunks(page: Page, target: number): Promise<void> {
  let sent = 0;
  while (sent < target) {
    try {
      await page.waitForFunction(
        (previous) => (window as unknown as ProbeWindow).__stream.sent > previous,
        sent,
        { timeout: STREAM_STALL_MS },
      );
    } catch {
      throw new Error(
        `the stream made no progress for ${STREAM_STALL_MS}ms at ${sent} of ${target} chunks`,
      );
    }
    sent = await page.evaluate(() => (window as unknown as ProbeWindow).__stream.sent);
  }
}

async function startProbe(page: Page): Promise<void> {
  await page.evaluate((threshold) => {
    const probe: Probe = { longTasks: [], keys: [], events: [] };
    (window as unknown as ProbeWindow).__probe = probe;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) probe.longTasks.push(entry.duration);
    }).observe({ type: 'longtask' });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if ((entry as PerformanceEventTiming).interactionId) {
          probe.events.push({ name: entry.name, durationMs: entry.duration });
        }
      }
    }).observe({
      type: 'event',
      durationThreshold: threshold,
    } as PerformanceObserverInit & { durationThreshold: number });
    // From the OS-stamped keydown to the first task after the next render: the
    // wait includes any time the main thread spent busy before the handler ran.
    document.addEventListener(
      'keydown',
      (event) => {
        const record: KeyRecord = { key: event.key, toFrameMs: Number.NaN };
        probe.keys.push(record);
        requestAnimationFrame(() => {
          const channel = new MessageChannel();
          channel.port1.onmessage = () => {
            record.toFrameMs = performance.now() - event.timeStamp;
          };
          channel.port2.postMessage(null);
        });
      },
      true,
    );
  }, EVENT_TIMING_THRESHOLD_MS);
}

async function readProbe(page: Page): Promise<Probe> {
  return page.evaluate(() => (window as unknown as ProbeWindow).__probe);
}

for (const rate of CPU_RATES) {
  test(`typing and Escape stay responsive while an answer streams (CPU ${rate}x)`, async ({
    page,
    browserName,
  }, testInfo) => {
    test.skip(
      browserName !== 'chromium',
      'the long task and event timing observers and the CPU throttle are Chromium-only; the spec carries no cross-browser tag, so only the chromium project runs it',
    );
    const copy = shellCopy();
    await installMockBackend(page, { log: 'accept', forget: 'happy' });
    await installPacedAsk(page);
    await openShell(page);

    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate });

    await askShell(page, QUESTION);
    await expect(page.locator(SHELL_SELECTOR.caret)).toBeVisible();
    // Typing starts once half the answer is on screen: the render cost grows
    // with the text, so the late keys are the ones that can miss the bound.
    await waitForStreamedChunks(page, TYPE_AFTER_CHUNKS);
    await startProbe(page);

    await page.keyboard.type(TYPED, { delay: KEY_DELAY_MS });
    await expect(page.locator(SHELL_SELECTOR.input)).toHaveValue(TYPED);
    const streamedBeforeEscape = await page.evaluate(
      () => (window as unknown as ProbeWindow).__stream,
    );
    expect(
      streamedBeforeEscape.closed,
      'the answer must still be streaming when Escape is pressed, or the spec measures an idle page',
    ).toBe(false);
    await expect(stopButton(page)).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(stopButton(page)).toBeHidden();
    await expect(page.locator(SHELL_SELECTOR.info).getByText(copy.ui.stoppedPartial)).toBeVisible();
    await settleFrames(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });

    const probe = await readProbe(page);
    const typedKeys = TYPED.length + 1;
    const keyMs = probe.keys.map((key) => key.toFrameMs);
    const maxKeyToFrame = Math.max(...keyMs);
    const maxEvent = Math.max(0, ...probe.events.map((event) => event.durationMs));
    const maxLongTask = Math.max(0, ...probe.longTasks);
    const summary = {
      cpuRate: rate,
      chunksBeforeEscape: streamedBeforeEscape.sent,
      keys: probe.keys.length,
      longTasks: probe.longTasks.length,
      maxLongTaskMs: Math.round(maxLongTask),
      maxKeyToFrameMs: Math.round(maxKeyToFrame),
      maxEventDurationMs: Math.round(maxEvent),
    };
    await testInfo.attach('stream-responsiveness', {
      body: JSON.stringify({ ...summary, keyToFrameMs: keyMs.map(Math.round) }),
      contentType: 'application/json',
    });
    console.log(`S14.8 ${JSON.stringify(summary)}`);

    expect(probe.keys, 'every typed key and the Escape press reach the probe').toHaveLength(
      typedKeys,
    );
    expect(
      keyMs.every(Number.isFinite),
      `a key never reached a frame: ${JSON.stringify(probe.keys)}`,
    ).toBe(true);
    expect(
      maxKeyToFrame,
      `key press to next frame under ${INP_GOOD_MS}ms while streaming: ${JSON.stringify(summary)}`,
    ).toBeLessThan(INP_GOOD_MS);
    expect(
      maxEvent,
      `event timing duration under ${INP_GOOD_MS}ms while streaming: ${JSON.stringify(summary)}`,
    ).toBeLessThan(INP_GOOD_MS);
    expect(
      maxLongTask,
      `no task of ${LONG_TASK_FAIL_MS}ms or more while streaming: ${JSON.stringify(summary)}`,
    ).toBeLessThan(LONG_TASK_FAIL_MS);
  });
}
