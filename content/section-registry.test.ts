import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ContactSection } from '@/components/sections/ContactSection';
import { GitLogSection } from '@/components/sections/GitLogSection';
import { GuitarSection } from '@/components/sections/GuitarSection';
import { Hero } from '@/components/sections/Hero';
import { HottestTakesSection } from '@/components/sections/HottestTakesSection';
import { LivePerfSection } from '@/components/sections/LivePerfSection';
import { ProjectsSection } from '@/components/sections/ProjectsSection';
import { ReadmeSection } from '@/components/sections/ReadmeSection';
import { ShellSection } from '@/components/sections/ShellSection';
import {
  dockKeyForSection,
  formatSectionPosition,
  HOME_SECTION_ID,
  NAVIGATION,
} from './navigation';
import { createNavigationSchema, SectionRegistrySchema } from './schemas';
import { SECTION_LABELS } from './section-labels';
import { getSectionByAlias, getSectionById, SECTION_REGISTRY } from './section-registry';

vi.mock('@/lib/ua', () => ({ getIsMobile: async () => false }));
vi.mock('@/lib/lighthouse-scores', () => {
  const scores = {
    performance: 0,
    accessibility: 0,
    bestPractices: 0,
    seo: 0,
    fetchedAt: '—',
  };
  return { getScores: async () => scores, LIGHTHOUSE_FALLBACK: scores };
});
vi.mock('@/components/client/ContactForm', () => ({ ContactFormLazy: () => null }));
vi.mock('@/components/client/InteractiveShell', () => ({ InteractiveShellLazy: () => null }));

describe('section registry', () => {
  it('contains the nine r106 destinations in rail and position-meter order', () => {
    expect(SECTION_REGISTRY.map(({ id, label, order }) => ({ id, label, order }))).toEqual([
      { id: 'bio', label: 'Home', order: 1 },
      { id: 'sec-readme', label: 'About', order: 2 },
      { id: 'sec-projects', label: 'Projects', order: 3 },
      { id: 'sec-git-log', label: 'Career', order: 4 },
      { id: 'sec-shell', label: 'Interactive shell', order: 5 },
      { id: 'sec-live-perf', label: 'Measured', order: 6 },
      { id: 'sec-hottest-takes', label: 'Opinions', order: 7 },
      { id: 'sec-guitar', label: 'Guitar and mixer', order: 8 },
      { id: 'sec-contact', label: 'Contact', order: 9 },
    ]);
    expect(SectionRegistrySchema.safeParse(SECTION_REGISTRY).success).toBe(true);
  });

  it('has unique ids, orders and search aliases', () => {
    const ids = SECTION_REGISTRY.map(({ id }) => id);
    const orders = SECTION_REGISTRY.map(({ order }) => order);
    const aliases = SECTION_REGISTRY.flatMap<string>(({ aliases }) => [...aliases]);
    expect(new Set(ids).size).toBe(9);
    expect(new Set(orders).size).toBe(9);
    expect(new Set(aliases).size).toBe(aliases.length);
    for (const entry of SECTION_REGISTRY) {
      expect(entry.aliases.length).toBeGreaterThan(0);
      expect(entry.icon.length).toBeGreaterThan(0);
      expect(getSectionById(entry.id)).toBe(entry);
      for (const alias of entry.aliases) {
        expect(getSectionByAlias(alias)).toBe(entry);
        expect(getSectionByAlias(`  ${alias.toUpperCase()}  `)).toBe(entry);
      }
    }
  });

  it('returns undefined for unknown ids and aliases', () => {
    expect(getSectionById('missing')).toBeUndefined();
    expect(getSectionByAlias('missing')).toBeUndefined();
    expect(getSectionByAlias('')).toBeUndefined();
    expect(getSectionByAlias('care')).toBeUndefined();
  });

  it('resolves prototype anchors as aliases without breaking existing section labels', () => {
    expect(getSectionByAlias('sec-about')?.id).toBe('sec-readme');
    expect(getSectionByAlias('sec-live-metrics')?.id).toBe('sec-live-perf');
    for (const { id, srLabel } of SECTION_REGISTRY) {
      expect(SECTION_LABELS[id]).toBe(srLabel);
    }
    expect(SECTION_LABELS['sec-daw-mixer']).toBe('DAW mixer');
  });

  it('targets actual section elements rendered by the home page sections', () => {
    const sections = [
      Hero,
      ReadmeSection,
      ProjectsSection,
      GitLogSection,
      ShellSection,
      LivePerfSection,
      HottestTakesSection,
      GuitarSection,
      ContactSection,
    ];
    const html = sections.map((Section) => renderToStaticMarkup(createElement(Section))).join('');
    const document = new DOMParser().parseFromString(html, 'text/html');
    for (const { id } of SECTION_REGISTRY) {
      expect(document.querySelectorAll(`section[id="${id}"]`), id).toHaveLength(1);
    }
  });

  it('rejects invalid content and duplicate destinations at the schema boundary', () => {
    const entries = SECTION_REGISTRY.map((entry) => ({ ...entry, aliases: [...entry.aliases] }));
    for (const patch of [
      { id: '' },
      { id: ' bio ' },
      { label: '' },
      { label: ' Home ' },
      { srLabel: '' },
      { srLabel: ' Home ' },
      { aliases: [] },
      { aliases: [''] },
      { aliases: ['Home'] },
      { aliases: [' home '] },
      { order: 0 },
      { order: 1.5 },
      { icon: 'missing' },
      { id: entries[1]?.id },
      { order: entries[1]?.order },
      { aliases: entries[1]?.aliases },
      { aliases: ['home', ' HOME '] },
    ]) {
      const result = SectionRegistrySchema.safeParse([
        { ...entries[0], ...patch },
        ...entries.slice(1),
      ]);
      expect(result.success).toBe(false);
    }
    expect(SectionRegistrySchema.safeParse(entries.slice(1)).success).toBe(false);
  });

  it('rejects an unsorted registry even when orders remain unique and contiguous', () => {
    const entries = [...SECTION_REGISTRY].reverse();
    expect(SectionRegistrySchema.safeParse(entries).success).toBe(false);
  });

  it('validates canonical entries without changing their text or aliases', () => {
    expect(SectionRegistrySchema.parse(SECTION_REGISTRY)).toEqual(SECTION_REGISTRY);
  });
});

describe('navigation content', () => {
  const sectionIds = SECTION_REGISTRY.map(({ id }) => id);
  const schema = createNavigationSchema(sectionIds);
  type MutableNavigation = {
    groups: { sectionIds: string[] }[];
    dock: { key: string; sectionId?: string; href?: string }[];
    siteLinks: { href: string }[];
  };
  const at = <T>(items: T[], index: number): T => {
    const item = items[index];
    if (!item) throw new Error(`missing fixture item ${index}`);
    return item;
  };
  const clone = () => structuredClone(NAVIGATION) as unknown as MutableNavigation;

  it('is derived from the registry and validates against it', () => {
    expect(schema.safeParse(NAVIGATION).success).toBe(true);
    expect(NAVIGATION.groups.flatMap(({ sectionIds: ids }) => ids)).toEqual(sectionIds);
    expect(HOME_SECTION_ID).toBe(SECTION_REGISTRY[0].id);
  });

  it('keeps registry and navigation free of zod so client islands can import them', async () => {
    vi.resetModules();
    vi.doMock('zod', () => {
      throw new Error('client-reachable content imported zod');
    });
    try {
      await expect(import('./section-registry')).resolves.toBeDefined();
      await expect(import('./navigation')).resolves.toBeDefined();
    } finally {
      vi.doUnmock('zod');
      vi.resetModules();
    }
  });

  it('maps every section to the dock control that stays current while it is on screen', () => {
    expect(sectionIds.map(dockKeyForSection)).toEqual([
      'home',
      'home',
      'work',
      'work',
      'shell',
      'shell',
      'menu',
      'menu',
      'menu',
    ]);
    expect(dockKeyForSection('unknown')).toBeUndefined();
  });

  it('formats the position as a zero padded index over the registry size', () => {
    expect(formatSectionPosition('bio')).toBe('01/9');
    expect(formatSectionPosition('sec-shell')).toBe('05/9');
    expect(formatSectionPosition('sec-contact')).toBe('09/9');
    expect(formatSectionPosition('unknown')).toBe('01/9');
  });

  it('rejects groups that drop, reorder or invent sections', () => {
    const dropped = clone();
    at(dropped.groups, 4).sectionIds = [];
    const reordered = clone();
    reordered.groups.reverse();
    const invented = clone();
    at(invented.groups, 0).sectionIds.push('sec-missing');
    for (const candidate of [dropped, reordered, invented]) {
      expect(schema.safeParse(candidate).success).toBe(false);
    }
  });

  it('rejects dock controls that point nowhere or lose the menu', () => {
    const unknownTarget = clone();
    at(unknownTarget.dock, 1).sectionId = 'sec-missing';
    const noMenu = clone();
    noMenu.dock = noMenu.dock.filter((control) => control.key !== 'menu');
    const bothTargets = clone();
    at(bothTargets.dock, 0).href = 'https://example.com';
    const danglingGroup = clone();
    danglingGroup.dock.splice(0, 1);
    for (const candidate of [unknownTarget, noMenu, bothTargets, danglingGroup]) {
      expect(schema.safeParse(candidate).success).toBe(false);
    }
  });

  it('rejects site links that are neither root-relative nor https', () => {
    const insecure = clone();
    at(insecure.siteLinks, 0).href = 'http://example.com';
    expect(schema.safeParse(insecure).success).toBe(false);
  });
});
