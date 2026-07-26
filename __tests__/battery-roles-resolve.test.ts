import { existsSync, readdirSync } from 'node:fs';
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
    ['a skill', SKILL],
    ['a command', COMMAND],
  ])('rejects a plugin entry backed only by %s', (_label, only) => {
    expect(
      resolvesWith('p:x', (path) => path === only, roots),
      `A ${_label} satisfied the accept-list. Neither is dispatchable as a subagent_type, so the Agent call errors — and agentDispatchedAfter pairs no result, meaning the failed dispatch still marks the role detected and review:stamp writes with that role unreviewed. pr-review-toolkit:review-pr entered the accept-list exactly this way. The suite above cannot catch a regression here: canObserve() filters every entry out when ~/.claude/agents and ~/.claude/plugins/marketplaces are absent, which is every CI runner, so this host-independent test is the only thing holding it there.`,
    ).toBe(false);
  });

  it('rejects a plugin entry with no backing file at all', () => {
    expect(resolvesWith('p:x', () => false, roots)).toBe(false);
  });
});
