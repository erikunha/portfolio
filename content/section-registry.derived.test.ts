import { describe, expect, it } from 'vitest';
import {
  SECTION_ICONS,
  SECTION_ID,
  SECTION_NAV,
  SECTION_REGISTRY,
  SECTIONS,
} from './section-registry';

const TODAYS_ORDER = [
  ['home', 'bio', 1],
  ['about', 'sec-readme', 2],
  ['projects', 'sec-projects', 3],
  ['career', 'sec-git-log', 4],
  ['shell', 'sec-shell', 5],
  ['measured', 'sec-live-metrics', 6],
  ['opinions', 'sec-hottest-takes', 7],
  ['guitar', 'sec-guitar', 8],
  ['contact', 'sec-contact', 9],
] as const;

describe('section registry derived from one table', () => {
  it('keeps the current order, ids and keys', () => {
    expect(SECTION_REGISTRY.map(({ id, order }) => [id, order])).toEqual(
      TODAYS_ORDER.map(([, id, order]) => [id, order]),
    );
    expect(Object.entries(SECTION_ID)).toEqual(TODAYS_ORDER.map(([key, id]) => [key, id]));
    expect(SECTION_NAV.map(({ id }) => id)).toEqual(TODAYS_ORDER.map(([, id]) => id));
  });

  it('derives order from the position in the table', () => {
    expect(Object.keys(SECTIONS)).toEqual(TODAYS_ORDER.map(([key]) => key));
    expect(SECTION_REGISTRY.map(({ order }) => order)).toEqual(
      Object.keys(SECTIONS).map((_, index) => index + 1),
    );
    expect(SECTION_REGISTRY.map(({ id }) => id)).toEqual(
      Object.values(SECTIONS).map(({ id }) => id),
    );
  });

  it('derives the icon map from the table', () => {
    expect(Object.keys(SECTION_ICONS)).toEqual(Object.keys(SECTIONS));
    for (const [key, entry] of Object.entries(SECTIONS)) {
      expect(SECTION_ICONS[key as keyof typeof SECTION_ICONS]).toBe(entry.icon);
    }
  });
});
