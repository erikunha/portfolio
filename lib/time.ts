export const MS_PER_SECOND = 1000;
export const SECONDS_PER_MINUTE = 60;
export const MINUTES_PER_HOUR = 60;
export const HOURS_PER_DAY = 24;
export const MS_PER_MINUTE = MS_PER_SECOND * SECONDS_PER_MINUTE;
export const SECONDS_PER_HOUR = SECONDS_PER_MINUTE * MINUTES_PER_HOUR;
export const MS_PER_HOUR = MS_PER_MINUTE * MINUTES_PER_HOUR;
export const MINUTES_PER_DAY = MINUTES_PER_HOUR * HOURS_PER_DAY;

const CLOCK_FIELD_WIDTH = 2;
const CLOCK_FIELD_PAD = '0';

export const pad2 = (value: number | string): string =>
  String(value).padStart(CLOCK_FIELD_WIDTH, CLOCK_FIELD_PAD);
