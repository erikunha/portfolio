import { describe, expect, it } from 'vitest';
import { WORLD_MAP_GRID, WORLD_MAP_LAND } from '@/content/world-map';
import { buildLandPaths, DOT_GAP_PX, DOT_PX } from './land-paths';

const LAND_CELLS = WORLD_MAP_LAND.join('').replaceAll('0', '').length;
const MIDNIGHT = 0;
const NOON = 12;
const EUROPE_ROW = 3;
const EUROPE_COLUMN = 52;
const RUN_PATTERN = /M(\d+) (\d+)h(\d+)/g;

function runs(path: string) {
  return [...path.matchAll(RUN_PATTERN)].map(([, x, y, length]) => ({
    x: Number(x),
    y: Number(y),
    length: Number(length),
  }));
}

function cellsIn(path: string): number {
  return runs(path).reduce(
    (total, run) => total + (run.length + DOT_GAP_PX) / WORLD_MAP_GRID.cellPx,
    0,
  );
}

function covers(path: string, row: number, column: number): boolean {
  const { cellPx } = WORLD_MAP_GRID;
  const centreY = row * cellPx + cellPx / 2;
  const cellStart = column * cellPx + DOT_GAP_PX / 2;
  return runs(path).some(
    (run) => run.y === centreY && run.x <= cellStart && cellStart < run.x + run.length,
  );
}

describe('buildLandPaths', () => {
  it('draws every land cell dim and none lit when no hour is given', () => {
    const { lit, dim } = buildLandPaths(WORLD_MAP_LAND, WORLD_MAP_GRID, null);

    expect(lit).toBe('');
    expect(cellsIn(dim)).toBe(LAND_CELLS);
  });

  it('splits the same land between lit and dim at any hour', () => {
    for (const hour of [MIDNIGHT, 5.5, NOON, 21]) {
      const { lit, dim } = buildLandPaths(WORLD_MAP_LAND, WORLD_MAP_GRID, hour);

      expect(
        cellsIn(lit) + cellsIn(dim),
        `a land cell must be lit or dim, never both or neither (hour ${hour})`,
      ).toBe(LAND_CELLS);
    }
  });

  it('lights Europe at midday UTC and dims it at midnight UTC', () => {
    expect(WORLD_MAP_LAND[EUROPE_ROW]?.[EUROPE_COLUMN]).toBe('1');

    const noon = buildLandPaths(WORLD_MAP_LAND, WORLD_MAP_GRID, NOON);
    const midnight = buildLandPaths(WORLD_MAP_LAND, WORLD_MAP_GRID, MIDNIGHT);

    expect(covers(noon.lit, EUROPE_ROW, EUROPE_COLUMN)).toBe(true);
    expect(covers(noon.dim, EUROPE_ROW, EUROPE_COLUMN)).toBe(false);
    expect(covers(midnight.lit, EUROPE_ROW, EUROPE_COLUMN)).toBe(false);
    expect(covers(midnight.dim, EUROPE_ROW, EUROPE_COLUMN)).toBe(true);
  });

  it('merges neighbouring cells of one state into a single dashed run', () => {
    const { dim } = buildLandPaths(WORLD_MAP_LAND, WORLD_MAP_GRID, null);

    expect(runs(dim).length).toBeLessThan(LAND_CELLS);
    for (const run of runs(dim)) {
      expect((run.length + DOT_GAP_PX) % WORLD_MAP_GRID.cellPx).toBe(0);
    }
  });

  it('keeps the dot narrower than its cell so the gap shows', () => {
    expect(DOT_PX).toBeLessThan(WORLD_MAP_GRID.cellPx);
    expect(DOT_PX + DOT_GAP_PX).toBe(WORLD_MAP_GRID.cellPx);
  });

  it('returns the same paths for the same hour', () => {
    const first = buildLandPaths(WORLD_MAP_LAND, WORLD_MAP_GRID, 13.25);

    expect(buildLandPaths(WORLD_MAP_LAND, WORLD_MAP_GRID, 13.25)).toEqual(first);
  });
});
