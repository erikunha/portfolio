import { KNOWN_ZONES } from '@/content/world-map';

export const ERIK_TIME_ZONE = 'America/Sao_Paulo';
export const FALLBACK_TIME_ZONE = 'UTC';

const FORMAT_LOCALE = 'en-US';
export const MS_PER_MINUTE = 60_000;
const MINUTES_PER_HOUR = 60;
const DEGREES_PER_HOUR = 15;
const FALLBACK_LATITUDE = 20;
const MAX_FALLBACK_LONGITUDE = 170;
const PLACE_CODE_LENGTH = 3;
const CLOCK_PAD_LENGTH = 2;
const CLOCK_PAD_CHAR = '0';
const CLOCK_SEPARATOR = ':';
const UTC_PREFIX = 'UTC';
const ZONE_PATH_SEPARATOR = '/';
const ZONE_WORD_SEPARATOR = '_';
const ZONE_WORD_JOINER = ' ';
const LABEL_JOINER = ', ';
const UTC_OFFSET_MINUTE_JOINER = ':';

export type WallClockTime = { hour: number; minute: number; second: number };
export type ZonePlace = { name: string; code: string; lat: number; lon: number };
export type ZoneDescription = { zone: string; label: string; offset: string };
export type ZoneFilterResult = { zones: string[]; total: number };

type Geo = (typeof KNOWN_ZONES)[string];
type CuratedZone = { key: string; geo: Geo };

const wallClockFormatters = new Map<string, Intl.DateTimeFormat>();
const curatedResults = new Map<string, CuratedZone | null>();
let curatedByCanonical: Map<string, CuratedZone> | undefined;

const padClock = (value: number) => String(value).padStart(CLOCK_PAD_LENGTH, CLOCK_PAD_CHAR);

function wallClockFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = wallClockFormatters.get(timeZone);
  if (cached) return cached;
  const created = new Intl.DateTimeFormat(FORMAT_LOCALE, {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  });
  wallClockFormatters.set(timeZone, created);
  return created;
}

function wallClock(timeZone: string, at: Date) {
  const parts = wallClockFormatter(timeZone).formatToParts(at);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour: read('hour'),
    minute: read('minute'),
    second: read('second'),
  };
}

export function zoneOffsetMinutes(timeZone: string, at: Date): number {
  const clock = wallClock(timeZone, at);
  const wallAsUtc = Date.UTC(
    clock.year,
    clock.month - 1,
    clock.day,
    clock.hour,
    clock.minute,
    clock.second,
  );
  return Math.round((wallAsUtc - at.getTime()) / MS_PER_MINUTE);
}

export function formatUtcOffset(offsetMinutes: number): string {
  const sign = offsetMinutes < 0 ? '-' : '+';
  const absolute = Math.abs(offsetMinutes);
  const hours = Math.floor(absolute / MINUTES_PER_HOUR);
  const minutes = absolute % MINUTES_PER_HOUR;
  const minutePart = minutes === 0 ? '' : `${UTC_OFFSET_MINUTE_JOINER}${padClock(minutes)}`;
  return `${UTC_PREFIX}${sign}${hours}${minutePart}`;
}

export function localTime(timeZone: string, at: Date): WallClockTime {
  const { hour, minute, second } = wallClock(timeZone, at);
  return { hour, minute, second };
}

export function formatClock(timeZone: string, at: Date, withSeconds: boolean): string {
  const { hour, minute, second } = localTime(timeZone, at);
  const fields = withSeconds ? [hour, minute, second] : [hour, minute];
  return fields.map(padClock).join(CLOCK_SEPARATOR);
}

function curatedLookup(): Map<string, CuratedZone> {
  if (curatedByCanonical) return curatedByCanonical;
  const lookup = new Map<string, CuratedZone>();
  for (const [key, geo] of Object.entries(KNOWN_ZONES)) {
    lookup.set(
      new Intl.DateTimeFormat(FORMAT_LOCALE, { timeZone: key }).resolvedOptions().timeZone,
      {
        key,
        geo,
      },
    );
  }
  curatedByCanonical = lookup;
  return lookup;
}

function resolveCuratedZone(timeZone: string): CuratedZone | null {
  const direct = Object.hasOwn(KNOWN_ZONES, timeZone) ? KNOWN_ZONES[timeZone] : undefined;
  if (direct) return { key: timeZone, geo: direct };
  try {
    const canonical = new Intl.DateTimeFormat(FORMAT_LOCALE, { timeZone }).resolvedOptions()
      .timeZone;
    return curatedLookup().get(canonical) ?? null;
  } catch {
    return null;
  }
}

function curatedZone(timeZone: string): CuratedZone | null {
  const cached = curatedResults.get(timeZone);
  if (cached !== undefined) return cached;
  const resolved = resolveCuratedZone(timeZone);
  curatedResults.set(timeZone, resolved);
  return resolved;
}

export function zoneCity(timeZone: string): string {
  const lastSegment = timeZone.split(ZONE_PATH_SEPARATOR).pop() ?? timeZone;
  return lastSegment.replaceAll(ZONE_WORD_SEPARATOR, ZONE_WORD_JOINER);
}

export function zoneLabel(timeZone: string): string {
  const curated = curatedZone(timeZone);
  if (!curated) return zoneCity(timeZone);
  return `${zoneCity(curated.key)}${LABEL_JOINER}${curated.geo.country}`;
}

export function zonePlace(timeZone: string, at: Date): ZonePlace {
  const curated = curatedZone(timeZone);
  if (curated) {
    const { country, code, lat, lon } = curated.geo;
    return { name: country, code, lat, lon };
  }
  const city = zoneCity(timeZone);
  const longitude = (zoneOffsetMinutes(timeZone, at) / MINUTES_PER_HOUR) * DEGREES_PER_HOUR;
  return {
    name: city,
    code: city.slice(0, PLACE_CODE_LENGTH).toUpperCase(),
    lat: FALLBACK_LATITUDE,
    lon: Math.max(-MAX_FALLBACK_LONGITUDE, Math.min(MAX_FALLBACK_LONGITUDE, longitude)),
  };
}

function listBrowserZones(): string[] {
  try {
    return Intl.supportedValuesOf('timeZone');
  } catch {
    return [];
  }
}

export function supportedZones(): readonly string[] {
  const zones = listBrowserZones();
  return zones.length > 0 ? zones : Object.keys(KNOWN_ZONES);
}

export function detectTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || FALLBACK_TIME_ZONE;
  } catch {
    return FALLBACK_TIME_ZONE;
  }
}

const normalizeSearch = (text: string) =>
  text.trim().toLowerCase().replaceAll(ZONE_WORD_SEPARATOR, ZONE_WORD_JOINER);

export function filterZones(
  zones: readonly string[],
  query: string,
  limit: number,
): ZoneFilterResult {
  const needle = normalizeSearch(query);
  const matching = zones.filter((zone) => {
    if (needle === '') return true;
    if (normalizeSearch(zone).includes(needle)) return true;
    const curated = curatedZone(zone);
    return curated?.geo.country.toLowerCase().includes(needle) === true;
  });
  const curatedFirst = [
    ...matching.filter((zone) => curatedZone(zone) !== null),
    ...matching.filter((zone) => curatedZone(zone) === null),
  ];
  return { zones: curatedFirst.slice(0, limit), total: matching.length };
}

export function describeZone(timeZone: string, at: Date): ZoneDescription {
  return {
    zone: timeZone,
    label: zoneLabel(timeZone),
    offset: formatUtcOffset(zoneOffsetMinutes(timeZone, at)),
  };
}
