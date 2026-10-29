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
import { SectionRegistrySchema } from './schemas';
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
  return { getScores: async () => scores, LIGHTHOUSE_FALLBACK: scores, LIGHTHOUSE_TTL_S: 90_000 };
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
      { id: 'sec-live-metrics', label: 'Measured', order: 6 },
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
    expect(getSectionByAlias('sec-live-perf')?.id).toBe('sec-live-metrics');
    for (const { id, srLabel } of SECTION_REGISTRY) {
      expect(SECTION_LABELS[id]).toBe(srLabel);
    }
    expect(SECTION_LABELS['sec-daw-mixer']).toBe('DAW mixer');
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
