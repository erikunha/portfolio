import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

// behavioral-test-allow: the artifacts under test ARE the workflow files; the tool allowlist an action runs with has no runtime surface in this repository.
const read = (name: string) =>
  readFileSync(join(process.cwd(), '.github', 'workflows', name), 'utf8');

type Step = { uses?: string; with?: { claude_args?: string } };
type Workflow = { jobs: Record<string, { permissions?: Record<string, string>; steps: Step[] }> };

function actionStep(name: string): { args: string; permissions: Record<string, string> } {
  const job = Object.values((parse(read(name)) as Workflow).jobs)[0];
  const step = job?.steps.find((s) => s.uses?.startsWith('anthropics/claude-code-action'));
  return { args: step?.with?.claude_args ?? '', permissions: job?.permissions ?? {} };
}

function listAfter(flag: string, args: string): string[] {
  const match = new RegExp(`${flag} "([^"]*)"`).exec(args);
  return (match?.[1] ?? '').split(',').filter(Boolean);
}

const WRITING_TOOLS = ['Edit', 'MultiEdit', 'Write', 'NotebookEdit', 'Bash'];

describe('claude.yml tool restriction', () => {
  const interactive = actionStep('claude.yml');
  const review = actionStep('claude-review.yml');

  it('allows read-only tools and none that write', () => {
    const allowed = listAfter('--allowedTools', interactive.args);
    expect(allowed.length).toBeGreaterThan(0);
    expect(allowed.filter((tool) => WRITING_TOOLS.includes(tool))).toEqual([]);
  });

  it('disallows every tool the review workflow disallows', () => {
    const disallowed = new Set(listAfter('--disallowedTools', interactive.args));
    const missing = listAfter('--disallowedTools', review.args).filter((t) => !disallowed.has(t));
    expect(missing).toEqual([]);
  });

  it('holds no contents write scope, so the job cannot push', () => {
    expect(interactive.permissions.contents).not.toBe('write');
  });
});
