'use client';

import { useCallback, useRef, useState } from 'react';
import s from './DawMixer.module.css';

const MIN_ANGLE = -150;
const MAX_ANGLE = 150;
const KNOB_SIZE = 38;
const KNOB_CENTER = 19;
const NEEDLE_LENGTH = 12;

function clamp(v: number) {
  return Math.max(MIN_ANGLE, Math.min(MAX_ANGLE, v));
}

function angleToCoords(a: number) {
  const rad = (a - 90) * (Math.PI / 180);
  return {
    x2: KNOB_CENTER + NEEDLE_LENGTH * Math.cos(rad),
    y2: KNOB_CENTER + NEEDLE_LENGTH * Math.sin(rad),
  };
}

interface KnobProps {
  initialAngle: number;
  label: string;
  channelName: string;
}

export function KnobIsland({ initialAngle, label, channelName }: KnobProps) {
  const [angle, setAngle] = useState(initialAngle);
  const svgRef = useRef<SVGSVGElement>(null);
  const needleRef = useRef<SVGLineElement>(null);
  const isDragging = useRef(false);
  const dragStartY = useRef(0);
  const dragStartAngle = useRef(initialAngle);
  const liveAngle = useRef(initialAngle);

  const updateNeedle = useCallback((newAngle: number) => {
    liveAngle.current = newAngle;
    const el = svgRef.current?.parentElement;
    if (el) el.setAttribute('aria-valuenow', String(newAngle));
    const needle = needleRef.current;
    if (needle) {
      const { x2, y2 } = angleToCoords(newAngle);
      needle.setAttribute('x2', x2.toFixed(2));
      needle.setAttribute('y2', y2.toFixed(2));
    }
  }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
      isDragging.current = true;
      dragStartY.current = e.clientY;
      dragStartAngle.current = liveAngle.current;
    } catch {
      // setPointerCapture not supported; drag won't work but no crash
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging.current) return;
    // Upward drag (negative deltaY) = increase angle
    const deltaY = dragStartY.current - e.clientY;
    const newAngle = clamp(dragStartAngle.current + deltaY * 1.5);
    updateNeedle(newAngle);
  };

  const onPointerUp = () => {
    if (!isDragging.current) return;
    isDragging.current = false;
    setAngle(Math.round(liveAngle.current));
  };

  const { x2, y2 } = angleToCoords(angle);

  return (
    <div
      className={s.knob}
      role="slider"
      aria-label={`${channelName} ${label}`}
      aria-valuenow={angle}
      aria-valuemin={MIN_ANGLE}
      aria-valuemax={MAX_ANGLE}
      aria-valuetext={`${angle > 0 ? '+' : ''}${angle}°`}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onKeyDown={(e) => {
        if (isDragging.current) return;
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          const next = clamp(liveAngle.current + 5);
          liveAngle.current = next;
          updateNeedle(next);
          setAngle(next);
        }
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          const next = clamp(liveAngle.current - 5);
          liveAngle.current = next;
          updateNeedle(next);
          setAngle(next);
        }
      }}
    >
      <svg
        ref={svgRef}
        width={KNOB_SIZE}
        height={KNOB_SIZE}
        viewBox={`0 0 ${KNOB_SIZE} ${KNOB_SIZE}`}
        className={s.knobSvg}
        aria-hidden="true"
      >
        <circle
          cx={KNOB_CENTER}
          cy={KNOB_CENTER}
          r="16"
          stroke="var(--ds-color-signal-quiet)"
          strokeWidth="1"
          fill="none"
        />
        <circle
          cx={KNOB_CENTER}
          cy={KNOB_CENTER}
          r="14"
          fill="var(--ds-color-surface-base)"
          stroke="var(--ds-color-border-default)"
          strokeWidth="1"
        />
        <line
          ref={needleRef}
          x1={KNOB_CENTER}
          y1={KNOB_CENTER}
          x2={x2.toFixed(2)}
          y2={y2.toFixed(2)}
          stroke="var(--ds-color-signal)"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      <div className={s.knobLabel}>{label}</div>
    </div>
  );
}
