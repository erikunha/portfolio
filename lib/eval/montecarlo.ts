export type CaseStats = {
  id: string;
  runs: number;
  passes: number;
  passAtK: number;
  passHatK: number;
  mean: number;
  variance: number;
  stddev: number;
};

export function aggregateCase(id: string, runResults: boolean[]): CaseStats {
  const runs = runResults.length;
  const passes = runResults.reduce((n, r) => n + (r ? 1 : 0), 0);

  if (runs === 0) {
    return { id, runs: 0, passes: 0, passAtK: 0, passHatK: 0, mean: 0, variance: 0, stddev: 0 };
  }

  const mean = passes / runs;
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
