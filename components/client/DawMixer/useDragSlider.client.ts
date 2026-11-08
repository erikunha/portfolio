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

  const follow = (event: PointerEvent<HTMLDivElement>) => {
    const next = config.valueAt(event, origin.current);
    if (next !== null) config.apply(next);
    return next;
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    origin.current = { value: config.read(), clientX: event.clientX, clientY: event.clientY };
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
      // biome-ignore lint/suspicious/noEmptyBlockStatements: capture is refused for synthetic pointers, the drag still works through bubbling
    } catch {}
    dragging.current = true;
    if (config.applyOnDown) follow(event);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (dragging.current) follow(event);
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    dragging.current = false;
    const next = config.settleOn === 'live' ? config.read() : follow(event);
    if (next !== null) config.commit?.(next);
  };

  const onPointerCancel = () => {
    if (!dragging.current) return;
    dragging.current = false;
    config.apply(origin.current.value);
    config.commit?.(origin.current.value);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (dragging.current) return;
    const next = sliderValueForKey(event.key, { value: config.read(), ...config.keys });
    if (next === null) return;
    event.preventDefault();
    const settled = config.normalizeKey ? config.normalizeKey(next) : next;
    config.apply(settled);
    config.commit?.(settled);
  };

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onKeyDown };
}
