import { describe, expect, it } from 'vitest';
import {
  nextToTopState,
  TO_TOP_MIN_DELTA_PX,
  TO_TOP_SHOW_AFTER_PX,
  type ToTopState,
} from './scroll-direction';

const PAST = TO_TOP_SHOW_AFTER_PX + 600;
const HIDDEN_AT_PAST: ToTopState = { visible: false, anchor: PAST };

describe('nextToTopState', () => {
  it('stays hidden while the page scrolls down past the threshold', () => {
    const next = nextToTopState({ visible: false, anchor: 0 }, PAST);
    expect(next.visible).toBe(false);
    expect(next.anchor).toBe(PAST);
  });

  it('shows once the page scrolls up past the minimum delta', () => {
    const next = nextToTopState(HIDDEN_AT_PAST, PAST - TO_TOP_MIN_DELTA_PX);
    expect(next.visible).toBe(true);
  });

  it('hides again when the page scrolls down while shown', () => {
    const shown: ToTopState = { visible: true, anchor: PAST };
    expect(nextToTopState(shown, PAST + TO_TOP_MIN_DELTA_PX).visible).toBe(false);
  });

  it('ignores jitter smaller than the minimum delta', () => {
    const shown: ToTopState = { visible: true, anchor: PAST };
    expect(nextToTopState(shown, PAST + TO_TOP_MIN_DELTA_PX - 1)).toBe(shown);
    expect(nextToTopState(HIDDEN_AT_PAST, PAST - TO_TOP_MIN_DELTA_PX + 1)).toBe(HIDDEN_AT_PAST);
  });

  it('accumulates slow upward scrolling until it passes the minimum delta', () => {
    let state = HIDDEN_AT_PAST;
    for (let step = 1; step <= TO_TOP_MIN_DELTA_PX; step += 1) {
      state = nextToTopState(state, PAST - step);
    }
    expect(state.visible).toBe(true);
  });

  it('hides at or above the threshold even while scrolling up', () => {
    const shown: ToTopState = { visible: true, anchor: TO_TOP_SHOW_AFTER_PX + 50 };
    expect(nextToTopState(shown, TO_TOP_SHOW_AFTER_PX).visible).toBe(false);
  });
});
