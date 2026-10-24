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

const root = join(__dirname, '..');
const skillDir = join(root, '.claude/skills/pr-review-orchestrator');

function readArtifact(path: string): string {
  // behavioral-test-allow: the artifacts under test ARE the review skill's markdown, the CI reviewer
  // prompt and its workflow; their property has no runtime surface other than these files.
  return readFileSync(path, 'utf8');
}

const coverage = readArtifact(join(skillDir, 'references/coverage.md'));
const workflowSteps = (
  parse(readArtifact(join(root, '.github/workflows/claude-review.yml'))) as {
    jobs: { review: { steps: Array<{ name?: string; run?: string }> } };
  }
).jobs.review.steps;
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
        existsSync(skillPath(file)) && readArtifact(skillPath(file)).includes(anchor),
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
  const prompt = readArtifact(join(root, '.github/claude-review-prompt.md'));
  type Step = {
    name?: string;
    if?: string;
    run?: string;
    uses?: string;
    with?: { claude_args?: string };
  };
  const workflow = parse(readArtifact(join(root, '.github/workflows/claude-review.yml'))) as {
    jobs: { review: { steps: Step[] } };
  };
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
        'Glob',
        'Grep',
        'Read',
        'Task(review-worker)',
        'mcp__github_inline_comment__create_inline_comment',
      ].sort(),
    );
  });

  it('denies the write, shell, web and credential-read tools the action adds in tag mode', () => {
    const denied = claudeArgs.match(/--disallowedTools "([^"]+)"/)?.[1]?.split(',') ?? [];
    for (const tool of [
      'Edit',
      'MultiEdit',
      'Write',
      'Bash',
      'Bash(git add:*)',
      'Bash(git commit:*)',
      'Bash(git rm:*)',
      'mcp__github_file_ops__commit_files',
      'WebFetch',
      'Read(**/.git/**)',
      'Read(//proc/**)',
      'Read(~/.ssh/**)',
      'Read(~/.gitconfig)',
      'Read(~/.git-credentials)',
      'Read(~/.config/**)',
    ]) {
      expect(denied, `${tool} must be denied; deny rules override tag mode's additions`).toContain(
        tool,
      );
    }
    expect(denied.some((tool) => tool.endsWith('/scripts/git-push.sh:*)'))).toBe(true);
    expect(
      denied,
      'the workspace lives under /home/runner/work, so a blanket home denial blocks the source under review',
    ).not.toContain('Read(~/**)');
  });

  it('keeps the inline-comment tool out of every subagent the reviewer can dispatch', () => {
    const denied = claudeArgs.match(/--disallowedTools "([^"]+)"/)?.[1]?.split(',') ?? [];
    for (const builtIn of [
      'general-purpose',
      'Explore',
      'Plan',
      'statusline-setup',
      'claude-code-guide',
    ]) {
      expect(
        denied,
        `built-in ${builtIn} inherits every tool, including create_inline_comment`,
      ).toContain(`Task(${builtIn})`);
    }
    const agentsDir = join(root, '.claude/agents');
    for (const file of readdirSync(agentsDir).filter((name) => name.endsWith('.md'))) {
      const tools = readArtifact(join(agentsDir, file)).match(/^tools:\s*(.+)$/m)?.[1];
      expect(
        tools,
        `${file} must declare tools, or it inherits create_inline_comment`,
      ).toBeDefined();
      expect(tools).not.toContain('mcp__github_inline_comment');
    }
    const worker = readArtifact(join(agentsDir, 'review-worker.md'));
    expect(
      worker
        .match(/^tools:\s*(.+)$/m)?.[1]
        ?.split(/,\s*/)
        .sort(),
    ).toEqual(['Glob', 'Grep', 'Read']);
  });

  it('keeps no git credentials in either checkout', () => {
    const checkouts = steps.filter((step) => step.uses?.startsWith('actions/checkout'));
    expect(checkouts).toHaveLength(2);
    for (const checkout of checkouts) {
      expect((checkout.with as Record<string, unknown> | undefined)?.['persist-credentials']).toBe(
        false,
      );
    }
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
    const snapshot = steps.findIndex((step) => step.name?.startsWith('Snapshot PR metadata'));
    const review = steps.findIndex((step) =>
      step.uses?.startsWith('anthropics/claude-code-action'),
    );
    expect(snapshot).toBeGreaterThanOrEqual(0);
    expect(snapshot).toBeLessThan(review);
    expect(steps[snapshot]?.if).toBeUndefined();
    expect(claudeArgs).toContain('--add-dir /tmp/review-evidence');
    expect(prompt).toContain('/tmp/review-evidence/pr.json');
    expect(prompt).toContain('/tmp/review-evidence/diff.patch');
    expect(prompt).not.toMatch(/gh pr (diff|view|checks)/);
  });
});

describe('claude-review snapshot step', () => {
  const snapshotRun =
    workflowSteps.find((step) => step.name?.startsWith('Snapshot PR metadata'))?.run ?? '';

  const FAILED_CHECK = '[{"name":"lint","state":"FAILURE","bucket":"fail","link":"u"}]';

  function run(behaviour: {
    checksExit: number;
    checksOut?: string;
    checksErr?: string;
    logBytes?: number;
    runListFails?: boolean;
    prViewFails?: boolean;
    prDiffFails?: boolean;
  }) {
    const dir = mkdtempSync(join(tmpdir(), 'review-snapshot-'));
    const bin = join(dir, 'bin');
    const out = join(dir, 'out');
    spawnSync('mkdir', ['-p', bin]);
    writeFileSync(
      join(bin, 'gh'),
      `#!/usr/bin/env bash
case "$1 $2" in
  "pr view") if [[ -n "$PR_VIEW_FAIL" ]]; then echo "HTTP 429" >&2; exit 1; fi; echo '{"headRefOid":"abc123"}' ;;
  "pr diff") if [[ -n "$PR_DIFF_FAIL" ]]; then echo "HTTP 504" >&2; exit 1; fi; if [[ "$*" == *--name-only* ]]; then echo app/page.tsx; else echo "+line"; fi ;;
  "pr checks") printf '%s' "$CHECKS_OUT"; echo "$CHECKS_ERR" >&2; exit "$CHECKS_EXIT" ;;
  "run list") if [[ -n "$RUN_LIST_FAIL" ]]; then echo "HTTP 502" >&2; exit 1; fi; [[ "$*" == *"--commit abc123"* ]] || exit 3; echo 42 ;;
  "run view") head -c "$LOG_BYTES" /dev/zero | tr '\\0' 'x' ;;
esac
`,
    );
    chmodSync(join(bin, 'gh'), 0o755);
    const script = join(dir, 'snapshot.sh');
    writeFileSync(script, snapshotRun);
    const result = spawnSync('bash', ['-e', script], {
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
        CHECKS_OUT: behaviour.checksOut ?? FAILED_CHECK,
        LOG_BYTES: String(behaviour.logBytes ?? 10),
        RUN_LIST_FAIL: behaviour.runListFails ? '1' : '',
        PR_VIEW_FAIL: behaviour.prViewFails ? '1' : '',
        PR_DIFF_FAIL: behaviour.prDiffFails ? '1' : '',
      },
    });
    const read = (name: string) => readArtifact(join(out, name));
    return { status: result.status, read, files: () => readdirSync(out).sort() };
  }

  it('keeps failed and pending check results as evidence', () => {
    for (const checksExit of [0, 1, 8]) {
      const result = run({ checksExit });
      expect(result.status).toBe(0);
      expect(result.read('checks.txt')).toBe('fail\tFAILURE\tlint\tu\n');
    }
  });

  it('marks an API error UNAVAILABLE even when gh exits 1 like a failed check', () => {
    for (const [checksExit, checksOut] of [
      [1, ''],
      [1, 'not json'],
      [4, ''],
      [0, '[]'],
    ] as const) {
      const result = run({ checksExit, checksOut, checksErr: 'HTTP 503' });
      expect(result.status).toBe(0);
      expect(result.read('checks.txt')).toMatch(/^UNAVAILABLE: gh pr checks exited \d/);
      expect(result.read('checks.txt')).toContain('HTTP 503');
    }
  });

  it('snapshots the diff and changed paths for the reviewer', () => {
    const result = run({ checksExit: 0 });
    expect(result.read('diff.patch')).toBe('+line\n');
    expect(result.read('files.txt')).toBe('app/page.tsx\n');
  });

  it('truncates a large failed log without failing the step, leaving no full copy behind', () => {
    const result = run({ checksExit: 1, logBytes: 5_000_000 });
    expect(result.status).toBe(0);
    expect(result.read('failed-run-42.log')).toHaveLength(1000);
    expect(result.files()).toEqual([
      'checks.txt',
      'diff.patch',
      'failed-run-42.log',
      'files.txt',
      'pr.json',
    ]);
  });
  it('marks failed-run logs UNAVAILABLE when gh run list fails, without aborting the job', () => {
    const result = run({ checksExit: 0, runListFails: true });
    expect(result.status).toBe(0);
    expect(result.read('failed-runs-unavailable.txt')).toMatch(/^UNAVAILABLE: gh run list failed/);
    expect(result.read('failed-runs-unavailable.txt')).toContain('HTTP 502');
    expect(result.read('checks.txt')).toBe('fail\tFAILURE\tlint\tu\n');
  });

  it('marks PR metadata UNAVAILABLE when gh pr view fails, and skips the run lookup it feeds', () => {
    const result = run({ checksExit: 1, prViewFails: true });
    expect(result.status).toBe(0);
    expect(result.files()).not.toContain('pr.json');
    expect(result.read('pr-unavailable.txt')).toMatch(/^UNAVAILABLE: gh pr view failed/);
    expect(result.read('pr-unavailable.txt')).toContain('HTTP 429');
    expect(result.read('failed-runs-unavailable.txt')).toMatch(/^UNAVAILABLE: no head SHA/);
    expect(result.read('diff.patch')).toBe('+line\n');
  });

  it('stops the job when gh pr diff fails, since a review with no diff could only approve blind', () => {
    const result = run({ checksExit: 0, prDiffFails: true });
    expect(result.status).not.toBe(0);
    expect(result.files()).not.toContain('checks.txt');
  });
});
