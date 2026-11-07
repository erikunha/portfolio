import { type KeyboardEvent, type PointerEvent, useRef } from 'react';
import { sliderValueForKey } from '@/lib/slider';

export interface DragOrigin {
  value: number;
  clientX: number;
  clientY: number;
}

export interface DragSliderConfig {
  read: () => number;
  apply: (value: number) => void;
  commit?: (value: number) => void;
  valueAt: (event: PointerEvent<HTMLDivElement>, origin: DragOrigin) => number | null;
  applyOnDown: boolean;
  settleOn: 'pointer' | 'live';
  keys: { min: number; max: number; step: number };
  normalizeKey?: (value: number) => number;
}

export interface DragSliderHandlers {
  onPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerCancel: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
}

export function useDragSlider(config: DragSliderConfig): DragSliderHandlers {
  const dragging = useRef(false);
  const origin = useRef<DragOrigin>({ value: 0, clientX: 0, clientY: 0 });

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const { read, apply, valueAt, applyOnDown } = config;
    origin.current = { value: read(), clientX: event.clientX, clientY: event.clientY };
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
      // biome-ignore lint/suspicious/noEmptyBlockStatements: capture is refused for synthetic pointers, the drag still works through bubbling
    } catch {}
    dragging.current = true;
    if (!applyOnDown) return;
    const next = valueAt(event, origin.current);
    if (next !== null) apply(next);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    const { apply, valueAt } = config;
    const next = valueAt(event, origin.current);
    if (next !== null) apply(next);
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    dragging.current = false;
    const { read, apply, commit, valueAt, settleOn } = config;
    if (settleOn === 'live') {
      commit?.(read());
      return;
    }
    const next = valueAt(event, origin.current);
    if (next === null) return;
    apply(next);
    commit?.(next);
  };

  const onPointerCancel = () => {
    if (!dragging.current) return;
    dragging.current = false;
    const { apply, commit } = config;
    apply(origin.current.value);
    commit?.(origin.current.value);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (dragging.current) return;
    const { read, apply, commit, keys, normalizeKey } = config;
    const next = sliderValueForKey(event.key, { value: read(), ...keys });
    if (next === null) return;
    event.preventDefault();
    const settled = normalizeKey ? normalizeKey(next) : next;
    apply(settled);
    commit?.(settled);
  };

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onKeyDown };
}
