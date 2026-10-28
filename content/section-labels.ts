import { z } from 'zod';

export const SECTION_LABELS = {
  'sec-about': 'About',
  'sec-shell': 'Interactive shell',
  'sec-ai-metrics': 'AI answer-quality evaluation',
  'sec-projects': 'Projects',
  'sec-perf-receipts': 'Performance receipts',
  'sec-git-log': 'Career history',
  'sec-man-page': 'Profile manual',
  'sec-live-perf': 'Live performance',
  'sec-sys-health': 'System health',
  'sec-visa': 'Work authorization',
  'sec-hottest-takes': 'Opinions',
  'sec-guitar': 'Guitar rig',
  'sec-daw-mixer': 'DAW mixer',
  'sec-unknowns': 'Open questions',
  'sec-contact': 'Contact',
} as const;

z.record(z.string(), z.string().min(1)).parse(SECTION_LABELS);
