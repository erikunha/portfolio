# AI-Assisted Development Hardening — Design Spec

**Date:** 2026-05-16
**Status:** Approved

---

## Scope

Two complementary hardening mechanisms for the AI-assisted development workflow:

1. **Risk tier classification** — every agent carries a tier label in its portfolio context block; the tier determines review depth
2. **Structured spec-gate checklist** — `architect-reviewer` runs a four-gate structured check before any `writing-plans` invocation, producing a machine-readable `GATE_RESULT`

Approach: agent-embedded hardening. No new skills or tools. Changes land in existing agent files and CLAUDE.md.

---

## Feature 1: Risk Tier Classification

### Tiers

| Tier | Label | Meaning | Review depth |
|---|---|---|---|
| 1 — Critical | `RISK: critical` | Security, budget caps, rate limits, non-negotiable CI gates | Full two-stage: spec compliance + code quality |
| 2 — Standard | `RISK: standard` | UI components, content, CSS, most features | Single-pass: code quality only |
| 3 — Mechanical | `RISK: mechanical` | Formatting, rename, doc-only, test assertion style | Self-review only (no reviewer dispatch) |

### Tier assignments

| Agent | Tier | Rationale |
|---|---|---|
| `ai-engineer` | Critical | 400K token/month cap (≈$0.40), `slidingWindow(8, '1 h')` rate-limit, `cache_control` on system prompt — silent disabling costs money |
| `security-auditor` | Critical | Attack surface, env var handling (`ANTHROPIC_API_KEY`, `UPSTASH_*`, `RESEND_API_KEY`, `DEPLOY_SALT`) |
| `dependency-manager` | Critical | 320KB CI bundle gate (framework+app) + 43KB app-code-only budget; new deps can silently blow either |
| `accessibility-tester` | Critical | Lighthouse A11y = 100 is a hard CI gate; regression blocks deploy |
| `architect-reviewer` | Critical | Plan approval cascades to all implementation; wrong approval amplifies across every task |
| `nextjs-developer` | Standard | RSC/client island decisions, INP-sensitive changes |
| `typescript-pro` | Standard | Type correctness, Zod schema changes |
| `test-automator` | Standard | Test coverage quality, assertion correctness |
| `performance-engineer` | Standard | Perf budgets enforced by Lighthouse CI gate |
| `seo-specialist` | Standard | Lighthouse SEO = 100 enforced by CI gate |
| `ui-ux-tester` | Standard | Visual QA — subjective, CI does not catch |
| `code-reviewer` | Standard | General PR review |
| `dx-optimizer` | Standard | Hook and CI config changes |
| `refactoring-specialist` | Mechanical | Behavior-preserving by definition; `pnpm ci:local` is sufficient gate |

### Implementation

Add to each agent's `## Portfolio project context` block:

```
- RISK: <critical|standard|mechanical> — <one-line rationale>
```

### Task-time tier determination

At the start of each task in the subagent-driven-development loop, the controller reads the task's `Files:` section. If any file matches a Critical agent's trigger path, the entire task is treated as Critical-tier regardless of which agents will be invoked.

**Critical trigger paths:**
- `app/api/ask/`, `app/api/contact/`, `lib/rate-limit.ts` (security + budget)
- `content/schemas.ts` (Zod schema — build-time validation gate)
- `.husky/`, `.github/workflows/` (gate chain integrity)
- `lighthouserc.yml`, `scripts/check-bundle-size.mjs` (CI gate thresholds)

---

## Feature 2: Structured Spec-Gate Checklist

### Where it lives

Embedded in `architect-reviewer.md` as a new `## Spec-gate protocol` section. This is the only agent that ever runs this gate, so the checklist belongs in its file, not in CLAUDE.md.

### The four gates

Run in order. Stop at first BLOCK.

**Gate 1 — Scope**
Does any item in the spec appear in CLAUDE.md "Out of scope" or DECISIONS.md as a rejected pattern?

Rejected patterns (from DECISIONS.md): GraphQL, Cloudflare Workers, multi-region deploy, Sentry by default, CAPTCHA on the contact form, separate routes per section, state management library, design system extraction, MDX, separate CMS.

Out of scope: i18n, light theme toggle, blog/MDX content engine, analytics beyond Vercel Web Analytics + Speed Insights, auth/accounts/comments, CMS.

If yes: BLOCK. State the specific item.

**Gate 2 — Client island budget**
Does the spec introduce any new `'use client'` surface or new client island?

If yes: does the spec explicitly justify the addition against the 43KB app-code-only client JS budget? (Current islands: InteractiveShell, ContactForm, ToTopButton, MatrixRain, CRTOverlay, StatusBar, Dock, MobileTitleBar, AppShell.client, ErrorBoundary.client.)

If no justification: BLOCK. Request budget analysis.

**Gate 3 — Security constraints**
Does the spec touch `app/api/ask/`, `lib/rate-limit.ts`, or `app/api/contact/route.ts`?

If yes, verify the spec preserves:
- Token cap: 400K tokens/month, warn at 80%, block at 100%, fail-open on Redis errors (`lib/rate-limit.ts:37,50-56`)
- Ask rate-limit: `slidingWindow(8, '1 h')` (`lib/rate-limit.ts:17`)
- Contact rate-limit: `slidingWindow(3, '10 m')` (`lib/rate-limit.ts:27`)
- Contact IP hashing: SHA-256 + `DEPLOY_SALT` before durable KV write (`app/api/contact/route.ts:43-47`)
- Prompt caching: `cache_control: { type: 'ephemeral' }` on system prompt (`app/api/ask/route.ts:110`)

If any constraint is not clearly preserved: BLOCK. Name the specific constraint.

**Gate 4 — CI gate regression risk**
Does the spec propose changes that could regress:
- Lighthouse Perf ≥ 95, A11y = 100, SEO = 100, Best Practices ≥ 95
- Per-route bundle budget: 120KB gzipped
- Axe-core a11y scan (runs in `build-and-gate` CI job)

If yes: does the spec call for `performance-engineer` or `accessibility-tester` review in its agent dispatch? If not: add them. This is an auto-add, not a BLOCK.

### Output format

```
GATE_RESULT: PASS | BLOCK
BLOCKED_BY: <gate name and specific reason, or "none">
DISPATCH_ADDITIONS: <comma-separated agent names to add, or "none">
```

### Integration with CLAUDE.md spec-gate rule

The existing spec-gate bullet in `## When in doubt`:

> Before invoking `writing-plans`, dispatch `architect-reviewer` against the spec. It must clear: (1) no new client islands without a 43KB budget justification, (2) no pattern listed in `DECISIONS.md` as rejected, (3) no item from the "Out of scope" list in this file.

Replace the three-item inline list with a reference to the structured protocol:

> Before invoking `writing-plans`, dispatch `architect-reviewer` against the spec. It runs the four-gate spec-gate protocol (defined in `~/.claude/agents/architect-reviewer.md` §Spec-gate protocol) and must return `GATE_RESULT: PASS` before `writing-plans` proceeds.

---

## Files Changed

| File | Change |
|---|---|
| `~/.claude/agents/architect-reviewer.md` | Add `## Spec-gate protocol` section with four gates and output format |
| `~/.claude/agents/ai-engineer.md` | Add `RISK: critical` line |
| `~/.claude/agents/security-auditor.md` | Add `RISK: critical` line |
| `~/.claude/agents/dependency-manager.md` | Add `RISK: critical` line |
| `~/.claude/agents/accessibility-tester.md` | Add `RISK: critical` line |
| `~/.claude/agents/nextjs-developer.md` | Add `RISK: standard` line |
| `~/.claude/agents/typescript-pro.md` | Add `RISK: standard` line |
| `~/.claude/agents/test-automator.md` | Add `RISK: standard` line |
| `~/.claude/agents/performance-engineer.md` | Add `RISK: standard` line |
| `~/.claude/agents/seo-specialist.md` | Add `RISK: standard` line |
| `~/.claude/agents/ui-ux-tester.md` | Add `RISK: standard` line |
| `~/.claude/agents/code-reviewer.md` | Add `RISK: standard` line |
| `~/.claude/agents/dx-optimizer.md` | Add `RISK: standard` line |
| `~/.claude/agents/refactoring-specialist.md` | Add `RISK: mechanical` line |
| `CLAUDE.md` | Replace three-item inline spec-gate list with reference to structured protocol |

Note: `architect-reviewer.md` is the only agent that gets a new section (the checklist). All other agents get only a single `RISK:` line.

---

## Non-Goals

- Automating gate evaluation via scripts or hooks (advisory enforcement via agent instructions is sufficient)
- Modifying review prompts inside the `subagent-driven-development` skill itself
- Adding a new `risk-classifier` skill (tier is determined by inspecting the task's `Files:` section manually)
- Enforcing tier-based review on commits that bypass the subagent flow (pre-commit hook covers linting/type/test; human judgment covers the rest)

---

## Known Issues (not in scope, logged for awareness)

- **CI env var drift:** CI sets `IP_HASH_SALT: ci-build-salt` but `app/api/contact/route.ts` reads `process.env.DEPLOY_SALT`. In CI builds, `DEPLOY_SALT` is undefined and falls back to `'portfolio'`. Hashing still occurs; only the salt value differs from production.
- **43KB budget unenforced by CI:** The CI bundle gate uses `--max-client-kb=320` (framework+app total). The 43KB app-code-only budget is tracked via CLAUDE.md and `@next/bundle-analyzer` but has no automated gate. A future gate script could measure app-only chunks separately.
