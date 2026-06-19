# Fast-Feedback Hooks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Tests come first in every task; implementation follows. Each task ends with a scoped commit (`git add <specific files>` — never `git add .`).

**Goal:** Add two local-session feedback hooks — `biome-format.sh` (PostToolUse `Edit|Write`) that applies Biome's mechanical fixes (format + import-organization, linter off) to each edited source file, and `session-context.sh` (SessionStart) that injects live git + PR + CI state as `additionalContext` — closing the fast-feedback axis the 2026 ecosystem benchmark flagged as the platform's one thin spot. Both are non-blocking, fail-silent, and fully reversible.

**Architecture:** Two standalone Bash hooks in `.claude/hooks/`, each matching the existing hook convention exactly: read stdin once, extract `tool_input.file_path` via the shared `python3` snippet (`biome-format` only — `session-context` takes no tool input), resolve repo root via `git rev-parse --show-toplevel`, run a single bounded command, and `exit 0` unconditionally. `biome-format.sh` is wired as the 4th hook in the existing PostToolUse `Edit|Write` array; `session-context.sh` is wired in a new top-level `SessionStart` array (the project `settings.json` has no SessionStart entry today, so this is additive and non-conflicting with the global/plugin SessionStart hooks). Greenfield test infra: no bash-hook test harness exists, so the plan creates a `*.test.sh` runner (`.claude/hooks/__tests__/run.sh`) that pipes mock JSON to stdin and asserts on observable output / file state, per STANDARDS Ch.4 (behavioral assertions only).

**Tech Stack:** Bash hooks (existing `.claude/hooks/*.sh` pattern) · `python3` stdin JSON extraction (identical to `css-token-guard.sh` / `section-order-guard.sh` / `api-edit-marker.sh`) · repo-local Biome binary `node_modules/.bin/biome` · `git` (porcelain/rev-list/status) · `gh` (PR + CI state) wrapped in `timeout 5` with git-only fallback · `*.test.sh` bash runner with a PATH-shim stub for the failing-`gh` case · Claude Code hook wiring in `.claude/settings.json`.

## Global Constraints

These hold for **every** task. Violating any one is a defect even if tests pass.

- **Non-blocking, always `exit 0`.** Both hooks are PostToolUse / SessionStart feedback hooks. They must NEVER block the edit or error the session. On any failure (Biome missing, file gone, parse error, `gh` unauthenticated, not a git repo) they fail silently and `exit 0`. (Contrast: the blocking guards `bash-guard.sh` / `architect-gate.sh` / `api-security-push-guard.sh` use `exit 2`; these two hooks must not.)
- **Match the existing hook stdin pattern verbatim.** Read all of stdin into `INPUT=$(cat)`, then extract the path with the exact shared snippet:
  ```bash
  FILE=$(printf '%s' "$INPUT" | python3 -c "
  import json, sys
  try:
    data = json.load(sys.stdin)
    print(data.get('tool_input', {}).get('file_path', '') or data.get('file_path', ''))
  except Exception:
    print('')
  " 2>/dev/null || echo "")
  ```
  `session-context.sh` does not read a `file_path` (SessionStart has no tool input) and so omits this snippet, but still consumes stdin defensively.
- **Repo-root resolution:** `REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)`. Invoke the repo-local Biome binary by absolute path (`"$REPO_ROOT/node_modules/.bin/biome"`), never a bare `biome`.
- **`biome-format` command is `check --write`, NOT `format`** — `biome.json` has `assist.actions.source.organizeImports: on` (verified), so plain `format --write` leaves import order failing the pre-commit `biome check .` gate. The exact command is:
  ```
  "$REPO_ROOT/node_modules/.bin/biome" check --write --linter-enabled=false --no-errors-on-unmatched "$FILE"
  ```
  `--linter-enabled=false` is mandatory as a deliberate mechanical-only scope choice: the hook applies strictly formatting + import-organization and leaves ALL lint findings (including `noUnusedImports`/`noUnusedVariables`) as a conscious pre-commit gate. (Those two rules' autofix is **unsafe** — applied only under `--unsafe`; plain `check --write` runs safe fixes only and does NOT delete unused imports. Disabling the linter is about keeping the hook purely mechanical, not about preventing auto-deletion under plain `--write`.) Format + import-organization only; lint stays a conscious pre-commit gate.
- **`biome-format` extension allow-list:** run ONLY when `$FILE` ends in one of `.ts .tsx .js .jsx .json .jsonc .css`. Every other path (`.md`, `.mdx`, images, lockfiles) is skipped — Biome is never invoked.
- **`session-context` output envelope is exactly:**
  ```json
  {"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"<multi-line block>"}}
  ```
  The git-only fallback emits the same envelope with the open-PRs / CI lines omitted. Outside a git repo, emit nothing and `exit 0`.
- **`gh` is bounded and optional:** every `gh` call is wrapped in `timeout 5`; on non-zero exit / timeout / unauthenticated, fall back to git-only. Never let `gh` latency or failure error the session.
- **Header comment block on each hook** explaining purpose + history, matching every existing file in `.claude/hooks/`. `chmod +x` both scripts.
- **Tests are behavioral.** Assert observable output (stdout JSON / printed warning) or file-state (before/after byte comparison), never source-grep of the hook body. The `gh`-fail case uses a PATH-shim stub (temp dir prepended to `PATH` with a `gh` that exits non-zero), not an env toggle — deterministic and hermetic.
- **Scoped commits only.** `git add <specific files>` per task; never `git add .` / `-A` / `--all`.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `.claude/hooks/__tests__/run.sh` | Greenfield bash-hook test runner: pipe mock JSON to stdin, assert output / file state, PATH-shim stub for failing `gh`; non-zero exit on any failed assertion | Create |
| `.claude/hooks/__tests__/fixtures/messy.ts` | Mis-formatted `.ts` fixture (bad spacing/indent) for the format-applied assertion | Create |
| `.claude/hooks/__tests__/fixtures/unordered-imports.ts` | Out-of-order imports fixture for the organizeImports assertion | Create |
| `.claude/hooks/__tests__/fixtures/unused-import.ts` | Unused-import fixture proving the linter stays disabled (import survives) | Create |
| `.claude/hooks/__tests__/fixtures/clean.ts` | Already-Biome-clean fixture for the idempotency (byte-identical) assertion | Create |
| `.claude/hooks/biome-format.sh` | PostToolUse `Edit\|Write`: format + organize imports on edited source files, lint off, fail-silent, `exit 0` | Create |
| `.claude/hooks/session-context.sh` | SessionStart: emit `additionalContext` JSON with branch / ahead-behind / uncommitted / open-PRs / CI; `gh` in `timeout 5` with git-only fallback; nothing outside a repo | Create |
| `.claude/settings.json` | Wire `biome-format.sh` as 4th PostToolUse `Edit\|Write` hook; add new `SessionStart` array with `session-context.sh` | Modify |
| `DECISIONS.md` | ADR bullet recording the two hooks + reversibility note (§7 of spec) | Modify (prepend) |

---

## Task A1: Greenfield bash-hook test harness + fixtures

**Files:**
- Create: `.claude/hooks/__tests__/run.sh`
- Create: `.claude/hooks/__tests__/fixtures/messy.ts`, `unordered-imports.ts`, `unused-import.ts`, `clean.ts`

**Interfaces:**
- `run.sh` exposes shell helpers used by later tasks: `assert_eq <name> <expected> <actual>`, `assert_contains <name> <haystack> <needle>`, `fail <msg>`; it copies a fixture to a temp file, pipes `{"tool_input":{"file_path":"<temp>"}}` into a hook, and compares before/after. The runner exits non-zero if any assertion fails, zero otherwise. It is invoked as `bash .claude/hooks/__tests__/run.sh`.

- [ ] **Step 1: Write the failing runner (harness with one self-check that must fail first)**

Create `.claude/hooks/__tests__/run.sh`. Start it with a deliberately failing self-test so we can prove the runner reports failures (RED), then remove the self-test in Step 3:
```bash
#!/usr/bin/env bash
# Greenfield bash-hook behavioral test runner for .claude/hooks/.
# Pipes mock tool-input JSON to a hook on stdin and asserts on observable
# output / file state (STANDARDS Ch.4: behavioral, no source-grep). Exits
# non-zero on the first failed assertion. No Vitest dependency — hooks are bash,
# the harness is bash. History: created 2026-06-19 with the fast-feedback hooks
# (Unit A) — the repo had no bash-hook test harness before this.
set -u
REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
HOOKS="$REPO_ROOT/.claude/hooks"
FIX="$HOOKS/__tests__/fixtures"
FAILED=0

fail() { printf 'FAIL: %s\n' "$1"; FAILED=1; }
pass() { printf 'ok: %s\n' "$1"; }
assert_eq() { # name expected actual
  if [ "$2" = "$3" ]; then pass "$1"; else fail "$1 (expected [$2] got [$3])"; fi
}
assert_contains() { # name haystack needle
  case "$2" in *"$3"*) pass "$1";; *) fail "$1 (missing [$3])";; esac
}
assert_not_contains() { # name haystack needle
  case "$2" in *"$3"*) fail "$1 (unexpectedly found [$3])";; *) pass "$1";; esac
}

# --- TEMPORARY self-test: proves the runner reports a failure (remove in Step 3) ---
assert_eq "runner-selftest" "1" "0"

[ "$FAILED" -eq 0 ] && { printf '\nALL PASS\n'; exit 0; } || { printf '\nFAILURES\n'; exit 1; }
```

- [ ] **Step 2: Run it, verify it FAILS (RED)**

```bash
chmod +x .claude/hooks/__tests__/run.sh
bash .claude/hooks/__tests__/run.sh; echo "exit=$?"
```
Expected: prints `FAIL: runner-selftest (expected [1] got [0])` then `FAILURES` and `exit=1`. This proves the runner correctly surfaces a failed assertion (so a later real failure cannot silently pass).

- [ ] **Step 3: Remove the self-test, add the fixtures**

Delete the `# --- TEMPORARY self-test ---` line and its `assert_eq "runner-selftest" ...` line from `run.sh`. Then create the four fixtures.

`.claude/hooks/__tests__/fixtures/messy.ts` (bad spacing + indentation, but valid TS so Biome only reformats):
```ts
export   const  greet=(name:string)=>{
return    `hi ${name}`
}
```

`.claude/hooks/__tests__/fixtures/unordered-imports.ts` (imports out of organizeImports order; the named symbols are referenced so the linter — if it ran — would have nothing to delete):
```ts
import { z } from "zod";
import { type NextRequest, NextResponse } from "next/server";

export function handler(_req: NextRequest) {
  const schema = z.object({ ok: z.boolean() });
  return NextResponse.json(schema.parse({ ok: true }));
}
```

`.claude/hooks/__tests__/fixtures/unused-import.ts` (one import is deliberately unused — it must SURVIVE, proving the linter is off):
```ts
import { readFileSync } from "node:fs";

export const ANSWER = 42;
```

`.claude/hooks/__tests__/fixtures/clean.ts` — generate it from Biome itself so the byte-identical idempotency check is anchored to the real formatter, not hand-guessed:
```bash
printf 'export const ANSWER = 42;\n' > .claude/hooks/__tests__/fixtures/clean.ts
"$(git rev-parse --show-toplevel)/node_modules/.bin/biome" check --write --linter-enabled=false --no-errors-on-unmatched .claude/hooks/__tests__/fixtures/clean.ts
```
Expected: the file is unchanged by Biome (it is already clean). Confirm with `git diff --stat .claude/hooks/__tests__/fixtures/clean.ts` showing no change, or that the file content is exactly `export const ANSWER = 42;`.

- [ ] **Step 4: Run the harness, verify it PASSES with zero assertions (GREEN baseline)**

```bash
bash .claude/hooks/__tests__/run.sh; echo "exit=$?"
```
Expected: prints `ALL PASS` and `exit=0` (no assertions yet — the harness is now a clean baseline ready for hook tests).

- [ ] **Step 5: Commit**

```bash
git add .claude/hooks/__tests__/run.sh \
        .claude/hooks/__tests__/fixtures/messy.ts \
        .claude/hooks/__tests__/fixtures/unordered-imports.ts \
        .claude/hooks/__tests__/fixtures/unused-import.ts \
        .claude/hooks/__tests__/fixtures/clean.ts
git commit -m "test(hooks): greenfield bash-hook test harness + fixtures"
```

---

## Task A2: `biome-format.sh` — format + organize imports on edited source files

**Files:**
- Modify: `.claude/hooks/__tests__/run.sh` (append the biome-format assertions)
- Create: `.claude/hooks/biome-format.sh`

**Interfaces:**
- Hook contract: stdin = PostToolUse JSON `{"tool_input":{"file_path":"<abs path>"}}`. Behavior: if `$FILE` ends in an allow-listed extension AND `node_modules/.bin/biome` exists, run `biome check --write --linter-enabled=false --no-errors-on-unmatched "$FILE"`; the file is mutated in place. Output to stdout is irrelevant to correctness; the side-effect (mutated file) is the assertion target. Always `exit 0`.
- Test contract: each test copies a fixture to `$(mktemp)`, captures `before=$(cat tmp)`, pipes `{"tool_input":{"file_path":"$tmp"}}` to the hook, captures `after=$(cat tmp)`, asserts on the delta.

- [ ] **Step 1: Write the failing tests (append to `run.sh`, before the final exit line)**

Insert these blocks immediately above the final `[ "$FAILED" -eq 0 ] && ...` line in `run.sh`:
```bash
# ── biome-format.sh ──────────────────────────────────────────────────────────
BIOME_HOOK="$HOOKS/biome-format.sh"
run_format() { # fixture-basename -> echoes the temp file path after the hook ran
  local tmp; tmp=$(mktemp /tmp/bf.XXXXXX).ts
  cp "$FIX/$1" "$tmp"
  printf '{"tool_input":{"file_path":"%s"}}' "$tmp" | bash "$BIOME_HOOK" >/dev/null 2>&1
  printf '%s' "$tmp"
}

# 1. messy .ts is left Biome-clean (formatting applied -> file changed).
t=$(run_format messy.ts)
before=$(cat "$FIX/messy.ts"); after=$(cat "$t")
if [ "$before" != "$after" ]; then pass "format: messy reformatted"; else fail "format: messy unchanged"; fi
# and the result is idempotent under a second biome pass (truly clean):
"$REPO_ROOT/node_modules/.bin/biome" check --write --linter-enabled=false --no-errors-on-unmatched "$t" >/dev/null 2>&1
assert_eq "format: messy now idempotent" "$after" "$(cat "$t")"
rm -f "$t"

# 2. out-of-order imports are organized (assist runs -> next/server sorts before zod is moot;
#    assert the file changed AND zod import still present).
t=$(run_format unordered-imports.ts)
after=$(cat "$t")
if [ "$(cat "$FIX/unordered-imports.ts")" != "$after" ]; then pass "format: imports organized"; else fail "format: imports not organized"; fi
assert_contains "format: zod import retained" "$after" 'from "zod"'
rm -f "$t"

# 3. unused import SURVIVES (linter disabled -> no semantic mutation).
t=$(run_format unused-import.ts)
assert_contains "format: unused import retained (linter off)" "$(cat "$t")" "readFileSync"
rm -f "$t"

# 4. already-clean file is byte-identical after.
t=$(run_format clean.ts)
assert_eq "format: clean is idempotent" "$(cat "$FIX/clean.ts")" "$(cat "$t")"
rm -f "$t"

# 5. .md path -> Biome never invoked (file unchanged even though content is non-TS).
tmd=$(mktemp /tmp/bf.XXXXXX).md
printf '# Title\n\n  badly   spaced markdown\n' > "$tmd"
mdbefore=$(cat "$tmd")
printf '{"tool_input":{"file_path":"%s"}}' "$tmd" | bash "$BIOME_HOOK" >/dev/null 2>&1
assert_eq "format: .md skipped (no write)" "$mdbefore" "$(cat "$tmd")"
rm -f "$tmd"
```

- [ ] **Step 2: Run, verify it FAILS (RED)**

```bash
bash .claude/hooks/__tests__/run.sh; echo "exit=$?"
```
Expected: failures because `.claude/hooks/biome-format.sh` does not exist yet (`bash "$BIOME_HOOK"` errors; the messy/imports files are never mutated, so the "reformatted"/"organized" assertions fail). `exit=1`.

- [ ] **Step 3: Write the minimal hook**

Create `.claude/hooks/biome-format.sh`:
```bash
#!/usr/bin/env bash
# PostToolUse hook for Edit and Write tools (fast-feedback Unit A, hook 1 of 2).
# On each agent edit of a source file, applies Biome's MECHANICAL fixes —
# formatting + import organization — so format/import-order never surprise at the
# pre-commit `biome check .` gate. Lint findings are deliberately NOT auto-fixed.
#
# WHY `check --write` not `format --write`: biome.json has
# assist.actions.source.organizeImports:on, so `format` alone leaves import order
# failing pre-commit. WHY `--linter-enabled=false`: a deliberate mechanical-only
# scope choice — this hook applies ONLY formatting + import-organization and leaves
# every lint finding as a conscious pre-commit gate. (noUnusedImports/Variables
# autofix is UNSAFE — applied only under --unsafe; plain `check --write` runs safe
# fixes only and does NOT delete unused imports. Disabling the linter keeps the hook
# purely mechanical, it is not preventing auto-deletion under plain --write.) So:
# format + import-organization only; lint stays a conscious pre-commit gate.
# ALWAYS exits 0 — a PostToolUse feedback hook must never block the edit.
# History: created 2026-06-19 (Unit A). See DECISIONS.md.
INPUT=$(cat)
FILE=$(printf '%s' "$INPUT" | python3 -c "
import json, sys
try:
  data = json.load(sys.stdin)
  print(data.get('tool_input', {}).get('file_path', '') or data.get('file_path', ''))
except Exception:
  print('')
" 2>/dev/null || echo "")

# Extension allow-list: only Biome-supported source files.
if printf '%s' "$FILE" | grep -qE '\.(ts|tsx|js|jsx|json|jsonc|css)$'; then
  REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
  BIOME="$REPO_ROOT/node_modules/.bin/biome"
  # Guard on the binary existing (fresh clone, no install) — fail-silent if absent.
  if [ -x "$BIOME" ] && [ -f "$FILE" ]; then
    "$BIOME" check --write --linter-enabled=false --no-errors-on-unmatched "$FILE" >/dev/null 2>&1 || true
  fi
fi

exit 0
```
Then `chmod +x .claude/hooks/biome-format.sh`.

- [ ] **Step 4: Run, verify it PASSES (GREEN)**

```bash
chmod +x .claude/hooks/biome-format.sh
bash .claude/hooks/__tests__/run.sh; echo "exit=$?"
```
Expected: all `format:` assertions print `ok:`, final `ALL PASS`, `exit=0`. Spot-confirm the unused-import survival is real (not a false pass): the `readFileSync` line is still in the temp file before `rm`.

- [ ] **Step 5: Commit**

```bash
git add .claude/hooks/biome-format.sh .claude/hooks/__tests__/run.sh
git commit -m "feat(hooks): biome-format PostToolUse hook (format + organize imports, lint off)"
```

---

## Task A3: `session-context.sh` — inject live git + PR + CI state at SessionStart

**Files:**
- Modify: `.claude/hooks/__tests__/run.sh` (append the session-context assertions + the failing-`gh` PATH shim)
- Create: `.claude/hooks/session-context.sh`

**Interfaces:**
- Hook contract: no stdin tool input. On stdout, prints the single-line JSON envelope `{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"..."}}`. `additionalContext` is a multi-line block: `[session-context]\nbranch: <name> (<ahead> ahead, <behind> behind)\nuncommitted: <n> files\nopen PRs: <list or 'none'>\nlast CI: <status> (<sha>)`. With `gh` failing, the open-PRs / CI lines are omitted (git-only fallback). Outside a git repo, prints nothing. Always `exit 0`.
- Test contract: run the hook from inside the repo (real git state) and assert the JSON envelope shape + the `branch:` / `uncommitted:` fields. For the fallback, prepend a temp dir containing a non-zero-exit `gh` stub to `PATH` and assert the envelope still emits and omits CI. For the no-repo case, run from `/tmp` and assert empty stdout.

- [ ] **Step 1: Write the failing tests (append to `run.sh`, before the final exit line)**

```bash
# ── session-context.sh ───────────────────────────────────────────────────────
SC_HOOK="$HOOKS/session-context.sh"

# 1. Inside the repo: emits the exact envelope shape + core git fields.
out=$(cd "$REPO_ROOT" && printf '' | bash "$SC_HOOK")
assert_contains "ctx: hookEventName envelope" "$out" '"hookEventName":"SessionStart"'
assert_contains "ctx: hookSpecificOutput key" "$out" '"hookSpecificOutput"'
assert_contains "ctx: additionalContext key"  "$out" '"additionalContext"'
assert_contains "ctx: marker line"            "$out" '[session-context]'
assert_contains "ctx: branch field"           "$out" 'branch:'
assert_contains "ctx: uncommitted field"      "$out" 'uncommitted:'
# Valid single-line JSON object (python parses it).
if printf '%s' "$out" | python3 -c "import json,sys; json.load(sys.stdin)" 2>/dev/null; then
  pass "ctx: valid JSON"
else
  fail "ctx: not valid JSON"
fi

# 2. gh failing (PATH shim) -> git-only fallback, still valid envelope, no CI line.
SHIM=$(mktemp -d)
cat > "$SHIM/gh" <<'STUB'
#!/usr/bin/env bash
exit 1
STUB
chmod +x "$SHIM/gh"
out_fb=$(cd "$REPO_ROOT" && printf '' | PATH="$SHIM:$PATH" bash "$SC_HOOK")
assert_contains "ctx-fallback: still emits envelope" "$out_fb" '"hookEventName":"SessionStart"'
assert_contains "ctx-fallback: branch retained"      "$out_fb" 'branch:'
assert_not_contains "ctx-fallback: CI line omitted"  "$out_fb" 'last CI:'
rm -rf "$SHIM"

# 3. Outside a git repo -> emits nothing.
NOREPO=$(mktemp -d)
out_nr=$(cd "$NOREPO" && printf '' | bash "$SC_HOOK")
assert_eq "ctx: empty outside repo" "" "$out_nr"
rm -rf "$NOREPO"
```

- [ ] **Step 2: Run, verify it FAILS (RED)**

```bash
bash .claude/hooks/__tests__/run.sh; echo "exit=$?"
```
Expected: the `ctx:` assertions fail because `.claude/hooks/session-context.sh` does not exist (empty `$out`). `exit=1`.

- [ ] **Step 3: Write the minimal hook**

Create `.claude/hooks/session-context.sh`:
```bash
#!/usr/bin/env bash
# SessionStart hook (fast-feedback Unit A, hook 2 of 2).
# Injects live git + PR + CI state as `additionalContext` at session start —
# additive to the .remember/ handoff and plugin SessionStart hooks (which carry
# work-state, not live git/CI state). Closes the "acting on a stale branch /
# unaware CI is red" error class. `gh` calls are bounded by `timeout 5` and fall
# back to git-only on any failure / unauthenticated gh. Outside a git repo: emits
# nothing. ALWAYS exits 0 — a SessionStart hook must never error the session.
# History: created 2026-06-19 (Unit A). See DECISIONS.md.
cat >/dev/null 2>&1 || true   # consume stdin defensively; SessionStart has no tool input

# Repo guard: outside a git repo, emit nothing.
REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
cd "$REPO_ROOT" 2>/dev/null || exit 0

BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")

# ahead/behind vs upstream (0/0 when no upstream is set).
AHEAD=0; BEHIND=0
if git rev-parse --abbrev-ref --symbolic-full-name '@{u}' >/dev/null 2>&1; then
  read -r BEHIND AHEAD < <(git rev-list --left-right --count '@{u}...HEAD' 2>/dev/null || echo "0 0")
fi

UNCOMMITTED=$(git status --porcelain 2>/dev/null | grep -c . || echo 0)
LAST_SUBJECT=$(git log -1 --pretty=%s 2>/dev/null || echo "")

# git-only base block (always present).
CTX=$(printf '[session-context]\nbranch: %s (%s ahead, %s behind)\nuncommitted: %s files\nlast commit: %s' \
  "$BRANCH" "$AHEAD" "$BEHIND" "$UNCOMMITTED" "$LAST_SUBJECT")

# Best-effort gh enrichment (open PRs + CI), bounded and fail-silent.
if command -v gh >/dev/null 2>&1; then
  PRS=$(timeout 5 gh pr list --state open --json number,headRefName \
        --jq 'if length==0 then "none" else (map("#\(.number) \(.headRefName)") | join(", ")) end' 2>/dev/null) || PRS=""
  CI=$(timeout 5 gh run list --branch "$BRANCH" --limit 1 \
        --json status,conclusion,headSha \
        --jq '.[0] | "\(.conclusion // .status) (\(.headSha[0:7]))"' 2>/dev/null) || CI=""
  if [ -n "$PRS" ]; then
    CTX=$(printf '%s\nopen PRs: %s' "$CTX" "$PRS")
  fi
  if [ -n "$CI" ]; then
    CTX=$(printf '%s\nlast CI: %s' "$CTX" "$CI")
  fi
fi

# Emit the SessionStart additionalContext envelope as a single-line JSON object.
printf '%s' "$CTX" | python3 -c "
import json, sys
ctx = sys.stdin.read()
print(json.dumps({'hookSpecificOutput': {'hookEventName': 'SessionStart', 'additionalContext': ctx}}))
" 2>/dev/null || true

exit 0
```
Then `chmod +x .claude/hooks/session-context.sh`.

> WHY the `gh` enrichment is gated on non-empty results: a failing/timed-out `gh` yields an empty string, so the `open PRs:` / `last CI:` lines are simply not appended — that IS the git-only fallback, and the `ctx-fallback: CI line omitted` assertion proves it.

- [ ] **Step 4: Run, verify it PASSES (GREEN)**

```bash
chmod +x .claude/hooks/session-context.sh
bash .claude/hooks/__tests__/run.sh; echo "exit=$?"
```
Expected: all `ctx:` / `ctx-fallback:` assertions print `ok:`, final `ALL PASS`, `exit=0`. If the runner's real session has authenticated `gh`, the base run may include `last CI:` (fine — only the fallback run asserts its absence).

- [ ] **Step 5: Commit**

```bash
git add .claude/hooks/session-context.sh .claude/hooks/__tests__/run.sh
git commit -m "feat(hooks): session-context SessionStart hook (git + PR + CI, gh fallback)"
```

---

## Task A4: Wire both hooks into `settings.json`

**Files:**
- Modify: `.claude/settings.json`

**Interfaces:**
- `biome-format.sh` becomes the 4th entry in the existing `PostToolUse[0].hooks` array (matcher `Edit|Write`), after `api-edit-marker.sh`.
- A new top-level `SessionStart` array is added with one hook running `session-context.sh`.

- [ ] **Step 1: Write the failing wiring assertion (append to `run.sh`, before the final exit line)**

```bash
# ── settings.json wiring ─────────────────────────────────────────────────────
WIRING=$(python3 -c "
import json
s = json.load(open('$REPO_ROOT/.claude/settings.json'))
post = s.get('hooks', {}).get('PostToolUse', [])
ss   = s.get('hooks', {}).get('SessionStart', [])
post_cmds = [h.get('command','') for blk in post for h in blk.get('hooks', [])]
ss_cmds   = [h.get('command','') for blk in ss   for h in blk.get('hooks', [])]
print('BIOME', any('biome-format.sh' in c for c in post_cmds))
print('SESSION', any('session-context.sh' in c for c in ss_cmds))
" 2>/dev/null)
assert_contains "wiring: biome-format in PostToolUse" "$WIRING" "BIOME True"
assert_contains "wiring: session-context in SessionStart" "$WIRING" "SESSION True"
```

- [ ] **Step 2: Run, verify it FAILS (RED)**

```bash
bash .claude/hooks/__tests__/run.sh; echo "exit=$?"
```
Expected: `wiring:` assertions fail (`BIOME False` / `SESSION False`). `exit=1`.

- [ ] **Step 3: Edit `settings.json`**

Append to the `PostToolUse` → `Edit|Write` hooks array (after the `api-edit-marker.sh` entry):
```json
          {
            "type": "command",
            "command": "bash .claude/hooks/biome-format.sh"
          }
```
Add a new top-level `SessionStart` array as a sibling of `PostToolUse` / `SessionEnd`:
```json
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bash .claude/hooks/session-context.sh"
          }
        ]
      }
    ]
```

- [ ] **Step 4: Run, verify it PASSES (GREEN) + validate JSON**

```bash
python3 -c "import json; json.load(open('.claude/settings.json')); print('settings.json valid')"
bash .claude/hooks/__tests__/run.sh; echo "exit=$?"
```
Expected: `settings.json valid`, both `wiring:` assertions `ok:`, `ALL PASS`, `exit=0`.

- [ ] **Step 5: Commit**

```bash
git add .claude/settings.json .claude/hooks/__tests__/run.sh
git commit -m "chore(hooks): wire biome-format (PostToolUse) + session-context (SessionStart)"
```

---

## Task A5: Failure-mode guard verification (spec §4) + ADR

**Files:**
- Modify: `.claude/hooks/__tests__/run.sh` (append the residual §4 guard assertions not yet covered)
- Modify: `DECISIONS.md`

**Interfaces:** explicit assertions for the §4 failure modes that Tasks A2–A3 did not already pin: (a) `biome` binary missing → hook still `exit 0` and leaves the file untouched; (b) file deleted between edit and hook → `exit 0`, no error; (c) malformed stdin JSON → `exit 0`, no crash; (d) every hook invocation returns exit code 0.

- [ ] **Step 1: Write the failing §4 guard tests (append to `run.sh`, before the final exit line)**

```bash
# ── §4 failure-mode guards ───────────────────────────────────────────────────
# (a) biome binary missing -> hook exits 0, file untouched. Simulate by pointing
#     the hook at a temp REPO_ROOT with no node_modules via a subshell cd.
tmp=$(mktemp /tmp/bf.XXXXXX).ts; cp "$FIX/messy.ts" "$tmp"; before=$(cat "$tmp")
( cd "$(mktemp -d)" && printf '{"tool_input":{"file_path":"%s"}}' "$tmp" | bash "$HOOKS/biome-format.sh" ) >/dev/null 2>&1
ec=$?
assert_eq "guard: biome-missing exit 0" "0" "$ec"
assert_eq "guard: biome-missing file untouched" "$before" "$(cat "$tmp")"
rm -f "$tmp"

# (b) file deleted before hook -> exit 0, no error.
gone="/tmp/bf-gone-$$.ts"
printf '{"tool_input":{"file_path":"%s"}}' "$gone" | bash "$HOOKS/biome-format.sh" >/dev/null 2>&1
assert_eq "guard: missing-file exit 0" "0" "$?"

# (c) malformed stdin JSON -> both hooks exit 0, no crash.
printf 'not json at all' | bash "$HOOKS/biome-format.sh" >/dev/null 2>&1
assert_eq "guard: biome malformed-stdin exit 0" "0" "$?"
printf 'not json at all' | bash "$HOOKS/session-context.sh" >/dev/null 2>&1
assert_eq "guard: session malformed-stdin exit 0" "0" "$?"

# (d) session-context exit code is 0 even inside the repo.
( cd "$REPO_ROOT" && printf '' | bash "$HOOKS/session-context.sh" ) >/dev/null 2>&1
assert_eq "guard: session-context exit 0" "0" "$?"
```

- [ ] **Step 2: Run, verify behavior**

```bash
bash .claude/hooks/__tests__/run.sh; echo "exit=$?"
```
Expected: if the hooks already satisfy these guards (they should — `exit 0` is unconditional, `[ -x "$BIOME" ]` and `[ -f "$FILE" ]` guard the missing-binary/file cases), all `guard:` assertions pass immediately. If any FAILS (RED), fix the owning hook minimally (e.g. the missing-file guard), re-run, then proceed. Do not commit on a failing run.

- [ ] **Step 3: Prepend the ADR bullet to `DECISIONS.md`**

Add (newest-first, matching the file's convention):
```markdown
- **2026-06-19 — Fast-feedback hooks (Unit A).** Added two non-blocking local-session hooks: `biome-format.sh` (PostToolUse `Edit|Write`) runs `biome check --write --linter-enabled=false` on edited source files (format + import-organization only — linter off so it never deletes an in-progress import); `session-context.sh` (SessionStart) injects branch / ahead-behind / uncommitted / open-PR / CI state as `additionalContext`, `gh` bounded by `timeout 5` with a git-only fallback. Both `exit 0` always. Closes the one "fast-feedback" axis the 2026 ecosystem benchmark flagged as thin. **Reversible:** delete the two `.claude/hooks/*.sh` files and their `settings.json` entries; no CI change, no data migration, no external dependency.
```

- [ ] **Step 4: Final full-harness verification (GREEN)**

```bash
bash .claude/hooks/__tests__/run.sh; echo "exit=$?"
```
Expected: `ALL PASS`, `exit=0`. This is the completion evidence for the whole plan — cite it before any "done" claim (per CLAUDE.md verification-before-completion).

- [ ] **Step 5: Commit**

```bash
git add .claude/hooks/__tests__/run.sh DECISIONS.md
git commit -m "test(hooks): §4 failure-mode guards + ADR for fast-feedback hooks"
```

---

## Post-implementation (not plan tasks, but required before PR)

- **Live-session verification (spec §6):** in a real session, confirm the injected `[session-context]` block appears at SessionStart, and that an actual `Edit` to a `.ts` file leaves it Biome-clean. The harness proves mechanism; the live session proves wiring (the one thing a bash test cannot assert).
- **No regression to existing PostToolUse hooks:** confirm `section-order-guard`, `css-token-guard`, `api-edit-marker` still fire after `biome-format` is appended (they are independent array entries; appending a 4th does not reorder or disable them).
- **5-agent review battery** before push (CLAUDE.md), scoped to the change: this touches `.claude/` (an execution vector) so the battery is mandatory, not optional. `git mv`/file-move scan: N/A (all files are new).
- **PR:** sub-PR `feat/platform-gaps-2026-hooks` → integration branch `feat/platform-gaps-2026`; size with `PR_BASE=origin/feat/platform-gaps-2026 pnpm pr-size`.
