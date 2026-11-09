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
    const onStart = ci.indexOf('\non:');
    const onRel = ci.slice(onStart + 1).search(/\n\S/);
    const onBlock = onRel === -1 ? ci.slice(onStart) : ci.slice(onStart, onStart + 1 + onRel);
    expect(onBlock).toMatch(/\n {2}workflow_dispatch:/);
    expect(onBlock).not.toMatch(/\n {2}schedule:/);
    expect(ci).not.toMatch(/^\s{2}agent-eval:/m);
  });
});
