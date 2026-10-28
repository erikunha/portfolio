import { z } from 'zod';
import { measured } from './measured';

export const SECTION_LABELS = {
  'sec-readme': 'About',
  'sec-shell': 'Interactive shell',
  'sec-live-metrics': measured.title,
  'sec-projects': 'Projects',
  'sec-responsibilities': 'Responsibilities',
  'sec-now': 'Now',
  'sec-npm-stack': 'Tech stack',
  'sec-git-log': 'Career history',
  'sec-man-page': 'Profile manual',
  'sec-sys-health': 'System health',
  'sec-credentials': 'Credentials',
  'sec-visa': 'Work authorization',
  'sec-community': 'Community',
  'sec-hottest-takes': 'Opinions',
  'sec-guitar': 'Guitar rig',
  'sec-daw-mixer': 'DAW mixer',
  'sec-unknowns': 'Open questions',
  'sec-contact': 'Contact',
} as const;

z.record(z.string(), z.string().min(1)).parse(SECTION_LABELS);
