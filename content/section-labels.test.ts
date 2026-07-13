import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SECTION_LABELS } from './section-labels';

describe('SECTION_LABELS', () => {
  it('every label is a non-empty plain-English string (not a shell command)', () => {
    for (const [id, label] of Object.entries(SECTION_LABELS)) {
      expect(label.length, id).toBeGreaterThan(0);
      expect(label, id).not.toMatch(/[/~]|--|\.\w/);
    }
  });

  it('every Module rendered by a section has a SECTION_LABELS entry (fail-closed)', () => {
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
        // behavioral-test-allow: enumerates every Module id a section renders to prove label coverage
        const src = readFileSync(join(sectionDir, file), 'utf8');
        for (const m of src.matchAll(/<Module\b[\s\S]*?\bid="(sec-[^"]+)"/g)) {
          if (m[1]) ids.add(m[1]);
        }
      }
    }
    for (const id of ids) {
      expect(SECTION_LABELS, `missing label for ${id}`).toHaveProperty(id);
    }
    expect(ids.size).toBeGreaterThanOrEqual(20);
  });
});
