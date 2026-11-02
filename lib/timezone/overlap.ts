import { ERIK_PIN, WORLD_MAP_GRID } from '@/content/world-map';
import { ERIK_TIME_ZONE, zoneOffsetMinutes } from './zones';

export const MINUTES_PER_HOUR = 60;
export const HOURS_PER_DAY = 24;
export const MINUTES_PER_DAY = HOURS_PER_DAY * MINUTES_PER_HOUR;
export const WORK_START_HOUR = 9;
export const WORK_END_HOUR = 18;

const WORK_START_MINUTE = WORK_START_HOUR * MINUTES_PER_HOUR;
const WORK_END_MINUTE = WORK_END_HOUR * MINUTES_PER_HOUR;
const HALF_HOUR_MINUTES = MINUTES_PER_HOUR / 2;
const MS_PER_MINUTE = 60_000;
const DAY_SHIFTS = [-MINUTES_PER_DAY, 0, MINUTES_PER_DAY] as const;
const RANGE_JOINER = ' to ';
const CLOCK_SEPARATOR = ':';
const CLOCK_PAD_LENGTH = 2;
const CLOCK_PAD_CHAR = '0';

const FULL_CIRCLE_DEGREES = 360;
const PIN_NUDGE_DISTANCE = 30;
const PIN_NUDGE_OFFSET = { x: -14, y: -10 } as const;
const NEAR_DISTANCE = 60;
const ROUTE_LIFT = 50;
const COORDINATE_DECIMALS = 2;

export const MAP_WIDTH = WORLD_MAP_GRID.columns * WORLD_MAP_GRID.cellPx;
export const MAP_HEIGHT = WORLD_MAP_GRID.rows * WORLD_MAP_GRID.cellPx;
export const MAP_LABEL_WIDTH = 104;
export const MAP_LABEL_HEIGHT = 34;

const LABEL_RIGHT_MARGIN = 6;
const LABEL_BOTTOM_MARGIN = 4;
const LABEL_MAX_X = MAP_WIDTH - MAP_LABEL_WIDTH - LABEL_RIGHT_MARGIN;
const LABEL_MAX_ERIK_Y = MAP_HEIGHT - MAP_LABEL_HEIGHT - LABEL_BOTTOM_MARGIN;
const LABEL_MIN_X = 4;
const LABEL_MIN_Y = 2;
const ERIK_LABEL_OFFSET = { x: 10, y: 8 } as const;
const VISITOR_LABEL_OFFSET = { x: 10, y: -44 } as const;
const NEAR_VISITOR_LABEL_OFFSET = { x: -118, y: -46 } as const;

export type OverlapRows = { erik: boolean[]; you: boolean[]; both: boolean[] };
export type BestSlot = { you: string; erik: string };
export type Overlap = {
  minutes: number;
  hours: number;
  range: string | null;
  cells: OverlapRows;
  currentHour: number;
  bestSlot: BestSlot | null;
};
export type ErikAvailability = { online: boolean; hoursUntilBack: number };
export type MapPoint = { x: number; y: number };
export type PinLayout = {
  erik: MapPoint;
  visitor: MapPoint;
  nudged: boolean;
  near: boolean;
  showRoute: boolean;
  route: string | null;
  erikLabel: MapPoint;
  visitorLabel: MapPoint;
};

const mod = (value: number, modulus: number) => ((value % modulus) + modulus) % modulus;
const isWorking = (minuteOfDay: number) =>
  minuteOfDay >= WORK_START_MINUTE && minuteOfDay < WORK_END_MINUTE;
const utcMinuteOfDay = (at: Date) => mod(Math.floor(at.getTime() / MS_PER_MINUTE), MINUTES_PER_DAY);
const roundCoordinate = (value: number) => Number(value.toFixed(COORDINATE_DECIMALS));

export function formatMinutesOfDay(minutes: number): string {
  const wrapped = mod(minutes, MINUTES_PER_DAY);
  const hours = Math.floor(wrapped / MINUTES_PER_HOUR);
  return [hours, wrapped % MINUTES_PER_HOUR]
    .map((field) => String(field).padStart(CLOCK_PAD_LENGTH, CLOCK_PAD_CHAR))
    .join(CLOCK_SEPARATOR);
}

export function computeOverlap(visitorZone: string, at: Date): Overlap {
  const shift = zoneOffsetMinutes(visitorZone, at) - zoneOffsetMinutes(ERIK_TIME_ZONE, at);
  let start = 0;
  let minutes = 0;
  for (const day of DAY_SHIFTS) {
    const from = Math.max(WORK_START_MINUTE, WORK_START_MINUTE + shift + day);
    const to = Math.min(WORK_END_MINUTE, WORK_END_MINUTE + shift + day);
    if (to - from > minutes) {
      minutes = to - from;
      start = from;
    }
  }

  const cells: OverlapRows = { erik: [], you: [], both: [] };
  for (let hour = 0; hour < HOURS_PER_DAY; hour++) {
    const midpoint = hour * MINUTES_PER_HOUR + HALF_HOUR_MINUTES;
    const you = isWorking(midpoint);
    const erik = isWorking(mod(midpoint - shift, MINUTES_PER_DAY));
    cells.you.push(you);
    cells.erik.push(erik);
    cells.both.push(you && erik);
  }

  const slotMinute = start + Math.floor(minutes / 2);
  return {
    minutes,
    hours: minutes / MINUTES_PER_HOUR,
    range:
      minutes > 0
        ? `${formatMinutesOfDay(start)}${RANGE_JOINER}${formatMinutesOfDay(start + minutes)}`
        : null,
    cells,
    currentHour: Math.floor(
      mod(utcMinuteOfDay(at) + zoneOffsetMinutes(visitorZone, at), MINUTES_PER_DAY) /
        MINUTES_PER_HOUR,
    ),
    bestSlot:
      minutes > 0
        ? { you: formatMinutesOfDay(slotMinute), erik: formatMinutesOfDay(slotMinute - shift) }
        : null,
  };
}

export function erikAvailability(at: Date): ErikAvailability {
  const local = mod(utcMinuteOfDay(at) + zoneOffsetMinutes(ERIK_TIME_ZONE, at), MINUTES_PER_DAY);
  const online = isWorking(local);
  return {
    online,
    hoursUntilBack: online
      ? 0
      : Math.ceil(mod(WORK_START_MINUTE - local, MINUTES_PER_DAY) / MINUTES_PER_HOUR),
  };
}

export function projectToMap(lat: number, lon: number): MapPoint {
  const { topLatitude, bottomLatitude } = WORLD_MAP_GRID;
  return {
    x: ((lon + FULL_CIRCLE_DEGREES / 2) / FULL_CIRCLE_DEGREES) * MAP_WIDTH,
    y: ((topLatitude - lat) / (topLatitude - bottomLatitude)) * MAP_HEIGHT,
  };
}

const withinBox = (a: MapPoint, b: MapPoint, distance: number) =>
  Math.abs(a.x - b.x) < distance && Math.abs(a.y - b.y) < distance;

export function layoutPins(visitor: { lat: number; lon: number }): PinLayout {
  const erik = projectToMap(ERIK_PIN.lat, ERIK_PIN.lon);
  const projected = projectToMap(visitor.lat, visitor.lon);
  const nudged = withinBox(projected, erik, PIN_NUDGE_DISTANCE);
  const pin = nudged
    ? { x: erik.x + PIN_NUDGE_OFFSET.x, y: erik.y + PIN_NUDGE_OFFSET.y }
    : projected;
  const near = withinBox(pin, erik, NEAR_DISTANCE);
  const route = nudged
    ? null
    : `M${roundCoordinate(erik.x)} ${roundCoordinate(erik.y)} Q${roundCoordinate((erik.x + pin.x) / 2)} ${roundCoordinate(Math.min(erik.y, pin.y) - ROUTE_LIFT)} ${roundCoordinate(pin.x)} ${roundCoordinate(pin.y)}`;

  return {
    erik,
    visitor: pin,
    nudged,
    near,
    showRoute: !nudged,
    route,
    erikLabel: {
      x: Math.min(erik.x + ERIK_LABEL_OFFSET.x, LABEL_MAX_X),
      y: Math.min(erik.y + ERIK_LABEL_OFFSET.y, LABEL_MAX_ERIK_Y),
    },
    visitorLabel: near
      ? {
          x: Math.max(LABEL_MIN_X, erik.x + NEAR_VISITOR_LABEL_OFFSET.x),
          y: Math.max(LABEL_MIN_Y, erik.y + NEAR_VISITOR_LABEL_OFFSET.y),
        }
      : {
          x: Math.max(LABEL_MIN_X, Math.min(pin.x + VISITOR_LABEL_OFFSET.x, LABEL_MAX_X)),
          y: Math.max(LABEL_MIN_Y, pin.y + VISITOR_LABEL_OFFSET.y),
        },
  };
}
