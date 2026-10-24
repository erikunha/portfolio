import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
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

  it('keeps the mechanism each consequential row names inside the file it cites', () => {
    const anchors: Record<number, string> = {
      3: 'Authority order',
      9: 'Precedence when two skills answer the same question',
      26: 'ROUTING-CONTRACT-V1',
      31: 'find_semantic_duplicates',
      47: 'Failure is not zero',
      115: 'Right-column gate',
    };
    for (const [section, anchor] of Object.entries(anchors)) {
      const row = rows.find((candidate) => candidate.section === Number(section));
      const file = row?.target.match(/\b(?:SKILL|[a-z-]+)\.md\b/)?.[0] ?? '';
      expect(
        existsSync(skillPath(file)) && readFileSync(skillPath(file), 'utf8').includes(anchor),
        `coverage row ${section} cites ${file}, which must still contain "${anchor}"`,
      ).toBe(true);
    }
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
  type Step = {
    name?: string;
    if?: string;
    run?: string;
    uses?: string;
    with?: { claude_args?: string };
  };
  const workflow = parse(
    readFileSync(join(root, '.github/workflows/claude-review.yml'), 'utf8'),
  ) as { jobs: { review: { steps: Step[] } } };
  const steps = workflow.jobs.review.steps;
  const claudeArgs =
    steps.find((step) => step.uses?.startsWith('anthropics/claude-code-action'))?.with
      ?.claude_args ?? '';
  const allowedTools = claudeArgs.match(/--allowedTools "([^"]+)"/)?.[1]?.split(',') ?? [];
  const activeLines = (run = '') =>
    run
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== '' && !line.startsWith('#'));
  const indexOfStep = (pattern: RegExp) =>
    steps.findIndex((step) => activeLines(step.run).some((line) => pattern.test(line)));

  it('grants the reviewer exactly the read-only tool set', () => {
    expect([...allowedTools].sort()).toEqual(
      [
        'Bash(gh pr diff:*)',
        'Glob',
        'Grep',
        'Read',
        'Task',
        'mcp__github_inline_comment__create_inline_comment',
      ].sort(),
    );
  });

  it('extracts the skill from a default-branch fetch that runs before it, unconditionally', () => {
    const fetch = indexOfStep(/^git fetch --depth=1 origin "\$DEFAULT_BRANCH"$/);
    const archive = indexOfStep(
      /^git archive FETCH_HEAD:\.claude\/skills\/pr-review-orchestrator /,
    );
    expect(fetch, 'the default-branch fetch must be an active line').toBeGreaterThanOrEqual(0);
    expect(archive).toBeGreaterThan(fetch);
    expect(steps.slice(fetch, archive + 1).some((step) => step.if !== undefined)).toBe(false);
    expect(prompt).toContain('/tmp/review-skill/SKILL.md');
    expect(claudeArgs).toContain('--add-dir /tmp/review-skill');
  });

  it('runs no package manager in the credentialed job', () => {
    const offenders = steps.flatMap((step) =>
      activeLines(step.run).filter((line) => /\b(pnpm|npm|npx|yarn|bun)\b/.test(line)),
    );
    expect(offenders, 'a package manager loads PR-controlled code such as .pnpmfile.cjs').toEqual(
      [],
    );
  });

  it('snapshots PR metadata and gate results unconditionally before the review', () => {
    const snapshot = indexOfStep(/^bash scripts\/claude-review-snapshot\.sh$/);
    const review = steps.findIndex((step) =>
      step.uses?.startsWith('anthropics/claude-code-action'),
    );
    expect(snapshot).toBeGreaterThanOrEqual(0);
    expect(snapshot).toBeLessThan(review);
    expect(steps[snapshot]?.if).toBeUndefined();
    expect(claudeArgs).toContain('--add-dir /tmp/review-evidence');
    expect(prompt).toContain('/tmp/review-evidence/pr.json');
  });
});

describe('claude-review snapshot script', () => {
  const script = join(root, 'scripts/claude-review-snapshot.sh');

  function run(behaviour: { checksExit: number; checksErr?: string; logBytes?: number }) {
    const dir = mkdtempSync(join(tmpdir(), 'review-snapshot-'));
    const bin = join(dir, 'bin');
    const out = join(dir, 'out');
    spawnSync('mkdir', ['-p', bin]);
    writeFileSync(
      join(bin, 'gh'),
      `#!/usr/bin/env bash
case "$1 $2" in
  "pr view") if [[ "$*" == *--jq* ]]; then echo abc123; else echo '{"headRefOid":"abc123"}'; fi ;;
  "pr checks") echo "lint pass"; echo "$CHECKS_ERR" >&2; exit "$CHECKS_EXIT" ;;
  "run list") echo 42 ;;
  "run view") head -c "$LOG_BYTES" /dev/zero | tr '\\0' 'x' ;;
esac
`,
    );
    chmodSync(join(bin, 'gh'), 0o755);
    const result = spawnSync('bash', [script], {
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        REPO: 'o/r',
        PR: '1',
        OUT_DIR: out,
        MAX_LOG_BYTES: '1000',
        CHECKS_EXIT: String(behaviour.checksExit),
        CHECKS_ERR: behaviour.checksErr ?? '',
        LOG_BYTES: String(behaviour.logBytes ?? 10),
      },
    });
    const read = (name: string) => readFileSync(join(out, name), 'utf8');
    return { status: result.status, read, files: () => readdirSync(out).sort() };
  }

  it('keeps failed and pending check results as evidence', () => {
    for (const checksExit of [0, 1, 8]) {
      const result = run({ checksExit });
      expect(result.status).toBe(0);
      expect(result.read('checks.txt')).toBe('lint pass\n');
    }
  });

  it('marks unreadable check results UNAVAILABLE instead of passing error text as results', () => {
    const result = run({ checksExit: 4, checksErr: 'HTTP 503' });
    expect(result.status).toBe(0);
    expect(result.read('checks.txt')).toMatch(/^UNAVAILABLE: gh pr checks exited 4/);
    expect(result.read('checks.txt')).toContain('HTTP 503');
  });

  it('truncates a large failed log without failing the step, leaving no full copy behind', () => {
    const result = run({ checksExit: 1, logBytes: 5_000_000 });
    expect(result.status).toBe(0);
    expect(result.read('failed-run-42.log')).toHaveLength(1000);
    expect(result.files()).toEqual(['checks.txt', 'failed-run-42.log', 'pr.json']);
  });
});
