const DECLINE =
  /\b(?:not|never|no longer|won'?t|wouldn'?t|don'?t|doesn'?t|didn'?t|avoid|skip|instead of|rather than)\b/i;

export function declinesWithin(output: string, subject: RegExp, window = 60): boolean {
  const match = subject.exec(output);
  if (match === null) return false;
  const start = Math.max(0, match.index - window);
  return DECLINE.test(output.slice(start, match.index));
}
