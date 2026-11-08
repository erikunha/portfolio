import { describe, expect, it } from 'vitest';
import { siteNavChrome } from './navigation';
import { offlineNotice } from './offline';
import { SITE_LOCALE } from './site-locale';

describe('siteNavChrome offline copy', () => {
  it.each(Object.values(SITE_LOCALE))(
    'carries only the %s offline notice, resolved on the server',
    (locale) => {
      expect(siteNavChrome(locale).offline).toEqual(offlineNotice[locale]);
    },
  );
});
