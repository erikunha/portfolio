---
name: battery-synthesis
description: Use after all 4 review-battery agents (pr-review-toolkit:code-reviewer, documentation-engineer, security-auditor, pr-review-toolkit:pr-test-analyzer) have returned and before running `pnpm review:stamp`. Unifies their reports into one deduplicated, severity-ranked action table so nothing is double-counted or missed before the stamp decision. Not a gate; a DX aid where the fix responsibility stays with the main agent.
---

# Battery Synthesis

A DX aid for unifying the output of the 4-agent review battery into a single,
deduplicated, prioritized action table. Not a gate — the stamp decision and
the responsibility for fixing findings remain with the main agent.

## When to use

After all 4 battery agents have returned their reports and before `pnpm review:stamp`.

Battery agents, one per role in `.claude/skills/review-battery`:
`pr-review-toolkit:code-reviewer` (correctness), `documentation-engineer`
(claim-drift), `security-auditor` (gate-robustness),
`pr-review-toolkit:pr-test-analyzer` (test-strength).

Dispatch trigger in CLAUDE.md: "After dispatching the full 4-agent battery, before
`pnpm review:stamp` → `battery-synthesis`"

## How to synthesize

Read all 4 reports from the current context in order. Do NOT re-dispatch agents.

**Step 0 — Read each report's `STATUS:` line before its findings.** A reviewer
returning `STATUS: blocked` or `STATUS: partial` did not review the range, and
its zero findings mean "could not look", not "looked and found nothing". Nothing
downstream can tell those apart on its own: `review:findings check` filters on
severity and `open`, and `review:stamp` counts `subagent_type` dispatches, so a
blocked role leaves an empty ledger and stamps green.

For every role whose status is not `completed`, record an `important` finding
via `pnpm review:findings add important <role> "<role> returned STATUS: <status>
— <what it could not cover>"` before synthesizing anything else. That keeps the
ledger blocking until the role is re-dispatched or the gap is explicitly
justified, which is the only mechanism here that stops a non-review from
stamping.

**Step 1 — Extract findings.** For each report, collect every finding:
- Severity as the agent stated it (Critical / Important / Advisory or equivalent)
- File path(s) affected
- Issue description (one line)
- Agent name

**Step 2 — Deduplicate.** When two or more agents flag the same file + issue class
(e.g., both `pr-review-toolkit:code-reviewer` and `security-auditor` flag the same unvalidated input
on the same button):
- Merge into one row
- List all agent names in the Agent(s) column separated by ` + `
- Add note: "Overlapping — one fix resolves both"
- Use the highest severity across the duplicates

**Step 3 — Detect conflicts.** When one agent recommends action X and another recommends
action Y that contradicts X on the same element or file (e.g., `security-auditor`
says a hook must exit 2 to block while `pr-review-toolkit:code-reviewer` says the same hook
must exit 0 so the surrounding chain continues), do NOT merge them. Surface them in the
Conflicts section instead.

**Step 4 — Classify.** Sort all deduplicated findings by severity:
Critical → Important → Advisory.

**Step 5 — Output** the table in the format below.

## Output format

~~~markdown
## Battery Synthesis — YYYY-MM-DD

### Critical
| Issue | File(s) | Agent(s) | Action |
|---|---|---|---|
| Gate fails open: `cmd \| tail` swallows the exit code | scripts/check-example.sh | security-auditor | Add `set -o pipefail`, or capture the status before the pipe |

### Important
| Issue | File(s) | Agent(s) | Action | Note |
|---|---|---|---|---|
| Guard passes when the header is absent | lib/example.ts | pr-review-toolkit:code-reviewer + security-auditor | Return false on a missing header | Overlapping — correctness sees the fail-open branch, gate-robustness sees the same line as a control that never blocks |

### Advisory
| Issue | File(s) | Agent(s) | Action |
|---|---|---|---|
| Handbook still names a script the diff renamed | docs/handbook/example.md | documentation-engineer | Update the reference; the old name resolves to nothing |

### Conflicts requiring resolution before acting
- [test-strength] "Assert the exit code, not the message" vs [gate-robustness] "The message is
  the only thing a blocked operator reads" — both are about the same guard block and pull opposite
  ways on what the test should pin. Pick one before acting. Options: (a) pin the exit code and let
  the message drift, accepting that a wrong message misleads a blocked operator; (b) pin both, and
  accept that a copy edit reds the suite.
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
