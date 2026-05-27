'use client';

import { useCallback, useRef, useState } from 'react';
import s from './DawMixer.module.css';

interface VuMeterProps {
  segments: number;
  initialLevel: number;
  clipping?: boolean;
  channelName: string;
}

export function VuMeter({ segments, initialLevel, clipping = false, channelName }: VuMeterProps) {
  const [level, setLevel] = useState(initialLevel);
  const containerRef = useRef<HTMLDivElement>(null);
  const segmentRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const isDragging = useRef(false);
  const liveLevel = useRef(initialLevel);

  const getSegmentClass = useCallback(
    (i: number, currentLevel: number): string => {
      const filledCount = Math.round((currentLevel / 100) * segments);
      const isRed = clipping && currentLevel > 85 && i >= segments - 2;
      if (isRed) return s.vuSegRed;
      if (i < filledCount) return s.vuSegFilled;
      return s.vuSegEmpty;
    },
    [segments, clipping],
  );

  const applyLevel = useCallback(
    (newLevel: number) => {
      liveLevel.current = newLevel;
      const el = containerRef.current;
      if (el) el.setAttribute('aria-valuenow', String(newLevel));
      segmentRefs.current.forEach((seg, i) => {
        if (seg) seg.className = getSegmentClass(i, newLevel);
      });
    },
    [getSegmentClass],
  );

  const getLevelFromPointer = useCallback((clientX: number): number | null => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return Math.max(0, Math.min(100, Math.round(((clientX - rect.left) / rect.width) * 100)));
  }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    isDragging.current = true;
    const newLevel = getLevelFromPointer(e.clientX);
    if (newLevel !== null) applyLevel(newLevel);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging.current) return;
    const newLevel = getLevelFromPointer(e.clientX);
    if (newLevel !== null) applyLevel(newLevel);
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging.current) return;
    isDragging.current = false;
    const newLevel = getLevelFromPointer(e.clientX);
    if (newLevel !== null) setLevel(newLevel);
  };

  const filledCount = Math.round((level / 100) * segments);

  return (
    <div
      ref={containerRef}
      role="slider"
      aria-label={`${channelName} VU meter demonstration, drag to adjust level`}
      aria-valuenow={level}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuetext={`${level}%`}
      tabIndex={0}
      className={s.vuMeter}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') {
          const next = Math.min(100, liveLevel.current + 5);
          applyLevel(next);
          setLevel(next);
        }
        if (e.key === 'ArrowLeft') {
          const next = Math.max(0, liveLevel.current - 5);
          applyLevel(next);
          setLevel(next);
        }
      }}
    >
      {Array.from({ length: segments }, (_, i) => {
        const isRed = clipping && level > 85 && i >= segments - 2;
        const isFilled = i < filledCount;
        const cls = isRed ? s.vuSegRed : isFilled ? s.vuSegFilled : s.vuSegEmpty;
        const setRef = (el: HTMLSpanElement | null) => {
          segmentRefs.current[i] = el;
        };
        // biome-ignore lint/suspicious/noArrayIndexKey: positional segments — no stable id exists
        return <span key={i} ref={setRef} className={cls} />;
      })}
    </div>
  );
}
