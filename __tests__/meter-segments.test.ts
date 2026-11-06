import { describe, expect, it } from 'vitest';
import { METER_SEGMENTS } from '@/content/daw-mixer';
import {
  METER_CLIP_SEGMENTS,
  METER_CLIP_THRESHOLD_PCT,
  MeterSegment,
  meterSegmentState,
} from '@/lib/meter';

const states = (pct: number, clipping: boolean) =>
  Array.from({ length: METER_SEGMENTS }, (_, index) =>
    meterSegmentState(index, pct, METER_SEGMENTS, clipping),
  );

describe('meterSegmentState', () => {
  it('fills the leading segments in proportion to the level', () => {
    const filled = states(50, false).filter((state) => state === MeterSegment.Filled);
    expect(filled).toHaveLength(Math.round(METER_SEGMENTS / 2));
  });

  it('never goes red unless the channel is clipping', () => {
    expect(states(100, false)).not.toContain(MeterSegment.Red);
  });

  it('turns the last filled clip segments red above the clip threshold', () => {
    const red = states(100, true).filter((state) => state === MeterSegment.Red);
    expect(red, 'the clip zone is the last METER_CLIP_SEGMENTS segments').toHaveLength(
      METER_CLIP_SEGMENTS,
    );
  });

  it('keeps the clip zone unlit at or below the threshold', () => {
    expect(states(METER_CLIP_THRESHOLD_PCT, true)).not.toContain(MeterSegment.Red);
  });

  it('leaves unfilled clip segments empty', () => {
    const level = 90;
    const filledCount = Math.round((level / 100) * METER_SEGMENTS);
    const result = states(level, true);
    expect(result.slice(filledCount).every((state) => state === MeterSegment.Empty)).toBe(true);
  });
});
