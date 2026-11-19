import { describe, expect, it } from 'vitest';
import * as cv from './cv.schema';
import * as dawMixer from './daw-mixer.schema';
import * as eq from './eq.schema';
import * as errors from './errors.schema';
import * as footer from './footer.schema';
import * as links from './links.schema';
import * as navigation from './navigation.schema';
import * as primitives from './schema-primitives';
import * as barrel from './schemas';
import * as shellUi from './shell-ui.schema';
import * as worldMap from './world-map.schema';

type Moved = readonly [string, Record<string, unknown>, readonly string[]];

const MOVED: readonly Moved[] = [
  [
    'schema-primitives',
    primitives,
    ['CompanyUrlSchema', 'LocalizedTextSchema', 'SectionTextSchema'],
  ],
  ['navigation.schema', navigation, ['createNavigationSchema']],
  ['footer.schema', footer, ['CopyFeedbackSchema', 'FooterContentSchema']],
  ['errors.schema', errors, ['ErrorsClientContentSchema', 'ErrorsContentSchema']],
  [
    'links.schema',
    links,
    [
      'LinksChannelSchema',
      'LinksContentSchema',
      'LinksCopySchema',
      'LinksPillSchema',
      'LinksPlaylistSchema',
      'LinksProfileSchema',
      'LinksUpcomingSchema',
    ],
  ],
  [
    'eq.schema',
    eq,
    [
      'EQ_DEFAULT_PEAK_Q',
      'EQ_MAX_BAR_COUNT',
      'EQ_MIN_BAR_COUNT',
      'EQ_TEMPLATE_TOKENS',
      'EqBandSchema',
      'EqSpectrumSchema',
    ],
  ],
  ['daw-mixer.schema', dawMixer, ['DawMixerCopySchema', 'DawMixerSchema']],
  [
    'cv.schema',
    cv,
    ['CvDocumentSchema', 'CvJsonLdSchema', 'ReadingViewsSchema', 'SummaryDocumentSchema'],
  ],
  ['world-map.schema', worldMap, ['WorldMapSchema']],
  [
    'shell-ui.schema',
    shellUi,
    ['ShellCommandsSchema', 'ShellResponseSchema', 'ShellUiSchema', 'TerminalChromeSchema'],
  ],
];

const INTERNAL = new Set(['SectionTextSchema']);

describe.each(MOVED)('%s', (_name, moved, names) => {
  it('exports exactly the moved names', () => {
    expect(Object.keys(moved).sort()).toEqual([...names].sort());
  });

  it.each(names.filter((name) => !INTERNAL.has(name)))(
    'barrel re-exports %s as the same value',
    (name) => {
      expect((barrel as Record<string, unknown>)[name]).toBe(moved[name]);
    },
  );
});
