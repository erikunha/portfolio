import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

// behavioral-test-allow: the artifacts under test ARE the review skill's markdown, the CI reviewer
// prompt and its workflow. Their property (every source section mapped to a real file, CI wired to
// a trusted copy of the skill) has no runtime surface other than these files.
const root = join(__dirname, '..');
const skillDir = join(root, '.claude/skills/pr-review-orchestrator');
const coverage = readFileSync(join(skillDir, 'references/coverage.md'), 'utf8');
const SOURCE_SECTION_COUNT = 134;
const STATUSES = ['kept', 'adapted', 'replaced', 'not applicable'];

type Row = { section: number; status: string; target: string };

function parseRows(markdown: string): Row[] {
  return markdown
    .split('\n')
    .map((line) => line.match(/^\| (\d+) \| ([^|]+) \| ([^|]+) \| ([^|]+) \|$/))
    .filter((match): match is RegExpMatchArray => match !== null)
    .map((match) => ({
      section: Number(match[1]),
      status: (match[3] ?? '').trim(),
      target: (match[4] ?? '').trim(),
    }));
}

function skillPath(file: string): string {
  return file === 'SKILL.md' ? join(skillDir, file) : join(skillDir, 'references', file);
}

function unresolvedTargets(row: Row): string[] {
  const cited = row.target.match(/\b(?:SKILL|[a-z-]+)\.md\b/g) ?? [];
  const skillFiles = cited.filter((file) => file !== 'CLAUDE.md');
  if (row.status !== 'not applicable' && row.status !== 'replaced' && skillFiles.length === 0) {
    return ['<no skill file cited>'];
  }
  return skillFiles.filter((file) => !existsSync(skillPath(file)));
}

const rows = parseRows(coverage);

describe('review orchestrator coverage map', () => {
  it('maps every source section exactly once', () => {
    expect(
      rows.map((row) => row.section),
      'a v20 section is missing or duplicated in references/coverage.md; every section needs a row saying where it lives or why it does not apply',
    ).toEqual(Array.from({ length: SOURCE_SECTION_COUNT }, (_, i) => i + 1));
  });

  it('uses only the declared statuses', () => {
    for (const row of rows) expect(STATUSES).toContain(row.status);
  });

  it('points every kept or adapted section at a skill file that exists', () => {
    const broken = rows
      .map((row) => ({ section: row.section, missing: unresolvedTargets(row) }))
      .filter((entry) => entry.missing.length > 0);
    expect(
      broken,
      'a kept or adapted section must name the SKILL.md or references/*.md file holding its mechanism',
    ).toEqual([]);
  });

  it('rejects a row with no target and a row citing a missing file', () => {
    const [noTarget, missingFile] = parseRows(
      '| 1 | X | kept | CLAUDE.md only |\n| 2 | Y | adapted | nowhere.md section |',
    );
    expect(noTarget && unresolvedTargets(noTarget)).toEqual(['<no skill file cited>']);
    expect(missingFile && unresolvedTargets(missingFile)).toEqual(['nowhere.md']);
  });
});

describe('CI reviewer runs a trusted copy of the orchestrator', () => {
  const prompt = readFileSync(join(root, '.github/claude-review-prompt.md'), 'utf8');
  type Step = { name?: string; run?: string; uses?: string; with?: { claude_args?: string } };
  const workflow = parse(
    readFileSync(join(root, '.github/workflows/claude-review.yml'), 'utf8'),
  ) as { jobs: { review: { steps: Step[] } } };
  const steps = workflow.jobs.review.steps;
  const claudeArgs =
    steps.find((step) => step.uses?.startsWith('anthropics/claude-code-action'))?.with
      ?.claude_args ?? '';
  const allowedTools = claudeArgs.match(/--allowedTools "([^"]+)"/)?.[1]?.split(',') ?? [];

  it('loads the skill from the default-branch copy, never the PR or base copy', () => {
    expect(prompt).toContain('/tmp/review-skill/SKILL.md');
    expect(prompt).toContain('references/ci.md');
    const materialise = steps.find((step) => step.run?.includes('/tmp/review-skill'));
    expect(
      materialise?.run,
      'the skill must be extracted from FETCH_HEAD (the default branch)',
    ).toMatch(/git archive FETCH_HEAD:\.claude\/skills\/pr-review-orchestrator/);
    expect(claudeArgs).toContain('--add-dir /tmp/review-skill');
  });

  it('runs no PR-controlled package code in the credentialed job', () => {
    const installs = steps.filter((step) => /\bpnpm (install|i)\b/.test(step.run ?? ''));
    expect(
      installs,
      'a pnpm install loads the PR .pnpmfile.cjs even with --ignore-scripts',
    ).toEqual([]);
  });

  it('gives the reviewer no tool that can read its environment or reach the network', () => {
    for (const tool of [
      'WebFetch',
      'Bash(gh run view:*)',
      'Bash(gh pr checks:*)',
      'Bash(gh api:*)',
    ]) {
      expect(allowedTools, `${tool} must not be granted to the reviewer`).not.toContain(tool);
    }
    expect(allowedTools).toContain('Task');
  });

  it('snapshots gate results for the reviewer before it starts', () => {
    const snapshot = steps.find((step) => step.run?.includes('/tmp/review-evidence'));
    expect(snapshot?.run).toMatch(/gh pr checks/);
    expect(claudeArgs).toContain('--add-dir /tmp/review-evidence');
    expect(prompt).toContain('/tmp/review-evidence');
  });
});
