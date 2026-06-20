// lib/eval/ab.ts
//
// A/B success-rate delta for the agent-eval harness (--ab mode, C-c.3). Given
// two arms of per-case Monte-Carlo stats (control vs treatment), abDelta()
// reports the success-rate change the treatment causes:
//   - controlMean / treatmentMean: the corpus-level success rate per arm
//     (the mean of the per-case mean pass rates).
//   - deltaMean (treatment - control): negative means the treatment is worse.
//   - deltaStddev: pooled spread across both arms, the noise floor the delta
//     must clear to be meaningful (a flaky corpus has a wide deltaStddev).
//   - degraded: true only when the treatment is meaningfully WORSE than control,
//     i.e. the drop exceeds a noise threshold. A drop within noise, or any
//     improvement, is never flagged degraded.
//
// This is the mechanism that turns "is this CLAUDE.md rule load-bearing" into a
// measurement: prune the rule in the treatment arm and read the delta. A
// load-bearing rule produces a non-zero negative delta with degraded:true.
//
// Pure: no clock, no IO, no randomness. The arms are the full sample for this
// run, so the population form of variance is used (see lib/eval/montecarlo.ts).

import type { CaseStats } from '@/lib/eval/montecarlo';

export type AbResult = {
  controlMean: number;
  treatmentMean: number;
  deltaMean: number; // treatment - control
  deltaStddev: number; // pooled
  degraded: boolean; // treatment meaningfully worse than control
};

// A drop smaller than this (in success-rate points) is treated as noise, not a
// real regression. Keeps a 0.01 jitter from tripping `degraded` while a 0.3
// drop on a pruned-rule treatment clearly does.
const DEGRADED_NOISE_THRESHOLD = 0.05;

function meanOf(stats: CaseStats[]): number {
  if (stats.length === 0) return 0;
  return stats.reduce((sum, s) => sum + s.mean, 0) / stats.length;
}

// Pooled spread: the root of the mean per-case population variance across BOTH
// arms. Zero when every case in both arms is deterministic (all-pass / all-fail);
// widens as either arm becomes flaky.
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
  // Degraded only on a real downward move: the drop must exceed the noise
  // threshold. An improvement (deltaMean >= 0) is never degraded.
  const degraded = deltaMean < -DEGRADED_NOISE_THRESHOLD;
  return { controlMean, treatmentMean, deltaMean, deltaStddev, degraded };
}
