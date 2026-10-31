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
  const timers: ReturnType<typeof setTimeout>[] = [];

  function later(fn: () => void, ms: number) {
    if (cancelled) return;
    timers.push(setTimeout(fn, ms));
  }

  function typeDialog() {
    let phraseIdx = 0;
    let charIdx = 0;
    let phase: 'type' | 'hold' | 'back' = 'type';

    function tick() {
      if (cancelled) return;
      const phrase = dialog[phraseIdx % dialog.length] ?? '';
      if (phase === 'type') {
        charIdx++;
        outEl.textContent = phrase.slice(0, charIdx);
        if (charIdx >= phrase.length) {
          phase = 'hold';
          later(tick, timing.holdMs);
        } else {
          later(tick, timing.typeMs);
        }
      } else if (phase === 'hold') {
        phase = 'back';
        later(tick, timing.backMs);
      } else {
        charIdx--;
        outEl.textContent = phrase.slice(0, charIdx);
        if (charIdx <= 0) {
          phraseIdx = (phraseIdx + 1) % dialog.length;
          phase = 'type';
          later(tick, timing.interMs);
        } else {
          later(tick, timing.backMs);
        }
      }
    }

    tick();
  }

  function typeCommand() {
    let charIdx = 0;

    function step() {
      if (cancelled) return;
      charIdx++;
      cmdEl.textContent = command.slice(0, charIdx);
      if (charIdx >= command.length) {
        later(typeDialog, timing.interMs);
        return;
      }
      later(step, timing.cmdMs + Math.random() * timing.cmdJitter);
    }

    step();
  }

  typeCommand();

  return () => {
    cancelled = true;
    timers.forEach(clearTimeout);
  };
}
