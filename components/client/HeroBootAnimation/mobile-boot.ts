import { type PhraseLoop, runPhraseLoop, typeOut } from '@/lib/typewriter';

export type MobileBootTiming = {
  cmdMs: number;
  cmdJitter: number;
  typeMs: number;
  holdMs: number;
  backMs: number;
  interMs: number;
};

export function runMobileBoot(
  cmdEl: HTMLSpanElement,
  outEl: HTMLSpanElement,
  command: string,
  dialog: readonly string[],
  timing: MobileBootTiming,
): () => void {
  let cancelled = false;
  let handoff: ReturnType<typeof setTimeout> | undefined;
  let loop: PhraseLoop | undefined;

  const cancelTyping = typeOut(command, {
    stepMs: () => timing.cmdMs + Math.random() * timing.cmdJitter,
    onText: (text) => {
      cmdEl.textContent = text;
    },
    onDone: () => {
      if (cancelled) return;
      handoff = setTimeout(() => {
        loop = runPhraseLoop({
          phrases: dialog,
          timing: {
            typeMs: timing.typeMs,
            holdMs: timing.holdMs,
            backMs: timing.backMs,
            pauseMs: timing.interMs,
          },
          onText: (text) => {
            outEl.textContent = text;
          },
        });
      }, timing.interMs);
    },
  });

  return () => {
    cancelled = true;
    cancelTyping();
    clearTimeout(handoff);
    loop?.cancel();
  };
}
