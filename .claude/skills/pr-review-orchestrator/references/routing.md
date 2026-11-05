# Routing: capabilities and contracts

## Ask who owns the information, then use that surface

| Question                                     | Surface                                                                                          |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| PR metadata, checks, threads, review state   | `gh` (GitHub)                                                                                    |
| Local repo facts, history                    | `git`, `Grep`, `Glob`, `Read`                                                                    |
| Exact library docs for the installed version | `node_modules/<pkg>` source and CHANGELOG, then the library's own documentation                  |
| Rendered behaviour, focus, network, console  | Playwright MCP for deterministic journeys; chrome-devtools for DOM, network, performance traces  |
| Product intent                               | the PR body, DECISIONS.md, ARCHITECTURE.md                                                       |
| Design authority                             | the approved design artifact named in the PR body                                                |
| Deployment state                             | the deployment dashboard only when the question is deployment-specific; local reproduction first |

Use the strongest fitting surface, not the longest chain. Do not browse the web for something
`gh` or the installed package answers.

## Subagents

Use the Agent tool with a contract: a reviewer per domain, a validator per gate group, a
challenger per consequential conclusion. Subagents do not inherit loaded skills; name `SKILLS:`
in the contract. Every subagent prompt carries the repo's git-state rule from CLAUDE.md.

Choose effort by task shape: retrieval and gate runs low, domain review medium or high,
security, data integrity and challenges high. A missing tool is not fixed by a stronger model.

## Track contract (Claude subagent)

`COMPLEXITY` and `SKILLS` go before the marker; the fields after it are each at column 0,
continuation lines indented.

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
TOOLS: Read, Grep, Glob, Bash for the VALIDATION commands only
EVIDENCE: file:line, counts with denominators, commands with results
VALIDATION: <exact commands, if any>
DONE: question answered with evidence, or proven unanswerable
STOP: return FOLLOW-UP instead of drifting into another domain
RETURN:
  the worker return format in references/output.md
```

Review tracks are read-only, so `WRITE-OWNERSHIP` is omitted.

## Skill routing for tracks

Precedence when two skills answer the same question: a project skill in `.claude/skills`
(`semgrep`, `visual-baseline-regen`, `ai-eval-update`) wins, then the exact domain skill below,
then a generic reviewer. A generic skill never overrides a project rule.


Next/React boundary: `senior-nextjs`, `react-performance`. Tailwind: `tailwind-v4`.
Accessibility: `a11y-audit`. Browser journeys: `playwright-pro`. API: `api-design-reviewer`,
`senior-nodejs`. Security: `senior-security`, `semgrep`. Tests: `vitest`, `tdd-guide`.
Dependencies: `dependency-upgrade-steward`, `dependency-auditor`. Design: `design-taste`,
`web-design-guidelines`. Email: `resend`. Workflow: `verification-planner`, `product-verifier`,
`readiness-verdict`.

Do not run several generic reviewers over the same diff (code-reviewer, pr-review-expert,
ship-gate, adversarial-reviewer together): that is correlated noise. One generic adversarial
pass earns its place; the rest are domain tracks.

## Agreement is not confirmation

Three workers reading the same implementation are one source. Inspect the decisive evidence
yourself before accepting it.
