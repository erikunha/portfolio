import type { BootCtrl } from '@/lib/boot-animation';
import { type BootTiming, typeThenLoop } from '@/lib/boot-timing';
import { createPauseControl } from '@/lib/typewriter';

export function runMobileBoot(
  cmdEl: HTMLSpanElement,
  outEl: HTMLSpanElement,
  command: string,
  dialog: readonly string[],
  timing: BootTiming,
): BootCtrl {
  const dialogPause = createPauseControl((paused) => {
    if (paused) run.pause();
    else run.resume();
  });

  const run = typeThenLoop({
    command,
    dialog,
    timing,
    handoffMs: timing.interMs,
    onCommandText: (text) => {
      cmdEl.textContent = text;
    },
    onDialogText: (text) => {
      outEl.textContent = text;
    },
    startPaused: dialogPause.isPaused,
  });

  return {
    cancel: run.cancel,
    pauseDialog: dialogPause.pause,
    resumeDialog: dialogPause.resume,
  };
}
