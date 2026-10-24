# Routing: capabilities, providers, contracts

## Ask who owns the information, then use that surface

| Question                                     | Surface                                                                                                                                                  |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PR metadata, checks, threads, review state   | `gh` (GitHub)                                                                                                                                            |
| Local repo facts, history                    | `git`                                                                                                                                                    |
| What exists, who depends on X                | codebase-memory-mcp (confirm against source)                                                                                                             |
| Exact references, callers, safe rename       | serena (activate the project first)                                                                                                                      |
| Blast radius of a diff, hubs                 | graphify `affected`, `get_pr_impact`                                                                                                                     |
| Duplicated logic the diff adds               | token-savior `find_semantic_duplicates` (its one routed review check)                                                                                    |
| Exact library docs for the installed version | context7, else `node_modules/<pkg>` source and CHANGELOG                                                                                                 |
| Rendered behaviour, focus, network, console  | Playwright MCP for deterministic journeys; chrome-devtools for DOM, network, performance traces; claude-in-chrome for exploratory authenticated sessions |
| Product intent                               | `specs/<feature>/spec.md`, `plan.md`, DECISIONS.md, PR body                                                                                              |
| Design authority                             | the spec's prototype export or approved design artifact                                                                                                  |
| Deployment state                             | Vercel only when the question is deployment-specific; local reproduction first                                                                           |

Use the strongest fitting surface, not the longest chain. Do not browse the web for something
`gh` or the installed package answers.

## Providers

| Provider         | Call                                                                                                                                                                               | Fits                                                                                                                                                                         | Notes                                                                                                                                                                                                                          |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Codex            | `python3 ~/Desktop/Projects/claude-skills/runtime/bin/cross-runtime.py run --contract <json> --runtime codex --model <model> --effort high`                                        | deep read-only tracks, adversarial passes, exact-version research in `node_modules`                                                                                          | contract needs `kind: analyze`, `access: read-only`, `write_ownership: []`, `budget_window: weekly`, full `execution_context` (`task_contract.make_context`). Sandbox has no network and usually cannot build or open sockets. |
| MiMo             | `python3 ~/.claude-skills/runtime/bin/model-delegate.py run --mode review --model xiaomi-mimo-v2.6-flash --root <repo> --file <f> ... --task "..." --criteria "..."`               | narrow second opinions on 1 to 4 files                                                                                                                                       | review and analyze only (implement is refused). Pro times out on wide inputs. Output is untrusted: verify each finding, then `model-delegate.py outcome --id <id> --accepted                                                   | --rejected`. |
| Claude subagents | Agent tool with `ROUTING-CONTRACT-V1` and `COMPLEXITY:`; the `routing-*` types exist only where the user-level runtime is installed, else `general-purpose` with the same contract | `routing-reviewer[-high]` per domain, `routing-validator` per gate group, `routing-challenger` per consequential conclusion, `routing-architect` for one structural decision | They do not inherit loaded skills; name `SKILLS:` in the contract. Every subagent prompt carries the repo's git-state rule from CLAUDE.md.                                                                                     |

Choose effort by task shape: retrieval and gate runs low, domain review medium or high,
security, data integrity and challenges high. A missing tool is not fixed by a stronger model.

## Track contract (Claude subagent)

`COMPLEXITY` and `SKILLS` go before the marker; the fields after it follow the canonical order
of the global agent-routing rule, each at column 0, continuation lines indented.

```text
COMPLEXITY: standard|hard
SKILLS: <0 to 2 skills, e.g. senior-nextjs, a11y-audit>
ROUTING-CONTRACT-V1
TASK-ID: <pr>-<domain>
OBJECTIVE: <one falsifiable review question>
WHY-DELEGATE: <isolation or independence it buys>
SCOPE: <exact files, commands, routes>
OUT-OF-SCOPE: unrelated files are excluded; other tracks' questions; no file writes
ACCEPTED-CONTEXT: <REVIEW-CONTEXT facts this track needs, nothing more>
MODEL-ROUTE: <omit to take the agent default>
TOOLS: Read, Grep, Glob, Bash for the VALIDATION commands only
EVIDENCE: file:line, counts with denominators, commands with results
VALIDATION: <exact commands, if any>
DONE: question answered with evidence, or proven unanswerable
STOP: return FOLLOW-UP instead of drifting into another domain
RETURN:
  the worker return format in references/output.md
```

Review tracks are read-only, so `WRITE-OWNERSHIP` is omitted. For Codex the same content goes
in `objective` as prose.

## Skill routing for tracks

Precedence when two skills answer the same question: a project skill in `.claude/skills`
(`semgrep`, `visual-baseline-regen`, `ai-eval-update`) wins, then the exact domain skill below,
then a generic reviewer. A generic skill never overrides a project rule.


Next/React boundary: `senior-nextjs`, `react-performance`. Tailwind: `tailwind-v4`.
Accessibility: `a11y-audit`. Browser journeys: `playwright-pro`. API: `api-design-reviewer`,
`senior-nodejs`. Security: `senior-security`, `semgrep`. Tests: `vitest`, `tdd-guide`.
Dependencies: `dependency-upgrade-steward`, `dependency-auditor`. Design: `design-taste`,
`web-design-guidelines`. Email: `resend`. Workflow: `verification-planner`, `product-verifier`,
`readiness-verdict`. Use `skill-finder` before naming a skill that is not confirmed installed.

Do not run several generic reviewers over the same diff (code-reviewer, pr-review-expert,
ship-gate, adversarial-reviewer together): that is correlated noise. One generic adversarial
pass from a different provider earns its place; the rest are domain tracks.

## Agreement is not confirmation

Three workers reading the same implementation are one source. Inspect the decisive evidence
yourself before accepting it.
