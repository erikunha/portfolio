# PR Comment Harness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish a tool-agnostic, mechanically-enforced harness that prevents any AI agent (Claude Code, Copilot, Cursor, Codex) from merging a PR until every GitHub review-thread comment is marked Resolved, with detection for self-resolve bypasses.

**Architecture:** Three reinforcing layers — (1) policy in `CLAUDE.md` and the generated `AGENTS.md` so every AI tool sees the rule; (2) local mechanical gate `pnpm tsx scripts/check-pr-comments.ts <pr>` invoked via `pnpm ready-to-merge`; (3) unbypassable CI + branch-protection backstop. `CLAUDE.md` is the single hand-edited source; `AGENTS.md` and `.github/copilot-instructions.md` are generated outputs verified by drift check. CLI scripts exit non-zero with structured stderr (named codes, no HTTP envelope).

**Tech Stack:** Next.js 15 / TypeScript strict / tsx for scripts / Vitest for behavioral tests / `gh api graphql` for GitHub data / GitHub Actions for CI / existing `scripts/sync-copilot.ts` pipeline.

---

## Approach summary (gate-review absorbed)

Five issues from the `architect-reviewer` 4-gate protocol shaped this plan:

1. **AGENTS.md is generator-only from day one** — no hand-written seed, no chicken-and-egg drift check.
2. **CLI scripts use stderr + named codes**, not the `/api/*` HTTP envelope (which is for HTTP responses only).
3. **`check-branch-protection.ts` ships with a behavioral Vitest** — kill switches need tests.
4. **Self-resolve detection** is a non-blocking warning surface for `suspicious_self_resolve` cases (PR author resolves their own threads).
5. **`ready-to-merge` chains `pnpm ci`** (full gate including bundle-check), not `pnpm ci:local`.

---

## File Structure

| Path | Action | Responsibility |
|---|---|---|
| `CLAUDE.md` | Modify | Add `## PR merge gate` section codifying the rule + ground-truth signal + escalation contract. |
| `AGENTS.md` | Create (generator-only) | Tool-agnostic mirror of `CLAUDE.md` with "for AI agents" preface. Auto-gen header required. |
| `scripts/check-pr-comments.ts` | Create | GraphQL gate — exits non-zero if any review thread is unresolved; warns on self-resolve. |
| `scripts/check-branch-protection.ts` | Create | Fails CI if `required_conversation_resolution: false` on `main`. |
| `scripts/lib/copilot/translators/claudemd-to-agentsmd.ts` | Create | Translates `CLAUDE.md` → `AGENTS.md` with header + "for AI agents" preface. |
| `scripts/sync-copilot.ts` | Modify | Wire the new translator into the output set. |
| `scripts/check-copilot-drift.ts` | Modify | Add `AGENTS.md` to `GENERATED_PATTERNS` + `listGeneratedFiles()`. |
| `__tests__/scripts/check-pr-comments.test.ts` | Create | Behavioral Vitest mocking `gh` GraphQL responses. |
| `__tests__/scripts/check-branch-protection.test.ts` | Create | Behavioral Vitest mocking `gh api` responses. |
| `package.json` | Modify | Add `ready-to-merge` script. |
| `.github/workflows/ci.yml` | Modify | Add steps invoking `check-pr-comments` and `check-branch-protection`. |
| `DECISIONS.md` | Modify | ADR entry: harness rationale, reversibility, residual self-resolve risk, manual branch-protection toggle. |

---

## Task 1: Add PR merge gate section to CLAUDE.md

**Files:**
- Modify: `CLAUDE.md` (insert new section between `## Out of scope` and `## Things that have been considered and rejected`, around line 150)

- [ ] **Step 1: Add the new section**

Use Edit on `CLAUDE.md`. Insert before the line `## Things that have been considered and rejected`:

```markdown
## PR merge gate

Before any agent or human calls `gh pr merge` on this repo:

1. **GitHub resolve-thread is ground truth.** A PR may not merge while `gh api graphql` returns any `PullRequestReviewThread` with `isResolved: false`. Enforced by GitHub branch protection (`required_conversation_resolution`) and by `pnpm ready-to-merge <pr>` locally.
2. **AI agents must RESOLVE or ESCALATE every open comment.** RESOLVE = address with a fix commit and reply with the SHA. ESCALATE = surface to the human owner with the comment verbatim, 2-3 options, and a recommendation; wait for a decision. No third bucket. "Looks minor" is not allowed.
3. **In-session reviewer findings count.** Output from `pr-review-toolkit:review-pr`, `code-review:code-review`, or `ultrareview` must be posted to the PR before merge so they fall under rule 1.
4. **Self-resolve is detectable.** `scripts/check-pr-comments.ts` warns when the PR author is also the thread resolver. Document the override on the PR if intentional.
5. **Mechanical command.** `pnpm ready-to-merge <pr>` runs `pnpm ci` (full local gate, including bundle-check) then queries unresolved threads. Must pass before `gh pr merge`.
6. **The branch protection rule must stay enabled.** CI runs `scripts/check-branch-protection.ts` against `main`; the build fails if `required_conversation_resolution` is off.

Rationale: human-in-the-loop quality gate for AI-assisted development on a Staff/Principal-bar artifact. See `DECISIONS.md` for residual-risk note. See `AGENTS.md` for the cross-tool surface (generated from this file).
```

- [ ] **Step 2: Verify Biome accepts the change**

Run: `pnpm check`
Expected: clean exit (Biome formats markdown but doesn't fail on it).

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "feat(docs): add pr merge gate to CLAUDE.md"
```

---

## Task 2: Behavioral test for `check-pr-comments.ts` (failing)

**Files:**
- Create: `__tests__/scripts/check-pr-comments.test.ts`
- Test target (not yet created): `scripts/check-pr-comments.ts`

The script will export `evaluatePullRequest({ prNumber, owner, repo, ghExec })` so tests can inject a mock `gh` runner. The wrapper at the bottom calls `process.exit()` only when invoked as `main`.

- [ ] **Step 1: Write the failing test**

Create `__tests__/scripts/check-pr-comments.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { evaluatePullRequest, type Thread } from '@/scripts/check-pr-comments';

function mkThread(overrides: Partial<Thread> = {}): Thread {
  return {
    id: 'T_1',
    isResolved: true,
    resolvedBy: { login: 'reviewer' },
    comments: [{ author: { login: 'reviewer' }, body: 'lgtm' }],
    ...overrides,
  };
}

function mockGh(threads: Thread[], prAuthor = 'erikunha') {
  return vi.fn(async (_args: string[]) =>
    JSON.stringify({
      data: {
        repository: {
          pullRequest: {
            author: { login: prAuthor },
            reviewThreads: { nodes: threads },
          },
        },
      },
    }),
  );
}

describe('evaluatePullRequest', () => {
  it('passes when every thread is resolved by someone other than the PR author', async () => {
    const ghExec = mockGh([mkThread()]);
    const result = await evaluatePullRequest({
      prNumber: 42,
      owner: 'erikunha',
      repo: 'portfolio',
      ghExec,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.warnings).toEqual([]);
  });

  it('fails with code "unresolved_threads" when any thread is unresolved', async () => {
    const ghExec = mockGh([
      mkThread({ id: 'T_1' }),
      mkThread({ id: 'T_2', isResolved: false, resolvedBy: null }),
    ]);
    const result = await evaluatePullRequest({
      prNumber: 42,
      owner: 'erikunha',
      repo: 'portfolio',
      ghExec,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('unresolved_threads');
      expect(result.unresolvedThreads).toEqual(['T_2']);
    }
  });

  it('warns "suspicious_self_resolve" when PR author resolved their own thread', async () => {
    const ghExec = mockGh([
      mkThread({ resolvedBy: { login: 'erikunha' } }),
    ]);
    const result = await evaluatePullRequest({
      prNumber: 42,
      owner: 'erikunha',
      repo: 'portfolio',
      ghExec,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.warnings).toContainEqual({
        code: 'suspicious_self_resolve',
        threadId: 'T_1',
      });
    }
  });

  it('fails with code "gh_auth_missing" when gh exits with auth error', async () => {
    const ghExec = vi.fn(async () => {
      const err = new Error('gh: auth required') as Error & { code?: string };
      err.code = 'GH_AUTH';
      throw err;
    });
    const result = await evaluatePullRequest({
      prNumber: 42,
      owner: 'erikunha',
      repo: 'portfolio',
      ghExec,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('gh_auth_missing');
  });

  it('fails with code "graphql_failure" when GraphQL returns errors array', async () => {
    const ghExec = vi.fn(async () =>
      JSON.stringify({ errors: [{ message: 'rate limited' }] }),
    );
    const result = await evaluatePullRequest({
      prNumber: 42,
      owner: 'erikunha',
      repo: 'portfolio',
      ghExec,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('graphql_failure');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run __tests__/scripts/check-pr-comments.test.ts`
Expected: FAIL — `Cannot find module '@/scripts/check-pr-comments'` (file doesn't exist yet).

- [ ] **Step 3: Commit the failing test**

```bash
git add __tests__/scripts/check-pr-comments.test.ts
git commit -m "test(scripts): add failing test for pr-comments gate"
```

---

## Task 3: Implement `check-pr-comments.ts`

**Files:**
- Create: `scripts/check-pr-comments.ts`

- [ ] **Step 1: Write the implementation**

Create `scripts/check-pr-comments.ts`:

```ts
#!/usr/bin/env tsx
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileP = promisify(execFile);

export type Thread = {
  id: string;
  isResolved: boolean;
  resolvedBy: { login: string } | null;
  comments: Array<{ author: { login: string }; body: string }>;
};

export type Warning = { code: 'suspicious_self_resolve'; threadId: string };

export type EvalResult =
  | { ok: true; warnings: Warning[] }
  | {
      ok: false;
      code: 'unresolved_threads' | 'gh_auth_missing' | 'graphql_failure' | 'unknown';
      message: string;
      unresolvedThreads?: string[];
    };

export type GhExec = (args: string[]) => Promise<string>;

const QUERY = `query($owner:String!,$repo:String!,$pr:Int!){
  repository(owner:$owner,name:$repo){
    pullRequest(number:$pr){
      author{login}
      reviewThreads(first:100){
        nodes{
          id
          isResolved
          resolvedBy{login}
          comments(first:1){nodes{author{login} body}}
        }
      }
    }
  }
}`;

type GraphQLEnvelope = {
  data?: {
    repository?: {
      pullRequest?: {
        author: { login: string };
        reviewThreads: {
          nodes: Array<{
            id: string;
            isResolved: boolean;
            resolvedBy: { login: string } | null;
            comments: { nodes: Array<{ author: { login: string }; body: string }> };
          }>;
        };
      };
    };
  };
  errors?: Array<{ message: string }>;
};

export async function evaluatePullRequest(opts: {
  prNumber: number;
  owner: string;
  repo: string;
  ghExec: GhExec;
}): Promise<EvalResult> {
  let raw: string;
  try {
    raw = await opts.ghExec([
      'api',
      'graphql',
      '-f',
      `query=${QUERY}`,
      '-F',
      `owner=${opts.owner}`,
      '-F',
      `repo=${opts.repo}`,
      '-F',
      `pr=${opts.prNumber}`,
    ]);
  } catch (e) {
    const msg = (e as Error).message ?? String(e);
    if (/auth|login|token/i.test(msg)) {
      return { ok: false, code: 'gh_auth_missing', message: msg };
    }
    return { ok: false, code: 'unknown', message: msg };
  }

  let envelope: GraphQLEnvelope;
  try {
    envelope = JSON.parse(raw) as GraphQLEnvelope;
  } catch (e) {
    return { ok: false, code: 'graphql_failure', message: `non-JSON gh output: ${(e as Error).message}` };
  }

  if (envelope.errors && envelope.errors.length > 0) {
    return {
      ok: false,
      code: 'graphql_failure',
      message: envelope.errors.map((x) => x.message).join('; '),
    };
  }

  const pr = envelope.data?.repository?.pullRequest;
  if (!pr) {
    return { ok: false, code: 'graphql_failure', message: 'pullRequest not found in response' };
  }

  const author = pr.author.login;
  const threads: Thread[] = pr.reviewThreads.nodes.map((t) => ({
    id: t.id,
    isResolved: t.isResolved,
    resolvedBy: t.resolvedBy,
    comments: t.comments.nodes,
  }));

  const unresolved = threads.filter((t) => !t.isResolved).map((t) => t.id);
  if (unresolved.length > 0) {
    return {
      ok: false,
      code: 'unresolved_threads',
      message: `${unresolved.length} unresolved review thread(s) on PR #${opts.prNumber}: ${unresolved.join(', ')}`,
      unresolvedThreads: unresolved,
    };
  }

  const warnings: Warning[] = threads
    .filter((t) => t.resolvedBy?.login === author)
    .map((t) => ({ code: 'suspicious_self_resolve' as const, threadId: t.id }));

  return { ok: true, warnings };
}

async function defaultGhExec(args: string[]): Promise<string> {
  const { stdout } = await execFileP('gh', args, { encoding: 'utf8' });
  return stdout;
}

async function resolvePrNumber(passed: string | undefined): Promise<number> {
  if (passed && /^\d+$/.test(passed)) return Number(passed);
  const { stdout } = await execFileP('gh', ['pr', 'view', '--json', 'number', '-q', '.number'], {
    encoding: 'utf8',
  });
  const n = Number(stdout.trim());
  if (!Number.isFinite(n)) throw new Error('could not infer PR number from current branch');
  return n;
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
    const prNumber = await resolvePrNumber(process.argv[2]);
    const { owner, repo } = await resolveOwnerRepo();
    const result = await evaluatePullRequest({ prNumber, owner, repo, ghExec: defaultGhExec });
    if (!result.ok) {
      process.stderr.write(`PR_GATE_FAIL code=${result.code} ${result.message}\n`);
      if (result.unresolvedThreads) {
        for (const id of result.unresolvedThreads) process.stderr.write(`  unresolved: ${id}\n`);
      }
      process.exit(1);
    }
    for (const w of result.warnings) {
      process.stderr.write(`PR_GATE_WARN code=${w.code} thread=${w.threadId}\n`);
    }
    process.stdout.write(`PR gate OK (pr=${prNumber}, warnings=${result.warnings.length})\n`);
    process.exit(0);
  } catch (e) {
    process.stderr.write(`PR_GATE_FAIL code=unknown ${(e as Error).message}\n`);
    process.exit(2);
  }
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) void main();
```

- [ ] **Step 2: Run the test suite**

Run: `pnpm vitest run __tests__/scripts/check-pr-comments.test.ts`
Expected: PASS — all 5 cases green.

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add scripts/check-pr-comments.ts __tests__/scripts/check-pr-comments.test.ts
git commit -m "feat(scripts): pr comment merge gate with self-resolve detection"
```

---

## Task 4: Add `ready-to-merge` script to package.json

**Files:**
- Modify: `package.json:11-31` (scripts block)

- [ ] **Step 1: Add the script**

Edit `package.json`. After the `"ci:local"` line, add:

```json
    "ready-to-merge": "pnpm ci && tsx scripts/check-pr-comments.ts",
```

The script accepts an optional PR number via `pnpm ready-to-merge -- 42` (pnpm passes args through `--`). When omitted, the script infers the PR number from the current branch via `gh pr view`.

- [ ] **Step 2: Verify pnpm picks up the script**

Run: `pnpm run --silent | grep ready-to-merge`
Expected: outputs `ready-to-merge` line.

- [ ] **Step 3: Document the command in CLAUDE.md commands table**

Edit `CLAUDE.md`. In the `## Commands` table (around line 11-23), add a new row after `pnpm bundle-check`:

```markdown
| `pnpm ready-to-merge [-- <pr>]` | Pre-merge gate: full CI + every GH review thread resolved |
```

- [ ] **Step 4: Commit**

```bash
git add package.json CLAUDE.md
git commit -m "feat(dx): pnpm ready-to-merge script wires ci + pr comment gate"
```

---

## Task 5: Behavioral test for `check-branch-protection.ts` (failing)

**Files:**
- Create: `__tests__/scripts/check-branch-protection.test.ts`
- Test target (not yet created): `scripts/check-branch-protection.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/scripts/check-branch-protection.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { evaluateBranchProtection } from '@/scripts/check-branch-protection';

function mockGh(payload: unknown, opts: { reject?: Error } = {}) {
  return vi.fn(async () => {
    if (opts.reject) throw opts.reject;
    return JSON.stringify(payload);
  });
}

describe('evaluateBranchProtection', () => {
  it('passes when required_conversation_resolution.enabled is true', async () => {
    const ghExec = mockGh({ required_conversation_resolution: { enabled: true } });
    const r = await evaluateBranchProtection({ owner: 'erikunha', repo: 'portfolio', branch: 'main', ghExec });
    expect(r.ok).toBe(true);
  });

  it('fails with code "conversation_resolution_off" when enabled is false', async () => {
    const ghExec = mockGh({ required_conversation_resolution: { enabled: false } });
    const r = await evaluateBranchProtection({ owner: 'erikunha', repo: 'portfolio', branch: 'main', ghExec });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('conversation_resolution_off');
  });

  it('fails with code "conversation_resolution_off" when block is missing entirely', async () => {
    const ghExec = mockGh({});
    const r = await evaluateBranchProtection({ owner: 'erikunha', repo: 'portfolio', branch: 'main', ghExec });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('conversation_resolution_off');
  });

  it('fails with code "branch_unprotected" when gh returns 404-style error', async () => {
    const ghExec = mockGh(null, { reject: new Error('HTTP 404: Branch not protected') });
    const r = await evaluateBranchProtection({ owner: 'erikunha', repo: 'portfolio', branch: 'main', ghExec });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('branch_unprotected');
  });

  it('fails with code "gh_auth_missing" on auth error', async () => {
    const ghExec = mockGh(null, { reject: new Error('gh: auth required') });
    const r = await evaluateBranchProtection({ owner: 'erikunha', repo: 'portfolio', branch: 'main', ghExec });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('gh_auth_missing');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run __tests__/scripts/check-branch-protection.test.ts`
Expected: FAIL — `Cannot find module '@/scripts/check-branch-protection'`.

- [ ] **Step 3: Commit**

```bash
git add __tests__/scripts/check-branch-protection.test.ts
git commit -m "test(scripts): add failing test for branch-protection gate"
```

---

## Task 6: Implement `check-branch-protection.ts`

**Files:**
- Create: `scripts/check-branch-protection.ts`

- [ ] **Step 1: Write the implementation**

Create `scripts/check-branch-protection.ts`:

```ts
#!/usr/bin/env tsx
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileP = promisify(execFile);

export type EvalResult =
  | { ok: true }
  | {
      ok: false;
      code:
        | 'conversation_resolution_off'
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
      process.stderr.write(`BRANCH_PROTECTION_FAIL code=${result.code} ${result.message}\n`);
      process.exit(1);
    }
    process.stdout.write(`Branch protection OK (${branch}: required_conversation_resolution=true)\n`);
    process.exit(0);
  } catch (e) {
    process.stderr.write(`BRANCH_PROTECTION_FAIL code=unknown ${(e as Error).message}\n`);
    process.exit(2);
  }
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) void main();
```

- [ ] **Step 2: Run tests**

Run: `pnpm vitest run __tests__/scripts/check-branch-protection.test.ts`
Expected: PASS — all 5 cases green.

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add scripts/check-branch-protection.ts
git commit -m "feat(scripts): branch-protection gate verifies conversation-resolution enabled"
```

---

## Task 7: Wire both checks into CI

**Files:**
- Modify: `.github/workflows/ci.yml` (insert two new steps in `build-and-gate` job)

- [ ] **Step 1: Add the steps**

Edit `.github/workflows/ci.yml`. After the existing `Verify Copilot port artifacts in sync` step (around line 64-67), insert:

```yaml
      - name: Verify branch protection on main
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: pnpm tsx scripts/check-branch-protection.ts main

      - name: PR comment merge gate
        if: github.event_name == 'pull_request'
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: pnpm tsx scripts/check-pr-comments.ts ${{ github.event.pull_request.number }}
```

The PR comment gate runs only on `pull_request` events because `push` events to `main` have no PR context to query.

- [ ] **Step 2: Verify YAML is parseable**

Run: `pnpm tsx -e "import { readFileSync } from 'node:fs'; console.log(readFileSync('.github/workflows/ci.yml', 'utf8').length, 'bytes')"`
Expected: a positive byte count and no parse error from YAML. (Full YAML schema validation lives in GitHub's runner; we cannot lint it locally without `actionlint` installed. If the user has `actionlint` available, run `actionlint .github/workflows/ci.yml` instead.)

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: enforce branch protection + pr comment gate in build-and-gate job"
```

---

## Task 8: AGENTS.md generator + sync wiring + drift extension

This task creates the translator that emits `AGENTS.md` from `CLAUDE.md`, wires it into `sync-copilot.ts`, extends `check-copilot-drift.ts` to verify the header, and runs the generator to produce the first `AGENTS.md`.

**Files:**
- Create: `scripts/lib/copilot/translators/claudemd-to-agentsmd.ts`
- Modify: `scripts/sync-copilot.ts` (add new output)
- Modify: `scripts/check-copilot-drift.ts` (add AGENTS.md to GENERATED_PATTERNS + listGeneratedFiles)
- Create: `AGENTS.md` (via generator)

- [ ] **Step 1: Write the translator**

Create `scripts/lib/copilot/translators/claudemd-to-agentsmd.ts`:

```ts
import { autoGenHeader } from '../auto-gen-header';
import type { TranslatorOutput } from '../types';

const AI_PREFACE = `## For AI Agents

This file is the **tool-agnostic** version of \`CLAUDE.md\`. Every binding rule below applies to every AI coding agent operating in this repo: Claude Code, Copilot, Cursor, Codex, Aider, and future tools.

**Hard rule — PR merges:** No agent may call \`gh pr merge\` while any GitHub review thread on the PR has \`isResolved: false\`. The gate is mechanically enforced by \`pnpm ready-to-merge\` and by GitHub branch protection (\`required_conversation_resolution\`). See the **PR merge gate** section below for the full contract — RESOLVE or ESCALATE; no third option.

`;

export function claudemdToAgentsMd(source: string, sourcePath: string): TranslatorOutput {
  const header = autoGenHeader(sourcePath);
  const content = `${header}\n\n${AI_PREFACE}${source}`;
  return { path: 'AGENTS.md', content };
}
```

- [ ] **Step 2: Wire into sync-copilot.ts**

Edit `scripts/sync-copilot.ts`. Add an import after the existing translator imports (around line 8-13):

```ts
import { claudemdToAgentsMd } from './lib/copilot/translators/claudemd-to-agentsmd';
```

In the `main()` function, inside the `if (!flags.only || flags.only === 'instructions')` block (around line 109-129), after the line:

```ts
    outputs.push(
      claudemdToInstructions(projectClaudeMd, projectClaudeMdPath, portedNames, {
        target: 'project',
      }),
    );
```

Add:

```ts
    outputs.push(claudemdToAgentsMd(projectClaudeMd, projectClaudeMdPath));
```

- [ ] **Step 3: Extend the drift checker**

Edit `scripts/check-copilot-drift.ts`. Modify `GENERATED_PATTERNS` (around line 9-15):

```ts
const GENERATED_PATTERNS = [
  /^AGENTS\.md$/,
  /^\.github\/copilot-instructions\.md$/,
  /^\.github\/prompts\//,
  /^\.github\/chatmodes\//,
  /^\.github\/instructions\//,
  /^\.vscode\/mcp\.json$/,
];
```

Modify `listGeneratedFiles()` (around line 40-51). After the `const files: string[] = [];` line, add:

```ts
  try {
    require('node:fs').statSync('AGENTS.md');
    files.push('AGENTS.md');
  } catch {}
```

Wait — `check-copilot-drift.ts` uses ES module imports. Use `readdirSync` instead. Replace the entire `listGeneratedFiles()` function with:

```ts
function listGeneratedFiles(): string[] {
  const files: string[] = [];
  const rootEntries = readDirSafe('.');
  if (rootEntries.includes('AGENTS.md')) files.push('AGENTS.md');
  const githubEntries = readDirSafe('.github');
  if (githubEntries.includes('copilot-instructions.md')) {
    files.push('.github/copilot-instructions.md');
  }
  for (const subdir of ['prompts', 'chatmodes', 'instructions']) {
    const entries = readDirSafe(path.join('.github', subdir));
    for (const e of entries) files.push(path.join('.github', subdir, e));
  }
  return files;
}
```

- [ ] **Step 4: Run the sync to produce AGENTS.md**

Run: `pnpm sync:copilot`
Expected: stdout shows `wrote AGENTS.md` among the other generated files.

- [ ] **Step 5: Verify AGENTS.md was created with the header**

Run: `head -5 AGENTS.md`
Expected: first three lines match the auto-gen-header marker:
```
<!-- AUTO-GENERATED by scripts/sync-copilot.ts — do not edit by hand.
     Source: CLAUDE.md
     Regenerate with: pnpm sync:copilot -->
```

- [ ] **Step 6: Run drift check against a noop range to verify header detection**

Run: `pnpm tsx scripts/check-copilot-drift.ts HEAD~1..HEAD`
Expected: stdout `Copilot port drift check: OK` (no source files changed in HEAD~1..HEAD that aren't paired with generated changes; the header check passes for the new AGENTS.md).

If a real drift is reported, fix it (add AGENTS.md to the same commit as the CLAUDE.md edit) and re-run.

- [ ] **Step 7: Run full local CI**

Run: `pnpm ci:local`
Expected: green.

- [ ] **Step 8: Commit**

```bash
git add scripts/lib/copilot/translators/claudemd-to-agentsmd.ts scripts/sync-copilot.ts scripts/check-copilot-drift.ts AGENTS.md
git commit -m "feat(harness): agents.md generated from claude.md with drift gate"
```

---

## Task 9: ADR entry in DECISIONS.md

**Files:**
- Modify: `DECISIONS.md` (append entry)

- [ ] **Step 1: Read the current DECISIONS.md tail**

Run: `tail -20 DECISIONS.md`
Note the format of recent entries — match the date / bullet / reversibility convention.

- [ ] **Step 2: Append the ADR entry**

Edit `DECISIONS.md`. Append:

```markdown
- **2026-05-19** — Tool-agnostic PR comment merge gate. `CLAUDE.md` adds a `## PR merge gate` section; `AGENTS.md` is generated from it (auto-gen header enforced by `check-copilot-drift.ts`). `scripts/check-pr-comments.ts` blocks merge via `pnpm ready-to-merge` when any GitHub review thread has `isResolved: false`; warns on self-resolve (PR author == thread resolver). `scripts/check-branch-protection.ts` fails CI if `required_conversation_resolution` is off on `main`. Reversibility: low — all changes are config + scripts; revert with one commit. Residual risk: an agent with write access can still resolve threads it shouldn't (the self-resolve warning surfaces this but doesn't block). Manual prerequisite: enable "Require conversations resolved before merging" on the `main` branch in GitHub UI — one-time admin toggle, not reproducible from this repo's code. Disable command: `gh api -X DELETE repos/<owner>/<repo>/branches/main/protection/required_conversation_resolution`.
```

- [ ] **Step 3: Run a final full local CI**

Run: `pnpm ci`
Expected: green.

- [ ] **Step 4: Commit**

```bash
git add DECISIONS.md
git commit -m "docs(adr): record pr comment harness rationale and residual risk"
```

---

## Task 10: Dispatch DISPATCH_ADDITIONS agents + final verification

Per the architect-reviewer's `DISPATCH_ADDITIONS`, dispatch `dx-optimizer` and `security-auditor` against the final diff before pushing.

- [ ] **Step 1: Run `dx-optimizer` against the changes**

Use the Agent tool with `subagent_type: dx-optimizer`. Prompt:

> Review the `chore/pr-comment-harness` branch diff (vs main). Focus: does the `pnpm ready-to-merge` UX make sense for a solo developer using this repo with AI agents (Claude Code primarily)? Specifically: (a) is `pnpm ci` (~2 min) the right gate before `gh pr merge`, or does it dwarf the `check-pr-comments.ts` step that's the actual point of this gate? (b) is the `pnpm ready-to-merge -- 42` arg-pass-through pattern discoverable enough, or should we accept positional args natively? (c) anything in the CI workflow that doubles existing work? Return concrete fixes, not vibes. Under 400 words.

- [ ] **Step 2: Run `security-auditor` against the changes**

Use the Agent tool with `subagent_type: security-auditor`. Prompt:

> Review the `chore/pr-comment-harness` branch diff (vs main). Focus on `scripts/check-pr-comments.ts` and `scripts/check-branch-protection.ts`. Specifically: (a) command-injection surfaces — both scripts call `gh` via `execFile` (no shell), confirm; (b) data exfiltration risk — the scripts emit thread IDs and PR data to stderr/stdout; any sensitive fields leaked? (c) self-resolve bypass — is the warning-only treatment of `suspicious_self_resolve` defensible, or should it block? (d) branch-protection check uses `GITHUB_TOKEN` — confirm the token scope is sufficient and doesn't expand the runner's privilege beyond what other steps already have. Return concrete findings with severity. Under 400 words.

- [ ] **Step 3: Address findings**

For each finding from steps 1-2: either fix in a new commit on this branch, or document why the finding is accepted in `DECISIONS.md` under the existing ADR entry. Do not push until all findings are RESOLVED or DOCUMENTED.

- [ ] **Step 4: Final verification**

Run all three in sequence:

```bash
pnpm ci
pnpm sync:copilot && git diff --quiet AGENTS.md .github/copilot-instructions.md  # regen should be a noop
pnpm tsx scripts/check-copilot-drift.ts main..HEAD
```

Expected: all three green. The second one specifically catches "did the generator output drift since the last commit?" — if AGENTS.md or copilot-instructions.md changed on re-run, commit the diff before pushing.

- [ ] **Step 5: Push and open PR**

```bash
git push -u origin chore/pr-comment-harness
gh pr create --title "feat(harness): tool-agnostic pr comment merge gate" --body "$(cat <<'EOF'
## Summary

- Adds a tool-agnostic merge gate that blocks `gh pr merge` while any GitHub review thread on the PR is unresolved.
- Policy lives in `CLAUDE.md` (`## PR merge gate`); the cross-tool surface `AGENTS.md` is generated from it via `pnpm sync:copilot` with an auto-gen header enforced by the drift checker.
- Local gate: `pnpm ready-to-merge [-- <pr>]` chains `pnpm ci` + `scripts/check-pr-comments.ts`. The gate warns on self-resolve (PR author resolves their own threads).
- CI backstop: `scripts/check-branch-protection.ts` fails the build if `required_conversation_resolution` is off on `main`.
- Manual one-time setup required: enable "Require conversations resolved before merging" on the `main` branch in GitHub UI before merging this PR.

## Test plan

- [ ] `pnpm ci` green
- [ ] `pnpm sync:copilot` regenerates AGENTS.md identical to committed
- [ ] `pnpm vitest run __tests__/scripts/` — both new tests pass
- [ ] Branch protection rule enabled on `main`
- [ ] Self-test: this PR exercises the gate. Resolve all review threads before merge.
EOF
)"
```

- [ ] **Step 6: Manually enable branch protection** (one-time, requires admin)

In the GitHub UI: Repository → Settings → Branches → Branch protection rules → `main` → check "Require conversations to be resolved before merging" → Save.

Alternatively via CLI:

```bash
gh api -X PATCH repos/erikunha/portfolio/branches/main/protection/required_conversation_resolution -f enabled=true
```

(Replace `erikunha/portfolio` with the actual repo owner/name if different.)

- [ ] **Step 7: Self-test the gate on this PR**

The PR opened in Step 5 is itself the first artifact under the new gate. To self-test:

1. Run `pnpm ready-to-merge -- <this-pr-number>` locally. If any review comments arrived, they should block.
2. Resolve all threads via the GitHub UI.
3. Re-run `pnpm ready-to-merge -- <this-pr-number>`. Expected: PASS.
4. `gh pr merge` should succeed.

---

## Self-review (post-write checklist)

**Spec coverage** — Every fix from the architect-reviewer block is mapped to a task:
- Generator-only AGENTS.md (Gate 1) → Task 8 (no hand-written seed; sync emits it directly).
- CLI envelope misuse (Gate 1, Standard 4) → Task 3 (no `requestId`, stderr + named codes).
- Behavioral test for branch-protection check (Gate 2, Standard 4) → Tasks 5+6.
- Self-resolve bypass undefended (Gate 2) → Task 3 (warning surface) + Task 9 (residual risk documented).
- ready-to-merge skips bundle-check (Gate 4) → Task 4 (chains `pnpm ci` not `pnpm ci:local`).

NITs mapped: (a) PR number auto-infer via `gh pr view` → Task 3 `resolvePrNumber`. (b) Standard wording binds the gate → Task 1 section text. (c) New scripts in doc-vs-code audit — there is no `scripts/audit/` corpus yet in this repo; documented as out-of-scope for this PR.

**Placeholder scan** — no "TBD", "appropriate error handling", or "similar to Task N" references. Every code block contains complete, runnable code.

**Type consistency** — `EvalResult`, `Thread`, `Warning`, `GhExec` types are defined in Task 3 and re-used identically in Task 2's mocks. `evaluateBranchProtection` types in Task 6 are self-contained. Function signatures match across tasks.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-19-pr-comment-harness.md`. Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. Best for a 10-task plan with TDD discipline; each subagent gets a focused context.
2. **Inline Execution** — Execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints. Faster but the main context grows with each task's diff.
