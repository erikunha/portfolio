'use client';

import { useRef, useState } from 'react';
import { PERCENT_RANGE, percentAlong } from '@/lib/slider';
import { useDragSlider } from '../useDragSlider.client';

const KEY_STEP_PCT = 2;

interface FaderProps {
  initialPct: number;
  channelName: string;
  label: string;
  onPctChange?: (pct: number) => void;
  onAriaValueText?: (pct: number) => string;
}

export function FaderIsland({
  initialPct,
  channelName,
  label,
  onPctChange,
  onAriaValueText,
}: FaderProps) {
  const [pct, setPct] = useState(initialPct);
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const livePct = useRef(initialPct);

  const applyPct = (newPct: number) => {
    livePct.current = newPct;
    if (trackRef.current) {
      trackRef.current.setAttribute('aria-valuenow', String(newPct));
      trackRef.current.setAttribute(
        'aria-valuetext',
        onAriaValueText ? onAriaValueText(newPct) : `${newPct}%`,
      );
    }
    if (thumbRef.current) {
      thumbRef.current.style.left = `calc(${newPct}% - var(--fader-thumb-w) / 2)`;
    }
    onPctChange?.(newPct);
  };

  const handlers = useDragSlider({
    read: () => livePct.current,
    apply: applyPct,
    commit: setPct,
    valueAt: (event) => percentAlong(trackRef.current, event.clientX),
    applyOnDown: true,
    settleOn: 'pointer',
    keys: { ...PERCENT_RANGE, step: KEY_STEP_PCT },
  });

  return (
    <div
      ref={trackRef}
      role="slider"
      aria-label={`${channelName} ${label}`}
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuetext={onAriaValueText ? onAriaValueText(pct) : `${pct}%`}
      tabIndex={0}
      className="fader-track"
      {...handlers}
    >
      <div
        ref={thumbRef}
        className="faderThumb"
        style={{ left: `calc(${pct}% - var(--fader-thumb-w) / 2)` }}
        aria-hidden="true"
      />
    </div>
  );
}
