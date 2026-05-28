'use client';

import { useCallback, useRef } from 'react';
import s from './VuMeter.module.css';

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
    (i: number, currentLevel: number): string => {
      const filledCount = Math.round((currentLevel / 100) * segments);
      const isRed = clipping && currentLevel > 85 && i >= segments - 2;
      if (isRed) return s.vuSegRed ?? '';
      if (i < filledCount) return s.vuSegFilled ?? '';
      return s.vuSegEmpty ?? '';
    },
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

  const getLevelFromPointer = useCallback((clientX: number): number | null => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return null;
    return Math.max(0, Math.min(100, Math.round(((clientX - rect.left) / rect.width) * 100)));
  }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragStartLevel.current = liveLevel.current;
    const newLevel = getLevelFromPointer(e.clientX);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // setPointerCapture not supported; drag still works within element bounds
    }
    isDragging.current = true;
    if (newLevel !== null) applyLevel(newLevel);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging.current) return;
    const newLevel = getLevelFromPointer(e.clientX);
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

  const filledCount = Math.round((initialLevel / 100) * segments);

  return (
    <div
      ref={containerRef}
      role="slider"
      aria-live="polite"
      aria-atomic="true"
      aria-label={`${channelName} VU meter demonstration, drag to adjust level`}
      aria-valuenow={initialLevel}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuetext={`${initialLevel}%`}
      tabIndex={0}
      className={s.vuMeter}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onKeyDown={(e) => {
        if (isDragging.current) return;
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          applyLevel(Math.min(100, liveLevel.current + 5));
        }
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          applyLevel(Math.max(0, liveLevel.current - 5));
        }
      }}
    >
      {Array.from({ length: segments }, (_, i) => {
        const isRed = clipping && initialLevel > 85 && i >= segments - 2;
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
