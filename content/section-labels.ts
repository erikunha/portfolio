import { z } from 'zod';
import { recordBy } from './record-by';
import { SECTION_REGISTRY, type SectionId } from './section-registry';
import { SITE_LOCALE, type SiteLocale } from './site-locale';

const sectionLabelsFor = (locale: SiteLocale): Record<SectionId, string> =>
  recordBy(
    SECTION_REGISTRY,
    ({ id }) => id,
    ({ srLabel }) => srLabel[locale],
  );

export const SECTION_LABELS: Record<SiteLocale, Record<SectionId, string>> = {
  [SITE_LOCALE.en]: sectionLabelsFor(SITE_LOCALE.en),
  [SITE_LOCALE.pt]: sectionLabelsFor(SITE_LOCALE.pt),
};

z.record(z.string(), z.string().min(1)).parse(SECTION_LABELS[SITE_LOCALE.en]);
z.record(z.string(), z.string().min(1)).parse(SECTION_LABELS[SITE_LOCALE.pt]);

const scrollRegionLabelsFor = (
  locale: SiteLocale,
): Record<'sec-responsibilities' | 'sec-readme', string> =>
  locale === SITE_LOCALE.pt
    ? {
        'sec-responsibilities': 'Responsabilidades (rolável)',
        'sec-readme': 'Código README',
      }
    : {
        'sec-responsibilities': 'Responsibilities (scrollable)',
        'sec-readme': 'README code',
      };

export const SCROLL_REGION_LABELS: Record<
  SiteLocale,
  Record<'sec-responsibilities' | 'sec-readme', string>
> = {
  [SITE_LOCALE.en]: scrollRegionLabelsFor(SITE_LOCALE.en),
  [SITE_LOCALE.pt]: scrollRegionLabelsFor(SITE_LOCALE.pt),
};

const SCROLL_REGION_PARENTS = {
  'sec-responsibilities': 'sec-readme',
  'sec-readme': 'sec-readme',
} as const satisfies Record<keyof typeof SCROLL_REGION_LABELS.en, SectionId>;

for (const locale of Object.values(SITE_LOCALE)) {
  for (const [regionId, label] of Object.entries(SCROLL_REGION_LABELS[locale])) {
    const sectionId = SCROLL_REGION_PARENTS[regionId as keyof typeof SCROLL_REGION_PARENTS];
    const sectionLabel: string | undefined = SECTION_LABELS[locale][sectionId];
    if (sectionLabel === undefined) {
      throw new Error(`scroll region label for ${sectionId} has no matching section label`);
    }
    if (sectionLabel === label) {
      throw new Error(
        `scroll region label for ${sectionId} must differ from the parent section label`,
      );
    }
  }
}
