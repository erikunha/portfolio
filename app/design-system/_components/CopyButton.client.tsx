'use client';
import { useState } from 'react';
import styles from './CopyButton.module.css';

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button type="button" className={styles.root} onClick={copy} aria-label="Copy code">
      {copied ? 'COPIED' : 'COPY'}
    </button>
  );
}
