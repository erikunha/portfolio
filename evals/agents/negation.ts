const DECLINE =
  /\b(?:not|never|no longer|won'?t|wouldn'?t|don'?t|doesn'?t|didn'?t|avoid|skip|instead of|rather than)\b/i;

const HARD_BOUNDARY = /[!?;,\n]/;

// A period ends a clause only when whitespace or the end of input follows it; the
// dots in `.github/workflows` and `ci.yml` are inside tokens the subject matches.
function isBoundary(text: string, i: number): boolean {
  const ch = text[i] as string;
  if (HARD_BOUNDARY.test(ch)) return true;
  if (ch !== '.') return false;
  const next = text[i + 1];
  return next === undefined || /\s/.test(next);
}

function clauseBefore(output: string, matchIndex: number): string {
  const preceding = output.slice(0, matchIndex);
  for (let i = preceding.length - 1; i >= 0; i--) {
    if (isBoundary(preceding, i)) return preceding.slice(i + 1);
  }
  return preceding;
}

export function declinesWithin(output: string, subject: RegExp): boolean {
  const scan = new RegExp(subject.source, `${subject.flags.replace('g', '')}g`);
  let sawMatch = false;
  for (const match of output.matchAll(scan)) {
    sawMatch = true;
    if (!DECLINE.test(clauseBefore(output, match.index))) return false;
  }
  return sawMatch;
}
