---
name: battery-synthesis
description: Use after all 4 review-battery agents (pr-review-toolkit:review-pr, security-auditor, performance-engineer, dependency-auditor) have returned and before running `pnpm review:stamp`. Unifies their reports into one deduplicated, severity-ranked action table so nothing is double-counted or missed before the stamp decision. Not a gate; a DX aid where the fix responsibility stays with the main agent.
---
> **Codex note:** hook activation is not configured in this repo, so every "the hook blocks", "enforced", "WIRED", or "exit 2" claim here — including in this file's description — is a **hard rule to self-enforce**, not an automated gate.


# Battery Synthesis

A DX aid for unifying the output of the 4-agent review battery into a single,
deduplicated, prioritized action table. Not a gate — the stamp decision and
the responsibility for fixing findings remain with the main Claude.

## When to use

After all 4 battery agents have returned their reports and before `pnpm review:stamp`.

Battery agents: `pr-review-toolkit:review-pr`,
`security-auditor`, `performance-engineer`, `dependency-auditor`.

Dispatch trigger in AGENTS.md: "After dispatching the full 4-agent battery, before
`pnpm review:stamp` → `battery-synthesis`"

## How to synthesize

Read all 4 reports from the current context in order. Do NOT re-dispatch agents.

**Step 1 — Extract findings.** For each report, collect every finding:
- Severity as the agent stated it (Critical / Important / Advisory or equivalent)
- File path(s) affected
- Issue description (one line)
- Agent name

**Step 2 — Deduplicate.** When two or more agents flag the same file + issue class
(e.g., both `pr-review-toolkit:review-pr` and `security-auditor` flag the same unvalidated input
on the same button):
- Merge into one row
- List all agent names in the Agent(s) column separated by ` + `
- Add note: "Overlapping — one fix resolves both"
- Use the highest severity across the duplicates

**Step 3 — Detect conflicts.** When one agent recommends action X and another recommends
action Y that contradicts X on the same element or file (e.g., `performance-engineer`
says "add preload for this font" and `pr-review-toolkit:review-pr` says "avoid layout shift from
this font loading"), do NOT merge them. Surface them in the Conflicts section instead.

**Step 4 — Classify.** Sort all deduplicated findings by severity:
Critical → Important → Advisory.

**Step 5 — Output** the table in the format below.

## Output format

~~~markdown
## Battery Synthesis — YYYY-MM-DD

### Critical
| Issue | File(s) | Agent(s) | Action |
|---|---|---|---|
| Missing rate-limit on /api/example | app/api/example/route.ts | security-auditor | Add `applyRateLimit()` call before handler logic |

### Important
| Issue | File(s) | Agent(s) | Action | Note |
|---|---|---|---|---|
| Missing aria-label on close button | components/client/Dialog.client.tsx | pr-review-toolkit:review-pr + performance-engineer | Add aria-label="Close dialog" | Overlapping — one fix resolves both |

### Advisory
| Issue | File(s) | Agent(s) | Action |
|---|---|---|---|
| Unused import `clsx` | components/sections/Hero.tsx | pr-review-toolkit:review-pr | Remove import |

### Conflicts requiring resolution before acting
- [perf] Add `<link rel="preload">` for JetBrains Mono vs [a11y] Avoid CLS from font
  swap — pick one approach before addressing either row. Options: (a) preload + `font-display: block` to eliminate swap; (b) keep `font-display: swap` and accept potential CLS from the font swap.
~~~

## After synthesis — record the findings ledger (verification loop)

The table now feeds a mechanical gate. `pnpm review:stamp` REFUSES to stamp
while any Critical/Important finding is `open`, so the stamp proves resolution,
not just dispatch. Record the cycle:

1. Start a clean ledger: `pnpm review:findings clear`
2. For every Critical and Important row: `pnpm review:findings add <critical|important> <source-agent> "<issue title>"`
3. As you fix each, cite the fix commit: `pnpm review:findings resolve <id> <sha>`
4. If a finding is intentionally not fixed, justify it (a non-empty reason is
   required; reference a DECISIONS.md entry where applicable):
   `pnpm review:findings justify <id> "<reason>"`
5. `pnpm review:findings check` must pass before `pnpm review:stamp`.

Anti-theater rule: the agent that verifies a `resolve` should not be the one
that wrote the fix. Re-dispatch the relevant battery agent against the fix
before resolving its finding.

- Advisory rows are optional; note any you skip (they do not enter the ledger).
- Resolve all Conflicts explicitly: pick the approach, document the choice, then act.
- If a conflict cannot be resolved without user input, escalate before stamping.
