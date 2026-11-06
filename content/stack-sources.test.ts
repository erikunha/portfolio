import { describe, expect, it } from 'vitest';
import { linksContent } from './links';
import { profile, profileStack } from './profile';
import { projects } from './projects';
import { readingViews, summaryDocument } from './reading-views';
import { SITE_LOCALES } from './site-locale';

describe('stack and featured projects have one source', () => {
  it.each(SITE_LOCALES)('the /summary stack is the profile stack (%s)', (locale) => {
    expect(readingViews[locale].summary.stack).toEqual(profileStack.all);
  });

  it('every profile stack item appears in the profile technology line', () => {
    for (const item of profileStack.all) expect(profile.technologyLine).toContain(item);
  });

  it('the /links stack line is the full profile stack, in profile order', () => {
    expect(linksContent.profile.stack.split(' · ')).toEqual(profileStack.all);
  });

  it.each(SITE_LOCALES)(
    'the /summary projects lead with the first home projects (%s)',
    (locale) => {
      const names = summaryDocument[locale].projects.map((project) => project.name);
      expect(names).toEqual(projects[locale].slice(0, names.length).map((project) => project.name));
      expect(names[0]).toBe('ORIGINATION_PLATFORM_UI');
    },
  );
});
