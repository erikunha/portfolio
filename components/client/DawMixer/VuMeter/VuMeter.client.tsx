'use client';

import { useCallback, useRef } from 'react';
import { MeterSegment, meterSegmentState } from '@/lib/meter';
import { PERCENT_RANGE, percentAlong, sliderValueForKey } from '@/lib/slider';

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
}

export function VuMeter({ segments, initialLevel, clipping = false, channelName }: VuMeterProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const segmentRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const isDragging = useRef(false);
  const liveLevel = useRef(initialLevel);
  const dragStartLevel = useRef(initialLevel);

  const getSegmentClass = useCallback(
    (index: number, level: number) =>
      SEGMENT_CLASS[meterSegmentState(index, level, segments, clipping)],
    [segments, clipping],
  );

  const applyLevel = useCallback(
    (newLevel: number) => {
      liveLevel.current = newLevel;
      const el = containerRef.current;
      if (el) {
        el.setAttribute('aria-valuenow', String(newLevel));
        el.setAttribute('aria-valuetext', `${newLevel}%`);
      }
      segmentRefs.current.forEach((seg, i) => {
        if (seg) seg.className = getSegmentClass(i, newLevel);
      });
    },
    [getSegmentClass],
  );

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragStartLevel.current = liveLevel.current;
    const newLevel = percentAlong(containerRef.current, e.clientX);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
      // biome-ignore lint/suspicious/noEmptyBlockStatements: intentional no-op
    } catch {}
    isDragging.current = true;
    if (newLevel !== null) applyLevel(newLevel);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging.current) return;
    const newLevel = percentAlong(containerRef.current, e.clientX);
    if (newLevel !== null) applyLevel(newLevel);
  };

  const onPointerUp = () => {
    isDragging.current = false;
  };

  const onPointerCancel = () => {
    if (!isDragging.current) return;
    isDragging.current = false;
    applyLevel(dragStartLevel.current);
  };

  return (
    <div
      ref={containerRef}
      role="slider"
      aria-label={`${channelName} VU meter demonstration, drag to adjust level`}
      aria-valuenow={initialLevel}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuetext={`${initialLevel}%`}
      tabIndex={0}
      className="vu-meter"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onKeyDown={(e) => {
        if (isDragging.current) return;
        const next = sliderValueForKey(e.key, {
          value: liveLevel.current,
          ...PERCENT_RANGE,
          step: KEY_STEP_PCT,
        });
        if (next === null) return;
        e.preventDefault();
        applyLevel(next);
      }}
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
