// __tests__/agent-eval-ci-config.test.ts
// C-d.2 structural invariants for the `agent-eval` CI job. The agent-eval
// harness is NON-BLOCKING by design: it spends AI Gateway credits on a
// Monte-Carlo prompt-regression run, so it must run only on demand
// (workflow_dispatch) or on a schedule, NEVER on the per-push gate, and must
// never sit in any blocking job's `needs`.
//
// Reading .github/workflows/ci.yml is allowed by the no-source-grep guard
// (that guard only flags reads of app/components/lib/scripts SOURCE, which CI
// config is not). Parsing the YAML is the only behavioral way to assert wiring.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const ci = readFileSync(`${process.cwd()}/.github/workflows/ci.yml`, 'utf8');

// Slice the agent-eval job block ONLY (up to the next 2-space-indented sibling
// key), so a different job's `timeout-minutes`/`AI_GATEWAY_API_KEY`/upload step
// cannot vacuously satisfy an assertion meant for this job. Match a sibling via
// /\n {2}\S/ , NOT indexOf("\n  "), which also matches 4-space body lines.
const heading = '\n  agent-eval:';
const start = ci.indexOf(heading);
const rest = ci.slice(start + heading.length);
const nextJobRel = rest.search(/\n {2}\S/);
const job =
  nextJobRel === -1 ? ci.slice(start) : ci.slice(start, start + heading.length + nextJobRel);

// The set of jobs that gate branch protection. The agent-eval job must not
// appear in ANY of their `needs:` arrays — being needed by a required check
// would make the non-blocking harness transitively blocking.
const BLOCKING_JOBS = [
  'quality-fast',
  'typecheck',
  'test',
  'build',
  'performance',
  'e2e-functional',
  'e2e-visual-chromium',
  'ai-eval',
];

describe('ci.yml agent-eval job invariants', () => {
  it('defines an agent-eval job', () => {
    expect(ci).toMatch(/^\s{2}agent-eval:/m);
  });

  it('declares a weekly schedule trigger at the top level', () => {
    // The job runs on schedule; the top-level `on:` must declare a cron so the
    // scheduled trigger actually fires.
    expect(ci).toMatch(/\n {2}schedule:\n {4}- cron:/);
  });

  it('triggers ONLY on workflow_dispatch or schedule (never the per-push gate)', () => {
    expect(job).toMatch(
      /if:[^\n]*github\.event_name == 'workflow_dispatch'[^\n]*\|\|[^\n]*github\.event_name == 'schedule'/,
    );
    // Negative guard: the gate must not fall through to pull_request / push.
    expect(job).not.toMatch(/event_name == 'pull_request'/);
    expect(job).not.toMatch(/event_name == 'push'/);
  });

  it('sets AI_GATEWAY_API_KEY from secrets', () => {
    expect(job).toMatch(/AI_GATEWAY_API_KEY:\s*\$\{\{\s*secrets\./);
  });

  it('runs pnpm eval:agents', () => {
    expect(job).toMatch(/run:\s*pnpm eval:agents/);
  });

  it('uploads agent-eval-result.json if: always()', () => {
    expect(job).toMatch(/if:\s*always\(\)/);
    expect(job).toMatch(/path:\s*agent-eval-result\.json/);
  });

  it('sets a timeout-minutes', () => {
    expect(job).toMatch(/timeout-minutes:\s*\d+/);
  });

  it("is NOT in any blocking job's needs (stays non-blocking)", () => {
    for (const blocking of BLOCKING_JOBS) {
      const bHeading = `\n  ${blocking}:`;
      const bStart = ci.indexOf(bHeading);
      expect(bStart, `blocking job ${blocking} not found`).toBeGreaterThanOrEqual(0);
      const bRest = ci.slice(bStart + bHeading.length);
      const bNextRel = bRest.search(/\n {2}\S/);
      const bBlock =
        bNextRel === -1 ? ci.slice(bStart) : ci.slice(bStart, bStart + bHeading.length + bNextRel);
      const needsMatch = bBlock.match(/needs:\s*\[([^\]]*)\]/);
      if (needsMatch?.[1] !== undefined) {
        const needs = needsMatch[1].split(',').map((s) => s.trim());
        expect(needs, `${blocking}.needs must not include agent-eval`).not.toContain('agent-eval');
      }
    }
  });

  it('is not itself a blocking job (no other job needs it)', () => {
    // Scan every `needs:` array in the whole file for agent-eval.
    for (const m of ci.matchAll(/needs:\s*\[([^\]]*)\]/g)) {
      const needs = (m[1] ?? '').split(',').map((s) => s.trim());
      expect(needs).not.toContain('agent-eval');
    }
  });
});
