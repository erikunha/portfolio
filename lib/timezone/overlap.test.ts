import { describe, expect, it } from 'vitest';
import { KNOWN_ZONES, WORLD_MAP_GRID } from '@/content/world-map';
import {
  computeOverlap,
  erikAvailability,
  formatMinutesOfDay,
  layoutPins,
  MAP_HEIGHT,
  MAP_LABEL_HEIGHT,
  MAP_LABEL_WIDTH,
  MAP_WIDTH,
  projectToMap,
} from './overlap';
import { ERIK_TIME_ZONE } from './zones';

const JANUARY = new Date('2026-01-15T12:00:00Z');
const JULY = new Date('2026-07-15T12:00:00Z');
const HOURS = 24;

const litHours = (row: readonly boolean[]) => row.flatMap((lit, hour) => (lit ? [hour] : []));
const hoursRange = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i);

describe('computeOverlap', () => {
  it('overlaps eight full hours with the same zone as Erik', () => {
    const overlap = computeOverlap(ERIK_TIME_ZONE, JANUARY);

    expect(overlap.hours).toBe(8);
    expect(overlap.range).toBe('10:00 to 18:00');
    expect(litHours(overlap.cells.both)).toEqual(hoursRange(10, 17));
    expect(overlap.bestSlot).toEqual({ you: '10:00', erik: '10:00' });
  });

  it('returns 24 hourly cells per row', () => {
    const { cells } = computeOverlap('Europe/Berlin', JANUARY);

    expect(cells.erik).toHaveLength(HOURS);
    expect(cells.you).toHaveLength(HOURS);
    expect(cells.both).toHaveLength(HOURS);
  });

  it('never lands on the midpoint: a visitor two hours behind gets the first shared half hour', () => {
    const overlap = computeOverlap('America/Bogota', JANUARY);

    expect(overlap.bestSlot?.you, 'the midpoint 12:30 you read as a bug').not.toBe('12:30');
    expect(overlap.bestSlot).toEqual({ you: '09:00', erik: '11:00' });
  });

  it('opens the best slot at the top of Erik window when the visitor shares his zone', () => {
    const overlap = computeOverlap(ERIK_TIME_ZONE, JANUARY);

    expect(overlap.bestSlot).toEqual({ you: '10:00', erik: '10:00' });
  });

  it('marks the visitor working hours in the you row', () => {
    expect(litHours(computeOverlap('Europe/Berlin', JANUARY).cells.you)).toEqual(hoursRange(9, 17));
  });

  it('computes Berlin in winter and the best slot in both zones', () => {
    const overlap = computeOverlap('Europe/Berlin', JANUARY);

    expect(overlap.hours).toBe(4);
    expect(overlap.range).toBe('14:00 to 18:00');
    expect(litHours(overlap.cells.erik)).toEqual(hoursRange(14, 21));
    expect(litHours(overlap.cells.both)).toEqual(hoursRange(14, 17));
    expect(overlap.bestSlot).toEqual({ you: '14:00', erik: '10:00' });
  });

  it('loses an hour of overlap on the Berlin DST instant', () => {
    const before = computeOverlap('Europe/Berlin', new Date('2026-03-29T00:59:59Z'));
    const after = computeOverlap('Europe/Berlin', new Date('2026-03-29T01:00:00Z'));

    expect(before.hours).toBe(4);
    expect(after.hours).toBe(3);
    expect(after.range).toBe('15:00 to 18:00');
  });

  it('gains an hour of overlap on the New York DST instant', () => {
    const before = computeOverlap('America/New_York', new Date('2026-03-08T06:59:59Z'));
    const after = computeOverlap('America/New_York', new Date('2026-03-08T07:00:00Z'));

    expect(before.range).toBe('09:00 to 16:00');
    expect(before.hours).toBe(7);
    expect(after.range).toBe('09:00 to 17:00');
    expect(after.hours).toBe(8);
  });

  it('computes New York across the seasons', () => {
    expect(computeOverlap('America/New_York', JANUARY).hours).toBe(7);
    expect(computeOverlap('America/New_York', JULY).hours).toBe(8);
  });

  it('overlaps behind Erik: Los Angeles', () => {
    const overlap = computeOverlap('America/Los_Angeles', JANUARY);

    expect(overlap.hours).toBe(4);
    expect(overlap.range).toBe('09:00 to 13:00');
  });

  it('overlaps ahead of Erik: Dubai', () => {
    const overlap = computeOverlap('Asia/Dubai', JANUARY);

    expect(overlap.hours).toBe(1);
    expect(overlap.range).toBe('17:00 to 18:00');
  });

  it('keeps half-hour precision for Asia/Tehran', () => {
    const overlap = computeOverlap('Asia/Tehran', JANUARY);

    expect(overlap.hours).toBe(1.5);
    expect(overlap.range).toBe('16:30 to 18:00');
    expect(overlap.bestSlot).toEqual({ you: '16:30', erik: '10:00' });
    expect(litHours(overlap.cells.both)).toEqual(hoursRange(16, 17));
    expect(litHours(overlap.cells.erik)).toEqual([...hoursRange(16, 23)]);
  });

  it('reports no overlap for Asia/Kathmandu, where Erik starts after the visitor day ends', () => {
    const overlap = computeOverlap('Asia/Kathmandu', JANUARY);

    expect(overlap.hours).toBe(0);
    expect(overlap.range).toBeNull();
    expect(overlap.bestSlot).toBeNull();
  });

  it('reports no overlap for Asia/Tokyo, where the gap is negative', () => {
    const overlap = computeOverlap('Asia/Tokyo', JANUARY);

    expect(overlap.hours).toBe(0);
    expect(overlap.range).toBeNull();
    expect(overlap.bestSlot).toBeNull();
    expect(litHours(overlap.cells.both)).toEqual([]);
    expect(litHours(overlap.cells.you)).toEqual(hoursRange(9, 17));
  });

  it('finds the overlap that wraps to the previous day: Auckland in summer', () => {
    const overlap = computeOverlap('Pacific/Auckland', JANUARY);

    expect(overlap.hours).toBe(1);
    expect(overlap.range).toBe('09:00 to 10:00');
    expect(overlap.bestSlot).toEqual({ you: '09:00', erik: '17:00' });
  });

  it('drops to zero overlap when Auckland leaves daylight saving', () => {
    expect(computeOverlap('Pacific/Auckland', JULY).hours).toBe(0);
  });

  it('reports the visitor current hour, 0 at local midnight', () => {
    expect(computeOverlap('Europe/Berlin', JANUARY).currentHour).toBe(13);
    expect(computeOverlap('Asia/Kolkata', JANUARY).currentHour).toBe(17);
    expect(computeOverlap(ERIK_TIME_ZONE, new Date('2026-01-15T03:00:00Z')).currentHour).toBe(0);
  });
});

describe('erikAvailability', () => {
  it.each([
    ['2026-01-15T11:59:00Z', false, 2],
    ['2026-01-15T12:00:00Z', false, 1],
    ['2026-01-15T20:59:00Z', true, 0],
    ['2026-01-15T21:00:00Z', false, 16],
    ['2026-01-15T03:00:00Z', false, 10],
    ['2026-01-15T10:30:00Z', false, 3],
  ])('at %s online is %s and back in %i hours', (iso, online, hoursUntilBack) => {
    expect(erikAvailability(new Date(iso))).toEqual({ online, hoursUntilBack });
  });
});

describe('formatMinutesOfDay', () => {
  it.each([
    [0, '00:00'],
    [570, '09:30'],
    [1440, '00:00'],
    [-390, '17:30'],
  ])('formats %i as %s', (minutes, expected) => {
    expect(formatMinutesOfDay(minutes)).toBe(expected);
  });
});

describe('projectToMap', () => {
  it('maps the grid corners to the map corners', () => {
    expect(MAP_WIDTH).toBe(WORLD_MAP_GRID.columns * WORLD_MAP_GRID.cellPx);
    expect(MAP_HEIGHT).toBe(WORLD_MAP_GRID.rows * WORLD_MAP_GRID.cellPx);
    expect(projectToMap(WORLD_MAP_GRID.topLatitude, -180)).toEqual({ x: 0, y: 0 });
    expect(projectToMap(WORLD_MAP_GRID.bottomLatitude, 180)).toEqual({
      x: MAP_WIDTH,
      y: MAP_HEIGHT,
    });
  });

  it('places Sao Paulo', () => {
    const { x, y } = projectToMap(-23.5, -46.6);

    expect(x).toBeCloseTo(200.1, 5);
    expect(y).toBeCloseTo(152.25, 5);
  });

  it('keeps every curated zone inside the map', () => {
    for (const [zone, { lat, lon }] of Object.entries(KNOWN_ZONES)) {
      const { x, y } = projectToMap(lat, lon);

      expect(x, `${zone} must project inside the map width`).toBeGreaterThanOrEqual(0);
      expect(x, `${zone} must project inside the map width`).toBeLessThanOrEqual(MAP_WIDTH);
      expect(y, `${zone} must project inside the map height`).toBeGreaterThanOrEqual(0);
      expect(y, `${zone} must project inside the map height`).toBeLessThanOrEqual(MAP_HEIGHT);
    }
  });
});

describe('layoutPins', () => {
  it('draws a route and places both labels beside their pins for a far visitor', () => {
    const berlin = KNOWN_ZONES['Europe/Berlin'];
    if (!berlin) throw new Error('Europe/Berlin must be curated');
    const layout = layoutPins(berlin);

    expect(layout.near).toBe(false);
    expect(layout.nudged).toBe(false);
    expect(layout.showRoute).toBe(true);
    expect(layout.route).toMatch(/^M200\.1 152\.25 Q\S+ \S+ 290\.1 38\.25$/);
    expect(layout.erikLabel.x).toBeCloseTo(210.1, 5);
    expect(layout.erikLabel.y).toBeCloseTo(160.25, 5);
    expect(layout.visitorLabel.x).toBeCloseTo(300.1, 5);
    expect(layout.visitorLabel.y).toBe(2);
  });

  it('offsets the visitor pin and draws no route when the visitor is at Erik', () => {
    const saoPaulo = KNOWN_ZONES[ERIK_TIME_ZONE];
    if (!saoPaulo) throw new Error('America/Sao_Paulo must be curated');
    const layout = layoutPins(saoPaulo);

    expect(layout.nudged).toBe(true);
    expect(layout.near).toBe(true);
    expect(layout.showRoute).toBe(false);
    expect(layout.route).toBeNull();
    expect(layout.visitor.x).toBeCloseTo(layout.erik.x - 14, 5);
    expect(layout.visitor.y).toBeCloseTo(layout.erik.y - 10, 5);
  });

  it('keeps both pins and labels visible and apart when the visitor is at Erik', () => {
    const saoPaulo = KNOWN_ZONES[ERIK_TIME_ZONE];
    if (!saoPaulo) throw new Error('America/Sao_Paulo must be curated');
    const { erikLabel, visitorLabel } = layoutPins(saoPaulo);
    const overlapsX =
      erikLabel.x < visitorLabel.x + MAP_LABEL_WIDTH &&
      visitorLabel.x < erikLabel.x + MAP_LABEL_WIDTH;
    const overlapsY =
      erikLabel.y < visitorLabel.y + MAP_LABEL_HEIGHT &&
      visitorLabel.y < erikLabel.y + MAP_LABEL_HEIGHT;

    expect(
      overlapsX && overlapsY,
      'a nearby visitor label must not cover Erik label: both clocks stay readable',
    ).toBe(false);
  });

  it('keeps the route and moves only the label for a near but distinct visitor: Bogota', () => {
    const bogota = KNOWN_ZONES['America/Bogota'];
    if (!bogota) throw new Error('America/Bogota must be curated');
    const layout = layoutPins(bogota);

    expect(layout.near).toBe(true);
    expect(layout.nudged).toBe(false);
    expect(layout.showRoute).toBe(true);
    expect(layout.visitorLabel.x).toBeCloseTo(layout.erik.x - 118, 5);
    expect(layout.visitorLabel.y).toBeCloseTo(layout.erik.y - 46, 5);
  });

  it('keeps every label inside the map', () => {
    for (const [zone, geo] of Object.entries(KNOWN_ZONES)) {
      const { erikLabel, visitorLabel } = layoutPins(geo);

      for (const label of [erikLabel, visitorLabel]) {
        expect(label.x, `${zone} label x`).toBeGreaterThanOrEqual(0);
        expect(label.y, `${zone} label y`).toBeGreaterThanOrEqual(0);
        expect(label.x, `${zone} label x`).toBeLessThanOrEqual(MAP_WIDTH);
        expect(label.y, `${zone} label y`).toBeLessThanOrEqual(MAP_HEIGHT);
      }
    }
  });
});
