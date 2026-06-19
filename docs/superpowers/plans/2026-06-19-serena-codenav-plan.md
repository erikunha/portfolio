# Semantic Code-Nav + test-author Implementation Plan

> **For agentic workers:** Use `superpowers:subagent-driven-development`
> or `superpowers:executing-plans` to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the **Serena MCP** as a **read-only** symbol-navigation server (find-references, go-to-definition, symbol search — no write/edit/shell tools) into the repo-root `/.mcp.json`, and author **one** thin project-scoped agent, `.claude/agents/test-author.md`, that encodes the TDD red→green cycle and pins the STANDARDS Ch.4 behavioral-assertion rule. `refactoring-specialist` is explicitly **not** authored (it fails the two-part test — its method is already a CLAUDE.md rule Serena mechanizes, and refactors emit working-tree edits, not read-once output). An ADR records the MCP addition (pinned ref), the read-only grant, and the `refactoring-specialist` drop.

**Architecture:** Three independent, sequenced units. **Unit S** adds the `serena` server to `/.mcp.json` and smoke-verifies that it starts under `--context claude-code --mode planning`, that find-references on a known symbol returns call sites, and that the exposed tool list contains **no** write/edit/shell tools. **Unit A** authors the `test-author` agent prompt and validates it manually on one real unit (automated eval is a *soft* dependency on Unit C's harness — noted, not blocked). **Unit R** records the ADR in `DECISIONS.md`. Neither the MCP config nor the agent prompt is unit-testable like application code, so each is structured as config-add → smoke/manual verification → commit, with explicit checkbox steps throughout.

**Tech Stack:** JSONC (`/.mcp.json`), Markdown (`.claude/agents/test-author.md`, `DECISIONS.md`), `uvx` (Serena launcher — `git+https://github.com/oraios/serena` pinned to commit `dd7eb6d72ae179aa940e50cd6276ec5646f306f8`), Bash for smoke verification. No `pnpm`/Vitest changes — nothing here touches `app/`, `lib/`, `components/`, or `scripts/`, so `pnpm test` / `pnpm build` are unaffected and are run only as a final no-regression confirmation.

---

## Global Constraints

- **Staging discipline:** every commit stages only the file(s) named in that task — use `git add <specific files>`, **never** `git add .`, `git add -A`, or `git add --all`.
- **Pinning:** the Serena `--from` ref is hardcoded to commit `dd7eb6d72ae179aa940e50cd6276ec5646f306f8`. **Never** `@latest`. The `upstash` entry already in `/.mcp.json` uses `@latest`; that is a documented pinning violation (DECISIONS.md, 2026-06-18) — do **not** copy it. If a stable release **tag** exists at install time, prefer the tag and record the swap in the ADR; otherwise keep this SHA.
- **Read-only grant is server-enforced, not by convention:** `--mode planning` excludes every write/edit/shell tool; `--context claude-code` excludes redundant filesystem/shell tools and sets `single_project: true`. Do **not** add a second mode or remove these flags. Refactor edits go through the main agent's normal `Edit` path, never Serena.
- **No invented flags:** `--mode editing-disabled` and `--context ide-assistant` do **not** exist in this version of Serena — never use them. Only `--mode planning` and `--context claude-code` are valid here.
- **`refactoring-specialist` is out of scope** — do not author it, do not reference it as an agent to create, do not add it to any dispatch table.
- **No source-grep tests:** `test-author` must author tests that assert observable behavior (STANDARDS Ch.4). The agent prompt itself is not a `.test.ts` file and adds no coverage gate.
- **Soft dependency, non-blocking:** automated eval of `test-author` waits on Unit C's eval harness. Until C lands, validate `test-author` manually on one real task (Unit A, Task A.3). Do **not** block this plan on C.
- **Reversibility:** the entire change undoes by removing the `serena` block from `/.mcp.json` and deleting `.claude/agents/test-author.md`. No production/runtime impact. The ADR records the undo.
- **Verification before completion:** before claiming done, the Serena smoke check (Unit S) must pass with navigation-only tools, `test-author` must produce one correct behavioral test on a real unit (Unit A), and existing MCP servers (`context7`, `upstash`) must still connect.

---

## File Map

| Unit | File | Action |
|---|---|---|
| S | `/.mcp.json` (repo root) | Modify — add `serena` server block beside `context7` + `upstash` |
| A | `.claude/agents/test-author.md` | Create — first project-scoped agent (`.claude/agents/` is currently empty) |
| R | `DECISIONS.md` | Modify — append ADR (MCP addition + pinned ref + read-only grant + `refactoring-specialist` drop) |
| — | `docs/superpowers/specs/2026-06-18-serena-mcp-and-agents-design.md` | Read-only — source spec, verify committed |

---

## Unit S — Wire the Serena MCP (read-only navigation)

### Task S.1: Confirm prerequisites and current `/.mcp.json` shape

**Files:**
- Read: `/.mcp.json` (repo root)
- Read: `docs/superpowers/specs/2026-06-18-serena-mcp-and-agents-design.md`

**Interfaces:** none (inspection only).

- [ ] **Step 1: Confirm `uvx` is available**

```bash
uvx --version
```

Expected: a version string (uvx ships with `uv`). If `uvx` is missing, install `uv` first (`brew install uv` or `curl -LsSf https://astral.sh/uv/install.sh | sh`); Serena cannot launch without it. This is a host prerequisite, not a repo change.

- [ ] **Step 2: Confirm the spec is committed (source of truth for the pinned SHA + flags)**

```bash
git log --oneline -- docs/superpowers/specs/2026-06-18-serena-mcp-and-agents-design.md
```

Expected: at least one commit. The pinned commit `dd7eb6d72ae179aa940e50cd6276ec5646f306f8` and the `--context claude-code --mode planning` flags come from this spec (§3), verified against the real binary.

- [ ] **Step 3: Confirm `serena` is not already present and read the current structure**

```bash
grep -n "serena" .mcp.json || echo "NOT PRESENT — ok to add"
cat .mcp.json
```

Expected: `serena` not present. The file has a top-level `mcpServers` object containing `context7` (http) and `upstash` (command/args). The new entry is a third key inside `mcpServers`, a sibling of those two.

No commit in this task (inspection only).

---

### Task S.2: Add the `serena` server block to `/.mcp.json`

**Files:**
- Modify: `/.mcp.json` (repo root)

**Interfaces:**
- New JSON key `mcpServers.serena` with exactly:
  - `command`: `"uvx"`
  - `args`: `["--from", "git+https://github.com/oraios/serena@dd7eb6d72ae179aa940e50cd6276ec5646f306f8", "serena", "start-mcp-server", "--context", "claude-code", "--project", "${PWD}", "--mode", "planning"]`

- [ ] **Step 1: Add the `serena` entry as a sibling of `context7` and `upstash`**

Find this exact text in `/.mcp.json`:

```json
    "upstash": {
      "command": "npx",
      "args": [
        "-y",
        "@upstash/mcp-server@latest",
        "--email",
        "${UPSTASH_EMAIL}",
        "--api-key",
        "${UPSTASH_READONLY_API_KEY}"
      ]
    }
  }
}
```

Replace with:

```json
    "upstash": {
      "command": "npx",
      "args": [
        "-y",
        "@upstash/mcp-server@latest",
        "--email",
        "${UPSTASH_EMAIL}",
        "--api-key",
        "${UPSTASH_READONLY_API_KEY}"
      ]
    },
    "serena": {
      "command": "uvx",
      "args": [
        "--from",
        "git+https://github.com/oraios/serena@dd7eb6d72ae179aa940e50cd6276ec5646f306f8",
        "serena",
        "start-mcp-server",
        "--context",
        "claude-code",
        "--project",
        "${PWD}",
        "--mode",
        "planning"
      ]
    }
  }
}
```

Note: the comma after the `upstash` closing brace is the only change to existing lines — JSON requires it now that `serena` follows. The `args` array reproduces the spec value verbatim; do not reorder, drop, or substitute any flag.

- [ ] **Step 2: Validate the file is still well-formed JSON**

```bash
node -e "JSON.parse(require('fs').readFileSync('.mcp.json','utf8')); console.log('valid JSON')"
```

Expected: `valid JSON`. If it errors, the most likely cause is a missing/trailing comma — fix before proceeding.

- [ ] **Step 3: Confirm the three servers are all present and `serena` is pinned (not `@latest`)**

```bash
node -e "const m=JSON.parse(require('fs').readFileSync('.mcp.json','utf8')).mcpServers; console.log(Object.keys(m).join(',')); console.log(m.serena.args.join(' '))"
```

Expected output:
- Line 1: `context7,upstash,serena`
- Line 2: contains `git+https://github.com/oraios/serena@dd7eb6d72ae179aa940e50cd6276ec5646f306f8` and `--context claude-code` and `--mode planning`, and does **not** contain `@latest`, `editing-disabled`, or `ide-assistant`.

- [ ] **Step 4: Commit**

```bash
git add .mcp.json
git commit -m "feat(mcp): add Serena read-only navigation server (planning mode, pinned)"
```

---

### Task S.3: Smoke-test the Serena server (starts + navigation works + no write/shell tools)

This is the verification heart of Unit S. The agent prompt and MCP config are not unit-testable like code, so this task is the behavioral proof that the read-only grant holds at the server level.

**Files:**
- Read: `/.mcp.json` (the args under test)
- No file modified in this task.

**Interfaces:** Serena MCP stdio server invoked exactly as configured in `/.mcp.json`.

- [ ] **Step 1: Confirm the server starts under the configured flags**

Launch Serena exactly as `/.mcp.json` will, and confirm it boots without error (the invalid flag values from earlier spec revisions would fail here silently — a clean start is the signal the flags are real):

```bash
cd /Users/erikhenriquealvescunha/Desktop/Projects/portfolio
timeout 90 uvx --from git+https://github.com/oraios/serena@dd7eb6d72ae179aa940e50cd6276ec5646f306f8 \
  serena start-mcp-server --context claude-code --project "$PWD" --mode planning 2>&1 | head -40
```

Expected: startup/index log lines, no fatal flag-parse or context/mode-not-found error. First run pays the LSP cold-start + project-index cost (accepted in the spec's failure-mode table); `timeout 90` bounds it. A `--context`/`--mode` "not found" error means a wrong flag value slipped in — fix Task S.2 before continuing. (If the host is offline and `uvx` cannot resolve the git ref, this is a host/network issue, not a config defect — re-run when online.)

- [ ] **Step 2: Assert the exposed tool list is navigation-only (no write/edit/shell tools)**

After confirming startup, restart the MCP connection so the new server registers, then enumerate Serena's exposed tools. Using the active MCP client (the Claude Code session), list the `serena` server's tools and verify:

- **Present** (navigation): `find_referencing_symbols` (find-references), `find_symbol` / symbol search, go-to-definition style lookups, `get_symbols_overview`.
- **Absent** (must NOT appear): `replace_symbol_body`, `insert_after_symbol`, `insert_before_symbol`, `replace_lines`, `insert_at_line`, `delete_lines`, `create_text_file`, `replace_content`, **`execute_shell_command`**.

Record the actual tool list. The two load-bearing absences to confirm explicitly are **`replace_symbol_body`** and **`execute_shell_command`** — their absence is the proof that `--mode planning` excised the write/shell surface (the April-2026 stdio-RCE class the spec calls out).

**This tool-list assertion is a HARD, BLOCKING gate — not merely "the server starts cleanly."** "Starts cleanly" only proves the process launched; it says nothing about which tools are exposed. If ANY write/edit/shell tool from the Absent list above is present at the pinned commit (`dd7eb6d…`), **STOP — do not proceed to Step 3, Unit A, or commit anything.** The empirical check against the *pinned binary's actual exposed tool list* is load-bearing precisely because the read-only grant is the whole security premise of adding this server, and because prior spec revisions invented non-existent flags — so the planning-mode write/shell exclusion must be verified against the real binary at this exact pin, never assumed from documentation. A present write/shell tool means `--mode planning` did not excise the surface at this commit: re-pin or abandon, do not work around it.

- [ ] **Step 3: find-references on a known symbol returns the expected call sites**

Pick a symbol with known, multiple call sites in this repo (e.g. `defineHandler` from the API boundary, or `getScores` from `lib/lighthouse-scores.ts`). First record the grep-truth set:

```bash
grep -rn "defineHandler" app lib --include="*.ts" --include="*.tsx" | head -20
```

Then run Serena's find-references (`find_referencing_symbols`) on that same symbol via the MCP client and confirm the returned call sites cover the real consumers the grep showed (Serena resolves the symbol graph; it should surface the importing/calling sites, not comment/string matches). Expected: a non-empty reference set that matches the genuine callers. This proves the navigation tool does the job the manual "consumer-scan before `git mv`" rule did by hand.

- [ ] **Step 4: Confirm the other MCP servers still connect**

Confirm `context7` and `upstash` still register and connect in the same session (adding `serena` must not disturb them). Expected: all three servers connected; `upstash` may still warn about unset `UPSTASH_EMAIL`/`UPSTASH_READONLY_API_KEY` (pre-existing, unrelated to this change).

No commit in this task (verification only). If any assertion fails, fix the offending step's root cause (most likely Task S.2's args) and re-run — do not proceed to Unit A on a failed smoke check.

---

## Unit A — Author the `test-author` agent (thin, project-scoped)

### Task A.1: Confirm `.claude/agents/` is empty and read the STANDARDS Ch.4 rule to pin

**Files:**
- Read: `STANDARDS.md` (Chapter 4 — the behavioral-assertion rule to pin verbatim-in-spirit)
- Read: `docs/superpowers/specs/2026-06-18-serena-mcp-and-agents-design.md` (§2 component 2)

**Interfaces:** none (inspection only).

- [ ] **Step 1: Confirm no project agents exist yet (`test-author` is the first)**

```bash
ls -la .claude/agents/ 2>/dev/null || echo "dir absent"
```

Expected: empty directory or absent. If absent, it will be created in Task A.2. If a `test-author.md` already exists, stop — this plan assumes a clean create.

- [ ] **Step 2: Re-read the exact STANDARDS Ch.4 rule the agent must pin**

```bash
grep -n -A 6 "^## 4. Testing" STANDARDS.md
```

Expected: the rule "Tests assert *behavior*, not *source*… Reading application source under `app/`, `components/`, `lib/`, or `scripts/` with `readFileSync` to make a structural assertion … is banned" plus the single `// behavioral-test-allow:` exception. The agent prompt must reference this rule and the meta-gate `__tests__/meta/no-source-grep.test.ts` so authored tests pass that gate.

No commit (inspection only).

---

### Task A.2: Create `.claude/agents/test-author.md`

**Files:**
- Create: `.claude/agents/test-author.md`

**Interfaces:** Claude Code project sub-agent. Frontmatter `name: test-author`, a `description` that routes dispatch only for test-authoring (TDD red→green), and a restricted tool set (no broad write surface beyond what authoring a test file needs).

- [ ] **Step 1: Create the directory if needed**

```bash
mkdir -p .claude/agents
```

- [ ] **Step 2: Write the agent prompt**

Create `.claude/agents/test-author.md` with exactly this content:

```markdown
---
name: test-author
description: >-
  Authors a behavioral test (or test suite) for a single named unit using
  strict TDD red->green. Dispatch when the task is "write the failing test
  first" for a component, API handler, lib utility, or client island — BEFORE
  implementation exists or before a bugfix. Produces the test file; it does NOT
  write the implementation, and the 5-agent review battery REVIEWS the test, it
  does not author it. Do NOT use for: implementing features, refactors,
  reviewing existing tests, or non-test code.
tools: Read, Write, Edit, Bash, Glob, Grep
model: sonnet
---

You author tests. One unit at a time. Strict TDD: red first, then the minimum
that goes green. You never write the implementation — your output is the test
file and the evidence that it fails for the right reason, then passes.

## Method (the reason you exist as a separate agent)

The main agent does not run red->green by default. You do. For the named unit:

1. **RED.** Write the test that asserts the unit's *observable behavior*. Run it.
   Confirm it FAILS, and that it fails for the intended reason (assertion miss,
   not import error / typo / missing file). Cite the failing output. A test that
   errors instead of failing-an-assertion is not a valid red.
2. **GREEN.** Only after a valid red: implement (or hand back to the main agent
   to implement) the minimum to pass. Re-run. Confirm it passes. Cite the output.
3. **Stop.** Do not add speculative cases, do not refactor unrelated code, do not
   write implementation beyond what the red test demands.

## Hard rule — behavioral assertions only (STANDARDS Ch.4)

Tests assert **behavior**, not **source**. Exercise observable output: render the
component and inspect the DOM, call the handler and inspect the response, trigger
the side effect and assert it happened. Reading application source under `app/`,
`components/`, `lib/`, or `scripts/` with `readFileSync` to make a structural
assertion (`.toContain` / `.toMatch` on file text) is **banned** and fails the
meta-gate `__tests__/meta/no-source-grep.test.ts`. The only permitted exception
is a `readFileSync` carrying an explicit `// behavioral-test-allow: <reason>` tag,
used solely where the file itself IS the artifact under test and the unit layer
has no behavioral substitute (a config/manifest read, or a built CSS asset whose
effect jsdom cannot evaluate). A source-grep test gives false confidence: it
passes on a comment or dead branch and fails on an innocuous rename. Behavioral
tests fail when, and only when, the guarantee actually regresses.

## Conventions in this repo

- Unit tests: Vitest, run via `pnpm test`. E2E/behavioral cross-browser: Playwright
  (`pnpm test:e2e`). Co-located `*.e2e.ts` specs run against the live route.
- Every API route, every kill switch, every interactive client component has a
  behavioral test. Client component pre-mortem: `querySelector` returns `null`
  not `undefined` (use `.not.toBeNull()`); a component rendered twice must not
  rely on a hardcoded `id`.
- Run only the changed unit's tests, not the full suite, while iterating; run the
  relevant suite once before declaring done.

## Output

Report: the test file path, the red evidence (failing output + why it is a valid
red), the green evidence (passing output). Do NOT make extra commits unless the
dispatching workflow asks you to — typically you hand the test back for the main
agent to commit alongside the implementation.
```

- [ ] **Step 3: Confirm the file parses as valid frontmatter + body and pins the rule**

```bash
grep -n "no-source-grep\|behavioral-test-allow\|name: test-author\|RED\|GREEN" .claude/agents/test-author.md
```

Expected: matches for the frontmatter `name`, the red/green cycle, the `no-source-grep` meta-gate reference, and the `behavioral-test-allow` exception. This confirms the two non-negotiables (TDD method + Ch.4 pin) are present.

- [ ] **Step 4: Confirm `refactoring-specialist` was NOT created (scope guard)**

```bash
ls .claude/agents/
```

Expected: exactly one file — `test-author.md`. If `refactoring-specialist.md` appears, delete it: it is explicitly out of scope per the spec (§1 decision).

- [ ] **Step 5: Commit**

```bash
git add .claude/agents/test-author.md
git commit -m "feat(agents): add thin project-scoped test-author agent (TDD red->green, Ch.4 pinned)"
```

---

### Task A.3: Manually validate `test-author` on one real unit (soft C-dependency noted)

Automated eval of `test-author` is a **soft** dependency on Unit C's eval harness (regression case: "authors a behavioral test that passes"). Unit C is not part of this plan and does not block it. Until C lands, validate manually here on one real task.

**Files:**
- No production file changed by the plan. The validation may produce a throwaway test file that is NOT committed (or is reverted) — this task proves the agent works, it does not ship a test.

**Interfaces:** dispatch the `test-author` agent against one real, simple unit.

- [ ] **Step 1: Pick one real, behavioral-testable unit**

Choose a small pure utility or a single interactive behavior that already exists and already has, or could have, a behavioral test (e.g. a `lib/` utility like `ip-hash` or `rate-limit`, or a client island behavior). Record the choice and the behavior to assert.

- [ ] **Step 2: Dispatch `test-author` on it**

Dispatch the `test-author` agent with the unit name and the behavior to assert. Instruct it to follow its red→green method and to NOT commit.

- [ ] **Step 3: Verify the agent's output meets the bar**

Confirm the agent produced:
- a test that asserts **observable behavior** (renders/calls/triggers — no `readFileSync` source-grep without a tagged exception),
- valid **red** evidence (a real assertion failure, not an import error),
- valid **green** evidence (passes after the minimal change),
- and that the test passes the meta-gate (it would not trip `__tests__/meta/no-source-grep.test.ts`).

Expected: all four hold. If the agent writes a source-grep test or skips the red step, tighten the prompt in `.claude/agents/test-author.md` (re-edit + re-commit via Task A.2's commit step) and re-validate.

- [ ] **Step 4: Clean up the throwaway validation artifact**

If the validation created a temporary test file that is not meant to ship, remove it so it does not land in the diff:

```bash
git status --porcelain
# revert/delete any throwaway test file the validation created, e.g.:
# git checkout -- <path>   (if it modified an existing file)
# rm <path>                (if it created a new throwaway file)
```

Expected: working tree clean of validation artifacts; only the committed `.mcp.json`, `test-author.md`, and (Unit R) `DECISIONS.md` changes remain. No commit in this task.

---

## Unit R — Record the ADR

### Task R.1: Append the ADR to `DECISIONS.md`

**Files:**
- Modify: `DECISIONS.md`

**Interfaces:** one ADR bullet following the repo convention (date · decision · rationale · reversibility note). The ADR must record three things per the spec (§3): the MCP addition with the pinned ref, the read-only grant, and the `refactoring-specialist` drop.

- [ ] **Step 1: Confirm the pinned ref actually shipped in `/.mcp.json` (ADR must cite reality, not intent)**

```bash
node -e "console.log(JSON.parse(require('fs').readFileSync('.mcp.json','utf8')).mcpServers.serena.args.join(' '))"
```

Expected: the printed args contain `git+https://github.com/oraios/serena@dd7eb6d72ae179aa940e50cd6276ec5646f306f8`, `--context claude-code`, `--mode planning`. Cite this exact pinned value in the ADR. (If Task S.2 swapped the SHA for a release tag, cite the tag instead.)

- [ ] **Step 2: Append the ADR bullet**

Add this entry to `DECISIONS.md` under the most recent date section (or a new `## 2026-06-19` heading if the convention groups by date — match the surrounding file's structure):

```markdown
- **2026-06-19** · **Serena MCP added to `/.mcp.json` as a read-only symbol-navigation server.** Pinned to commit `dd7eb6d72ae179aa940e50cd6276ec5646f306f8` (`uvx --from git+https://github.com/oraios/serena@<sha>`), launched `start-mcp-server --context claude-code --project ${PWD} --mode planning`. **Read-only is server-enforced, not by convention:** `--mode planning` excludes every write/edit/shell tool (`replace_symbol_body`, `insert_*_symbol`, `replace_lines`, `insert_at_line`, `delete_lines`, `create_text_file`, `replace_content`, `execute_shell_command`); `--context claude-code` drops redundant filesystem/shell tools and sets `single_project: true`. This deliberately removes the write-capable stdio surface the April-2026 stdio-RCE class targets — smoke-verified that `replace_symbol_body` and `execute_shell_command` are absent from the exposed tool list and that find-references resolves real call sites. The pin is hardcoded, NOT `@latest` (unlike the `upstash` entry's documented pinning violation, 2026-06-18). Refactor edits go through the main agent's `Edit` path; Serena navigates only. **`refactoring-specialist` agent was dropped** (architect finding): it fails the two-part vetting test — its method (consumer-scan before `git mv`) is already a CLAUDE.md rule that Serena's find-references now mechanizes directly, and behavior-preserving refactors emit working-tree edits, not read-once isolated output. The single project-scoped agent authored is `test-author` (`.claude/agents/test-author.md`), which authors behavioral tests via TDD red->green and pins STANDARDS Ch.4; the review battery only reviews tests, it does not author them. Automated `test-author` eval is a soft dependency on the Unit C harness; validated manually on one real unit until C lands. _Reversible: remove the `serena` block from `/.mcp.json` and delete `.claude/agents/test-author.md`; no runtime/production impact._
```

Replace `<sha>` in the prose only if you cited a release tag in Step 1; otherwise the explicit SHA is already in the bullet.

- [ ] **Step 3: Commit**

```bash
git add DECISIONS.md
git commit -m "docs(decisions): ADR for Serena read-only MCP + test-author agent + refactoring-specialist drop"
```

---

## Final verification (before declaring done)

### Task V.1: Whole-change no-regression + spec-coverage check

**Files:**
- Read-only across the three changed files.

- [ ] **Step 1: Confirm the three intended changes, and only those, are committed**

```bash
git log --oneline -4
git status --porcelain
```

Expected: three feature commits (`.mcp.json`, `test-author.md`, `DECISIONS.md`), clean working tree (no leftover validation artifact from Task A.3).

- [ ] **Step 2: Re-confirm Serena smoke assertions still hold**

Re-run Unit S Task S.3 Step 2 (tool list: `replace_symbol_body` + `execute_shell_command` absent) and Step 4 (`context7` + `upstash` still connect). Expected: navigation-only tools, all three servers connected.

- [ ] **Step 3: Confirm no application-code regression**

Because this plan touched no `app/`/`lib/`/`components/`/`scripts/` code, the test/build suites should be unaffected. Run them once as a no-regression confirmation (not as a gate this change introduces):

```bash
pnpm typecheck 2>&1 | tail -5
pnpm test --run 2>&1 | tail -5
```

Expected: typecheck clean, tests green — unchanged from before this plan. If anything fails, it is unrelated to these three Markdown/JSON edits; investigate separately.

- [ ] **Step 4: Spec-coverage self-check**

Confirm every spec requirement is satisfied: (a) `serena` in `/.mcp.json` with the exact pinned args ✅ Unit S; (b) `--mode planning` read-only + `--context claude-code`, no invented flags ✅ Global Constraints + S.2; (c) smoke test proves start + find-references + no write/shell tools ✅ S.3; (d) thin `test-author` agent pinning Ch.4 ✅ A.2; (e) `refactoring-specialist` dropped, not authored ✅ A.2 Step 4 + scope guard; (f) soft C-dependency noted, manual validation done ✅ A.3; (g) ADR records all three items ✅ R.1. Done only when all seven hold.
```