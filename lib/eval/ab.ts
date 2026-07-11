import type { CaseStats } from '@/lib/eval/montecarlo';

export type AbResult = {
  controlMean: number;
  treatmentMean: number;
  deltaMean: number;
  deltaStddev: number;
  degraded: boolean;
};

const DEGRADED_NOISE_THRESHOLD = 0.05;

function meanOf(stats: CaseStats[]): number {
  if (stats.length === 0) return 0;
  return stats.reduce((sum, s) => sum + s.mean, 0) / stats.length;
}

function pooledStddev(control: CaseStats[], treatment: CaseStats[]): number {
  const all = [...control, ...treatment];
  if (all.length === 0) return 0;
  const meanVariance = all.reduce((sum, s) => sum + s.variance, 0) / all.length;
  return Math.sqrt(meanVariance);
}

export function abDelta(control: CaseStats[], treatment: CaseStats[]): AbResult {
  const controlMean = meanOf(control);
  const treatmentMean = meanOf(treatment);
  const deltaMean = treatmentMean - controlMean;
  const deltaStddev = pooledStddev(control, treatment);
  const degraded = deltaMean < -DEGRADED_NOISE_THRESHOLD;
  return { controlMean, treatmentMean, deltaMean, deltaStddev, degraded };
}
