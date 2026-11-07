export const ASCII_BAR = { cells: 20, filled: '#', empty: '.' } as const;

export function asciiBar(fraction: number, cells: number = ASCII_BAR.cells): string {
  const clamped = Math.min(1, Math.max(0, fraction));
  const filled = Math.round(clamped * cells);
  return ASCII_BAR.filled.repeat(filled) + ASCII_BAR.empty.repeat(cells - filled);
}
