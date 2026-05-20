#!/usr/bin/env tsx
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { sanitizeSecrets } from './lib/sanitize-secrets';

const execFileP = promisify(execFile);

export type EvalResult =
  | { ok: true }
  | {
      ok: false;
      code: 'conversation_resolution_off' | 'branch_unprotected' | 'gh_auth_missing' | 'unknown';
      message: string;
    };

export type GhExec = (args: string[]) => Promise<string>;

export async function evaluateBranchProtection(opts: {
  owner: string;
  repo: string;
  branch: string;
  ghExec: GhExec;
}): Promise<EvalResult> {
  let raw: string;
  try {
    raw = await opts.ghExec([
      'api',
      `repos/${opts.owner}/${opts.repo}/branches/${opts.branch}/protection`,
    ]);
  } catch (e) {
    const msg = (e as Error).message ?? String(e);
    if (/404|not protected/i.test(msg)) {
      return { ok: false, code: 'branch_unprotected', message: msg };
    }
    if (/auth|login|token/i.test(msg)) {
      return { ok: false, code: 'gh_auth_missing', message: msg };
    }
    return { ok: false, code: 'unknown', message: msg };
  }

  let parsed: { required_conversation_resolution?: { enabled?: boolean } };
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    return { ok: false, code: 'unknown', message: `non-JSON gh output: ${(e as Error).message}` };
  }

  if (parsed.required_conversation_resolution?.enabled !== true) {
    return {
      ok: false,
      code: 'conversation_resolution_off',
      message:
        `required_conversation_resolution is not enabled on ${opts.branch}. ` +
        `Enable it: gh api -X PATCH repos/${opts.owner}/${opts.repo}/branches/${opts.branch}/protection/required_conversation_resolution -f enabled=true`,
    };
  }

  return { ok: true };
}

async function defaultGhExec(args: string[]): Promise<string> {
  const { stdout } = await execFileP('gh', args, { encoding: 'utf8' });
  return stdout;
}

async function resolveOwnerRepo(): Promise<{ owner: string; repo: string }> {
  const { stdout } = await execFileP(
    'gh',
    ['repo', 'view', '--json', 'owner,name', '-q', '.owner.login + "/" + .name'],
    { encoding: 'utf8' },
  );
  const [owner, repo] = stdout.trim().split('/');
  if (!owner || !repo) throw new Error('could not resolve owner/repo from gh');
  return { owner, repo };
}

async function main() {
  try {
    const branch = process.argv[2] ?? 'main';
    const { owner, repo } = await resolveOwnerRepo();
    const result = await evaluateBranchProtection({ owner, repo, branch, ghExec: defaultGhExec });
    if (!result.ok) {
      process.stderr.write(
        sanitizeSecrets(`BRANCH_PROTECTION_FAIL code=${result.code} ${result.message}\n`),
      );
      process.exit(1);
    }
    process.stdout.write(
      `Branch protection OK (${branch}: required_conversation_resolution=true)\n`,
    );
    process.exit(0);
  } catch (e) {
    process.stderr.write(
      sanitizeSecrets(`BRANCH_PROTECTION_FAIL code=unknown ${(e as Error).message}\n`),
    );
    process.exit(2);
  }
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) void main();
