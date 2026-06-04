> Status: DRAFT
> Date: 2026-06-04
> Workstream: WS6 Documentation Truth and Drift Control
> Parent: ../specs/2026-06-04-platform-mastery-program-design.md
> PR order: 3 of 8
> Delivery: standalone PR to main

# WS6: Documentation Truth and Drift Control

## Context

The 2026-06-04 platform audit found that `ARCHITECTURE.md` section 4 ("Directory layout") references at least six paths that no longer exist in the codebase. The tree was accurate at an earlier point in the project's evolution but was never updated as components were renamed, restructured into subdirectories, or replaced.

A second finding came from the audit process itself: the parallel research agents read from the local working tree, which was two commits behind `origin/main`. PRs #86 and #87 had already shipped `app/api/healthz/route.ts`, `app/api/psi-refresh/route.ts`, `.nvmrc`, and SHA-pinned GitHub Actions. Those items were reported as gaps when they were already closed. The root cause is that read-only audit agents must pin to `origin/main`, not the local working tree, which can lag behind in a multi-session workflow. This lesson belongs in persistent memory so future audit agents apply it automatically.

The drift gap is the medium-severity finding listed in the parent program spec. There is currently no automated check: an engineer can edit the tree in ARCHITECTURE.md and leave it stale indefinitely with no CI signal. This workstream closes that gap by making doc drift a build failure rather than a review observation.

## Goal

1. Fix every stale path in the `ARCHITECTURE.md` section 4 file tree to match the current filesystem.
2. Introduce `scripts/check-doc-drift.mjs`: a CI gate that parses the ARCHITECTURE.md file tree block and fails if any referenced path does not exist. Drift is a build failure from this point forward.
3. Update the checkboxes in `docs/superpowers/plans/2026-06-03-cicd-reliability-hardening.md` to reflect that all tasks in that plan shipped in PRs #86 and #87.
4. Record the "audit agents must read from `origin/main`, not the working tree" lesson in the project's persistent memory file.

## Drift inventory

Each row was verified against the filesystem on 2026-06-04. "Current reality" is the confirmed real path or structure.

| Stale path in ARCHITECTURE.md tree | Current reality | Category |
|---|---|---|
| `app/robots.ts` | `public/robots.txt` (static file, not a dynamic route) | Renamed + moved |
| `app/llms.txt/route.ts` | `public/llms.txt` (static file, not a dynamic route) | Renamed + moved |
| `app/contact/action.ts` | Removed; the contact form now calls `app/api/contact/route.ts` directly | Removed |
| `components/terminal/` | Removed; terminal-style UI components moved into `app/design-system/` and inline sections | Removed |
| `components/ui/` | Removed; minimal UI primitives moved into `app/design-system/` | Removed |
| `components/client/matrix-dialog.client.tsx` | `components/client/HeroBootAnimation/HeroBootAnimation.tsx` (flat file reorganized as named subdirectory) | Renamed + restructured |
| `components/client/shell.client.tsx` | `components/client/InteractiveShell/InteractiveShell.tsx` | Renamed + restructured |
| `components/client/contact-form.client.tsx` | `components/client/ContactForm/ContactForm.tsx` | Renamed + restructured |
| `components/client/typewriter-observer.client.tsx` | Removed; role-typing behavior now in `components/client/RoleTyper/RoleTyper.tsx` | Removed / replaced |
| `components/client/motion-indicator.client.tsx` | Removed; scroll-to-top behavior now in `components/client/ToTopButton/ToTopButton.tsx` | Removed / replaced |
| `content/bio.ts` | `content/readme.ts` | Renamed |
| `content/zod-schemas.ts` | `content/schemas.ts` | Renamed |
| `tests/unit/` | `__tests__/` at repo root (Vitest unit tests co-located at root, not under `tests/`) | Moved |

**Total stale paths confirmed: 13**

Additionally, the following routes exist in the codebase but are absent from the ARCHITECTURE.md tree. They are not blocking (omission, not false assertion), but the tree fix should add them for completeness:

| Missing from tree | Present at |
|---|---|
| `app/api/[transport]/route.ts` | `app/api/[transport]/route.ts` |
| `app/api/csp-report/route.ts` | `app/api/csp-report/route.ts` |
| `app/api/healthz/route.ts` | `app/api/healthz/route.ts` |
| `app/api/log/route.ts` | `app/api/log/route.ts` |
| `app/api/psi-refresh/route.ts` | `app/api/psi-refresh/route.ts` |

Note: `STANDARDS.md` Ch.9 contains a false claim about CSP being enforced in production. That claim is owned by WS0 and must not be edited here. This spec only coordinates: do not touch `STANDARDS.md` Ch.9 in the WS6 PR.

## Approach

### 1. Fix the ARCHITECTURE.md file tree

Edit section 4 of `ARCHITECTURE.md` (the fenced code block starting at line 145) to replace every stale path with its correct current form. The tree is illustrative, not exhaustive; it does not need to list every file, only a representative sample that communicates the structural intent. Rules for the fix:

- Remove `app/robots.ts` and `app/llms.txt/route.ts`; add a comment that robots and llms.txt are static files in `public/`.
- Remove `app/contact/action.ts`; the contact route comment in `app/api/contact/route.ts` already covers it.
- Remove `components/terminal/` and `components/ui/`.
- Replace the five flat `*.client.tsx` names with the current subdirectory names.
- Replace `content/bio.ts` with `content/readme.ts` and `content/zod-schemas.ts` with `content/schemas.ts`.
- Replace `tests/unit/` with `__tests__/`.
- Add the five missing API routes with a short comment each.

### 2. Build scripts/check-doc-drift.mjs

The gate follows the same structural pattern as `scripts/check-section-order.mjs` (the project's canonical template for a Node-based CI gate): a single-file ESM script, `process.cwd()` for root resolution, `readFileSync` for I/O, `process.exit(1)` on failure, a human-readable summary line on success.

**Parsing strategy:**

1. Read `ARCHITECTURE.md` as a string.
2. Locate the section 4 tree block by finding the heading `## 4. Directory layout` and then the first opening ` ``` ` (no language tag) that follows it.
3. Extract the content between that opening fence and the matching closing ` ``` `.
4. From the extracted block, collect path-like tokens: lines that start with optional whitespace followed by a file or directory name containing at least one `.` or ending in `/`. Exclude comment-only lines (lines whose first non-whitespace character is `#`).
5. Resolve each token against `process.cwd()`.
6. Check existence with `fs.existsSync()`. Files are checked directly; directory tokens (ending in `/`) are checked with `statSync().isDirectory()`.
7. Collect failures. If any, print each missing path and `process.exit(1)`.

**Path extraction rules** (to avoid false positives):

- Lines that are purely comment text (e.g., `# font, theme tokens, JSON-LD, metadata`) are skipped entirely.
- Tokens that appear after a `#` inline comment on the same line are ignored (only the part before `#` is the path fragment).
- The extracted "path" is the minimal path component, not the full line. The parser extracts the first whitespace-delimited token from each candidate line.
- The path is resolved relative to `process.cwd()` (repo root), which is where the gate runs.
- Paths that describe directory roots (`app/`, `components/`) are expected to exist as directories. The parser recognizes trailing `/` as a directory indicator.
- An ALLOW_DRIFT_PATHS set handles any paths that are illustrative conventions rather than literal filesystem entries (e.g., a comment showing a naming convention). This set is documented inline in the script with a `// WHY:` comment and starts empty.

### 3. Wire the gate into CI

Add `check:doc-drift` to `package.json` scripts:

```
"check:doc-drift": "node scripts/check-doc-drift.mjs"
```

Add it to the `ci:local` chain. The gate is fast (file reads only) and belongs alongside the other `check-*` scripts.

### 4. Update the 2026-06-03 reliability plan checkboxes

In `docs/superpowers/plans/2026-06-03-cicd-reliability-hardening.md`, change every `- [ ]` task step that represents work shipped in PRs #86 and #87 to `- [x]`. The shipped scope covers all tasks in Phase 1 (Tasks 1-9) and all tasks in Phase 2 (Tasks 10-14), including:

- `/api/healthz` route and unit tests
- post-deploy smoke workflow (`.github/workflows/smoke.yml`)
- PSI cron alerting and `meta:psi-last-run` KV write
- ai-eval Upstash isolation
- rollback runbook in `CLAUDE.md`
- `.nvmrc`
- server crash logging in CI
- visual spec move to `tests/visual/`
- SHA-pinned GitHub Actions

The Self-Review Checklist at the bottom already uses `[x]` and does not need changing.

### 5. Record the audit-pins-to-origin lesson

Add the following entry to the project memory file at `.claude/projects/-Users-erikhenriquealvescunha-Documents-Claude-Projects-erik-portifolio/memory/MEMORY.md`:

```
- [Read-only audit agents pin to origin/main](feedback_audit_pin_to_origin.md) -- before running any audit, research, or gap-analysis agent, run `git fetch && git status` first; confirm local HEAD matches origin/main; stale working trees caused a 2-commit-behind false-positive finding in the 2026-06-04 platform audit (PRs #86/#87 already shipped)
```

And create the corresponding file `feedback_audit_pin_to_origin.md` in the same memory directory.

**CLAUDE.md vs memory: choice.** WS4 and WS7 both edit `CLAUDE.md`. Adding a third WS6 edit creates a merge-order dependency. The lesson is operational (applies to agent invocation posture) rather than a standing project rule, so it fits better in memory than in CLAUDE.md. Placing it in memory avoids the contention and is consistent with how similar audit-process lessons are stored in this repo.

## Architecture

### New files

| Path | Purpose |
|---|---|
| `scripts/check-doc-drift.mjs` | CI gate: parses the ARCHITECTURE.md file tree block and exits 1 if any referenced path is absent |
| `__tests__/scripts/check-doc-drift.test.ts` | Vitest tests: gate fails on a broken fixture, passes on the real ARCHITECTURE.md |
| `.claude/projects/-Users-erikhenriquealvescunha-Documents-Claude-Projects-erik-portifolio/memory/feedback_audit_pin_to_origin.md` | Persistent memory: audit agents must pin to origin/main |

### Modified files

| Path | Change |
|---|---|
| `ARCHITECTURE.md` | Section 4 tree block: 13 stale paths corrected; 5 missing routes added |
| `docs/superpowers/plans/2026-06-03-cicd-reliability-hardening.md` | All task checkboxes marked `[x]` to reflect shipped state |
| `package.json` | Add `"check:doc-drift": "node scripts/check-doc-drift.mjs"` to scripts |
| `package.json` | Add `check:doc-drift` to the `ci:local` chain |
| `.claude/projects/-Users-erikhenriquealvescunha-Documents-Claude-Projects-erik-portifolio/memory/MEMORY.md` | Add audit-pin lesson entry |

## Error handling

**Malformed tree lines:** Lines that do not parse as a path (pure comment lines, blank lines, separator lines) are skipped without error. The parser is conservative: it only extracts tokens that look like `something.ext` or `something/` or `something/nested.ext`. Ambiguous lines default to being skipped.

**Inline comments:** The format `path/to/file.ts  # comment` is common in the ARCHITECTURE.md tree. The parser strips everything from `#` onward before extracting the path token.

**Illustrative paths:** The ARCHITECTURE.md tree includes lines like `robots.ts, sitemap.ts` (comma-separated on one line) to convey multiple files concisely. The parser handles comma-separated tokens on a single line by splitting on `,` and processing each token individually after trimming whitespace.

**False positives and the ALLOW_DRIFT_PATHS allowlist:** If any future author adds a naming-convention example to the tree (e.g., `[slug]/page.tsx` as an illustrative pattern) that is not a literal path, they must add it to the `ALLOW_DRIFT_PATHS` set in the script with a `// WHY:` comment. The allowlist is empty at initial implementation. It is not a backdoor for suppressing real drift: entries require an explicit written justification.

**Gate scope:** The gate checks only paths explicitly written in the ARCHITECTURE.md section 4 tree block. It does not scan the rest of `ARCHITECTURE.md` for path-like strings. This keeps the check precise and avoids false positives from prose references.

## Test strategy

TDD: write the failing test first, then implement the gate.

```typescript
// __tests__/scripts/check-doc-drift.test.ts
import { describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('check-doc-drift', () => {
  it('exits 1 when the tree references a path that does not exist', () => {
    // Write a minimal ARCHITECTURE.md fixture with a deliberately bad path
    const dir = join(tmpdir(), `check-doc-drift-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'ARCHITECTURE.md'),
      [
        '## 4. Directory layout',
        '',
        '```',
        'app/',
        '  does-not-exist.ts    # this path is fake',
        '```',
      ].join('\n'),
    );

    let exitCode = 0;
    try {
      execSync(`node scripts/check-doc-drift.mjs`, {
        cwd: dir,
        env: { ...process.env },
        stdio: 'pipe',
      });
    } catch (err: unknown) {
      exitCode = (err as { status: number }).status ?? 1;
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }

    expect(exitCode).toBe(1);
  });

  it('exits 0 when the real ARCHITECTURE.md tree matches the filesystem', () => {
    let exitCode = 0;
    try {
      execSync(`node scripts/check-doc-drift.mjs`, {
        cwd: process.cwd(),
        stdio: 'pipe',
      });
    } catch (err: unknown) {
      exitCode = (err as { status: number }).status ?? 1;
    }

    expect(exitCode).toBe(0);
  });
});
```

The second test is the gate's own acceptance test: it passes only when the ARCHITECTURE.md tree has been corrected. Write the failing tests first. The second test will fail until the tree fix lands. Implement `check-doc-drift.mjs` until both pass.

A third test is recommended once the gate is wired into CI:

```typescript
  it('handles comma-separated path tokens on one line without false positives', () => {
    // A tree line like "robots.ts, sitemap.ts" appears in ARCHITECTURE.md.
    // The parser must split on comma and check each token individually.
    // This test verifies no crash and no false-positive rejection of the real file.
    let exitCode = 0;
    try {
      execSync(`node scripts/check-doc-drift.mjs`, { cwd: process.cwd(), stdio: 'pipe' });
    } catch {
      exitCode = 1;
    }
    expect(exitCode).toBe(0);
  });
```

## Acceptance criteria

1. `pnpm check:doc-drift` passes on the corrected `ARCHITECTURE.md` tree with exit code 0.
2. `pnpm check:doc-drift` exits 1 when a stale path is introduced into the tree (verified with the test fixture above).
3. No path from the drift inventory table remains in the `ARCHITECTURE.md` file tree block after the fix.
4. `check:doc-drift` appears in the `ci:local` chain and runs in CI.
5. All 13 stale paths are removed or corrected; the gate passes green on the real tree.
6. All task checkboxes in `2026-06-03-cicd-reliability-hardening.md` are `[x]`.
7. The audit-pin lesson is written to the memory file and indexed in `MEMORY.md`.
8. `STANDARDS.md` Ch.9 is not edited in this PR (owned by WS0).
9. `CLAUDE.md` is not edited in this PR (WS4 and WS7 own those edits; lesson goes to memory).

## Out of scope

The parent program spec explicitly rejected a full meta-enforcement framework: a system that tracks every path, symbol, and claim across all docs and gates them generically. That design was rejected because it adds maintained complexity disproportionate to a single high-drift artifact and would model cargo-cult over-building. This workstream is the scoped, targeted cousin: one gate, one document, the highest-drift surface in the repo. It is not a generic doc-linter. If other docs accumulate similar drift over time, the correct extension is to pass a list of ARCHITECTURE.md-like files to the existing gate, not to build a new framework.

Also out of scope:

- Linting prose claims in `ARCHITECTURE.md` beyond path existence (e.g., line-count claims, budget numbers, description accuracy).
- Enforcing that the tree is complete (it is allowed to be illustrative, not exhaustive).
- Editing `STANDARDS.md` Ch.9 (WS0).
- Editing `CLAUDE.md` with the lesson (WS4 and WS7 already touch it; lesson goes to memory to avoid collision).
- Adding the missing routes to any automated completeness check (completeness is the human author's responsibility; existence is the gate's responsibility).

## Risks and open questions

**Risk 1: Parser brittleness on future tree reformatting.** If a future author changes the indentation style or adds a language tag to the opening fence (e.g., ` ```text `), the parser could silently miss the block and exit 0 instead of catching drift. Mitigation: assert that at least one path was extracted from the block; if the count is zero, exit 1 with a diagnostic ("no paths found in ARCHITECTURE.md section 4 tree block -- check parser"). This makes the failure mode loud rather than silent.

**Risk 2: Comma-separated tokens.** The current tree has `robots.ts, sitemap.ts` on a single line. After the tree fix, `robots.ts` will be removed and only `sitemap.ts` remains, so this line will become a single token. However, the parser must handle the comma-separated form defensively in case it appears again.

**Risk 3: ALLOW_DRIFT_PATHS becoming a suppression backdoor.** Any entry added to the allowlist without a `// WHY:` comment is a code-review finding. The gate review at PR time is the enforcement mechanism.

**Open question:** Should `check-doc-drift.mjs` be scoped strictly to `ARCHITECTURE.md` section 4, or should the target file be configurable via a CLI argument (e.g., `node scripts/check-doc-drift.mjs ARCHITECTURE.md`)? Recommendation: start with the hardcoded target. The gate solves a specific known problem. Configurability can be added when a second document needs the same treatment, not before. Confidence: high.

## Architect-reviewer gate findings (folded 2026-06-04, GATE_RESULT: PASS)

The architect gate passed all four spec gates, verified the 13-path drift inventory against the filesystem (accurate), and found two CRITICAL parser-design defects plus a 14th stale path. Plan tasks:

1. CRITICAL parser defect: the tree is indentation-nested, so `ask/route.ts` is really `app/api/ask/route.ts`. Resolving the bare token against `process.cwd()` false-positives on 10+ legitimately-existing nested entries. The parser MUST reconstruct each full path from indentation depth (an indent-to-prefix stack), OR the tree fix must flatten every entry to a repo-root-relative full path. Pick one mechanism explicitly and TDD it against a NESTED fixture, not only a flat one.
2. CRITICAL: 14th stale path. ARCHITECTURE.md references `og/` but the filesystem has `public/og.png` (a file). Fix the tree entry and let the gate treat it as a file.
3. Test coverage: add a fixture with nested `app/ -> api/ -> ask/route.ts` asserting exit 0, so the indentation logic is covered independently of the live tree. The current flat fixtures would pass a naive parser while the real tree breaks.

Class-of-bugs for thinking-inversion: indent-stack off-by-one, tabs vs spaces, dedent popping too many or too few levels; comment-strip must precede comma-split; directory-vs-file type must match the trailing-slash intent (a file masquerading as `foo/` must not silently pass); wrapped comment-continuation lines without a leading `#` must not parse as paths; a silent-empty parse block must exit 1.
