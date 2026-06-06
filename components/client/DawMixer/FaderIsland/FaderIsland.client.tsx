'use client';

import { useCallback, useRef, useState } from 'react';

interface FaderProps {
  initialPct: number;
  channelName: string;
  onPctChange?: (pct: number) => void;
  onAriaValueText?: (pct: number) => string;
}

export function FaderIsland({ initialPct, channelName, onPctChange, onAriaValueText }: FaderProps) {
  const [pct, setPct] = useState(initialPct);
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const livePct = useRef(initialPct);
  const dragStartPct = useRef(initialPct);

  const getPctFromPointer = useCallback((clientX: number): number | null => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return null;
    return Math.max(0, Math.min(100, Math.round(((clientX - rect.left) / rect.width) * 100)));
  }, []);

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
    const newPct = getPctFromPointer(e.clientX);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // setPointerCapture not supported; drag works within element bounds
    }
    isDragging.current = true;
    if (newPct !== null) applyPct(newPct);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging.current) return;
    const newPct = getPctFromPointer(e.clientX);
    if (newPct !== null) applyPct(newPct);
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging.current) return;
    isDragging.current = false;
    const newPct = getPctFromPointer(e.clientX);
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
      aria-label={`${channelName} fader`}
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
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          const next = Math.min(100, livePct.current + 2);
          livePct.current = next;
          applyPct(next);
          setPct(next);
        }
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          const next = Math.max(0, livePct.current - 2);
          livePct.current = next;
          applyPct(next);
          setPct(next);
        }
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
