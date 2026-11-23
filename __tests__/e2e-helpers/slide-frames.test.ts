import { describe, expect, it } from 'vitest';
import {
  analyseSlide,
  MIN_EXIT_TRAVEL,
  MIN_LIVE_POSITIONS,
  type Paint,
} from '../../tests/e2e/_helpers/slide-frames';

const PANEL_WIDTH = 320;
const SLIDE_MS = 200;
const OPEN = true;
const CLOSED = false;

function paintsFrom(rows: Array<[number, number, boolean]>): Paint[] {
  return rows.map(([at, x, open]) => ({ at, x, open }));
}

function easedSlide(frameMs: number): Paint[] {
  const paints: Paint[] = [{ at: 0, x: 0, open: OPEN }];
  let at = frameMs;
  for (; at < SLIDE_MS; at += frameMs) {
    const left = 1 - at / SLIDE_MS;
    paints.push({ at, x: -PANEL_WIDTH * (1 - left * left), open: OPEN });
  }
  paints.push({ at, x: 0, open: CLOSED });
  return paints;
}

describe('analyseSlide', () => {
  it('measures a steady 60 Hz slide as asserted with a live position per frame', () => {
    const slide = analyseSlide(easedSlide(16.7), PANEL_WIDTH);
    expect(slide.steady).toBe(true);
    expect(slide.positions).toBeGreaterThanOrEqual(MIN_LIVE_POSITIONS);
    expect(slide.travel).toBeGreaterThanOrEqual(MIN_EXIT_TRAVEL);
  });

  it('keeps a 30 Hz slide asserted and still counts the required positions', () => {
    const slide = analyseSlide(easedSlide(33.4), PANEL_WIDTH);
    expect(slide.steady).toBe(true);
    expect(slide.positions).toBeGreaterThanOrEqual(MIN_LIVE_POSITIONS);
  });

  it('does not assert on a slide that a stalled main thread drew in three frames', () => {
    const starved = paintsFrom([
      [-18, 0, OPEN],
      [282, 0, OPEN],
      [349, -156.2, OPEN],
      [415, -270, OPEN],
      [465, -316.2, OPEN],
      [499, 0, CLOSED],
      [532, 0, CLOSED],
    ]);
    const slide = analyseSlide(starved, PANEL_WIDTH);
    expect(slide.positions).toBe(3);
    expect(slide.steady, 'the stall before the first live frame leaves the window not steady').toBe(
      false,
    );
  });

  it('does not assert on a WebKit slide whose first frame came 172 ms after the release', () => {
    const late = paintsFrom([
      [0, 0, OPEN],
      [172, -311, OPEN],
      [193, -319.5, OPEN],
      [206, 0, CLOSED],
    ]);
    const slide = analyseSlide(late, PANEL_WIDTH);
    expect(slide.positions).toBe(2);
    expect(slide.steady).toBe(false);
  });

  it('still asserts a slide that jumps: steady frames, no live position', () => {
    const jumped = paintsFrom([
      [0, 0, OPEN],
      [17, 0, OPEN],
      [34, 0, OPEN],
      [51, 0, OPEN],
      [68, 0, OPEN],
      [85, 0, OPEN],
      [102, 0, OPEN],
      [119, 0, OPEN],
      [136, 0, OPEN],
      [153, 0, OPEN],
      [170, 0, OPEN],
      [187, 0, OPEN],
      [204, 0, CLOSED],
    ]);
    const slide = analyseSlide(jumped, PANEL_WIDTH);
    expect(slide.steady).toBe(true);
    expect(slide.positions).toBeLessThan(MIN_LIVE_POSITIONS);
  });

  it('reports no steady window while the dialog never closes inside the capture', () => {
    const open = paintsFrom([
      [0, 0, OPEN],
      [17, -50, OPEN],
      [34, -100, OPEN],
    ]);
    expect(analyseSlide(open, PANEL_WIDTH).steady).toBe(false);
  });
});
