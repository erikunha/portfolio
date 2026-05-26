'use client';

import { useEffect, useRef } from 'react';
import { readMotion } from '@/lib/motion';

const ROLES = ['Senior', 'Staff', 'Principal'];
const TYPE_MS = 80;
const HOLD_MS = 2000;
const BACK_MS = 40;
const INTER_MS = 300;

export function RoleTyper({ className }: { className?: string | undefined }) {
  const spanRef = useRef<HTMLSpanElement>(null);
  const liveRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = spanRef.current;
    if (!el) return;
    const node: HTMLSpanElement = el;

    let cancelled = false;
    let timerId: ReturnType<typeof setTimeout> | undefined;
    let roleIdx = 0;
    let charIdx = 0;
    let phase: 'type' | 'hold' | 'back' = 'type';

    function tick() {
      if (cancelled) return;
      const role = ROLES[roleIdx % ROLES.length] ?? '';
      if (phase === 'type') {
        charIdx++;
        node.textContent = `[${role.slice(0, charIdx)}]`;
        if (charIdx >= role.length) {
          phase = 'hold';
          // Announce only the completed role, not each character
          if (liveRef.current) liveRef.current.textContent = role;
          timerId = setTimeout(tick, HOLD_MS);
        } else {
          timerId = setTimeout(tick, TYPE_MS);
        }
      } else if (phase === 'hold') {
        phase = 'back';
        timerId = setTimeout(tick, BACK_MS);
      } else {
        charIdx--;
        node.textContent = charIdx > 0 ? `[${role.slice(0, charIdx)}]` : '[]';
        if (charIdx <= 0) {
          roleIdx++;
          charIdx = 0;
          phase = 'type';
          timerId = setTimeout(tick, INTER_MS);
        } else {
          timerId = setTimeout(tick, BACK_MS);
        }
      }
    }

    if (readMotion()) tick();

    const onMotionChange = (e: Event) => {
      const detail = (e as CustomEvent).detail as unknown;
      if (!detail || typeof (detail as { on?: unknown }).on !== 'boolean') return;
      const on = (detail as { on: boolean }).on;
      if (!on) {
        cancelled = true;
        clearTimeout(timerId);
      } else if (cancelled) {
        cancelled = false;
        clearTimeout(timerId);
        roleIdx = 0;
        charIdx = 0;
        phase = 'type';
        tick();
      }
    };
    window.addEventListener('motionchange', onMotionChange);

    return () => {
      cancelled = true;
      clearTimeout(timerId);
      window.removeEventListener('motionchange', onMotionChange);
    };
  }, []);

  return (
    <>
      <span className={className} ref={spanRef} aria-hidden="true">
        [Senior]
      </span>
      <span className="sr-only" ref={liveRef} role="status" aria-live="polite">
        Senior
      </span>
    </>
  );
}
