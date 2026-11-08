import type { WorldMap } from '@/content/schemas';
import { HOURS_PER_DAY } from '../time';
import { DEGREES_PER_HOUR } from './zones';

export const DOT_PX = 4;
export const DOT_GAP_PX = 2;

const HALF_CIRCLE_DEGREES = 180;
const LIT_FROM_HOUR = 9;
const LIT_UNTIL_HOUR = 18;
const LAND_CELL = '1';

export type LandPaths = { lit: string; dim: string };

const mod = (value: number, modulus: number) => ((value % modulus) + modulus) % modulus;

export function buildLandPaths(
  land: readonly string[],
  grid: WorldMap['grid'],
  utcHour: number | null,
): LandPaths {
  const { cellPx, degreesPerColumn, columns } = grid;
  const litColumns = Array.from({ length: columns }, (_, column) => {
    if (utcHour === null) return false;
    const longitude = -HALF_CIRCLE_DEGREES + (column + 0.5) * degreesPerColumn;
    const solarHour = mod(utcHour + longitude / DEGREES_PER_HOUR, HOURS_PER_DAY);
    return solarHour >= LIT_FROM_HOUR && solarHour < LIT_UNTIL_HOUR;
  });

  let lit = '';
  let dim = '';
  land.forEach((row, rowIndex) => {
    const y = rowIndex * cellPx + cellPx / 2;
    let column = 0;
    while (column < columns) {
      if (row[column] !== LAND_CELL) {
        column++;
        continue;
      }
      const start = column;
      const state = litColumns[column];
      while (column < columns && row[column] === LAND_CELL && litColumns[column] === state) {
        column++;
      }
      const run = `M${start * cellPx + DOT_GAP_PX / 2} ${y}h${(column - start) * cellPx - DOT_GAP_PX}`;
      if (state) lit += run;
      else dim += run;
    }
  });
  return { lit, dim };
}
