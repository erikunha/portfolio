export const CRT_BASE_TICK_MS = 1000 / 22;
export const CRT_EFFECT_SELECTOR = '.crt-noise, .crt-flicker, .crt-scan-beam';

export function createEffectStepper() {
  let lastTs: number | null = null;
  let phaseMs = 0;
  let origins = new Map<Animation, number>();

  return {
    step(ts: number) {
      if (lastTs !== null) phaseMs += ts - lastTs;
      lastTs = ts;
      for (const el of document.querySelectorAll<HTMLElement>(CRT_EFFECT_SELECTOR)) {
        for (const animation of el.getAnimations?.() ?? []) {
          const origin = origins.get(animation) ?? Number(animation.currentTime ?? 0);
          origins.set(animation, origin);
          if (phaseMs !== 0) animation.currentTime = origin + phaseMs;
        }
      }
    },
    hold() {
      lastTs = null;
      phaseMs = 0;
      origins = new Map();
    },
  };
}
