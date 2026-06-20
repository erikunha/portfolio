// lib/eval/montecarlo.ts
//
// Monte-Carlo per-case aggregation for the agent/prompt-eval harness
// (scripts/agent-eval.ts, C-b.7). Running a prompt N times against one case
// yields N boolean run-results; this collapses them into two complementary
// rates plus the spread:
//   - passAtK  (P(>=1 pass)) — DISCRIMINATION: did the prompt EVER succeed?
//   - passHatK (P(all pass))  — CONSISTENCY: did it ALWAYS succeed?
// A high passAtK with a low passHatK is the signal that a rule is flaky, not
// load-bearing — the exact property the harness exists to measure.
//
// `variance` is the POPULATION variance of the 0/1 pass indicator (divide by N,
// not N-1): these N runs ARE the full sample for this case under this prompt,
// not a sample drawn from a larger one, so the population form is correct and
// makes an all-pass / all-fail case report exactly 0 spread.

export type CaseStats = {
  id: string;
  runs: number;
  passes: number;
  passAtK: number; // P(>=1 pass) — discrimination
  passHatK: number; // P(all pass) — consistency
  mean: number;
  variance: number;
  stddev: number;
};

export function aggregateCase(id: string, runResults: boolean[]): CaseStats {
  const runs = runResults.length;
  const passes = runResults.reduce((n, r) => n + (r ? 1 : 0), 0);

  // Empty guard: no runs means no signal. Return zeros rather than dividing by
  // zero (NaN would poison the aggregate and any downstream gate comparison).
  if (runs === 0) {
    return { id, runs: 0, passes: 0, passAtK: 0, passHatK: 0, mean: 0, variance: 0, stddev: 0 };
  }

  const mean = passes / runs;
  // Population variance of the 0/1 indicator: E[x^2] - mean^2. For a 0/1
  // variable x^2 === x, so E[x^2] === mean, giving the closed form mean*(1-mean).
  const variance = mean * (1 - mean);
  const stddev = Math.sqrt(variance);

  return {
    id,
    runs,
    passes,
    passAtK: passes >= 1 ? 1 : 0,
    passHatK: passes === runs ? 1 : 0,
    mean,
    variance,
    stddev,
  };
}
