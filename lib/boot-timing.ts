import { type PhraseLoop, runPhraseLoop, typeOut } from './typewriter';

export type BootTiming = {
  cmdMs: number;
  cmdJitter: number;
  typeMs: number;
  holdMs: number;
  backMs: number;
  interMs: number;
};

type TypeThenLoopOptions = {
  command: string;
  dialog: readonly string[];
  timing: BootTiming;
  handoffMs: number;
  onCommandText: (text: string) => void;
  onCommandDone?: (() => void) | undefined;
  onDialogStart?: (() => void) | undefined;
  onDialogText: (text: string) => void;
  onWrap?: (() => void) | undefined;
  startPaused?: (() => boolean) | undefined;
};

export type TypeThenLoop = {
  cancel: () => void;
  pause: () => void;
  resume: () => void;
};

export function typeThenLoop({
  command,
  dialog,
  timing,
  handoffMs,
  onCommandText,
  onCommandDone,
  onDialogStart,
  onDialogText,
  onWrap,
  startPaused,
}: TypeThenLoopOptions): TypeThenLoop {
  let cancelled = false;
  let handoff: ReturnType<typeof setTimeout> | undefined;
  let loop: PhraseLoop | undefined;

  const cancelTyping = typeOut(command, {
    stepMs: () => timing.cmdMs + Math.random() * timing.cmdJitter,
    onText: onCommandText,
    onDone: () => {
      if (cancelled) return;
      onCommandDone?.();
      handoff = setTimeout(() => {
        if (cancelled) return;
        onDialogStart?.();
        loop = runPhraseLoop({
          phrases: dialog,
          timing: {
            typeMs: timing.typeMs,
            holdMs: timing.holdMs,
            backMs: timing.backMs,
            pauseMs: timing.interMs,
          },
          onText: onDialogText,
          ...(onWrap ? { onWrap } : {}),
          startPaused: startPaused?.() ?? false,
        });
      }, handoffMs);
    },
  });

  return {
    cancel: () => {
      cancelled = true;
      cancelTyping();
      clearTimeout(handoff);
      loop?.cancel();
    },
    pause: () => loop?.pause(),
    resume: () => loop?.resume(),
  };
}
