export const VITALS_ENDPOINT = '/api/vitals';

export const VITAL_NAME = { lcp: 'LCP', inp: 'INP', cls: 'CLS' } as const;

export type VitalName = (typeof VITAL_NAME)[keyof typeof VITAL_NAME];

export const VITAL_NAMES: readonly VitalName[] = Object.values(VITAL_NAME);

export const VITAL_RATING = {
  good: 'good',
  needsImprovement: 'needs-improvement',
  poor: 'poor',
} as const;

export type VitalRating = (typeof VITAL_RATING)[keyof typeof VITAL_RATING];

const VITAL_THRESHOLDS: Record<VitalName, readonly [good: number, poor: number]> = {
  LCP: [2500, 4000],
  INP: [200, 500],
  CLS: [0.1, 0.25],
};

export function rateVital(name: VitalName, value: number): VitalRating {
  const [good, poor] = VITAL_THRESHOLDS[name];
  if (value <= good) return VITAL_RATING.good;
  return value <= poor ? VITAL_RATING.needsImprovement : VITAL_RATING.poor;
}

export const INTERACTION_TYPES = ['pointer', 'keyboard'] as const;

export const LOAD_STATES = [
  'loading',
  'dom-interactive',
  'dom-content-loaded',
  'complete',
] as const;

export const NAVIGATION_TYPES = [
  'navigate',
  'reload',
  'back-forward',
  'back-forward-cache',
  'prerender',
  'restore',
] as const;
