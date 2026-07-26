import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BATTERY_ROLES } from '../scripts/review-stamp';

const REPO_AGENTS = join(process.cwd(), '.claude', 'agents');
const HOME_AGENTS = join(homedir(), '.claude', 'agents');
const MARKETPLACES = join(homedir(), '.claude', 'plugins', 'marketplaces');

function pluginRoots(plugin: string): string[] {
  if (!existsSync(MARKETPLACES)) return [];
  return readdirSync(MARKETPLACES)
    .map((m) => join(MARKETPLACES, m, 'plugins', plugin))
    .filter((p) => existsSync(p));
}

function canObserve(entry: string): boolean {
  if (entry.includes(':')) return existsSync(MARKETPLACES);
  return existsSync(join(REPO_AGENTS, `${entry}.md`)) || existsSync(HOME_AGENTS);
}

function resolvesWith(
  entry: string,
  exists: (path: string) => boolean,
  roots: (plugin: string) => string[],
): boolean {
  const [plugin, name] = entry.includes(':') ? entry.split(':') : [null, entry];
  if (plugin === null) {
    return exists(join(REPO_AGENTS, `${name}.md`)) || exists(join(HOME_AGENTS, `${name}.md`));
  }
  return roots(plugin).some((root) => exists(join(root, 'agents', `${name}.md`)));
}

function resolves(entry: string): boolean {
  return resolvesWith(entry, existsSync, pluginRoots);
}

const ENTRIES = BATTERY_ROLES.flatMap((r) => r.accepts.map((a) => [r.role, a] as const));
const OBSERVABLE = ENTRIES.filter(([, entry]) => canObserve(entry));
const UNOBSERVABLE = ENTRIES.filter(([, entry]) => !canObserve(entry));

describe('BATTERY_ROLES accept-lists', () => {
  it('every role keeps at least one accepted entry', () => {
    for (const role of BATTERY_ROLES) expect(role.accepts.length, role.role).toBeGreaterThan(0);
  });

  it.each(OBSERVABLE)(
    'role %s accepts %s, which resolves to something installed',
    (_role, entry) => {
      expect(
        resolves(entry),
        `${entry} resolves to no installed agent (agents/<name>.md). A skill or a command does NOT count: neither is dispatchable as a subagent_type. agentDispatchedAfter requires no result pairing, so dispatching something that cannot run still satisfies the role and the stamp passes. ui-ux-tester, dependency-manager, and bare code-reviewer all stayed dead this way. A plugin-qualified name is checked against the plugin, never trusted for containing a colon.`,
      ).toBe(true);
    },
  );

  if (UNOBSERVABLE.length > 0) {
    it.skip.each(UNOBSERVABLE)(
      'role %s accepts %s, needs host-only install state',
      (_role, entry) => {
        expect(resolves(entry)).toBe(true);
      },
    );
  }
});

describe('resolvesWith — host-independent, so CI actually pins the predicate', () => {
  const AGENT = 'somewhere/plugins/p/agents/x.md';
  const SKILL = 'somewhere/plugins/p/skills/x/SKILL.md';
  const COMMAND = 'somewhere/plugins/p/commands/x.md';
  const roots = () => ['somewhere/plugins/p'];

  it('accepts a plugin entry backed by an agent definition', () => {
    expect(resolvesWith('p:x', (path) => path === AGENT, roots)).toBe(true);
  });

  it.each([
    ['skill', SKILL],
    ['command', COMMAND],
  ])('rejects a plugin entry backed only by a %s', (label, only) => {
    expect(
      resolvesWith('p:x', (path) => path === only, roots),
      `A ${label} satisfied the accept-list. Neither is dispatchable as a subagent_type, so the Agent call errors — and agentDispatchedAfter pairs no result, meaning the failed dispatch still marks the role detected and review:stamp writes with that role unreviewed. pr-review-toolkit:review-pr entered the accept-list exactly this way. The suite above cannot catch a regression here: canObserve() filters every entry out when ~/.claude/agents and ~/.claude/plugins/marketplaces are absent, which is every CI runner, so this host-independent test is the only thing holding it there.`,
    ).toBe(false);
  });

  it('rejects a plugin entry with no backing file at all', () => {
    expect(resolvesWith('p:x', () => false, roots)).toBe(false);
  });

  const BARE_AGENT = join(HOME_AGENTS, 'x.md');

  it('accepts a bare-name entry backed by an agent definition', () => {
    expect(resolvesWith('x', (path) => path === BARE_AGENT, roots)).toBe(true);
  });

  it.each([
    ['a directory rather than a file', HOME_AGENTS],
    ['a home command', join(homedir(), '.claude', 'commands', 'x.md')],
    ['a home skill', join(homedir(), '.claude', 'skills', 'x', 'SKILL.md')],
  ])('rejects a bare-name entry backed only by %s', (label, only) => {
    expect(
      resolvesWith('x', (path) => path === only, roots),
      `A bare-name accept resolved through ${label}. This branch serves documentation-engineer (claim-drift) and security-auditor (gate-robustness) — half the battery — and it executes NOWHERE on CI: neither has a definition under .claude/agents/, so canObserve() routes both to UNOBSERVABLE and every host-dependent assertion is skipped on a runner. These cases are the only thing pinning it, which is why widening the branch to a directory or to a commands/skills path must fail here rather than pass everywhere.`,
    ).toBe(false);
  });
});

const AGENT_NAME = /(?:[\w-]+:)?(?:code-reviewer|review-pr|pr-test-analyzer)\b/g;

// Derived, never enumerated: a hand-listed set is the drift this gate exists to
// stop, and the first version of it already both omitted two docs that name the
// agents and listed one that names none.
function proseSurfaces(): string[] {
  const roots = ['docs', 'scripts', '.claude/commands', '.claude/hooks', '.claude/skills'];
  const out: string[] = [];
  const walk = (dir: string) => {
    if (!existsSync(dir)) return;
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      // Fixtures name dead aliases on purpose — .claude/hooks/__tests__/run.sh
      // feeds a bare code-reviewer through architect-gate precisely to prove a
      // PASS from the wrong agent is rejected. Instructions do not live in test
      // directories, so excluding them costs no coverage.
      if (e.isDirectory()) {
        if (e.name !== '__tests__' && e.name !== 'tests') walk(p);
      } else if (/\.(md|ts|sh)$/.test(e.name) && AGENT_NAME.test(readFileSync(p, 'utf8')))
        out.push(p);
    }
  };
  for (const r of roots) walk(join(process.cwd(), r));
  return out;
}

describe('prose that names the pre-PR review agent stays inside its accept-list', () => {
  const accepted = new Set(BATTERY_ROLES.flatMap((r) => r.accepts));

  const surfaces = proseSurfaces();

  it('finds surfaces to check, rather than silently checking none', () => {
    expect(
      surfaces.length,
      'No file under docs/, scripts/ or .claude/ names a review agent. Either the derivation broke — in which case this gate is checking nothing while reporting green — or every reference was removed, which would itself be the drift.',
    ).toBeGreaterThan(3);
  });

  it.each(surfaces)('%s names only dispatchable agents', (path) => {
    const rel = path.replace(`${process.cwd()}/`, '');
    const named = [...new Set(readFileSync(path, 'utf8').match(AGENT_NAME) ?? [])];
    const undispatchable = named.filter((n) => !accepted.has(n));
    expect(
      undispatchable,
      `${rel} instructs an operator to use a pr-review-toolkit name that no BATTERY_ROLES accept-list contains, so following it produces a dispatch the stamp will not count and .husky/pre-push then blocks on guidance the repo itself gave.\n\nThis is not hypothetical. CLAUDE.md was corrected to pr-review-toolkit:code-reviewer while these operational surfaces kept saying review-pr, and it took an external reviewer to notice — a name is valid as a SLASH COMMAND while being undispatchable as a subagent_type, so nothing mechanical caught the split.\n\nIf a surface legitimately references a skill rather than an agent, exclude that file here with a reason rather than widening the accept-list, which is the fail-open direction.\n\nnamed: ${named.join(', ') || '(none)'}\naccepted: ${[...accepted].sort().join(', ')}`,
    ).toEqual([]);
  });
});
