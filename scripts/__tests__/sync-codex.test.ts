import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import {
  AGENTS_BANNER,
  CODEX_NOTE,
  findFiction,
  insertNote,
  referencedHookSiblings,
  referencedMirrorPaths,
  rewriteText,
  undisclaimedEnforcementClaims,
  unresolvedRefs,
} from '../sync-codex.mjs';

const noneOnDisk = () => false;

describe('rewriteText — only the five harness paths are agent-specific', () => {
  it('routes skills to .agents and hooks/rules/agents to .codex', () => {
    expect(rewriteText('see .claude/skills/x')).toBe('see .agents/skills/x');
    expect(rewriteText('.claude/hooks/bash-guard.sh')).toBe('.codex/hooks/bash-guard.sh');
    expect(rewriteText('.claude/rules/api-boundary.md')).toBe('.codex/rules/api-boundary.md');
    expect(rewriteText('.claude/agents/architect-reviewer.md')).toBe(
      '.codex/agents/architect-reviewer.md',
    );
    expect(rewriteText('read CLAUDE.md first')).toBe('read AGENTS.md first');
  });

  it('rewrites CLAUDE.md even when an escape char precedes it (hook message "\\nCLAUDE.md:")', () => {
    expect(rewriteText('detected.\\nCLAUDE.md: use git add -u')).toBe(
      'detected.\\nAGENTS.md: use git add -u',
    );
  });

  it('leaves repo facts untouched — the model, command, bot, and gate pass through verbatim', () => {
    const facts =
      'model anthropic/claude-haiku-4-5, run /claude-review, wait on claude[bot], pnpm claude-gate';
    expect(rewriteText(facts)).toBe(facts);
  });

  it('does NOT invent a Codex settings.json — .claude/settings.json is not one of the five', () => {
    expect(rewriteText('.claude/settings.json')).toBe('.claude/settings.json');
  });

  it('rewrites the auto-load self-claim (false for the mirror) but leaves other Claude Code facts', () => {
    expect(rewriteText('Auto-loaded by Claude Code every session')).toBe(
      'Auto-loaded by Codex every session',
    );
    expect(rewriteText('Claude Code is available as a CLI')).toBe(
      'Claude Code is available as a CLI',
    );
  });

  it('scopes the live-fire "Confirmed enforced" citation to where hooks are registered', () => {
    expect(rewriteText('**Confirmed enforced (2026-06-06):**')).toBe(
      '**Confirmed enforced where hooks are registered (2026-06-06):**',
    );
  });

  it('leaves text without the "Confirmed enforced" phrase unchanged', () => {
    expect(rewriteText('no enforcement claim here')).toBe('no enforcement claim here');
  });
});

describe('findFiction — a leaked rewrite that names nothing real', () => {
  it.each([
    'anthropic/Codex-haiku-4-5',
    '/Codex-review',
    'Codex[bot]',
    'pnpm Codex-gate',
    'check-Codex-approval',
    '.Codex/hooks',
  ])('flags %s', (text) => {
    expect(findFiction(text)).not.toBeNull();
  });

  it('passes clean mirror text', () => {
    expect(findFiction('run /claude-review and wait on claude[bot]')).toBeNull();
  });
});

describe('referencedMirrorPaths — the dangling-ref surface the fail-open predecessor could not see', () => {
  it('extracts the .agents and .codex paths a rewritten file points at', () => {
    const text = 'uses .codex/rules/api-boundary.md and .agents/skills/semgrep/SKILL.md';
    expect(referencedMirrorPaths(text)).toEqual([
      '.codex/rules/api-boundary.md',
      '.agents/skills/semgrep/SKILL.md',
    ]);
  });

  it('ignores unrelated .claude paths (they are correctly left alone, not mirror targets)', () => {
    expect(referencedMirrorPaths('.claude/settings.json and .claude/.review-passed')).toEqual([]);
  });

  it('excludes the named runtime-state marker but stays fail-closed on any other dotfile', () => {
    expect(referencedMirrorPaths('writes to .codex/.api-edit-pending')).toEqual([]);
    // a DIFFERENT dotfile is still caught (the exemption is a named set, not "any dotfile")
    expect(referencedMirrorPaths('reads .codex/.some-other-state')).toEqual([
      '.codex/.some-other-state',
    ]);
    expect(referencedMirrorPaths('see .codex/rules/api-boundary.md')).toEqual([
      '.codex/rules/api-boundary.md',
    ]);
  });
});

describe('undisclaimedEnforcementClaims — a generated .md must not assert enforcement it cannot deliver', () => {
  const FAILURE_MESSAGE =
    'a generated doc asserting hook enforcement without the self-enforce disclaimer lies to the mirror runtime — see sync-codex CODEX_NOTE design';

  it(FAILURE_MESSAGE, () => {
    expect(undisclaimedEnforcementClaims('this hook is WIRED to block the tool call')).toEqual([
      'WIRED',
    ]);
  });

  it(`detects "exit 2" without a disclaimer — ${FAILURE_MESSAGE}`, () => {
    expect(undisclaimedEnforcementClaims('the guard uses exit 2 to block')).toEqual(['exit 2']);
  });

  it(`detects "Confirmed enforced" without a disclaimer — ${FAILURE_MESSAGE}`, () => {
    expect(undisclaimedEnforcementClaims('**Confirmed enforced (2026-06-06):** it fired')).toEqual([
      'Confirmed enforced',
    ]);
  });

  it('dedupes a token repeated in one body', () => {
    expect(undisclaimedEnforcementClaims('WIRED here and WIRED there and exit 2 as well')).toEqual([
      'WIRED',
      'exit 2',
    ]);
  });

  it(`passes once the CODEX_NOTE disclaimer is present — ${FAILURE_MESSAGE}`, () => {
    const body = `${CODEX_NOTE}this hook is WIRED to block the tool call`;
    expect(undisclaimedEnforcementClaims(body)).toBeNull();
  });

  it(`passes "exit 2" once the AGENTS_BANNER disclaimer is present — ${FAILURE_MESSAGE}`, () => {
    const body = `${AGENTS_BANNER}the guard uses exit 2 to block`;
    expect(undisclaimedEnforcementClaims(body)).toBeNull();
  });

  it('passes a body with none of the enforcement tokens, disclaimer or not', () => {
    expect(undisclaimedEnforcementClaims('just some ordinary prose')).toBeNull();
  });
});

describe('insertNote — the Codex disclaimer must not break a skill frontmatter', () => {
  const NOTE = '> Codex note.\n\n';

  it('inserts AFTER frontmatter so the ---name/description--- block stays the first bytes', () => {
    const skill = '---\nname: x\ndescription: the hook blocks it (exit 2)\n---\n# Body\n';
    const out = insertNote(skill, NOTE);
    expect(out.startsWith('---\nname: x\ndescription: the hook blocks it (exit 2)\n---\n')).toBe(
      true,
    );
    expect(out).toContain(`---\n${NOTE}`);
    expect(out.endsWith('# Body\n')).toBe(true);
  });

  it('prepends when there is no frontmatter', () => {
    expect(insertNote('# Rule\nbody\n', NOTE)).toBe(`${NOTE}# Rule\nbody\n`);
  });
});

describe('referencedHookSiblings — the relative detector a path scan cannot catch', () => {
  it('extracts $HOOK_DIR-relative dependencies a hook invokes', () => {
    const guard = 'python3 "$HOOK_DIR/bash-guard-detect.py" 2>/dev/null';
    expect(referencedHookSiblings(guard)).toEqual(['bash-guard-detect.py']);
  });
});

// The fail-closed decision, mutation-proven without the filesystem. This is the exact gap the
// predecessor could not see: a reference that is NOT another mirror target (so the drift diff
// never fires) and does not exist on disk. Drift catches a removed target; only this catches a
// reference to something that was never generated at all.
describe('unresolvedRefs — fail closed on a reference to a never-generated file', () => {
  it('flags a rule reference that is neither a mirror target nor on disk', () => {
    const problems = unresolvedRefs({
      to: 'AGENTS.md',
      text: 'see .codex/rules/ghost-rule.md',
      present: new Set(['AGENTS.md']),
      exists: noneOnDisk,
    });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('.codex/rules/ghost-rule.md');
  });

  it('flags a hook that invokes a $HOOK_DIR sibling that was never mirrored', () => {
    const problems = unresolvedRefs({
      to: '.codex/hooks/bash-guard.sh',
      text: 'python3 "$HOOK_DIR/bash-guard-detect.py"',
      present: new Set(['.codex/hooks/bash-guard.sh']),
      exists: noneOnDisk,
    });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('bash-guard-detect.py');
  });

  it('passes when every reference resolves to a mirror target', () => {
    const problems = unresolvedRefs({
      to: '.codex/hooks/bash-guard.sh',
      text: 'python3 "$HOOK_DIR/bash-guard-detect.py" and see .codex/rules/api-boundary.md',
      present: new Set([
        '.codex/hooks/bash-guard.sh',
        '.codex/hooks/bash-guard-detect.py',
        '.codex/rules/api-boundary.md',
      ]),
      exists: noneOnDisk,
    });
    expect(problems).toEqual([]);
  });
});

// The load-bearing behavior: --check must FAIL CLOSED on an incomplete mirror, not only on a
// content diff. This runs the real gate against the working tree, so it doubles as proof the
// committed mirror is both in-sync AND internally complete (every referenced file exists).
describe('the --check gate against the committed mirror', () => {
  it('exits 0: mirror is in sync and references nothing missing', () => {
    expect(() =>
      execFileSync('node', ['scripts/sync-codex.mjs', '--check'], { encoding: 'utf-8' }),
    ).not.toThrow();
  });
});
