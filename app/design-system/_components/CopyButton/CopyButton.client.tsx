'use client';
import { useEffect, useRef, useState } from 'react';
import styles from './CopyButton.module.css';

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
    <button type="button" className={styles.root} onClick={copy}>
      {copied ? 'COPIED' : 'COPY'}
    </button>
  );
}
