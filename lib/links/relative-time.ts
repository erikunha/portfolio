import { LINKS_INTL_LOCALE, type LinksLocale } from '@/content/links.constants';

const MS_PER_DAY = 86_400_000;
const DAYS_PER_WEEK = 7;
const DAYS_PER_MONTH = 30;
const DAYS_PER_YEAR = 365;

export function formatRelative(
  date: Date,
  locale: LinksLocale,
  now: Date = new Date(),
): string | null {
  const ms = date.getTime();
  if (!Number.isFinite(ms)) return null;

  const days = Math.round((ms - now.getTime()) / MS_PER_DAY);
  const format = new Intl.RelativeTimeFormat(LINKS_INTL_LOCALE[locale], { numeric: 'auto' });

  const absDays = Math.abs(days);
  if (absDays < 1) return format.format(0, 'day');
  if (absDays < DAYS_PER_WEEK) return format.format(days, 'day');
  if (absDays < DAYS_PER_MONTH) return format.format(Math.round(days / DAYS_PER_WEEK), 'week');
  if (absDays < DAYS_PER_YEAR) return format.format(Math.round(days / DAYS_PER_MONTH), 'month');
  return format.format(Math.round(days / DAYS_PER_YEAR), 'year');
}
