'use client';

import { useEffect, useRef } from 'react';
import { readMotion } from '@/lib/motion';

const TYPE_MS = 70;
const HOLD_MS = 1_540;
const BACK_MS = 40;
const INTER_MS = 280;

export function TaglineTyper({ phrases }: { phrases: readonly string[] }) {
  const spanRef = useRef<HTMLSpanElement>(null);
  const first = phrases[0] ?? '';

  useEffect(() => {
    const el = spanRef.current;
    if (!el || phrases.length === 0) return;
    const node: HTMLSpanElement = el;

    let cancelled = false;
    let timerId: ReturnType<typeof setTimeout> | undefined;
    let phraseIdx = 0;
    let charIdx = 0;
    let phase: 'type' | 'hold' | 'back' = 'type';

    function tick() {
      if (cancelled) return;
      const phrase = phrases[phraseIdx % phrases.length] ?? '';
      if (phase === 'type') {
        charIdx++;
        node.textContent = phrase.slice(0, charIdx);
        if (charIdx >= phrase.length) {
          phase = 'hold';
          timerId = setTimeout(tick, HOLD_MS);
        } else {
          timerId = setTimeout(tick, TYPE_MS);
        }
      } else if (phase === 'hold') {
        phase = 'back';
        timerId = setTimeout(tick, BACK_MS);
      } else {
        charIdx--;
        node.textContent = phrase.slice(0, Math.max(charIdx, 0));
        if (charIdx <= 0) {
          phraseIdx++;
          charIdx = 0;
          phase = 'type';
          timerId = setTimeout(tick, INTER_MS);
        } else {
          timerId = setTimeout(tick, BACK_MS);
        }
      }
    }

    function start() {
      charIdx = 0;
      phase = 'type';
      node.textContent = '';
      tick();
    }

    if (readMotion()) start();

    const onMotionChange = (event: Event) => {
      const detail = (event as CustomEvent).detail as { on?: unknown } | null;
      if (!detail || typeof detail.on !== 'boolean') return;
      clearTimeout(timerId);
      if (detail.on) {
        cancelled = false;
        start();
        return;
      }
      cancelled = true;
      node.textContent = phrases[0] ?? '';
    };
    window.addEventListener('motionchange', onMotionChange);

    return () => {
      cancelled = true;
      clearTimeout(timerId);
      window.removeEventListener('motionchange', onMotionChange);
    };
  }, [phrases]);

  return (
    <>
      <span ref={spanRef} aria-hidden="true">
        {first}
      </span>
      <span className="sr-only">{first}</span>
    </>
  );
}
