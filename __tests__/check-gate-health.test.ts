import { describe, expect, it } from 'vitest';
import {
  auditGates,
  collectScriptRefs,
  collectSettingsHookPaths,
} from '../scripts/check-gate-health';

describe('collectScriptRefs', () => {
  it('extracts a $REPO_ROOT-anchored script reference', () => {
    expect(collectScriptRefs('node "$REPO_ROOT/scripts/lint-token-boundary.mjs"')).toEqual([
      'scripts/lint-token-boundary.mjs',
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
      hookFiles: [
        { name: '.claude/hooks/css-token-guard.sh', refs: ['scripts/lint-token-boundary.mjs'] },
      ],
      settingsRefs: [],
      exists: () => false,
    });
    expect(dead).toHaveLength(1);
    expect(dead[0]).toMatchObject({
      source: '.claude/hooks/css-token-guard.sh',
      ref: 'scripts/lint-token-boundary.mjs',
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
      hookFiles: [{ name: 'h', refs: ['scripts/ok.mjs'] }],
      settingsRefs: ['.claude/hooks/ok.sh'],
      exists: () => true,
    });
    expect(dead).toEqual([]);
  });
});
