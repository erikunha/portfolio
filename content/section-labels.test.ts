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

  it('every section that renders a Module has a SECTION_LABELS entry (fail-closed)', () => {
    const dir = join(process.cwd(), 'components/sections');
    const ids = new Set<string>();
    for (const entry of readdirSync(dir)) {
      const file = join(dir, entry, `${entry}.tsx`);
      let src = '';
      try {
        // behavioral-test-allow: enumerates section ids to prove label coverage
        src = readFileSync(file, 'utf8');
      } catch {
        continue;
      }
      if (!/<Module\b/.test(src)) continue;
      const m = src.match(/id="(sec-[^"]+)"/);
      if (m?.[1]) ids.add(m[1]);
    }
    for (const id of ids) {
      expect(SECTION_LABELS, `missing label for ${id}`).toHaveProperty(id);
    }
    expect(ids.size).toBeGreaterThanOrEqual(18);
  });
});
