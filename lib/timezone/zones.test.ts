import { afterEach, describe, expect, it, vi } from 'vitest';
import { KNOWN_ZONES } from '@/content/world-map';
import {
  describeZone,
  detectTimeZone,
  ERIK_TIME_ZONE,
  FALLBACK_TIME_ZONE,
  filterZones,
  formatClock,
  formatUtcOffset,
  localTime,
  supportedZones,
  zoneLabel,
  zoneOffsetMinutes,
  zonePlace,
} from './zones';

const JANUARY = new Date('2026-01-15T12:00:00Z');
const JULY = new Date('2026-07-15T12:00:00Z');

afterEach(() => {
  vi.restoreAllMocks();
});

describe('zoneOffsetMinutes', () => {
  it('keeps America/Sao_Paulo at UTC-3 all year', () => {
    expect(ERIK_TIME_ZONE).toBe('America/Sao_Paulo');
    expect(zoneOffsetMinutes(ERIK_TIME_ZONE, JANUARY)).toBe(-180);
    expect(zoneOffsetMinutes(ERIK_TIME_ZONE, JULY)).toBe(-180);
  });

  it('returns the half-hour and quarter-hour offsets in whole minutes', () => {
    expect(zoneOffsetMinutes('Asia/Kolkata', JANUARY)).toBe(330);
    expect(zoneOffsetMinutes('Asia/Kathmandu', JANUARY)).toBe(345);
  });

  it('follows northern and southern DST', () => {
    expect(zoneOffsetMinutes('America/New_York', JANUARY)).toBe(-300);
    expect(zoneOffsetMinutes('America/New_York', JULY)).toBe(-240);
    expect(zoneOffsetMinutes('Australia/Sydney', JANUARY)).toBe(660);
    expect(zoneOffsetMinutes('Australia/Sydney', JULY)).toBe(600);
  });

  it('flips on the exact DST instant in New York', () => {
    expect(zoneOffsetMinutes('America/New_York', new Date('2026-03-08T06:59:59Z'))).toBe(-300);
    expect(zoneOffsetMinutes('America/New_York', new Date('2026-03-08T07:00:00Z'))).toBe(-240);
  });

  it('flips on the exact DST instant in Berlin', () => {
    expect(zoneOffsetMinutes('Europe/Berlin', new Date('2026-03-29T00:59:59Z'))).toBe(60);
    expect(zoneOffsetMinutes('Europe/Berlin', new Date('2026-03-29T01:00:00Z'))).toBe(120);
  });

  it('does not drift by a minute when the instant carries seconds and milliseconds', () => {
    const lateInMinute = new Date('2026-01-15T12:00:59.999Z');

    expect(
      zoneOffsetMinutes(ERIK_TIME_ZONE, lateInMinute),
      'offset must be exact at any second of the minute: a zone clock read to the minute while the instant keeps its seconds is off by up to 59s and rounds -3h to -3h01m',
    ).toBe(-180);
  });
});

describe('Erik zone', () => {
  it('formats to the offset the profile states', async () => {
    const { profile } = await import('@/content/profile');
    const { ERIK_TIME_ZONE } = await import('./zones');
    expect(
      formatUtcOffset(zoneOffsetMinutes(ERIK_TIME_ZONE, new Date('2026-01-15T12:00:00Z'))),
    ).toBe(profile.timezone);
  });
});

describe('formatUtcOffset', () => {
  it.each([
    [-180, 'UTC-3'],
    [330, 'UTC+5:30'],
    [345, 'UTC+5:45'],
    [0, 'UTC+0'],
    [600, 'UTC+10'],
    [-570, 'UTC-9:30'],
  ])('formats %i minutes as %s', (minutes, expected) => {
    expect(formatUtcOffset(minutes)).toBe(expected);
  });
});

describe('localTime and formatClock', () => {
  it('gives hour 0 at local midnight, never 24', () => {
    const saoPauloMidnight = new Date('2026-01-15T03:00:00Z');
    const tokyoMidnight = new Date('2026-01-14T15:00:00Z');

    expect(
      localTime(ERIK_TIME_ZONE, saoPauloMidnight).hour,
      'a 12-hour-clock-off format returns 24 at midnight in some engines; the clock must use the h23 cycle',
    ).toBe(0);
    expect(localTime('Asia/Tokyo', tokyoMidnight).hour).toBe(0);
    expect(formatClock(ERIK_TIME_ZONE, saoPauloMidnight, false)).toBe('00:00');
    expect(formatClock('Asia/Tokyo', tokyoMidnight, false)).toBe('00:00');
  });

  it('formats seconds only when asked', () => {
    const at = new Date('2026-01-15T03:00:07Z');

    expect(formatClock(ERIK_TIME_ZONE, at, true)).toBe('00:00:07');
    expect(formatClock(ERIK_TIME_ZONE, at, false)).toBe('00:00');
  });

  it('reads the half-hour zone wall clock', () => {
    expect(localTime('Asia/Kolkata', JANUARY)).toEqual({ hour: 17, minute: 30, second: 0 });
  });
});

describe('zoneLabel', () => {
  it('labels curated zones as City, Country', () => {
    expect(zoneLabel('America/Sao_Paulo')).toBe('Sao Paulo, Brazil');
    expect(zoneLabel('America/Argentina/Buenos_Aires')).toBe('Buenos Aires, Argentina');
    expect(zoneLabel('Asia/Kolkata')).toBe('Kolkata, India');
  });

  it('labels other zones by city only', () => {
    expect(zoneLabel('Asia/Kathmandu')).toBe('Kathmandu');
    expect(zoneLabel('America/Argentina/Cordoba')).toBe('Cordoba');
    expect(zoneLabel('UTC')).toBe('UTC');
  });
});

describe('legacy zone names', () => {
  it('treats a legacy alias as its curated zone: V8 lists Asia/Calcutta, not Asia/Kolkata', () => {
    expect(
      zoneLabel('Asia/Calcutta'),
      'browsers report and list legacy IANA aliases, so a curated lookup keyed only by the modern name loses the country for visitors in India',
    ).toBe('Kolkata, India');
    expect(zoneLabel('America/Buenos_Aires')).toBe('Buenos Aires, Argentina');
    expect(zonePlace('Asia/Calcutta', JANUARY)).toMatchObject({ name: 'India', code: 'BOM' });
  });

  it('finds the curated zone by country through the legacy alias', () => {
    expect(filterZones(['Africa/Abidjan', 'Asia/Calcutta'], 'india', 10).zones).toEqual([
      'Asia/Calcutta',
    ]);
    expect(filterZones(['Africa/Abidjan', 'Asia/Calcutta'], '', 10).zones[0]).toBe('Asia/Calcutta');
  });
});

describe('zonePlace', () => {
  it('returns the curated country, code and coordinates', () => {
    expect(zonePlace('Europe/Berlin', JANUARY)).toEqual({
      name: 'Germany',
      code: 'BER',
      lat: 52.5,
      lon: 13.4,
    });
  });

  it('places an uncurated zone by its UTC offset longitude', () => {
    const place = zonePlace('Asia/Kathmandu', JANUARY);

    expect(place.name).toBe('Kathmandu');
    expect(place.code).toBe('KAT');
    expect(place.lon).toBeCloseTo(86.25, 5);
  });

  it('clamps the fallback longitude so the pin stays on the map', () => {
    expect(zonePlace('Pacific/Kiritimati', JANUARY).lon).toBe(170);
    expect(zonePlace('Pacific/Pago_Pago', JANUARY).lon).toBe(-165);
  });
});

describe('supportedZones', () => {
  it('lists the browser zones', () => {
    const zones = supportedZones();

    expect(zones).toContain('America/Sao_Paulo');
    expect(zones).toContain('Europe/Berlin');
  });

  it('falls back to the curated zones when the browser cannot list them', () => {
    vi.spyOn(Intl, 'supportedValuesOf').mockImplementation(() => {
      throw new RangeError('unsupported');
    });

    expect(supportedZones()).toEqual(Object.keys(KNOWN_ZONES));
  });

  it('falls back to the curated zones when the browser lists none', () => {
    vi.spyOn(Intl, 'supportedValuesOf').mockReturnValue([]);

    expect(supportedZones()).toEqual(Object.keys(KNOWN_ZONES));
  });
});

describe('detectTimeZone', () => {
  const stubResolved = (timeZone: string | undefined) =>
    vi
      .spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions')
      .mockReturnValue({ timeZone } as Intl.ResolvedDateTimeFormatOptions);

  it('returns the browser zone', () => {
    stubResolved('Asia/Tokyo');

    expect(detectTimeZone()).toBe('Asia/Tokyo');
  });

  it('falls back to UTC when the browser reports no zone', () => {
    stubResolved(undefined);

    expect(detectTimeZone()).toBe(FALLBACK_TIME_ZONE);
  });

  it('falls back to UTC when the browser throws', () => {
    vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockImplementation(() => {
      throw new Error('blocked');
    });

    expect(detectTimeZone()).toBe(FALLBACK_TIME_ZONE);
  });
});

describe('filterZones', () => {
  const ZONES = [
    'Africa/Abidjan',
    'America/New_York',
    'America/Sao_Paulo',
    'Asia/Kathmandu',
    'Asia/Kolkata',
    'Europe/Berlin',
  ];

  it('puts curated zones first, then the rest, each in list order', () => {
    const { zones, total } = filterZones(ZONES, '', 10);

    expect(total).toBe(ZONES.length);
    expect(zones).toEqual([
      'America/New_York',
      'America/Sao_Paulo',
      'Asia/Kolkata',
      'Europe/Berlin',
      'Africa/Abidjan',
      'Asia/Kathmandu',
    ]);
  });

  it('matches the city with spaces or underscores, ignoring case and padding', () => {
    expect(filterZones(ZONES, '  SAO paulo ', 10).zones).toEqual(['America/Sao_Paulo']);
    expect(filterZones(ZONES, 'sao_paulo', 10).zones).toEqual(['America/Sao_Paulo']);
  });

  it('matches the curated country name', () => {
    expect(filterZones(ZONES, 'brazil', 10).zones).toEqual(['America/Sao_Paulo']);
    expect(filterZones(ZONES, 'india', 10).zones).toEqual(['Asia/Kolkata']);
  });

  it('limits the visible matches but counts all of them', () => {
    const { zones, total } = filterZones(ZONES, 'a', 2);

    expect(zones).toHaveLength(2);
    expect(total).toBeGreaterThan(2);
  });

  it('returns nothing for a query no zone matches', () => {
    expect(filterZones(ZONES, 'atlantis', 10)).toEqual({ zones: [], total: 0 });
  });
});

describe('describeZone', () => {
  it('pairs the label with the UTC offset at the instant', () => {
    expect(describeZone('Asia/Kolkata', JANUARY)).toEqual({
      zone: 'Asia/Kolkata',
      label: 'Kolkata, India',
      offset: 'UTC+5:30',
    });
    expect(describeZone('America/New_York', JULY).offset).toBe('UTC-4');
  });
});
