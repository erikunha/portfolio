import { z } from 'zod';
import { measured } from './measured';
import { SECTION_REGISTRY, type SectionRegistryEntry } from './section-registry';

const registrySectionLabels = Object.fromEntries(
  SECTION_REGISTRY.map(({ id, srLabel }) => [id, srLabel]),
) as {
  readonly [Entry in SectionRegistryEntry as Entry['id']]: Entry['srLabel'];
};

export const SECTION_LABELS = {
  ...registrySectionLabels,
  'sec-live-metrics': measured.title,
  'sec-ai-metrics': 'AI answer-quality evaluation',
  'sec-perf-receipts': 'Performance receipts',
  'sec-responsibilities': 'Responsibilities',
  'sec-now': 'Now',
  'sec-npm-stack': 'Tech stack',
  'sec-man-page': 'Profile manual',
  'sec-sys-health': 'System health',
  'sec-visa': 'Work authorization',
  'sec-daw-mixer': 'DAW mixer',
  'sec-unknowns': 'Open questions',
} as const;

z.record(z.string(), z.string().min(1)).parse(SECTION_LABELS);
