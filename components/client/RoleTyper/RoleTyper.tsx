'use client';

import { useEffect, useRef } from 'react';
import { ROLE } from '@/content/role';
import { cn } from '@/lib/cn';
import { readMotion } from '@/lib/motion';
import { subscribeMotion } from '@/lib/motion-change';
import { typeOut } from '@/lib/typewriter';

const TYPE_MS = 80;

export function RoleTyper({ className }: { className?: string | undefined }) {
  const pillRef = useRef<HTMLSpanElement>(null);
  const liveRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const pill = pillRef.current;
    if (!pill) return;
    const node: HTMLSpanElement = pill;

    let cancelled = !readMotion();
    let stopTyping: (() => void) | undefined;

    function start() {
      cancelled = false;
      node.textContent = '[]';
      stopTyping = typeOut(ROLE, {
        stepMs: TYPE_MS,
        onText: (text) => {
          node.textContent = `[${text}]`;
        },
        onDone: () => {
          if (liveRef.current) liveRef.current.textContent = ROLE;
        },
      });
    }

    if (!cancelled) start();

    const unsubscribe = subscribeMotion((on) => {
      if (!on) {
        cancelled = true;
        stopTyping?.();
      } else if (cancelled) {
        start();
      }
    });

    return () => {
      cancelled = true;
      stopTyping?.();
      unsubscribe();
    };
  }, []);

  return (
    <>
      <span className="role-typer" aria-hidden="true">
        <span className={cn(className, 'role-typer-sizer')} data-role-text={`[${ROLE}]`} />
        <span
          className={className}
          data-role-pill="true"
          ref={pillRef}
          aria-hidden="true"
        >{`[${ROLE}]`}</span>
      </span>
      <span className="sr-only" ref={liveRef} role="status" aria-live="polite">
        {ROLE}
      </span>
    </>
  );
}
