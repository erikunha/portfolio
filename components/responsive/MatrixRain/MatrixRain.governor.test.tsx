import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type MountedClient, mountClient } from '@/__tests__/helpers/render';

const CANVAS_RECT = {
  width: 400,
  height: 300,
  top: 0,
  left: 0,
  right: 400,
  bottom: 300,
  x: 0,
  y: 0,
  toJSON: () => ({}),
} as DOMRect;

const COLUMNS = 25;
const FONT_SIZE = 16;
const SPEED = 0.7;
const FRAME_SPACING_MS = 50;
const TAIL = 'rgba(0,0,0,0.10)';
const HEAD = '#1d6a2a';

function makeRecordingCtx() {
  const fills: string[] = [];
  const heads: number[] = [];
  let style = '';
  const ctx = {
    font: '',
    get fillStyle() {
      return style;
    },
    set fillStyle(v: string) {
      style = v;
      fills.push(v);
    },
    setTransform: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn((_ch: string, x: number, y: number) => {
      if (x === 0 && style === HEAD) heads.push(y);
    }),
  };
  return { ctx, fills, heads };
}

describe('MatrixRain follows the frame governor', () => {
  let mounted: MountedClient;
  let rafCallbacks: FrameRequestCallback[];
  let multiplier: number;
  let clock: number;

  beforeEach(() => {
    vi.resetModules();
    rafCallbacks = [];
    multiplier = 1;
    clock = 0;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafCallbacks.push(cb);
      return rafCallbacks.length;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.stubGlobal('requestIdleCallback', (cb: () => void) => {
      cb();
      return 1;
    });
    vi.stubGlobal('cancelIdleCallback', vi.fn());
    vi.doMock('@/lib/frame-governor', () => ({
      getFrameGovernorTickMultiplier: () => multiplier,
    }));
    vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue(CANVAS_RECT);
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  afterEach(() => {
    mounted?.unmount();
    vi.doUnmock('@/lib/frame-governor');
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  async function mountRain(recorder: ReturnType<typeof makeRecordingCtx>) {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      recorder.ctx as unknown as CanvasRenderingContext2D,
    );
    const { MatrixRain } = await import('./MatrixRain.client');
    mounted = await mountClient(
      createElement(MatrixRain, {
        fontSize: FONT_SIZE,
        speed: SPEED,
        tailFade: TAIL,
        headColor: HEAD,
      }),
    );
  }

  function pump(frames: number): void {
    for (let i = 0; i < frames; i++) {
      clock += FRAME_SPACING_MS;
      rafCallbacks.shift()?.(clock);
    }
  }

  function ticks(recorder: ReturnType<typeof makeRecordingCtx>): number {
    return recorder.ctx.fillText.mock.calls.length / (COLUMNS * 2);
  }

  it('draws on every frame that clears the base interval at multiplier 1', async () => {
    const recorder = makeRecordingCtx();
    await mountRain(recorder);
    pump(8);
    expect(ticks(recorder)).toBe(8);
    expect(
      recorder.fills.includes(TAIL) && recorder.fills.every((f) => !f.includes('0.19')),
      'full rate must fade with the configured colour untouched',
    ).toBe(true);
  });

  it('draws half as often at multiplier 2', async () => {
    multiplier = 2;
    const recorder = makeRecordingCtx();
    await mountRain(recorder);
    pump(8);
    expect(ticks(recorder), 'the interval must scale with the governor multiplier').toBe(4);
  });

  it('draws a quarter as often at multiplier 4', async () => {
    multiplier = 4;
    const recorder = makeRecordingCtx();
    await mountRain(recorder);
    pump(16);
    expect(ticks(recorder)).toBe(4);
  });

  it('keeps the fall speed by advancing the multiplier times further per tick', async () => {
    multiplier = 2;
    const recorder = makeRecordingCtx();
    await mountRain(recorder);
    pump(8);
    const [first = 0, second = 0] = recorder.heads;
    expect(second - first, 'the head must keep its fall speed in rows per second').toBeCloseTo(
      SPEED * 2 * FONT_SIZE,
      5,
    );
  });

  it('keeps the trail length by compounding the fade over the skipped ticks', async () => {
    multiplier = 2;
    const recorder = makeRecordingCtx();
    await mountRain(recorder);
    pump(8);
    expect(recorder.fills).toContain('rgba(0,0,0,0.19)');
  });

  it('applies a multiplier change on the next tick', async () => {
    const recorder = makeRecordingCtx();
    await mountRain(recorder);
    pump(4);
    expect(ticks(recorder)).toBe(4);
    multiplier = 4;
    pump(8);
    expect(ticks(recorder)).toBe(6);
  });
});
