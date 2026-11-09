export function longestCopy(copies: readonly string[]): string {
  return copies.reduce(
    (winner, candidate) => (candidate.length > winner.length ? candidate : winner),
    '',
  );
}
