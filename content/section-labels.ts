import { z } from 'zod';
import { SECTION_REGISTRY, type SectionRegistryEntry } from './section-registry';

const registrySectionLabels = Object.fromEntries(
  SECTION_REGISTRY.map(({ id, srLabel }) => [id, srLabel]),
) as {
  readonly [Entry in SectionRegistryEntry as Entry['id']]: Entry['srLabel'];
};

export const SECTION_LABELS = {
  ...registrySectionLabels,
  'sec-man-page': 'Profile manual',
  'sec-sys-health': 'System health',
  'sec-daw-mixer': 'DAW mixer',
} as const;

z.record(z.string(), z.string().min(1)).parse(SECTION_LABELS);

export const SCROLL_REGION_LABELS = {
  'sec-man-page': 'Profile manual (scrollable)',
  'sec-responsibilities': 'Responsibilities (scrollable)',
  'sec-readme': 'README code',
} as const;

z.record(z.string(), z.string().min(1)).parse(SCROLL_REGION_LABELS);

const SCROLL_REGION_PARENTS = {
  'sec-man-page': 'sec-man-page',
  'sec-responsibilities': 'sec-readme',
  'sec-readme': 'sec-readme',
} as const satisfies Record<keyof typeof SCROLL_REGION_LABELS, keyof typeof SECTION_LABELS>;

for (const [regionId, label] of Object.entries(SCROLL_REGION_LABELS)) {
  const sectionId = SCROLL_REGION_PARENTS[regionId as keyof typeof SCROLL_REGION_PARENTS];
  const sectionLabel: string | undefined = SECTION_LABELS[sectionId];
  if (sectionLabel === undefined) {
    throw new Error(`scroll region label for ${sectionId} has no matching section label`);
  }
  if (sectionLabel === label) {
    throw new Error(
      `scroll region label for ${sectionId} must differ from the parent section label`,
    );
  }
}
