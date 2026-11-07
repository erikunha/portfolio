import { describe, expect, it } from 'vitest';
import { WorldMapSchema } from './schemas';
import { worldMap } from './world-map';

const clone = () => structuredClone(worldMap);

describe('worldMap', () => {
  it('passes the schema', () => {
    expect(WorldMapSchema.safeParse(worldMap).success).toBe(true);
  });

  it('holds a land grid of the declared size with land in it', () => {
    expect(worldMap.land).toHaveLength(worldMap.grid.rows);
    for (const row of worldMap.land) {
      expect(row).toHaveLength(worldMap.grid.columns);
    }
    expect(worldMap.land.join('')).toContain('1');
  });

  it('declares only zones the browser can resolve', () => {
    for (const zone of Object.keys(worldMap.knownZones)) {
      expect(
        () => new Intl.DateTimeFormat('en', { timeZone: zone }),
        `${zone} must be a valid IANA zone: a typo here silently drops the visitor pin to the fallback`,
      ).not.toThrow();
    }
  });

  it('pins Erik in the southern hemisphere, west of the prime meridian', () => {
    expect(worldMap.erikPin.lat).toBeLessThan(0);
    expect(worldMap.erikPin.lon).toBeLessThan(0);
  });
});

describe('WorldMapSchema', () => {
  it('rejects a grid with the wrong number of rows', () => {
    const bad = clone();
    bad.land = bad.land.slice(1);

    expect(
      WorldMapSchema.safeParse(bad).success,
      'a short grid shifts every land cell north: the row count must match grid.rows',
    ).toBe(false);
  });

  it('rejects a row with the wrong width', () => {
    const bad = clone();
    bad.land[0] = `${bad.land[0]}0`;

    expect(
      WorldMapSchema.safeParse(bad).success,
      'a wide row overflows the map box: every row must be grid.columns cells',
    ).toBe(false);
  });

  it('rejects a cell that is neither land nor water', () => {
    const bad = clone();
    bad.land[0] = `2${bad.land[0]?.slice(1)}`;

    expect(WorldMapSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects a latitude outside the globe', () => {
    const bad = clone();
    bad.erikPin.lat = 91;

    expect(WorldMapSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects a longitude outside the globe', () => {
    const bad = clone();
    bad.knownZones['Europe/Berlin'] = { country: 'Germany', code: 'BER', lat: 52.5, lon: 181 };

    expect(WorldMapSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects a grid whose cell size and degrees per column disagree with the projection', () => {
    const bad = clone();
    bad.grid.degreesPerColumn = 5;

    expect(
      WorldMapSchema.safeParse(bad).success,
      'columns times degreesPerColumn must cover 360 degrees or the solar-hour columns drift off their land',
    ).toBe(false);
  });

  it('rejects an empty country', () => {
    const bad = clone();
    bad.knownZones['Europe/Berlin'] = { country: '', code: 'BER', lat: 52.5, lon: 13.4 };

    expect(WorldMapSchema.safeParse(bad).success).toBe(false);
  });
});
