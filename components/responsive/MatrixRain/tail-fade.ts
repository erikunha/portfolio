const TAIL_ALPHA_PATTERN = /^((?:rgb|hsl)a\((?:[^,)]+,){3}\s*)([\d.]+)(\s*\))$/i;
const ALPHA_DIGITS = 3;

export function scaleTailFade(tail: string, ticks: number): string {
  if (ticks === 1) return tail;
  const match = TAIL_ALPHA_PATTERN.exec(tail);
  if (!match) return tail;
  const alpha = Number(match[2]);
  const scaled = Number((1 - (1 - alpha) ** ticks).toFixed(ALPHA_DIGITS));
  return `${match[1]}${scaled}${match[3]}`;
}
