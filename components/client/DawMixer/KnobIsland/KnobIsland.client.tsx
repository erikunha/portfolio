'use client';

import { useRef, useState } from 'react';
import { useDragSlider } from '../useDragSlider.client';

const MIN_ANGLE = -150;
const MAX_ANGLE = 150;
const KNOB_SIZE = 26;
const KNOB_CENTER = 13;
const NEEDLE_LENGTH = 9;
const KEY_STEP_DEGREES = 5;
const DRAG_DEGREES_PER_PIXEL = 1.5;

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
}

export function KnobIsland({ initialAngle, label, channelName, degreesUnit }: KnobProps) {
  const [angle, setAngle] = useState(initialAngle);
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const needleRef = useRef<SVGLineElement>(null);
  const liveAngle = useRef(initialAngle);

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
      {...handlers}
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
      <div className="text-xs text-primary-400 text-center tracking-[0.1em] font-mono">{label}</div>
    </div>
  );
}
