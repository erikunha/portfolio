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

type PlaceholderProps = { ui: ShellUi; compact?: boolean };

function restingText(ui: ShellUi, compact: boolean): string {
  return compact ? ui.mobilePlaceholder : ui.placeholder;
}

export function AnimatedPlaceholder({ ui, compact = false }: PlaceholderProps) {
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
        typed.textContent = restingText(ui, compact);
        return;
      }
      loop = runPhraseLoop({
        phrases: compact ? ui.mobileSuggestions : ui.suggestions,
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
  }, [ui, compact]);
  return (
    <span className="shell-placeholder" aria-hidden="true" data-testid="shell-placeholder">
      <span ref={textRef} className="shell-placeholder-text" />
      <span className="shell-cursor" data-testid="shell-cursor" />
    </span>
  );
}

export function StaticPlaceholder({ ui, compact = false }: PlaceholderProps) {
  return (
    <span className="shell-placeholder" aria-hidden="true" data-testid="shell-placeholder">
      <span className="shell-placeholder-text">{restingText(ui, compact)}</span>
    </span>
  );
}
