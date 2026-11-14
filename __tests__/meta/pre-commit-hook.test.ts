import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const HOOK_PATH = join(import.meta.dirname, '..', '..', '.husky', 'pre-commit');

function hookCommands(source: string): string[] {
  return source
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'));
}

function violatesPreCommitContract(source: string): boolean {
  const commands = hookCommands(source);
  return (
    !commands.includes('pnpm check:staged') ||
    !commands.includes('pnpm gitleaks:staged') ||
    commands.includes('pnpm check')
  );
}

describe('.husky/pre-commit', () => {
  const hook = readFileSync(HOOK_PATH, 'utf8');

  it('lints staged files and scans staged secrets', () => {
    const commands = hookCommands(hook);
    expect(commands).toContain('pnpm check:staged');
    expect(commands).toContain('pnpm gitleaks:staged');
  });

  it('never runs the whole-tree check', () => {
    expect(hookCommands(hook)).not.toContain('pnpm check');
  });

  it('flags a hook that runs the whole-tree check', () => {
    expect(violatesPreCommitContract(hook)).toBe(false);
    expect(violatesPreCommitContract(hook.replace('pnpm check:staged', 'pnpm check'))).toBe(true);
  });
});
