import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SECTION_LABELS } from './section-labels';

const EXPECTED_SECTION_COUNT = 19;

describe('SECTION_LABELS', () => {
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
        for (const m of src.matchAll(/<(?:Module|section)\b[\s\S]*?\bid="(sec-[^"]+)"/g)) {
          if (m[1]) ids.add(m[1]);
        }
      }
    }
    for (const id of ids) {
      expect(SECTION_LABELS, `missing label for ${id}`).toHaveProperty(id);
    }
    expect(ids.size).toBe(EXPECTED_SECTION_COUNT);
    expect([...ids].sort()).toEqual(Object.keys(SECTION_LABELS).sort());
  });
});
