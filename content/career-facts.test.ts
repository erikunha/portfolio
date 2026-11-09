import { describe, expect, it } from 'vitest';
import { education } from './education';
import { gitLog } from './git-log';
import { profile } from './profile';
import { personSchema } from './seo';
import { SITE_LOCALE } from './site-locale';

const startYear = (date: string) => Number(/\d{4}/.exec(date)?.[0]);

describe('career facts the ask prompt and structured data rely on', () => {
  it.each(Object.values(SITE_LOCALE))(
    'lists the %s git log newest first, current employer on top',
    (locale) => {
      const entries = gitLog[locale];
      expect(entries[0]?.company).toBe(profile.currentEmployer.name);
      const years = entries.map((entry) => startYear(entry.date));
      expect(years).toEqual([...years].sort((a, b) => b - a));
    },
  );

  it('names as alma mater only the schools whose programme is finished', () => {
    const inProgress = new Set(
      education[SITE_LOCALE.en]
        .filter((entry) => entry.expectedCompletion)
        .map((entry) => entry.institution),
    );
    const alumniOf = personSchema.alumniOf.map((school) => school.name);
    expect(alumniOf.filter((name) => inProgress.has(name))).toEqual([]);
  });
});
