const BREAKPOINT_MIN_WIDTH: Record<string, number> = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
};
const DISPLAY_UTILITIES = new Set([
  'block',
  'contents',
  'flow-root',
  'flex',
  'grid',
  'inline',
  'inline-block',
  'inline-flex',
  'inline-grid',
  'inline-table',
  'list-item',
  'table',
]);

export function isHiddenAtWidth(className: string, width: number): boolean {
  const classes = className.split(/\s+/).filter(Boolean);
  let hidden = classes.includes('hidden');
  for (const [breakpoint, minWidth] of Object.entries(BREAKPOINT_MIN_WIDTH).sort(
    (a, b) => a[1] - b[1],
  )) {
    if (minWidth > width) continue;
    for (const token of classes) {
      if (!token.startsWith(`${breakpoint}:`)) continue;
      const utility = token.slice(breakpoint.length + 1);
      if (utility === 'hidden') hidden = true;
      else if (DISPLAY_UTILITIES.has(utility)) hidden = false;
    }
  }
  return hidden;
}
