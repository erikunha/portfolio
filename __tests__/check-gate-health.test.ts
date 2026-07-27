import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import {
  auditGates,
  collectHookRefs,
  collectScriptRefs,
  collectSettingsHookPaths,
} from '../scripts/check-gate-health';

describe('collectScriptRefs', () => {
  it('extracts a $REPO_ROOT-anchored script reference', () => {
    expect(collectScriptRefs('node "$REPO_ROOT/scripts/does-not-exist.mjs"')).toEqual([
      'scripts/does-not-exist.mjs',
    ]);
  });

  it('extracts bare references and dedups', () => {
    const content = 'node scripts/foo.ts\nnode scripts/foo.ts\nnode scripts/lib/bar.mjs';
    expect(collectScriptRefs(content).sort()).toEqual(['scripts/foo.ts', 'scripts/lib/bar.mjs']);
  });

  it('ignores non-script and non-code paths', () => {
    expect(collectScriptRefs('echo scripts/notes.txt; cat foo.mjs')).toEqual([]);
  });

  it('ignores script paths mentioned only in shell comments', () => {
    const hook =
      '# legacy: scripts/old-removed.mjs was deleted in the migration\nnode scripts/live.mjs';
    expect(collectScriptRefs(hook)).toEqual(['scripts/live.mjs']);
  });
});

describe('collectSettingsHookPaths', () => {
  it('walks nested PreToolUse/PostToolUse hook commands', () => {
    const settings = {
      hooks: {
        PreToolUse: [{ matcher: 'Bash', hooks: [{ command: '.claude/hooks/bash-guard.sh' }] }],
        PostToolUse: [
          { matcher: 'Edit|Write', hooks: [{ command: '.claude/hooks/api-edit-marker.sh' }] },
        ],
      },
    };
    expect(collectSettingsHookPaths(settings).sort()).toEqual([
      '.claude/hooks/api-edit-marker.sh',
      '.claude/hooks/bash-guard.sh',
    ]);
  });

  it('returns [] when there are no hooks', () => {
    expect(collectSettingsHookPaths({})).toEqual([]);
  });
});

describe('auditGates', () => {
  it('flags a hook that references a missing script (the dead-hook class)', () => {
    const dead = auditGates({
      hookFiles: [{ name: '.claude/hooks/example-guard.sh', refs: ['scripts/does-not-exist.mjs'] }],
      settingsRefs: ['.claude/hooks/example-guard.sh'],
      exists: (rel) => rel !== 'scripts/does-not-exist.mjs',
    });
    expect(dead).toHaveLength(1);
    expect(dead[0]).toMatchObject({
      source: '.claude/hooks/example-guard.sh',
      ref: 'scripts/does-not-exist.mjs',
      kind: 'hook->script',
    });
  });

  it('flags a settings entry pointing at a missing hook file', () => {
    const dead = auditGates({
      hookFiles: [],
      settingsRefs: ['.claude/hooks/removed.sh'],
      exists: () => false,
    });
    expect(dead).toEqual([
      { source: '.claude/settings.json', ref: '.claude/hooks/removed.sh', kind: 'settings->hook' },
    ]);
  });

  it('passes when every reference resolves', () => {
    const dead = auditGates({
      hookFiles: [{ name: '.claude/hooks/ok.sh', refs: ['scripts/ok.mjs'] }],
      settingsRefs: ['.claude/hooks/ok.sh'],
      exists: () => true,
    });
    expect(dead).toEqual([]);
  });

  it('flags a hook file on disk that no settings matcher wires (the inert-hook class)', () => {
    const dead = auditGates({
      hookFiles: [{ name: '.claude/hooks/orphan-guard.sh', refs: [] }],
      settingsRefs: [],
      exists: () => true,
    });
    expect(dead).toEqual([
      {
        source: '.claude/hooks/orphan-guard.sh',
        ref: '.claude/settings.json',
        kind: 'hook->unwired',
      },
    ]);
  });

  it('a hook path in a shell COMMENT is not an invocation, so it cannot wire an orphan', () => {
    const dead = auditGates({
      hookFiles: [
        {
          name: '.claude/hooks/entry.sh',
          refs: [],
          hookRefs: collectHookRefs('# replaces .claude/hooks/helper.sh\n'),
        },
        { name: '.claude/hooks/helper.sh', refs: [] },
      ],
      settingsRefs: ['.claude/hooks/entry.sh'],
      exists: () => true,
    });
    expect(
      dead.map((d) => d.source),
      'A commented-out mention satisfying the sibling exemption is the same fail-open this kind was added to close: the orphan reads as wired because prose named it.',
    ).toEqual(['.claude/hooks/helper.sh']);
  });

  it('does not flag a hook invoked by a sibling hook rather than by settings', () => {
    const dead = auditGates({
      hookFiles: [
        { name: '.claude/hooks/entry.sh', refs: [], hookRefs: ['.claude/hooks/helper.sh'] },
        { name: '.claude/hooks/helper.sh', refs: [] },
      ],
      settingsRefs: ['.claude/hooks/entry.sh'],
      exists: () => true,
    });
    expect(dead).toEqual([]);
  });

  it('an unwired hook cannot vouch for the hook it invokes — both are flagged', () => {
    const dead = auditGates({
      hookFiles: [
        {
          name: '.claude/hooks/dead.sh',
          refs: [],
          hookRefs: ['.claude/hooks/reached-only-by-dead.sh'],
        },
        { name: '.claude/hooks/reached-only-by-dead.sh', refs: [] },
      ],
      settingsRefs: [],
      exists: () => true,
    });
    expect(
      dead.map((d) => d.source).sort(),
      "Reachability must start at settings.json and follow hookRefs only through hooks already proven reachable. Unioning every hook's outbound refs lets a hook that never runs certify the one it calls.",
    ).toEqual(['.claude/hooks/dead.sh', '.claude/hooks/reached-only-by-dead.sh']);
  });

  it('follows a wired hook through two hops of sibling invocation', () => {
    const dead = auditGates({
      hookFiles: [
        { name: '.claude/hooks/entry.sh', refs: [], hookRefs: ['.claude/hooks/mid.sh'] },
        { name: '.claude/hooks/mid.sh', refs: [], hookRefs: ['.claude/hooks/leaf.sh'] },
        { name: '.claude/hooks/leaf.sh', refs: [] },
      ],
      settingsRefs: ['.claude/hooks/entry.sh'],
      exists: () => true,
    });
    expect(dead).toEqual([]);
  });

  it('flags every unwired hook rather than stopping at the first', () => {
    const dead = auditGates({
      hookFiles: [
        { name: '.claude/hooks/a.sh', refs: [] },
        { name: '.claude/hooks/b.sh', refs: [] },
      ],
      settingsRefs: [],
      exists: () => true,
    });
    expect(dead.map((d) => d.source)).toEqual(['.claude/hooks/a.sh', '.claude/hooks/b.sh']);
  });
});

describe('the gate against the committed harness', () => {
  it('exits 0: every hook resolves and every hook file is wired', () => {
    expect(() =>
      execFileSync('node', ['--import', 'tsx', 'scripts/check-gate-health.ts'], {
        encoding: 'utf-8',
      }),
    ).not.toThrow();
  });
});
