'use client';

import { useEffect, useRef, useState } from 'react';
import { IconCopy } from '../LinkIcons';

const FEEDBACK_MS = 1_800;

const COPY_OUTCOME = { idle: 'idle', done: 'done', failed: 'failed' } as const;

type CopyOutcome = (typeof COPY_OUTCOME)[keyof typeof COPY_OUTCOME];

export function CopyLinkButton({
  url,
  idleLabel,
  doneLabel,
  failedLabel,
}: {
  url: string;
  idleLabel: string;
  doneLabel: string;
  failedLabel: string;
}) {
  const [outcome, setOutcome] = useState<CopyOutcome>(COPY_OUTCOME.idle);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  function announce(next: CopyOutcome) {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    setOutcome(next);
    timerRef.current = setTimeout(() => setOutcome(COPY_OUTCOME.idle), FEEDBACK_MS);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
    } catch (err) {
      if (!(err instanceof DOMException)) throw err;
      announce(COPY_OUTCOME.failed);
      return;
    }
    announce(COPY_OUTCOME.done);
  }

  const label = {
    [COPY_OUTCOME.idle]: idleLabel,
    [COPY_OUTCOME.done]: doneLabel,
    [COPY_OUTCOME.failed]: failedLabel,
  }[outcome];

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center gap-[7px] border border-primary-subtle px-3 min-h-11 w-full bg-transparent text-primary-500 font-mono font-bold text-xs tracking-[0.1em] uppercase cursor-pointer transition-[box-shadow,background] duration-200 ease-out hover:shadow-[0_0_12px_var(--color-primary-500)] hover:bg-primary-quiet focus-visible:outline-2 focus-visible:outline-primary-500 focus-visible:outline-offset-2"
    >
      <span className="text-primary-400" aria-hidden="true">
        <IconCopy />
      </span>
      <span aria-hidden="true">{outcome === COPY_OUTCOME.idle ? label : `$ ${label}`}</span>
      <span className="sr-only" role="status">
        {label}
      </span>
    </button>
  );
}
