import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

// behavioral-test-allow: the artifact under test IS the workflow file; which ref a job checks out has no runtime surface in this repository.
const workflow = parse(
  readFileSync(join(process.cwd(), '.github', 'workflows', 'high-risk-label.yml'), 'utf8'),
) as {
  jobs: Record<
    string,
    {
      steps: {
        id?: string;
        uses?: string;
        env?: Record<string, string>;
        with?: Record<string, unknown>;
      }[];
    }
  >;
};

const steps = Object.values(workflow.jobs)[0]?.steps ?? [];
const EXPRESSION_OPEN = ['$', '{{'].join('');

describe('high-risk-label workflow runs trusted code with its token', () => {
  it('checks out the base commit, so a pull request cannot rewrite the script that holds the token', () => {
    const checkout = steps.find((s) => s.uses?.startsWith('actions/checkout'));
    expect(checkout?.with?.ref).toBe(`${EXPRESSION_OPEN} github.event.pull_request.base.sha }}`);
  });

  it('never checks out the pull request head or merge ref', () => {
    const refs = steps
      .filter((s) => s.uses?.startsWith('actions/checkout'))
      .map((s) => String(s.with?.ref ?? ''));
    expect(refs.filter((ref) => /head|merge|refs\/pull/.test(ref))).toEqual([]);
  });
});

describe('high-risk-label workflow on a base without the path list', () => {
  it('labels every changed file instead of failing when the base commit predates the script', () => {
    const sync = steps.find((s) => s.id === 'sync') as {
      run?: string;
      env?: Record<string, string>;
    };
    const dir = mkdtempSync(join(tmpdir(), 'hr-label-'));
    const bin = join(dir, 'bin');
    mkdirSync(bin);
    const calls = join(dir, 'calls.log');
    writeFileSync(
      join(bin, 'gh'),
      [
        '#!/usr/bin/env bash',
        `echo "$*" >> ${calls}`,
        'case "$*" in',
        '  *pulls/7/files*) echo "app/api/ask/route.ts" ;;',
        '  *issues/7/labels\\ --jq*) ;;',
        'esac',
      ].join('\n'),
    );
    chmodSync(join(bin, 'gh'), 0o755);
    const result = spawnSync(
      'bash',
      ['--noprofile', '--norc', '-c', `PATH=${bin}:$PATH; ${sync?.run ?? ''}`],
      {
        cwd: dir,
        encoding: 'utf8',
        env: {
          PATH: process.env.PATH ?? '',
          HOME: dir,
          NODE_ENV: 'test',
          REPO: 'o/r',
          PR_NUMBER: '7',
          LABEL: 'high-risk',
          LABEL_COLOR: 'B60205',
          LABEL_DESCRIPTION: 'x',
        },
      },
    );
    expect(result.status, result.stderr).toBe(0);
    expect(readFileSync(calls, 'utf8')).toContain('--method POST repos/o/r/issues/7/labels');
  });
});
