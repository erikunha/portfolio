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

const UTC_DAY_LENGTH = 'YYYY-MM-DD'.length;

export const utcDay = (date: Date): string => date.toISOString().slice(0, UTC_DAY_LENGTH);

const ISO_WEEK_DAYS = 7;
const ISO_WEEK_THURSDAY_OFFSET = 3;
const ISO_WEEK_ONE_DAY_OF_JANUARY = 4;
const ISO_WEEK_PAD_WIDTH = 2;
const MS_PER_DAY = MS_PER_HOUR * HOURS_PER_DAY;

const mondayIndex = (date: Date): number => (date.getUTCDay() + ISO_WEEK_DAYS - 1) % ISO_WEEK_DAYS;

export const isoWeek = (date: Date): string => {
  const thursday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  thursday.setUTCDate(thursday.getUTCDate() - mondayIndex(thursday) + ISO_WEEK_THURSDAY_OFFSET);
  const year = thursday.getUTCFullYear();
  const weekOne = new Date(Date.UTC(year, 0, ISO_WEEK_ONE_DAY_OF_JANUARY));
  const elapsedDays = (thursday.getTime() - weekOne.getTime()) / MS_PER_DAY;
  const week =
    1 + Math.round((elapsedDays - ISO_WEEK_THURSDAY_OFFSET + mondayIndex(weekOne)) / ISO_WEEK_DAYS);
  return `${year}-W${String(week).padStart(ISO_WEEK_PAD_WIDTH, '0')}`;
};
