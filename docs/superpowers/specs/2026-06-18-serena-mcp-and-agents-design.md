# Semantic Code-Nav + Vetted Agent (Unit D) — Design Spec

- **Date:** 2026-06-18 (rev. 2026-06-19 — addresses architect-reviewer FAIL)
- **Status:** Draft (rev.2) — pending architect-reviewer re-gate
- **Branch:** `feat/platform-gaps-2026-codenav` (sub-PR into `feat/platform-gaps-2026`)
- **Author:** Erik Cunha

## 1. Context & goal

Benchmark gap (score 27): refactors rely on grep + a manual "consumer-scan before `git mv`" rule (CLAUDE.md). Serena exposes LSP symbol-level operations (find-references, go-to-definition, symbol search) so the agent navigates the symbol graph instead of grepping — mechanizing that rule and surfacing *all* callers before a move.

### Goal

(1) Wire the **Serena MCP read-only** (navigation tools only). (2) Author **one** thin, vetted, project-scoped agent — `test-author` — that passes the research's two-part test (encodes a method the main agent won't run by default AND isolates read-once output).

### Decision (user-approved + architect-corrected)

Author a vetted project-scoped agent. **`refactoring-specialist` is dropped** (architect finding): it fails the two-part test — its "method" (consumer-scan before `git mv`) is already a CLAUDE.md rule the main agent follows, Serena mechanizes it directly, and behavior-preserving refactors produce edits in the working tree, not read-once isolated output. The value there is Serena itself, not a second persona. `test-author` is kept (authors tests; the battery only *reviews* them).

## 2. Components

1. **Serena MCP — read-only navigation.** Add to `/.mcp.json` (repo root, beside `context7` + `upstash`). Grant **only** navigation tools (find-references, go-to-definition, symbol search) — **no symbol-edit/write tools**. Refactor edits go through the main agent's normal `Edit` path, not Serena. This deliberately removes the write-capable stdio surface that the April-2026 stdio-RCE class targets: a read-only navigation server is a far smaller blast radius.
2. **`.claude/agents/test-author.md`** — thin prompt encoding the TDD cycle (red→green) for a given unit; pins STANDARDS Ch.4 behavioral-assertion rule. Project-scoped (first project agent; `.claude/agents/` is currently empty).

## 3. Wiring (architect-corrected)

`/.mcp.json` (repo root — **not** `.claude/.mcp.json`, which does not exist), add beside `context7`/`upstash`:

```jsonc
"serena": {
  "command": "uvx",
  "args": ["--from", "git+https://github.com/oraios/serena@dd7eb6d72ae179aa940e50cd6276ec5646f306f8",
           "serena", "start-mcp-server", "--context", "claude-code",
           "--project", "${PWD}", "--mode", "planning"]
}
```

- **Flag values verified against the real binary** (architect-reviewer inspected the uvx cache):
  - `--mode planning` is Serena's real read-only mode — `serena/resources/config/modes/planning.yml` excludes every write/edit/shell tool (`create_text_file`, `replace_symbol_body`, `insert_*_symbol`, `replace_lines`, `insert_at_line`, `delete_lines`, `replace_content`, `execute_shell_command`). This enforces the navigation-only grant at the server level, not by convention. (`editing-disabled` does NOT exist — it was invented in rev.2 and is corrected here.)
  - `--context claude-code` is the real context for this CLI agent — it excludes redundant `read_file`/`find_file`/`list_dir`/`search_for_pattern`/`execute_shell_command` and sets `single_project: true`, further narrowing the surface. (`ide-assistant` does NOT exist in this version.)
- **Pin:** the args pin the resolved commit `dd7eb6d…` (the SHA `uvx` resolves `git+https://github.com/oraios/serena` to at spec time). Prefer a stable release **tag** if one exists at install; otherwise keep this SHA. **Never `@latest`** — `upstash`'s `@latest` is a documented pinning violation (DECISIONS.md line 10); do not repeat it. Record the final pinned value in the ADR.
- `.claude/agents/test-author.md`: one new file, project-scoped.
- ADR records the MCP addition (with the pinned ref), the read-only grant, and the `refactoring-specialist` drop.

## 4. Failure-mode checklist (thinking-inversion)

| Failure mode | Mitigation |
|---|---|
| Serena LSP cold-start latency | Accept first-index cost; project-scoped (`${PWD}`) so it indexes only this repo |
| Write-capable stdio RCE class (April-2026) | Read-only `--mode planning` + pinned commit + minimal grants; no write/shell tools exposed |
| `@latest` pinning violation (upstash precedent) | Hardcode a release tag/SHA; record in ADR |
| Agent description noise degrades dispatch routing | One thin agent only (`test-author`); `refactoring-specialist` dropped |
| Serena absent (fresh clone / uvx missing) | Agent + main flow degrade to grep-based navigation; not a hard dependency |
| `test-author` writes source-grep / non-behavioral tests | Prompt pins STANDARDS Ch.4 behavioral-assertion rule |

## 5. Testing

- **Serena:** smoke check — the server **starts** under `--context claude-code --mode planning` (the prior invalid values would have failed this silently); find-references on a known symbol returns the expected call sites; assert the exposed tool list is the `planning`-mode set with **no** write/edit/shell tools present (`replace_symbol_body`, `replace_lines`, `execute_shell_command`, etc. absent).
- **`test-author`:** validated through the Unit C eval harness once it exists (regression case: "authors a behavioral test that passes"). Until C lands, validate manually on one real task. (Soft C-before-D dependency for *automated* eval; D ships with manual validation.)

## 6. Verification before completion

Serena smoke check passes and exposes navigation-only tools; `test-author` produces a correct behavioral test on one real unit; existing MCP servers (`context7`, `upstash`) still connect; agent dispatch still routes correctly.

## 7. Reversibility

Remove the `serena` entry from `/.mcp.json` and the `test-author.md` file. No production impact. ADR records the undo.

## 8. Status / next steps

Draft rev.2 → architect-reviewer re-gate → writing-plans → implementation (held). Soft-depends on Unit C for automated agent eval.
