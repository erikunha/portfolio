import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

// behavioral-test-allow: the artifacts under test ARE the review skill's markdown, the CI reviewer
// prompt and its workflow. Their property (every source section mapped, CI wired to the skill)
// has no runtime surface other than these files.
const root = join(__dirname, '..');
const skillDir = join(root, '.claude/skills/pr-review-orchestrator');
const coverage = readFileSync(join(skillDir, 'references/coverage.md'), 'utf8');
const SOURCE_SECTION_COUNT = 134;

const rows = coverage
  .split('\n')
  .map((line) => line.match(/^\| (\d+) \| ([^|]+) \| ([^|]+) \| ([^|]+) \|$/))
  .filter((match): match is RegExpMatchArray => match !== null);

describe('review orchestrator coverage map', () => {
  it('maps every source section exactly once', () => {
    const numbers = rows.map((row) => Number(row[1]));
    const expected = Array.from({ length: SOURCE_SECTION_COUNT }, (_, i) => i + 1);
    expect(
      numbers,
      'a v20 section is missing or duplicated in references/coverage.md; every section needs a row saying where it lives or why it does not apply',
    ).toEqual(expected);
  });

  it('uses only the declared statuses', () => {
    const statuses = new Set(rows.map((row) => row[3].trim()));
    for (const status of statuses) {
      expect(['kept', 'adapted', 'replaced', 'not applicable']).toContain(status);
    }
  });

  it('points only at files that exist in the skill', () => {
    const cited = new Set(rows.flatMap((row) => row[4].match(/[a-z-]+\.md|SKILL\.md/g) ?? []));
    for (const file of cited) {
      if (file === 'CLAUDE.md') continue;
      const path = file === 'SKILL.md' ? join(skillDir, file) : join(skillDir, 'references', file);
      expect(existsSync(path), `coverage.md cites ${file}, which does not exist`).toBe(true);
    }
  });
});

describe('CI reviewer runs the orchestrator', () => {
  const prompt = readFileSync(join(root, '.github/claude-review-prompt.md'), 'utf8');
  const workflow = parse(
    readFileSync(join(root, '.github/workflows/claude-review.yml'), 'utf8'),
  ) as {
    jobs: { review: { steps: Array<{ uses?: string; with?: { claude_args?: string } }> } };
  };
  const claudeArgs =
    workflow.jobs.review.steps.find((step) =>
      step.uses?.startsWith('anthropics/claude-code-action'),
    )?.with?.claude_args ?? '';

  it('tells the reviewer to load the skill and its CI profile from the trusted root', () => {
    expect(prompt).toContain('.claude/skills/pr-review-orchestrator/SKILL.md');
    expect(prompt).toContain('references/ci.md');
  });

  it('grants the tools the CI profile relies on', () => {
    for (const tool of ['Task', 'Bash(gh pr checks:*)', 'Bash(gh run view:*)', 'WebFetch']) {
      expect(claudeArgs, `claude-review.yml must allow ${tool} for the CI profile`).toContain(tool);
    }
  });
});
