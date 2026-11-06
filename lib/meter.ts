const FULL_PERCENT = 100;

export const METER_CLIP_THRESHOLD_PCT = 85;
export const METER_CLIP_SEGMENTS = 2;

export const MeterSegment = { Red: 'red', Filled: 'filled', Empty: 'empty' } as const;
export type MeterSegmentState = (typeof MeterSegment)[keyof typeof MeterSegment];

export function meterSegmentState(
  index: number,
  pct: number,
  segments: number,
  clipping: boolean,
): MeterSegmentState {
  const filledCount = Math.round((pct / FULL_PERCENT) * segments);
  if (index >= filledCount) return MeterSegment.Empty;
  const inClipZone =
    clipping && pct > METER_CLIP_THRESHOLD_PCT && index >= segments - METER_CLIP_SEGMENTS;
  return inClipZone ? MeterSegment.Red : MeterSegment.Filled;
}
