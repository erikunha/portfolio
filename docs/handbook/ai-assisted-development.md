# AI-Assisted Development

> How AI participates across the SDLC. This doc describes the agent context, work loop and repository checks. For the per-artifact reference (every hook, skill, agent), see [agents-skills-hooks-mcp](./agents-skills-hooks-mcp.md).

## Where AI shows up in the lifecycle

```mermaid
sequenceDiagram
    participant H as Human (owner)
    participant C as Claude Code (main loop)
    participant A as Subagents (review workers)
    participant G as Git hooks and scripts
    participant CI as CI

    H->>C: intent ("build X" / "fix Y")
    C->>C: /speckit.specify (intent + approach)
    C->>C: plan-review skill (PASS or BLOCK against scope, JS budget, API limits)
    C->>C: plan with a failure-mode checklist (each failure mode -> a task)
    C->>C: TDD implement (tests first)
    C->>G: commit runs Biome, staged gitleaks and commitlint
    C->>C: self-review the head (specialist reviewers; the result is not posted)
    C->>A: scoped review investigation
    A-->>C: findings
    C->>G: git push (pre-push: main guard, branch name, pnpm verify)
    C->>CI: open eligible PR; CI runs checks and filtered runtime jobs
    H->>CI: optional: owner, member or collaborator comments /claude-review
    CI->>C: claude-review posts inline findings + Verdict
    CI-->>C: review threads
    C->>C: drive threads to resolved -> green
    H->>CI: owner squash-merges (project convention)
```

## 1. Context engineering (what the agent knows)

Project instructions divide context between always-loaded guidance and task-specific references. The guiding principle: pick the cheapest slot that still fires when needed. **gate > skill > path-scoped rule > memory > prose in AGENTS.md.** Prose in `AGENTS.md` is the most expensive slot (it taxes every session), so it keeps only what no gate can show and stays under the line budget in `scripts/harness-size.json`, checked by `check:harness-size`. A rule with no exceptions moves out of prose into a permission deny rule or a hook where the tool supports one.

```mermaid
flowchart TD
    subgraph always["Loaded every session"]
        cl["AGENTS.md (project instructions) via CLAUDE.md @import"]
        ucl["User-global instructions (runtime-dependent)"]
    end
    subgraph ondemand["Loaded on demand"]
        rules[".claude/rules/*.md (when editing matching paths)"]
        skills[".agents/skills/* via .claude/skills links (when triggered)"]
        topic["STANDARDS.md chapters · /docs (when relevant)"]
    end
    subgraph runtime["Discovered at runtime"]
        mem["User-global memory (runtime-dependent)"]
        ctx7["Context7 MCP (configured docs connection)"]
        history["DECISIONS.md (why a thing is the way it is)"]
    end
    always --> agent["Claude Code"]
    ondemand --> agent
    runtime --> agent
```

- **`AGENTS.md`** is the single source of project instructions for Codex and Claude Code. `CLAUDE.md` imports it with `@AGENTS.md` and adds only Claude-specific lines.
- **`.claude/rules/*.md`** load only when the agent reads a matching path (`paths:` frontmatter): the API boundary, components and CSS, CI and gate configuration. This keeps path-specific guidance out of always-loaded context.
- **Skills** live in `.agents/skills/` and are linked into `.claude/skills/`; only their name and description are always loaded.
- User-global memory behavior depends on the active runtime. No project file establishes a `.remember/` handoff location; `AGENTS.md` never references one, and its reference list names the current sources.

## 2. The agent's working loop

The project instructions define this loop. The table distinguishes conventions from mechanical checks:

| Step               | Mechanism                                                    | Enforced by                                                                                  |
| ------------------ | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| Explore + plan     | brainstorming, planning                                      | `plan-review` PASS (convention)                                                              |
| Anticipate failure | pre-mortem                                                   | convention + plan tasks                                                                      |
| Implement          | test-first project rule                                      | convention                                                                                   |
| Self-verify        | project verification rule                                    | convention + `pnpm verify`                                                                   |
| Review             | self-review by specialist reviewers; claude-review only on request | `pnpm pr:gate` (every thread resolved with a reply); optional `pnpm claude-gate` after a requested review |
| Resolve            | reply in each review thread, then resolve it                 | `pnpm pr:gate` (fails `silent_resolve`)                                                      |
| Record             | DECISIONS.md ADR                                             | PR template checklist (author confirmation)                                                  |

## 3. Review. self-review before every merge, claude-review on request

**claude-review (claude[bot]) is opt-in.** It runs only when an owner, member or collaborator comments `/claude-review` on a PR, posting findings as inline review comments anchored to changed lines and closing with a `Verdict:` line that the optional `pnpm claude-gate` reads fail-closed. It is not a merge requirement.

Self-review runs before every merge: reviewers that did not write the change, one per relevant specialty, each loading the matching skill, with screenshots examined for UI changes, every finding verified, then fixed or rejected with a reason. It is a process step with no gate: its result stays out of the PR, and `pnpm pr:gate` only checks thread resolution.

## 4. Enforcement boundaries

`.claude/settings.json` denies broad `git add`, npm and yarn installs and local env reads, and registers a Stop hook (Biome on changed files and the typecheck, skipped in CI), a PreToolUse hook that fails closed on a `gh` merge unless it reads as a single merge into a base other than `main`, and a PreToolUse hook that refuses edits to existing test files while `FIX_MODE=1` or `.claude/fix-mode` declares a fix task. Git hooks run Biome and staged gitleaks at pre-commit, commitlint at commit-msg, and branch/main-ref checks plus `pnpm verify` at pre-push.

CI runs separate quality, typecheck, unit-test and build jobs. Runtime and AI jobs use change filters. Semgrep findings are report-only; the fixture and report-existence checks can still fail. User-global runtime restrictions require separate inspection.

## 5. CI-side AI workflows

`.github/workflows/claude-review.yml` handles PR review requested by a `/claude-review` comment. `.github/workflows/claude.yml` handles human `@claude` mentions. They have different triggers and permissions.

## Prompt architecture (the shapes of AI work)

The repo encodes distinct prompt patterns for distinct SDLC stages:

| Stage               | Prompt shape                                                       | Where it lives                                     |
| ------------------- | ------------------------------------------------------------------ | -------------------------------------------------- |
| Specification       | brainstorm -> spec with Context/Gaps/Changes                       | `/speckit.specify`, the spec template              |
| Architecture review | four-gate plan review -> `GATE_RESULT: PASS \| BLOCK`              | `plan-review` skill                                |
| Implementation      | TDD: failing test first, smallest change                           | `test-first discipline (AGENTS.md)` |
| Review              | specialist self-review of the head; `pr-review-orchestrator` is one way to run it | `AGENTS.md` working agreement, `REVIEW.md`         |
| Documentation       | reverse-engineer from code, route don't duplicate                  | source comparisons and canonical documentation     |

Choose verification from the affected behavior and the project gate requirements. A docs-only change still runs `pnpm ci:local` under `AGENTS.md`.
