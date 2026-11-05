import { describe, expect, it } from 'vitest';
import { communityEvent } from './community';
import { gitLog } from './git-log';
import { readingViews } from './reading-views';
import { SITE_LOCALE } from './site-locale';

const fragmentKey = (fragment: string) => fragment.trim().replace(/\.$/, '').toLowerCase();

describe.each(Object.values(SITE_LOCALE))('CV prose overrides (%s)', (locale) => {
  it('keys every override to a fragment the CV actually renders', () => {
    const fragments = new Set(
      [
        ...gitLog[locale].flatMap((entry) => entry.body.flatMap((line) => line.split(/;\s+/))),
        ...communityEvent[locale].bullets,
      ].map(fragmentKey),
    );
    const dead = Object.keys(readingViews[locale].cv.proseOverrides).filter(
      (key) => !fragments.has(key),
    );
    expect(
      dead,
      'An override whose key no longer matches a career or community fragment is dead: the CV ' +
        'silently falls back to the raw fragment. Update the key when the source text changes.',
    ).toEqual([]);
  });
});
