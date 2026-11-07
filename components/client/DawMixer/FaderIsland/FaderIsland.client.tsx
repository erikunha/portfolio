'use client';

import { useCallback, useRef, useState } from 'react';
import { PERCENT_RANGE, percentAlong, sliderValueForKey } from '@/lib/slider';

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
  const isDragging = useRef(false);
  const livePct = useRef(initialPct);
  const dragStartPct = useRef(initialPct);

  const applyPct = useCallback(
    (newPct: number) => {
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
    },
    [onPctChange, onAriaValueText],
  );

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragStartPct.current = livePct.current;
    const newPct = percentAlong(trackRef.current, e.clientX);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
      // biome-ignore lint/suspicious/noEmptyBlockStatements: intentional no-op
    } catch {}
    isDragging.current = true;
    if (newPct !== null) applyPct(newPct);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging.current) return;
    const newPct = percentAlong(trackRef.current, e.clientX);
    if (newPct !== null) applyPct(newPct);
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging.current) return;
    isDragging.current = false;
    const newPct = percentAlong(trackRef.current, e.clientX);
    if (newPct !== null) {
      applyPct(newPct);
      setPct(newPct);
    }
  };

  const onPointerCancel = () => {
    if (!isDragging.current) return;
    isDragging.current = false;
    applyPct(dragStartPct.current);
    setPct(dragStartPct.current);
  };

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
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onKeyDown={(e) => {
        if (isDragging.current) return;
        const next = sliderValueForKey(e.key, {
          value: livePct.current,
          ...PERCENT_RANGE,
          step: KEY_STEP_PCT,
        });
        if (next === null) return;
        e.preventDefault();
        applyPct(next);
        setPct(next);
      }}
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
