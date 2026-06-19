// lib/eval/percentile.ts
//
// Nearest-rank percentile, extracted verbatim from scripts/ask-eval.ts. Returns
// an actual observed sample — the smallest value at or above the p-th rank — so
// p50/p95 are real latencies from the run, never a value interpolated between
// two samples.
export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)] ?? 0;
}
