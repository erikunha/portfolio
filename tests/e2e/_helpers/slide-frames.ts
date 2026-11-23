export const FRAME_MS = 17;
export const STEADY_FRAME_GAP_MS = 2 * FRAME_MS;
export const MIN_LIVE_POSITIONS = 4;
export const MIN_EXIT_TRAVEL = 0.75;

export type Paint = { at: number; x: number; open: boolean };

export type SlideAnalysis = {
  livePaints: number;
  positions: number;
  steady: boolean;
  maxGapMs: number;
  travel: number;
};

const NO_GAP_MS = 0;

function isLive({ x, open }: Paint, panelWidth: number): boolean {
  return open && x < 0 && x > -panelWidth;
}

function maxGap(paints: Paint[]): number {
  return paints.reduce(
    (widest, paint, index) =>
      index === 0 ? widest : Math.max(widest, paint.at - (paints[index - 1]?.at ?? paint.at)),
    NO_GAP_MS,
  );
}

function slideSpan(paints: Paint[]): Paint[] {
  const closed = paints.findIndex(({ open }) => !open);
  return closed < 0 ? [] : paints.slice(0, closed + 1);
}

export function analyseSlide(paints: Paint[], panelWidth: number): SlideAnalysis {
  const live = paints.filter((paint) => isLive(paint, panelWidth));
  const span = slideSpan(paints);
  const gap = maxGap(span);
  const openTravels = paints.filter(({ open }) => open).map(({ x }) => -x / panelWidth);
  return {
    livePaints: live.length,
    positions: new Set(live.map(({ x }) => Math.round(x))).size,
    steady: span.length > 1 && gap <= STEADY_FRAME_GAP_MS,
    maxGapMs: span.length > 1 ? gap : Number.POSITIVE_INFINITY,
    travel: openTravels.length > 0 ? Math.max(...openTravels) : Number.NaN,
  };
}
