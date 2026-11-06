'use client';

import { useEffect, useRef } from 'react';
import { SHELL_LIMITS, type ShellUi } from '@/content/shell-ui';
import { readMotion } from '@/lib/motion';
import { subscribeMotion } from '@/lib/motion-change';
import { pauseWhileHidden } from '@/lib/pause-when-hidden';
import { createPauseControl, type PhraseLoop, runPhraseLoop } from '@/lib/typewriter';

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
    const typed: HTMLSpanElement = node;
    let loop: PhraseLoop | undefined;
    const pauses = createPauseControl((paused) => {
      if (paused) loop?.pause();
      else loop?.resume();
    });

    function render(motionOn: boolean) {
      if (!motionOn) {
        typed.textContent = ui.placeholder;
        return;
      }
      loop = runPhraseLoop({
        phrases: ui.suggestions,
        timing: PLACEHOLDER_TIMING,
        onText: (text) => {
          typed.textContent = text;
        },
        startPaused: pauses.isPaused(),
      });
    }

    render(readMotion());
    const unwatch = pauseWhileHidden(typed, pauses);
    const unsubscribeMotion = subscribeMotion((on) => {
      loop?.cancel();
      typed.textContent = '';
      render(on);
    });
    return () => {
      unsubscribeMotion();
      unwatch();
      loop?.cancel();
    };
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
