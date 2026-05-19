import { describe, expect, it, vi } from 'vitest';
import { createRefRewriter } from '@/scripts/lib/copilot/refs';
import type { PortedNames } from '@/scripts/lib/copilot/types';

describe('createRefRewriter', () => {
  it('rewrites [[skill]] to /skill when kind is skill', () => {
    const ported: PortedNames = new Map([['writing-plans', 'skill']]);
    const rw = createRefRewriter(ported);
    expect(rw.rewrite('Use [[writing-plans]] next.')).toBe('Use /writing-plans next.');
  });

  it('rewrites [[agent]] to @agent on first occurrence (with /agent parenthetical) per file', () => {
    const ported: PortedNames = new Map([['code-reviewer', 'agent']]);
    const rw = createRefRewriter(ported);
    const out = rw.rewrite('First [[code-reviewer]] and second [[code-reviewer]].');
    expect(out).toBe('First @code-reviewer (or /code-reviewer) and second @code-reviewer.');
  });

  it('produces a fresh first-occurrence state per rewriter instance', () => {
    const ported: PortedNames = new Map([['code-reviewer', 'agent']]);
    const rw1 = createRefRewriter(ported);
    const rw2 = createRefRewriter(ported);
    expect(rw1.rewrite('[[code-reviewer]]')).toContain('(or /code-reviewer)');
    expect(rw2.rewrite('[[code-reviewer]]')).toContain('(or /code-reviewer)');
  });

  it('replaces unported [[ref]] with HTML comment and emits a warning', () => {
    const ported: PortedNames = new Map();
    const warn = vi.fn();
    const rw = createRefRewriter(ported, { onWarn: warn });
    const out = rw.rewrite('Use [[no-such-skill]] here.');
    expect(out).toContain('<!-- originally referenced [no-such-skill] — not ported -->');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('no-such-skill'));
  });

  it('does not rewrite prose tool references like "Bash tool"', () => {
    const ported: PortedNames = new Map();
    const rw = createRefRewriter(ported);
    expect(rw.rewrite('uses the Bash tool to run tests')).toBe('uses the Bash tool to run tests');
  });
});
