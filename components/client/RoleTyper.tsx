'use client';

import { useEffect, useRef } from 'react';
import { readMotion } from '@/lib/motion';

const ROLES = ['Senior', 'Staff', 'Principal'];
const TYPE_MS = 80;
const HOLD_MS = 2000;
const BACK_MS = 40;
const INTER_MS = 300;

export function RoleTyper() {
  const spanRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el: HTMLSpanElement | null = spanRef.current;
    if (!el) return;
    const node = el;

    if (!readMotion()) return;

    let cancelled = false;
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
          setTimeout(tick, HOLD_MS);
        } else {
          setTimeout(tick, TYPE_MS);
        }
      } else if (phase === 'hold') {
        phase = 'back';
        setTimeout(tick, BACK_MS);
      } else {
        charIdx--;
        node.textContent = charIdx > 0 ? `[${role.slice(0, charIdx)}]` : '[]';
        if (charIdx <= 0) {
          roleIdx++;
          charIdx = 0;
          phase = 'type';
          setTimeout(tick, INTER_MS);
        } else {
          setTimeout(tick, BACK_MS);
        }
      }
    }

    tick();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <span className="pill" ref={spanRef} aria-label="Senior, Staff, or Principal" role="img">
      [Senior]
    </span>
  );
}
