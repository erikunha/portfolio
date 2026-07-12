#!/usr/bin/env tsx
import { execFile } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { sanitizeSecrets } from './lib/sanitize-secrets';

const execFileP = promisify(execFile);

export type EvalResult =
  | { ok: true }
  | {
      ok: false;
      code:
        | 'conversation_resolution_off'
        | 'required_status_checks_unenforced'
        | 'branch_unprotected'
        | 'gh_auth_missing'
        | 'unknown';
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

  let parsed: {
    required_conversation_resolution?: { enabled?: boolean };
    required_status_checks?: { contexts?: string[]; checks?: { context?: string }[] };
  };
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

  const classic = parsed.required_status_checks;
  const classicEnforced =
    (classic?.contexts?.length ?? 0) > 0 || (classic?.checks?.length ?? 0) > 0;
  if (classicEnforced) return { ok: true };

  let rulesRaw: string;
  try {
    rulesRaw = await opts.ghExec([
      'api',
      `repos/${opts.owner}/${opts.repo}/rules/branches/${opts.branch}`,
    ]);
  } catch (e) {
    return {
      ok: false,
      code: 'unknown',
      message: `could not read applied rules for ${opts.branch} (failing closed): ${(e as Error).message}`,
    };
  }

  let rules: { type?: string; parameters?: { required_status_checks?: unknown[] } }[];
  try {
    rules = JSON.parse(rulesRaw);
  } catch (e) {
    return {
      ok: false,
      code: 'unknown',
      message: `non-JSON rules output (failing closed): ${(e as Error).message}`,
    };
  }

  const rulesetEnforced =
    Array.isArray(rules) &&
    rules.some(
      (r) =>
        r.type === 'required_status_checks' &&
        (r.parameters?.required_status_checks?.length ?? 0) > 0,
    );
  if (!rulesetEnforced) {
    return {
      ok: false,
      code: 'required_status_checks_unenforced',
      message:
        `no required_status_checks apply to ${opts.branch} — neither classic protection nor any active ruleset targets it, ` +
        'so a red-CI merge or direct push is not blocked server-side. ' +
        `Fix: target the ruleset at the default branch, e.g. gh api -X PUT repos/${opts.owner}/${opts.repo}/rulesets/<id> ` +
        `-f 'conditions[ref_name][include][]=~DEFAULT_BRANCH' -f 'conditions[ref_name][exclude][]='`,
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
      `Branch protection OK (${branch}: required_conversation_resolution=true, required_status_checks enforced)\n`,
    );
    process.exit(0);
  } catch (e) {
    process.stderr.write(
      sanitizeSecrets(`BRANCH_PROTECTION_FAIL code=unknown ${(e as Error).message}\n`),
    );
    process.exit(2);
  }
}

const isMain =
  typeof process.argv[1] === 'string' && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) void main();
