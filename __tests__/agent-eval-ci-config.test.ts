// __tests__/agent-eval-ci-config.test.ts
// C-d.2 structural invariants for the agent-eval workflow. The agent-eval
// harness is NON-BLOCKING by design: it spends AI Gateway credits on a
// Monte-Carlo prompt-regression run, so it lives in its OWN workflow
// (.github/workflows/agent-eval.yml) whose `on:` is workflow_dispatch + schedule
// ONLY. That is a stronger guarantee than a job-level `if:`: the workflow
// physically cannot fire on a pull_request or push, so it can never gate a
// merge, and the weekly cron drives only this job (not ci.yml's whole suite,
// which would include the paid ai-eval job).
//
// Reading .github/workflows/*.yml is allowed by the no-source-grep guard (that
// guard only flags reads of app/components/lib/scripts SOURCE, which CI config
// is not). Parsing the YAML text is the only behavioral way to assert wiring.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const wf = readFileSync(`${process.cwd()}/.github/workflows/agent-eval.yml`, 'utf8');
const ci = readFileSync(`${process.cwd()}/.github/workflows/ci.yml`, 'utf8');

describe('agent-eval.yml — non-blocking scheduled workflow', () => {
  it('defines an agent-eval job', () => {
    expect(wf).toMatch(/^\s{2}agent-eval:/m);
  });

  it('triggers ONLY on workflow_dispatch + schedule (never pull_request / push)', () => {
    expect(wf).toMatch(/\n {2}workflow_dispatch:/);
    expect(wf).toMatch(/\n {2}schedule:\n {4}- cron:/);
    // Negative guards: a pull_request / push trigger would make it gate merges.
    expect(wf).not.toMatch(/\n {2}pull_request:/);
    expect(wf).not.toMatch(/\n {2}push:/);
  });

  it('sets AI_GATEWAY_API_KEY from secrets', () => {
    expect(wf).toMatch(/AI_GATEWAY_API_KEY:\s*\$\{\{\s*secrets\./);
  });

  it('runs pnpm eval:agents', () => {
    expect(wf).toMatch(/run:\s*pnpm eval:agents/);
  });

  it('uploads agent-eval-result.json if: always()', () => {
    expect(wf).toMatch(/if:\s*always\(\)/);
    expect(wf).toMatch(/path:\s*agent-eval-result\.json/);
  });

  it('sets a timeout-minutes', () => {
    expect(wf).toMatch(/timeout-minutes:\s*\d+/);
  });

  it('ci.yml carries NO schedule and NO agent-eval job (no weekly full-suite run)', () => {
    // The schedule lives in agent-eval.yml ONLY. A schedule on ci.yml's top-level
    // `on:` would also run build/test/perf/e2e/ai-eval weekly — the paid ai-eval
    // job burns Gateway credits — since those jobs run on any non-pull_request
    // event. This is the regression guard for that second-order effect.
    // Bound the on: block to the next TOP-LEVEL line (a column-0 key or comment),
    // not a hardcoded `concurrency:` — so the slice can't silently shrink if the
    // file is reordered. on:'s own entries are all indented, so the first
    // column-0 line after it ends the block.
    const onStart = ci.indexOf('\non:');
    const onRel = ci.slice(onStart + 1).search(/\n\S/);
    const onBlock = onRel === -1 ? ci.slice(onStart) : ci.slice(onStart, onStart + 1 + onRel);
    expect(onBlock).toMatch(/\n {2}workflow_dispatch:/); // sanity: slice captured the real block
    expect(onBlock).not.toMatch(/\n {2}schedule:/);
    expect(ci).not.toMatch(/^\s{2}agent-eval:/m);
  });
});
