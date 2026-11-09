'use client';

import { type PointerEvent, useRef, useState } from 'react';
import { useDragSlider } from '../useDragSlider.client';

const MIN_ANGLE = -150;
const MAX_ANGLE = 150;
const KNOB_SIZE = 26;
const KNOB_CENTER = 13;
const NEEDLE_LENGTH = 9;
const KEY_STEP_DEGREES = 5;
const DRAG_DEGREES_PER_PIXEL = 1.5;
const TAP_STEP_DEGREES = 15;
const TAP_SLOP_PX = 4;
const HALF = 2;

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
  degreesUnit: string;
  hint?: string;
}

export function KnobIsland({ initialAngle, label, channelName, degreesUnit, hint }: KnobProps) {
  const [angle, setAngle] = useState(initialAngle);
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const needleRef = useRef<SVGLineElement>(null);
  const liveAngle = useRef(initialAngle);
  const pressedAt = useRef({ x: 0, y: 0 });

  const updateNeedle = (newAngle: number) => {
    liveAngle.current = newAngle;
    const el = containerRef.current;
    if (el) {
      const rounded = Math.round(newAngle);
      el.setAttribute('aria-valuenow', String(rounded));
      el.setAttribute('aria-valuetext', `${rounded > 0 ? '+' : ''}${rounded} ${degreesUnit}`);
    }
    const needle = needleRef.current;
    if (needle) {
      const { x2, y2 } = angleToCoords(newAngle);
      needle.setAttribute('x2', x2.toFixed(2));
      needle.setAttribute('y2', y2.toFixed(2));
    }
  };

  const handlers = useDragSlider({
    read: () => liveAngle.current,
    apply: updateNeedle,
    commit: (value) => setAngle(Math.round(value)),
    valueAt: (event, origin) =>
      clamp(origin.value + (origin.clientY - event.clientY) * DRAG_DEGREES_PER_PIXEL),
    applyOnDown: false,
    settleOn: 'live',
    keys: { min: MIN_ANGLE, max: MAX_ANGLE, step: KEY_STEP_DEGREES },
    normalizeKey: Math.round,
  });

  const stepFromTap = (event: PointerEvent<HTMLDivElement>) => {
    const moved = Math.hypot(
      event.clientX - pressedAt.current.x,
      event.clientY - pressedAt.current.y,
    );
    const dial = svgRef.current?.getBoundingClientRect();
    if (moved > TAP_SLOP_PX || !dial) return;
    const upperHalf = event.clientY < dial.top + dial.height / HALF;
    const next = Math.round(
      clamp(liveAngle.current + (upperHalf ? TAP_STEP_DEGREES : -TAP_STEP_DEGREES)),
    );
    updateNeedle(next);
    setAngle(next);
  };

  const { x2, y2 } = angleToCoords(angle);

  return (
    <div
      ref={containerRef}
      className="knob-container"
      role="slider"
      aria-label={`${channelName} ${label}`}
      aria-valuenow={angle}
      aria-valuemin={MIN_ANGLE}
      aria-valuemax={MAX_ANGLE}
      aria-valuetext={`${angle > 0 ? '+' : ''}${angle} ${degreesUnit}`}
      tabIndex={0}
      title={hint}
      {...handlers}
      onPointerDown={(event) => {
        pressedAt.current = { x: event.clientX, y: event.clientY };
        handlers.onPointerDown(event);
      }}
      onPointerUp={(event) => {
        handlers.onPointerUp(event);
        stepFromTap(event);
      }}
    >
      <svg
        ref={svgRef}
        width={KNOB_SIZE}
        height={KNOB_SIZE}
        viewBox={`0 0 ${KNOB_SIZE} ${KNOB_SIZE}`}
        className="cursor-ns-resize"
        aria-hidden="true"
      >
        <circle
          cx={KNOB_CENTER}
          cy={KNOB_CENTER}
          r="11"
          stroke="var(--color-primary-500)"
          strokeWidth="1"
          fill="rgba(0,0,0,0.7)"
        />
        <line
          ref={needleRef}
          x1={KNOB_CENTER}
          y1={KNOB_CENTER}
          x2={x2.toFixed(2)}
          y2={y2.toFixed(2)}
          stroke="var(--color-primary-500)"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      <div className="text-xs text-primary-400 text-center tracking-xl font-mono">{label}</div>
    </div>
  );
}
