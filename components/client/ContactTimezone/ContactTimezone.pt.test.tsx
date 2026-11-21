import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { contactCopy } from '@/content/contact-copy';
import { SITE_LOCALE } from '@/content/site-locale';
import { ContactTimezone } from './ContactTimezone.client';

vi.mock('@/lib/timezone/zones', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/timezone/zones')>()),
  detectTimeZone: () => 'Europe/Berlin',
}));

const ENGLISH_JOINER = /\bto\b/;

describe('ContactTimezone overlap line in pt', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T15:00:00Z'));
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('joins the shared window with the pt word and no English joiner', () => {
    render(<ContactTimezone copy={contactCopy[SITE_LOCALE.pt].timezone} />);
    const text = screen.getByTestId('ctz-overlap').textContent ?? '';
    expect(text).toMatch(/\d{2}:\d{2} às \d{2}:\d{2} seu horário/);
    expect(text).not.toMatch(ENGLISH_JOINER);
  });
});
