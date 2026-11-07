import { describe, expect, it } from 'vitest';
import { aboutContent } from './about';
import { contactCopy } from './contact-copy';
import { SITE_LOCALE } from './site-locale';
import { WORK_SCOPE } from './work-scope';

describe.each(Object.values(SITE_LOCALE))('work scope (%s)', (locale) => {
  it('states the same remote scope in the About status and the contact facts', () => {
    expect(JSON.stringify(contactCopy[locale])).toContain(WORK_SCOPE[locale]);
    expect(JSON.stringify(aboutContent[locale])).toContain(WORK_SCOPE[locale]);
  });
});
