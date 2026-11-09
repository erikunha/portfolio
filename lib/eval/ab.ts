import type { CaseStats } from '@/lib/eval/montecarlo';

export type AbResult = {
  controlMean: number;
  treatmentMean: number;
  deltaMean: number;
  deltaStddev: number;
  deltaStderr: number;
  degraded: boolean;
};

const DEGRADED_NOISE_THRESHOLD = 0.05;
const DEGRADED_Z_SCORE = 1.645;

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

function varianceOfArmMean(stats: CaseStats[]): number {
  if (stats.length === 0) return 0;
  const sumOfCaseVariances = stats.reduce((sum, s) => {
    const sampleVariance = s.runs > 1 ? (s.variance * s.runs) / (s.runs - 1) : 0;
    return sum + (s.runs > 0 ? sampleVariance / s.runs : 0);
  }, 0);
  return sumOfCaseVariances / stats.length ** 2;
}

export function abDelta(control: CaseStats[], treatment: CaseStats[]): AbResult {
  const controlMean = meanOf(control);
  const treatmentMean = meanOf(treatment);
  const deltaMean = treatmentMean - controlMean;
  const deltaStddev = pooledStddev(control, treatment);
  const deltaStderr = Math.sqrt(varianceOfArmMean(control) + varianceOfArmMean(treatment));
  const degraded =
    deltaMean < -DEGRADED_NOISE_THRESHOLD && -deltaMean > DEGRADED_Z_SCORE * deltaStderr;
  return { controlMean, treatmentMean, deltaMean, deltaStddev, deltaStderr, degraded };
}
