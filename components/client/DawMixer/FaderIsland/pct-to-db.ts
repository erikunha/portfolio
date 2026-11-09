export function pctToDb(pct: number): string {
  if (pct === 0) return '-∞';
  const n = pct / 100;
  if (n <= 0.75) {
    const db = 20 * Math.log10(n / 0.75);
    return db.toFixed(1);
  }
  const db = ((n - 0.75) / 0.25) * 6;
  return `+${db.toFixed(1)}`;
}
