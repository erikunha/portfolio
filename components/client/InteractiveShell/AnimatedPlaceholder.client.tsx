'use client';

import { useEffect, useRef } from 'react';
import { SHELL_LIMITS, type ShellUi } from '@/content/shell-ui';
import { readMotion } from '@/lib/motion';
import { runPhraseLoop } from '@/lib/typewriter';

const PLACEHOLDER_TIMING = {
  typeMs: SHELL_LIMITS.placeholderTypeMs,
  holdMs: SHELL_LIMITS.placeholderHoldMs,
  backMs: SHELL_LIMITS.placeholderBackMs,
  pauseMs: SHELL_LIMITS.placeholderPauseMs,
} as const;

export function AnimatedPlaceholder({ ui }: { ui: ShellUi }) {
  const textRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const node = textRef.current;
    if (!node) return;
    if (!readMotion()) {
      node.textContent = ui.placeholder;
      return;
    }
    const loop = runPhraseLoop({
      phrases: ui.suggestions,
      timing: PLACEHOLDER_TIMING,
      onText: (text) => {
        node.textContent = text;
      },
    });
    return loop.cancel;
  }, [ui]);
  return (
    <span className="shell-placeholder" aria-hidden="true" data-testid="shell-placeholder">
      <span ref={textRef} />
      <span className="shell-cursor" data-testid="shell-cursor" />
    </span>
  );
}

export function StaticPlaceholder({ ui }: { ui: ShellUi }) {
  return (
    <span className="shell-placeholder" aria-hidden="true" data-testid="shell-placeholder">
      {ui.placeholder}
    </span>
  );
}
