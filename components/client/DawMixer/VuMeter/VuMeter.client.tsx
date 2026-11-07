'use client';

import { useRef } from 'react';
import { MeterSegment, meterSegmentState } from '@/lib/meter';
import { PERCENT_RANGE, percentAlong } from '@/lib/slider';
import { useDragSlider } from '../useDragSlider.client';

const KEY_STEP_PCT = 5;
const SEGMENT_CLASS = {
  [MeterSegment.Red]: 'vuSegRed',
  [MeterSegment.Filled]: 'vuSegFilled',
  [MeterSegment.Empty]: 'vuSegEmpty',
} as const;

interface VuMeterProps {
  segments: number;
  initialLevel: number;
  clipping?: boolean;
  channelName: string;
  label: string;
}

export function VuMeter({
  segments,
  initialLevel,
  clipping = false,
  channelName,
  label,
}: VuMeterProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const segmentRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const liveLevel = useRef(initialLevel);

  const getSegmentClass = (index: number, level: number) =>
    SEGMENT_CLASS[meterSegmentState(index, level, segments, clipping)];

  const applyLevel = (newLevel: number) => {
    liveLevel.current = newLevel;
    const el = containerRef.current;
    if (el) {
      el.setAttribute('aria-valuenow', String(newLevel));
      el.setAttribute('aria-valuetext', `${newLevel}%`);
    }
    segmentRefs.current.forEach((seg, i) => {
      if (seg) seg.className = getSegmentClass(i, newLevel);
    });
  };

  const handlers = useDragSlider({
    read: () => liveLevel.current,
    apply: applyLevel,
    valueAt: (event) => percentAlong(containerRef.current, event.clientX),
    applyOnDown: true,
    settleOn: 'live',
    keys: { ...PERCENT_RANGE, step: KEY_STEP_PCT },
  });

  return (
    <div
      ref={containerRef}
      role="slider"
      aria-label={`${channelName} ${label}`}
      aria-valuenow={initialLevel}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuetext={`${initialLevel}%`}
      tabIndex={0}
      className="vu-meter"
      {...handlers}
    >
      {Array.from({ length: segments }, (_, i) => {
        const cls = getSegmentClass(i, initialLevel);
        const setRef = (el: HTMLSpanElement | null) => {
          segmentRefs.current[i] = el;
        };
        // biome-ignore lint/suspicious/noArrayIndexKey: positional segments, no stable id exists
        return <span key={i} ref={setRef} className={cls} />;
      })}
    </div>
  );
}
