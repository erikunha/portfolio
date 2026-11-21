import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  applyIndex,
  INDEX_END,
  INDEX_START,
  parseDecisions,
  renderIndex,
} from '../codegen/decisions-index';

const ROOT = join(import.meta.dirname, '../..');
const DECISIONS_PATH = join(ROOT, 'DECISIONS.md');

const FIXTURE = [
  '# DECISIONS',
  '',
  'Intro paragraph.',
  '',
  '- **2026-11-18** · **The bridge reports nothing.** Body one. _Reversible: documentation only; restore it._',
  '- **2026-11-17** · **Pipes | in a title.** Body two with `a | b`.',
  '  Continuation line. _Reversible: delete the file._',
  '',
  '## 2026-11-09: the hero h1 sits at 36px',
  '',
  '- **2026-11-09** · **Stop control moves.** Body three. **Superseded (2026-11-13):** moved again. _Reversible: revert the commit._',
  '- **2026-11-08** · A plain first sentence with no bold title. More text.',
  '- **Follow-up, not done here:** an undated bullet.',
  '',
  '## 2026-05-31, Tailwind v4 migration: LHCI failures',
  '',
  '- **2026-05-31**: **Colon separator.** Body. **Superseded in part by the 2026-06-01 entry.**',
  '',
].join('\n');

describe('parseDecisions', () => {
  const entries = parseDecisions(FIXTURE);

  it('reads one entry per dated bullet and skips undated bullets', () => {
    expect(entries.map((entry) => entry.date)).toEqual([
      '2026-11-18',
      '2026-11-17',
      '2026-11-09',
      '2026-11-08',
      '2026-05-31',
    ]);
  });

  it('takes the bold lead as the title and the first sentence when there is none', () => {
    expect(entries[0]?.title).toBe('The bridge reports nothing');
    expect(entries[3]?.title).toBe('A plain first sentence with no bold title');
  });

  it('takes the area from the enclosing heading with its date stripped', () => {
    expect(entries[0]?.area).toBe('general');
    expect(entries[2]?.area).toBe('the hero h1 sits at 36px');
    expect(entries[4]?.area).toBe('Tailwind v4 migration: LHCI failures');
  });

  it('classifies status from the Superseded marker', () => {
    expect(entries.map((entry) => entry.status)).toEqual([
      'active',
      'active',
      'superseded',
      'active',
      'partly superseded',
    ]);
  });

  it('reads the first clause of the reversibility note, across continuation lines', () => {
    expect(entries.map((entry) => entry.reversibility)).toEqual([
      'documentation only',
      'delete the file',
      'revert the commit',
      'unstated',
      'unstated',
    ]);
  });
});

describe('renderIndex', () => {
  it('renders one table row per entry and escapes pipes', () => {
    const block = renderIndex(parseDecisions(FIXTURE));
    expect(block.startsWith(INDEX_START)).toBe(true);
    expect(block.trimEnd().endsWith(INDEX_END)).toBe(true);
    expect(block).toContain(
      '| 2026-11-18 | general | The bridge reports nothing | active | documentation only |',
    );
    expect(block).toContain('Pipes \\| in a title');
    expect(block.split('\n').filter((line) => /^\| \d{4}-/.test(line))).toHaveLength(5);
  });
});

describe('applyIndex', () => {
  it('inserts the block after the intro and leaves every other byte alone', () => {
    const applied = applyIndex(FIXTURE);
    const start = applied.indexOf(INDEX_START);
    const end = applied.indexOf(INDEX_END) + INDEX_END.length + 2;
    expect(applied.slice(0, start) + applied.slice(end)).toBe(FIXTURE);
  });

  it('is idempotent', () => {
    const once = applyIndex(FIXTURE);
    expect(applyIndex(once)).toBe(once);
  });

  it('replaces a stale block and never parses its own rows as entries', () => {
    const stale = applyIndex(FIXTURE.replace('Body one.', 'Changed body.')).replace(
      'The bridge reports nothing',
      'Stale title',
    );
    expect(applyIndex(stale)).toBe(applyIndex(FIXTURE.replace('Body one.', 'Changed body.')));
  });
});

describe('DECISIONS.md', () => {
  it('holds the committed index the generator produces', () => {
    const committed = readFileSync(DECISIONS_PATH, 'utf8');
    expect(committed, 'run `pnpm decisions:index` and commit DECISIONS.md').toBe(
      applyIndex(committed),
    );
  });

  it('indexes every dated bullet', () => {
    const committed = readFileSync(DECISIONS_PATH, 'utf8');
    const dated = committed.split('\n').filter((line) => /^- \*\*\d{4}-\d{2}-\d{2}\*\*/.test(line));
    expect(parseDecisions(committed)).toHaveLength(dated.length);
  });
});
