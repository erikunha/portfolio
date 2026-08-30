'use client';

import { useEffect, useRef, useState } from 'react';
import { IconCopy } from '../LinkIcons';

const FEEDBACK_MS = 1_800;

export function CopyLinkButton({
  url,
  idleLabel,
  doneLabel,
}: {
  url: string;
  idleLabel: string;
  doneLabel: string;
}) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
    } catch (err) {
      if (!(err instanceof DOMException)) throw err;
      return;
    }
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    setCopied(true);
    timerRef.current = setTimeout(() => setCopied(false), FEEDBACK_MS);
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center gap-[7px] border border-primary-subtle px-[14px] min-h-11 w-full bg-transparent text-primary-500 font-mono font-bold text-xs tracking-[0.1em] uppercase cursor-pointer transition-[box-shadow,background] duration-200 ease-out hover:shadow-[0_0_12px_var(--color-primary-500)] hover:bg-primary-quiet focus-visible:outline-2 focus-visible:outline-primary-500 focus-visible:outline-offset-2"
    >
      <span className="text-primary-400" aria-hidden="true">
        <IconCopy />
      </span>
      <span aria-hidden="true">{copied ? `$ ${doneLabel}` : idleLabel}</span>
      <span className="sr-only" role="status">
        {copied ? doneLabel : idleLabel}
      </span>
    </button>
  );
}
