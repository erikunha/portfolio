'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/cn';
import { readMotion } from '@/lib/motion';
import { subscribeMotion } from '@/lib/motion-change';
import { typeOut } from '@/lib/typewriter';

const TYPE_MS = 80;

export function RoleTyper({ role, className }: { role: string; className?: string | undefined }) {
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
      stopTyping = typeOut(role, {
        stepMs: TYPE_MS,
        onText: (text) => {
          node.textContent = `[${text}]`;
        },
        onDone: () => {
          if (liveRef.current) liveRef.current.textContent = role;
        },
      });
    }

    if (!cancelled) start();

    const unsubscribe = subscribeMotion((on) => {
      if (!on) {
        cancelled = true;
        stopTyping?.();
        node.textContent = `[${role}]`;
      } else if (cancelled) {
        start();
      }
    });

    return () => {
      cancelled = true;
      stopTyping?.();
      unsubscribe();
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
