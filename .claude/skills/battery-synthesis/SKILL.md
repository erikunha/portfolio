# Battery Synthesis

A DX aid for unifying the output of the 5-agent review battery into a single,
deduplicated, prioritized action table. Not a gate — the stamp decision and
the responsibility for fixing findings remain with the main Claude.

## When to use

After all 5 battery agents have returned their reports and before `pnpm review:stamp`.

Battery agents: `pr-review-toolkit:review-pr`, `accessibility-tester`,
`security-auditor`, `performance-engineer`, `dependency-manager`.

Dispatch trigger in CLAUDE.md: "After dispatching the full 5-agent battery, before
`pnpm review:stamp` → `battery-synthesis`"

## How to synthesize

Read all 5 reports from the current context in order. Do NOT re-dispatch agents.

**Step 1 — Extract findings.** For each report, collect every finding:
- Severity as the agent stated it (Critical / Important / Advisory or equivalent)
- File path(s) affected
- Issue description (one line)
- Agent name

**Step 2 — Deduplicate.** When two or more agents flag the same file + issue class
(e.g., both `pr-review-toolkit` and `accessibility-tester` flag a missing `aria-label`
on the same button):
- Merge into one row
- List all agent names in the Agent(s) column separated by ` + `
- Add note: "Overlapping — one fix resolves both"
- Use the highest severity across the duplicates

**Step 3 — Detect conflicts.** When one agent recommends action X and another recommends
action Y that contradicts X on the same element or file (e.g., `performance-engineer`
says "add preload for this font" and `accessibility-tester` says "avoid layout shift from
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
| Missing aria-label on close button | components/client/Dialog.client.tsx | pr-review + a11y | Add aria-label="Close dialog" | Overlapping — one fix resolves both |

### Advisory
| Issue | File(s) | Agent(s) | Action |
|---|---|---|---|
| Unused import `clsx` | components/sections/Hero.tsx | pr-review | Remove import |

### Conflicts requiring resolution before acting
- [perf] Add `<link rel="preload">` for JetBrains Mono vs [a11y] Avoid CLS from font
  swap — pick one approach before addressing either row. Options: (a) preload + `font-display:
  block` to eliminate swap; (b) keep `font-display: swap` and accept first-paint penalty.
~~~

## After synthesis

- Address all Critical and Important rows before calling `pnpm review:stamp`.
- Advisory rows are optional; note any you skip.
- Resolve all Conflicts explicitly — pick the approach, document the choice, then act.
- The table does not mechanically block stamp. It informs your decision.
- If a conflict cannot be resolved without user input, escalate before stamping.
