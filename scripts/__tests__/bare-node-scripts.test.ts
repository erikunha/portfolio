import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

const WORKFLOWS_DIR = join(process.cwd(), '.github/workflows');
const BARE_NODE_TS_RUN = /\bnode (scripts\/[\w./-]+\.ts)\b/g;
const WORKFLOW_FILE = /\.ya?ml$/;

function bareNodeScripts(): string[] {
  const found = new Set<string>();
  for (const name of readdirSync(WORKFLOWS_DIR).filter((file) => WORKFLOW_FILE.test(file))) {
    const text = readFileSync(join(WORKFLOWS_DIR, name), 'utf8');
    for (const match of text.matchAll(BARE_NODE_TS_RUN)) {
      if (match[1]) found.add(match[1]);
    }
  }
  return [...found].sort();
}

function importWithBareNode(script: string): { status: number | null; stderr: string } {
  const url = pathToFileURL(join(process.cwd(), script)).href;
  const run = spawnSync(
    process.execPath,
    ['--input-type=module', '-e', `await import(${JSON.stringify(url)});`],
    { encoding: 'utf8' },
  );
  return { status: run.status, stderr: run.stderr };
}

describe('scripts a workflow runs with bare node', () => {
  const scripts = bareNodeScripts();

  it('includes at least the high-risk label and tool pins scripts', () => {
    expect(scripts).toEqual(
      expect.arrayContaining(['scripts/high-risk-paths.ts', 'scripts/gates/check-tool-pins.ts']),
    );
  });

  it.each(scripts)('%s resolves every import under node without tsx', (script) => {
    const { status, stderr } = importWithBareNode(script);
    expect(
      { status, stderr },
      'a workflow step runs this script with node before pnpm install, so tsx is absent: every relative import must carry its .ts extension',
    ).toEqual({ status: 0, stderr: '' });
  });
});
