'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/cn';
import { readMotion } from '@/lib/motion';

export const ROLES = ['Senior'];
const TYPE_MS = 80;

export function RoleTyper({ className }: { className?: string | undefined }) {
  const pillRef = useRef<HTMLSpanElement>(null);
  const liveRef = useRef<HTMLSpanElement>(null);
  const role = ROLES[0] ?? '';

  useEffect(() => {
    const pill = pillRef.current;
    if (!pill) return;
    const node: HTMLSpanElement = pill;

    let cancelled = !readMotion();
    let timerId: ReturnType<typeof setTimeout> | undefined;
    let charIdx = 0;

    function type() {
      if (cancelled) return;
      charIdx++;
      node.textContent = `[${role.slice(0, charIdx)}]`;
      if (charIdx >= role.length) {
        if (liveRef.current) liveRef.current.textContent = role;
        return;
      }
      timerId = setTimeout(type, TYPE_MS);
    }

    function start() {
      cancelled = false;
      charIdx = 0;
      node.textContent = '[]';
      type();
    }

    if (!cancelled) start();

    const onMotionChange = (e: Event) => {
      const detail = (e as CustomEvent).detail as unknown;
      if (!detail || typeof (detail as { on?: unknown }).on !== 'boolean') return;
      const on = (detail as { on: boolean }).on;
      if (!on) {
        cancelled = true;
        clearTimeout(timerId);
      } else if (cancelled) {
        start();
      }
    };
    window.addEventListener('motionchange', onMotionChange);

    return () => {
      cancelled = true;
      clearTimeout(timerId);
      window.removeEventListener('motionchange', onMotionChange);
    };
  }, [role]);

  return (
    <>
      <span className="role-typer" aria-hidden="true">
        <span className={cn(className, 'role-typer-sizer')} data-role-text={`[${role}]`} />
        <span
          className={className}
          data-role-pill="true"
          ref={pillRef}
          aria-hidden="true"
        >{`[${role}]`}</span>
      </span>
      <span className="sr-only" ref={liveRef} role="status" aria-live="polite">
        {role}
      </span>
    </>
  );
}
