import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { About } from '@/components/sections/About';
import { AiMetricsSection } from '@/components/sections/AiMetricsSection';
import { ContactSection } from '@/components/sections/ContactSection';
import { GitLogSection } from '@/components/sections/GitLogSection';
import { GuitarSection } from '@/components/sections/GuitarSection';
import { Hero } from '@/components/sections/Hero';
import { HottestTakesSection } from '@/components/sections/HottestTakesSection';
import { ProjectsSection } from '@/components/sections/ProjectsSection';
import { ShellSection } from '@/components/sections/ShellSection';
import { dockKeyForSection, HOME_SECTION_ID, NAVIGATION } from './navigation';
import { createNavigationSchema, SectionRegistrySchema } from './schemas';
import { SECTION_LABELS } from './section-labels';
import { SECTION_REGISTRY } from './section-registry';
import { SITE_LOCALE } from './site-locale';

vi.mock('@/lib/ua', () => ({ getIsMobile: async () => false }));
vi.mock('@/lib/lighthouse-scores', () => {
  const scores = {
    performance: 0,
    accessibility: 0,
    bestPractices: 0,
    seo: 0,
    fetchedAt: '-',
  };
  return { getScores: async () => scores, LIGHTHOUSE_FALLBACK: scores, LIGHTHOUSE_TTL_S: 90_000 };
});
vi.mock('@/components/client/ContactForm', () => ({ ContactFormLazy: () => null }));
vi.mock('@/components/client/InteractiveShell', () => ({ InteractiveShellLazy: () => null }));

describe('section registry', () => {
  it('contains the nine destinations in rail and position-meter order', () => {
    expect(
      SECTION_REGISTRY.map(({ id, label, order }) => ({ id, label: label.en, order })),
    ).toEqual([
      { id: 'bio', label: 'Home', order: 1 },
      { id: 'sec-readme', label: 'About', order: 2 },
      { id: 'sec-projects', label: 'Projects', order: 3 },
      { id: 'sec-git-log', label: 'Career', order: 4 },
      { id: 'sec-shell', label: 'Interactive shell', order: 5 },
      { id: 'sec-live-metrics', label: 'Measured', order: 6 },
      { id: 'sec-hottest-takes', label: 'Opinions', order: 7 },
      { id: 'sec-guitar', label: 'Guitar and mixer', order: 8 },
      { id: 'sec-contact', label: 'Contact', order: 9 },
    ]);
    // pt-BR labels exist for every destination and keep the same ids and order.
    expect(
      SECTION_REGISTRY.map(({ id, label, order }) => ({ id, label: label.pt, order })),
    ).toEqual([
      { id: 'bio', label: 'Início', order: 1 },
      { id: 'sec-readme', label: 'Sobre', order: 2 },
      { id: 'sec-projects', label: 'Projetos', order: 3 },
      { id: 'sec-git-log', label: 'Carreira', order: 4 },
      { id: 'sec-shell', label: 'Shell interativo', order: 5 },
      { id: 'sec-live-metrics', label: 'Medições', order: 6 },
      { id: 'sec-hottest-takes', label: 'Opiniões', order: 7 },
      { id: 'sec-guitar', label: 'Guitarra e mixer', order: 8 },
      { id: 'sec-contact', label: 'Contato', order: 9 },
    ]);
    expect(SectionRegistrySchema.safeParse(SECTION_REGISTRY).success).toBe(true);
  });

  it('has unique ids and orders and an icon per entry', () => {
    const ids = SECTION_REGISTRY.map(({ id }) => id);
    const orders = SECTION_REGISTRY.map(({ order }) => order);
    expect(new Set(ids).size).toBe(9);
    expect(new Set(orders).size).toBe(9);
    for (const entry of SECTION_REGISTRY) {
      expect(entry.icon.length).toBeGreaterThan(0);
    }
  });

  it('keeps each srLabel equal to the section label table in both locales', () => {
    for (const { id, srLabel } of SECTION_REGISTRY) {
      for (const locale of Object.values(SITE_LOCALE)) {
        expect(SECTION_LABELS[locale][id]).toBe(srLabel[locale]);
      }
    }
  });

  it('targets actual section elements rendered by the home page sections', () => {
    const sections = [
      Hero,
      About,
      ProjectsSection,
      GitLogSection,
      ShellSection,
      AiMetricsSection,
      HottestTakesSection,
      GuitarSection,
      ContactSection,
    ];
    const html = sections
      .map((Section) => renderToStaticMarkup(createElement(Section, { locale: SITE_LOCALE.en })))
      .join('');
    const document = new DOMParser().parseFromString(html, 'text/html');
    for (const { id } of SECTION_REGISTRY) {
      expect(document.querySelectorAll(`section[id="${id}"]`), id).toHaveLength(1);
    }
  });

  it('rejects invalid content and duplicate destinations at the schema boundary', () => {
    const entries = SECTION_REGISTRY.map((entry) => ({ ...entry }));
    for (const patch of [
      { id: '' },
      { id: ' bio ' },
      { label: '' },
      { label: ' Home ' },
      { srLabel: '' },
      { srLabel: ' Home ' },
      { order: 0 },
      { order: 1.5 },
      { icon: 'missing' },
      { id: entries[1]?.id },
      { order: entries[1]?.order },
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
  const clone = () => structuredClone(NAVIGATION[SITE_LOCALE.en]) as unknown as MutableNavigation;

  it('is derived from the registry and validates against it', () => {
    for (const locale of Object.values(SITE_LOCALE)) {
      expect(schema.safeParse(NAVIGATION[locale]).success).toBe(true);
    }
    expect(NAVIGATION[SITE_LOCALE.en].groups.flatMap(({ sectionIds: ids }) => ids)).toEqual(
      sectionIds,
    );
    expect(HOME_SECTION_ID).toBe(SECTION_REGISTRY[0].id);
  });

  it('rejects a protocol-relative site link and a missing reduced-motion label', () => {
    const offsite = clone();
    at(offsite.siteLinks, 0).href = '//evil.example';
    expect(schema.safeParse(offsite).success).toBe(false);
    const unlabeled = clone() as unknown as { copy: Record<string, string> };
    unlabeled.copy.motionReduced = '';
    expect(schema.safeParse(unlabeled).success).toBe(false);
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

  it('names the menu trigger by its action and keeps the removed label out of the copy', () => {
    expect(NAVIGATION[SITE_LOCALE.en].copy.openMenu).toBe('Open menu');
    expect(Object.keys(NAVIGATION[SITE_LOCALE.en].copy)).not.toContain('indexLabel');
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
