import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SECTION_LABELS } from './section-labels';
import { SECTION_REGISTRY } from './section-registry';

const EXPECTED_SECTION_COUNT = 11;

describe('SECTION_LABELS', () => {
  it('uses registry region names while preserving the existing screen reader copy', () => {
    const regionLabels = Object.fromEntries(
      SECTION_REGISTRY.map(({ id }) => [id, SECTION_LABELS[id]]),
    );
    expect(regionLabels).toEqual({
      bio: 'Home',
      'sec-readme': 'About',
      'sec-projects': 'Projects',
      'sec-git-log': 'Career history',
      'sec-shell': 'Interactive shell',
      'sec-live-metrics': 'Measured',
      'sec-hottest-takes': 'Opinions',
      'sec-guitar': 'Guitar rig',
      'sec-contact': 'Contact',
    });
    for (const { id, srLabel } of SECTION_REGISTRY) {
      expect(SECTION_LABELS[id]).toBe(srLabel);
    }
  });

  it('every label is a non-empty plain-English string (not a shell command)', () => {
    for (const [id, label] of Object.entries(SECTION_LABELS)) {
      expect(label.length, id).toBeGreaterThan(0);
      expect(label, id).not.toMatch(/[/~]|--|\.\w/);
    }
  });

  it('labels cover exactly the Module and native section IDs (fail-closed)', () => {
    const dir = join(process.cwd(), 'components/sections');
    const ids = new Set<string>();
    for (const entry of readdirSync(dir)) {
      const sectionDir = join(dir, entry);
      let files: string[] = [];
      try {
        files = readdirSync(sectionDir).filter(
          (f) => f.endsWith('.tsx') && !f.endsWith('.test.tsx'),
        );
      } catch {
        continue;
      }
      for (const file of files) {
        // behavioral-test-allow: enumerates Module and native section IDs to prove label coverage
        const src = readFileSync(join(sectionDir, file), 'utf8');
        const namedIds = new Map(
          Array.from(src.matchAll(/const\s+(\w+)\s*=\s*['"](sec-[^'"]+)['"]/g), (match) => [
            match[1],
            match[2],
          ]),
        );
        for (const m of src.matchAll(
          /<(?:Module|section)\b[\s\S]*?\bid=(?:"(sec-[^"]+)"|\{(\w+)\})/g,
        )) {
          const id = m[1] ?? namedIds.get(m[2]);
          expect(id, `unresolved section id in ${file}`).toBeDefined();
          if (id) ids.add(id);
        }
      }
    }
    expect(ids.has('sec-guitar'), 'guitar module must retain label coverage').toBe(true);
    for (const id of ids) {
      expect(SECTION_LABELS, `missing label for ${id}`).toHaveProperty(id);
    }
    expect(ids.size).toBe(EXPECTED_SECTION_COUNT);
    expect([...ids].sort()).toEqual(
      Object.keys(SECTION_LABELS)
        .filter((id) => id.startsWith('sec-'))
        .sort(),
    );
  });
});
