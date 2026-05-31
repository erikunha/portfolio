'use client';
import { useEffect, useRef, useState } from 'react';

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      setCopied(true);
      timerRef.current = setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      // Clipboard unavailable: insecure context or permission denied.
      // DOMException is the only error writeText is specified to throw — re-throw anything else.
      if (!(err instanceof DOMException)) throw err;
    }
  }

  return (
    <button
      type="button"
      className="font-mono text-xs tracking-widest text-text-muted bg-transparent border border-border-default px-2 py-0.5 cursor-pointer hover:text-signal focus-visible:outline-2 focus-visible:outline-signal focus-visible:outline-offset-2"
      onClick={copy}
    >
      {copied ? 'COPIED' : 'COPY'}
    </button>
  );
}
