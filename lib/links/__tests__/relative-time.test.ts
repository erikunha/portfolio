import { describe, expect, it } from 'vitest';
import { formatRelative } from '@/lib/links/relative-time';

const NOW = new Date('2026-08-30T12:00:00Z');

describe('formatRelative', () => {
  it('renders days in Portuguese', () => {
    expect(formatRelative(new Date('2026-08-27T12:00:00Z'), 'pt', NOW)).toBe('há 3 dias');
  });

  it('prefers the idiomatic word over a count where Portuguese has one', () => {
    expect(formatRelative(new Date('2026-08-28T12:00:00Z'), 'pt', NOW)).toBe('anteontem');
    expect(formatRelative(new Date('2026-08-29T12:00:00Z'), 'pt', NOW)).toBe('ontem');
  });

  it('renders days in English', () => {
    expect(formatRelative(new Date('2026-08-28T12:00:00Z'), 'en', NOW)).toBe('2 days ago');
  });

  it('collapses to weeks past seven days', () => {
    expect(formatRelative(new Date('2026-08-23T12:00:00Z'), 'en', NOW)).toBe('last week');
  });

  it('collapses to months past thirty days', () => {
    expect(formatRelative(new Date('2026-07-01T12:00:00Z'), 'en', NOW)).toBe('2 months ago');
  });

  it('treats the same day as today rather than "0 days ago"', () => {
    expect(formatRelative(new Date('2026-08-30T09:00:00Z'), 'en', NOW)).toBe('today');
  });

  it('returns null for an unparseable date so the caller can omit the field', () => {
    expect(formatRelative(new Date('nope'), 'en', NOW)).toBeNull();
  });
});
