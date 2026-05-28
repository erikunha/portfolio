'use client';

import { useCallback, useRef, useState } from 'react';
import s from './DawMixer.module.css';

interface FaderProps {
  initialPct: number;
  channelName: string;
}

export function FaderIsland({ initialPct, channelName }: FaderProps) {
  const [pct, setPct] = useState(initialPct);
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const livePct = useRef(initialPct);

  const getPctFromPointer = useCallback((clientX: number): number | null => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return null;
    return Math.max(0, Math.min(100, Math.round(((clientX - rect.left) / rect.width) * 100)));
  }, []);

  const applyPct = useCallback((newPct: number) => {
    livePct.current = newPct;
    if (trackRef.current) {
      trackRef.current.setAttribute('aria-valuenow', String(newPct));
    }
    if (thumbRef.current) {
      thumbRef.current.style.transform = `translateX(calc(${newPct}% - 7px))`;
    }
  }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const newPct = getPctFromPointer(e.clientX);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
      isDragging.current = true;
      if (newPct !== null) applyPct(newPct);
    } catch {
      if (newPct !== null) {
        livePct.current = newPct;
        setPct(newPct);
      }
    }
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
      livePct.current = newPct;
      setPct(newPct);
    }
  };

  return (
    <div
      ref={trackRef}
      role="slider"
      aria-label={`${channelName} fader`}
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      tabIndex={0}
      className={s.faderTrack}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
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
        className={s.faderThumb}
        style={{ transform: `translateX(calc(${pct}% - 7px))` }}
        aria-hidden="true"
      />
    </div>
  );
}
