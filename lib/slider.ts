const LARGE_STEP_FACTOR = 5;
const FULL_PERCENT = 100;

export const PERCENT_RANGE = { min: 0, max: FULL_PERCENT } as const;

type SliderRange = { value: number; min: number; max: number; step: number };

export function sliderValueForKey(key: string, { value, min, max, step }: SliderRange) {
  const clamp = (next: number) => Math.max(min, Math.min(max, next));
  switch (key) {
    case 'ArrowRight':
    case 'ArrowUp':
      return clamp(value + step);
    case 'ArrowLeft':
    case 'ArrowDown':
      return clamp(value - step);
    case 'PageUp':
      return clamp(value + step * LARGE_STEP_FACTOR);
    case 'PageDown':
      return clamp(value - step * LARGE_STEP_FACTOR);
    case 'Home':
      return min;
    case 'End':
      return max;
    default:
      return null;
  }
}

export function percentAlong(element: Element | null, clientX: number): number | null {
  const rect = element?.getBoundingClientRect();
  if (!rect || rect.width === 0) return null;
  return Math.max(
    0,
    Math.min(FULL_PERCENT, Math.round(((clientX - rect.left) / rect.width) * FULL_PERCENT)),
  );
}
