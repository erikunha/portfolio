// A "subsystem" is the containing DIRECTORY (capped at two segments), not the file. Counting
// each root-level file as its own subsystem (the previous behaviour) auto-reds any change that
// touches several root config/docs — a dep bump (package.json + lockfile) plus DECISIONS.md and
// a config file already hit the red threshold of 5, which is breadth the PR does not actually
// have. Root files collapse to one `(root)` bucket; a file one level deep counts as its dir.
export function toSubsystem(filePath: string): string {
  const parts = filePath.split('/');
  if (parts.length === 1) return '(root)';
  return parts.slice(0, -1).slice(0, 2).join('/');
}
