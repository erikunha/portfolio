import { describe, expect, it } from 'vitest';
import { ContactContentSchema } from './contact';
import { contactCopy, contactHoursPhrase, fillCopy } from './contact-copy';

const EM_DASH = '—';
const EN_DASH = '–';

const collectStrings = (value: unknown): string[] => {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(collectStrings);
  if (value !== null && typeof value === 'object') {
    return Object.values(value).flatMap(collectStrings);
  }
  return [];
};

describe('fillCopy', () => {
  it('fills named placeholders with strings and numbers', () => {
    expect(fillCopy('back in ~{hours}h, {note}', { hours: 3, note: 'ok' })).toBe('back in ~3h, ok');
  });

  it('fills a placeholder used twice', () => {
    expect(fillCopy('{a} and {a}', { a: 'x' })).toBe('x and x');
  });

  it('leaves a placeholder without a value visible instead of printing undefined', () => {
    expect(fillCopy('{known} {missing}', { known: 'a' })).toBe('a {missing}');
  });
});

describe('contactHoursPhrase', () => {
  it.each([
    [9, '9 hours'],
    [1, '1 hour'],
    [0.5, '0.5 hours'],
    [0.25, '0.25 hours'],
    [0, '0 hours'],
  ])('phrases %s as %s', (hours, expected) => {
    expect(contactHoursPhrase(hours)).toBe(expected);
  });
});

describe('timezone panel copy', () => {
  const { timezone } = contactCopy;

  it('passes the contact schema', () => {
    expect(ContactContentSchema.safeParse(contactCopy).success).toBe(true);
  });

  it('states the facts the spec lists', () => {
    expect(timezone.facts.modeValue).toContain('remote-first');
    expect(timezone.facts.modeValue).toContain('EU/US/CA');
    expect(timezone.facts.relocationValue).toContain('relocation');
    expect(timezone.facts.relocationValue).toContain('visa sponsorship');
    expect(timezone.facts.engagementValue).toBe('full-time or contract');
    expect(timezone.facts.replyValue).toBe('within 48h');
    expect(timezone.propose.label).toContain('PROPOSE_IN_MESSAGE');
  });

  it('keeps the reply window in one place', () => {
    expect(timezone.facts.replyValue).toBe(contactCopy.channels.replyValue);
  });

  it('reads ONLINE NOW and OFF HOURS as the spec words them', () => {
    expect(timezone.status.online).toBe('ONLINE NOW · likely to reply today');
    expect(fillCopy(timezone.status.offHours, { hours: 4 })).toBe(
      'OFF HOURS · back in ~4h, message anyway',
    );
  });

  it('composes the footer overlap line', () => {
    const line = [
      fillCopy(timezone.overlap.summary, { hours: contactHoursPhrase(9) }),
      fillCopy(timezone.overlap.range, { range: '09:00 to 18:00' }),
    ].join(timezone.overlap.separator);

    expect(line).toBe('9 hours overlap · 09:00 to 18:00 your time');
  });

  it('has a 00/06/12/18/24 axis', () => {
    expect(timezone.axis).toEqual(['00', '06', '12', '18', '24']);
  });

  it('uses no em or en dash anywhere a person reads', () => {
    for (const text of collectStrings(timezone)) {
      expect(text, `"${text}" must not contain an em or en dash (lessons rule 14)`).not.toContain(
        EM_DASH,
      );
      expect(text, `"${text}" must not contain an en dash (lessons rule 14)`).not.toContain(
        EN_DASH,
      );
    }
  });
});
