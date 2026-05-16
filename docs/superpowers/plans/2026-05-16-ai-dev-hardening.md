# AI-Assisted Development Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `RISK` tier label to every agent's portfolio context block and embed a four-gate structured spec-gate protocol inside `architect-reviewer.md`, then update CLAUDE.md to reference it.

**Architecture:** Agent-embedded approach — no new skills, no new tools. Three tasks: (1) append `RISK:` labels to all 14 agents, (2) add the spec-gate protocol section to `architect-reviewer.md`, (3) update the CLAUDE.md spec-gate bullet. Agent files live in `~/.claude/agents/` and are not tracked by this repo's git — no commits for Tasks 1 and 2. Task 3 (CLAUDE.md) is tracked and gets a commit.

**Tech Stack:** bash, markdown, git

---

## File map

| File | Operation |
|---|---|
| `~/.claude/agents/ai-engineer.md` | Append `RISK: critical` line to portfolio context |
| `~/.claude/agents/security-auditor.md` | Append `RISK: critical` line to portfolio context |
| `~/.claude/agents/dependency-manager.md` | Append `RISK: critical` line to portfolio context |
| `~/.claude/agents/accessibility-tester.md` | Append `RISK: critical` line to portfolio context |
| `~/.claude/agents/architect-reviewer.md` | Append `RISK: critical` line + add `## Spec-gate protocol` section |
| `~/.claude/agents/nextjs-developer.md` | Append `RISK: standard` line to portfolio context |
| `~/.claude/agents/typescript-pro.md` | Append `RISK: standard` line to portfolio context |
| `~/.claude/agents/test-automator.md` | Append `RISK: standard` line to portfolio context |
| `~/.claude/agents/performance-engineer.md` | Append `RISK: standard` line to portfolio context |
| `~/.claude/agents/seo-specialist.md` | Append `RISK: standard` line to portfolio context |
| `~/.claude/agents/ui-ux-tester.md` | Append `RISK: standard` line to portfolio context |
| `~/.claude/agents/code-reviewer.md` | Append `RISK: standard` line to portfolio context |
| `~/.claude/agents/dx-optimizer.md` | Append `RISK: standard` line to portfolio context |
| `~/.claude/agents/refactoring-specialist.md` | Append `RISK: mechanical` line to portfolio context |
| `CLAUDE.md:140` | Replace inline three-item spec-gate bullet |

---

## Task 1 — Add RISK tier labels to all 14 agents

**Files:**
- Modify: `~/.claude/agents/ai-engineer.md`
- Modify: `~/.claude/agents/security-auditor.md`
- Modify: `~/.claude/agents/dependency-manager.md`
- Modify: `~/.claude/agents/accessibility-tester.md`
- Modify: `~/.claude/agents/architect-reviewer.md`
- Modify: `~/.claude/agents/nextjs-developer.md`
- Modify: `~/.claude/agents/typescript-pro.md`
- Modify: `~/.claude/agents/test-automator.md`
- Modify: `~/.claude/agents/performance-engineer.md`
- Modify: `~/.claude/agents/seo-specialist.md`
- Modify: `~/.claude/agents/ui-ux-tester.md`
- Modify: `~/.claude/agents/code-reviewer.md`
- Modify: `~/.claude/agents/dx-optimizer.md`
- Modify: `~/.claude/agents/refactoring-specialist.md`

- [ ] **Step 1: Verify no agent has a RISK label yet**

```bash
grep -l "^- RISK:" /Users/erikhenriquealvescunha/.claude/agents/*.md 2>/dev/null || echo "none — good"
```

Expected: `none — good`

- [ ] **Step 2: Append RISK labels to the five Critical agents**

```bash
echo '- RISK: critical — token budget cap (400K/month), rate-limit params, prompt caching; silent disabling costs money' \
  >> "/Users/erikhenriquealvescunha/.claude/agents/ai-engineer.md"

echo '- RISK: critical — attack surface review, env var handling; audit findings cascade to production' \
  >> "/Users/erikhenriquealvescunha/.claude/agents/security-auditor.md"

echo '- RISK: critical — 320KB CI bundle gate + 43KB app-code budget; new deps can silently blow either' \
  >> "/Users/erikhenriquealvescunha/.claude/agents/dependency-manager.md"

echo '- RISK: critical — Lighthouse A11y = 100 is a hard CI gate; any regression blocks deploy' \
  >> "/Users/erikhenriquealvescunha/.claude/agents/accessibility-tester.md"

echo '- RISK: critical — plan approval cascades to all implementation; wrong approval amplifies every subsequent task' \
  >> "/Users/erikhenriquealvescunha/.claude/agents/architect-reviewer.md"
```

- [ ] **Step 3: Append RISK labels to the eight Standard agents**

```bash
echo '- RISK: standard — RSC/client island decisions, INP-sensitive changes' \
  >> "/Users/erikhenriquealvescunha/.claude/agents/nextjs-developer.md"

echo '- RISK: standard — type correctness, Zod schema changes' \
  >> "/Users/erikhenriquealvescunha/.claude/agents/typescript-pro.md"

echo '- RISK: standard — test coverage quality, assertion correctness' \
  >> "/Users/erikhenriquealvescunha/.claude/agents/test-automator.md"

echo '- RISK: standard — perf budgets enforced by Lighthouse CI gate' \
  >> "/Users/erikhenriquealvescunha/.claude/agents/performance-engineer.md"

echo '- RISK: standard — Lighthouse SEO = 100 enforced by CI gate' \
  >> "/Users/erikhenriquealvescunha/.claude/agents/seo-specialist.md"

echo '- RISK: standard — visual QA, viewport checks; CI does not catch visual regressions' \
  >> "/Users/erikhenriquealvescunha/.claude/agents/ui-ux-tester.md"

echo '- RISK: standard — general PR review' \
  >> "/Users/erikhenriquealvescunha/.claude/agents/code-reviewer.md"

echo '- RISK: standard — hook and CI config changes' \
  >> "/Users/erikhenriquealvescunha/.claude/agents/dx-optimizer.md"
```

- [ ] **Step 4: Append RISK label to the one Mechanical agent**

```bash
echo '- RISK: mechanical — behavior-preserving by definition; pnpm ci:local is the sufficient gate' \
  >> "/Users/erikhenriquealvescunha/.claude/agents/refactoring-specialist.md"
```

- [ ] **Step 5: Verify all 14 agents have a RISK label**

```bash
for agent in ai-engineer security-auditor dependency-manager accessibility-tester architect-reviewer \
             nextjs-developer typescript-pro test-automator performance-engineer seo-specialist \
             ui-ux-tester code-reviewer dx-optimizer refactoring-specialist; do
  count=$(grep -c "^- RISK:" "/Users/erikhenriquealvescunha/.claude/agents/${agent}.md" 2>/dev/null || echo 0)
  echo "${agent}: ${count}"
done
```

Expected: all 14 print `1`.

- [ ] **Step 6: Verify the five Critical agents are correct**

```bash
grep "^- RISK:" \
  "/Users/erikhenriquealvescunha/.claude/agents/ai-engineer.md" \
  "/Users/erikhenriquealvescunha/.claude/agents/security-auditor.md" \
  "/Users/erikhenriquealvescunha/.claude/agents/dependency-manager.md" \
  "/Users/erikhenriquealvescunha/.claude/agents/accessibility-tester.md" \
  "/Users/erikhenriquealvescunha/.claude/agents/architect-reviewer.md"
```

Expected: all five lines contain `critical`.

---

## Task 2 — Add spec-gate protocol section to architect-reviewer.md

**Files:**
- Modify: `~/.claude/agents/architect-reviewer.md`

- [ ] **Step 1: Verify the section does not already exist**

```bash
grep -c "Spec-gate protocol" "/Users/erikhenriquealvescunha/.claude/agents/architect-reviewer.md" || echo "0"
```

Expected: `0`

- [ ] **Step 2: Append the spec-gate protocol section**

```bash
cat >> "/Users/erikhenriquealvescunha/.claude/agents/architect-reviewer.md" << 'SPEC_GATE_EOF'

## Spec-gate protocol

Run before any `writing-plans` invocation. Execute all four gates in order. Stop at the first BLOCK.

**Gate 1 — Scope**
Does any item in the spec appear in the CLAUDE.md "Out of scope" list or DECISIONS.md as a rejected pattern?

Rejected patterns: GraphQL, Cloudflare Workers, multi-region deploy, Sentry by default, CAPTCHA on the contact form, separate routes per section, state management library, design system extraction, MDX, separate CMS.

Out of scope: i18n, light theme toggle, blog/MDX content engine, analytics beyond Vercel Web Analytics + Speed Insights, auth/accounts/comments, CMS.

If yes: set `GATE_RESULT: BLOCK`, `BLOCKED_BY: Gate 1 — <specific item>`.

**Gate 2 — Client island budget**
Does the spec introduce any new `'use client'` surface or new client island?

If yes: does the spec explicitly justify the addition against the 43KB app-code-only client JS budget?

Current islands: InteractiveShell, ContactForm, ToTopButton, MatrixRain, CRTOverlay, StatusBar, Dock, MobileTitleBar, AppShell.client, ErrorBoundary.client.

If no justification present: set `GATE_RESULT: BLOCK`, `BLOCKED_BY: Gate 2 — no 43KB budget justification for new island`.

**Gate 3 — Security constraints**
Does the spec touch `app/api/ask/`, `lib/rate-limit.ts`, or `app/api/contact/route.ts`?

If yes, verify the spec preserves all of:
- Token cap: 400K tokens/month, warn at 80%, block at 100%, fail-open on Redis errors (`lib/rate-limit.ts:37,50-56`)
- Ask rate-limit: `slidingWindow(8, '1 h')` (`lib/rate-limit.ts:17`)
- Contact rate-limit: `slidingWindow(3, '10 m')` (`lib/rate-limit.ts:27`)
- Contact IP hashing: SHA-256 + `DEPLOY_SALT` before durable KV write (`app/api/contact/route.ts:43-47`)
- Prompt caching: `cache_control: { type: 'ephemeral' }` on system prompt (`app/api/ask/route.ts:110`)

If any constraint is not clearly preserved: set `GATE_RESULT: BLOCK`, `BLOCKED_BY: Gate 3 — <specific constraint>`.

**Gate 4 — CI gate regression risk**
Does the spec propose changes that could regress Lighthouse Perf ≥ 95, A11y = 100, SEO = 100, Best Practices ≥ 95, or the 120KB per-route bundle budget?

If yes and the spec does not already include `performance-engineer` or `accessibility-tester` in its agent dispatch: add them to `DISPATCH_ADDITIONS`. This gate does not BLOCK.

**Output — always end with exactly these three lines:**
```
GATE_RESULT: PASS | BLOCK
BLOCKED_BY: <gate name and specific reason, or "none">
DISPATCH_ADDITIONS: <comma-separated agent names to add, or "none">
```
SPEC_GATE_EOF
```

- [ ] **Step 3: Verify the section was appended correctly**

```bash
grep -c "Spec-gate protocol" "/Users/erikhenriquealvescunha/.claude/agents/architect-reviewer.md"
grep -c "GATE_RESULT" "/Users/erikhenriquealvescunha/.claude/agents/architect-reviewer.md"
grep -c "slidingWindow(8" "/Users/erikhenriquealvescunha/.claude/agents/architect-reviewer.md"
```

Expected: `1`, `2`, `1` (GATE_RESULT appears in gate output description and in the output template).

---

## Task 3 — Update CLAUDE.md spec-gate bullet and commit

**Files:**
- Modify: `CLAUDE.md:140`

- [ ] **Step 1: Verify the current bullet content**

```bash
grep -n "writing-plans.*architect-reviewer\|architect-reviewer.*writing-plans" \
  /Users/erikhenriquealvescunha/Documents/Claude/Projects/erik-portifolio/CLAUDE.md
```

Expected: one line containing both `writing-plans` and `architect-reviewer`, at approximately line 140.

- [ ] **Step 2: Replace the inline three-item list with a reference to the structured protocol**

Find and replace this exact line in `CLAUDE.md`:

Old line:
```
- Before invoking `writing-plans`, dispatch `architect-reviewer` against the spec. It must clear: (1) no new client islands without a 43KB budget justification, (2) no pattern listed in `DECISIONS.md` as rejected, (3) no item from the "Out of scope" list in this file.
```

New line:
```
- Before invoking `writing-plans`, dispatch `architect-reviewer` against the spec. It runs the four-gate spec-gate protocol (defined in `~/.claude/agents/architect-reviewer.md` §Spec-gate protocol) and must return `GATE_RESULT: PASS` before `writing-plans` proceeds.
```

Use the Read + Edit tools (not sed) to make this change safely.

- [ ] **Step 3: Verify the replacement**

```bash
grep -n "GATE_RESULT" /Users/erikhenriquealvescunha/Documents/Claude/Projects/erik-portifolio/CLAUDE.md
```

Expected: one line near line 140 containing `GATE_RESULT: PASS`.

- [ ] **Step 4: Run the full gate chain**

```bash
cd /Users/erikhenriquealvescunha/Documents/Claude/Projects/erik-portifolio && pnpm ci:local
```

Expected: exits 0. Biome, tsc, validate-content, and vitest all pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/erikhenriquealvescunha/Documents/Claude/Projects/erik-portifolio
git add CLAUDE.md
git commit -m "feat(claude-md): replace inline spec-gate list with structured protocol reference"
```

---

## Final verification

- [ ] **All 14 agents have exactly one RISK label**

```bash
for agent in ai-engineer security-auditor dependency-manager accessibility-tester architect-reviewer \
             nextjs-developer typescript-pro test-automator performance-engineer seo-specialist \
             ui-ux-tester code-reviewer dx-optimizer refactoring-specialist; do
  count=$(grep -c "^- RISK:" "/Users/erikhenriquealvescunha/.claude/agents/${agent}.md" 2>/dev/null || echo 0)
  echo "${agent}: ${count}"
done
```

Expected: all 14 print `1`.

- [ ] **architect-reviewer has both RISK label and spec-gate protocol**

```bash
grep "^- RISK:" "/Users/erikhenriquealvescunha/.claude/agents/architect-reviewer.md"
grep "Spec-gate protocol" "/Users/erikhenriquealvescunha/.claude/agents/architect-reviewer.md"
grep "GATE_RESULT" "/Users/erikhenriquealvescunha/.claude/agents/architect-reviewer.md"
```

Expected: three lines of output, all non-empty.

- [ ] **CLAUDE.md references structured protocol**

```bash
grep "GATE_RESULT: PASS" /Users/erikhenriquealvescunha/Documents/Claude/Projects/erik-portifolio/CLAUDE.md
```

Expected: one matching line.

- [ ] **ci:local passes**

```bash
cd /Users/erikhenriquealvescunha/Documents/Claude/Projects/erik-portifolio && pnpm ci:local 2>&1 | tail -4
```

Expected: `Tests 54 passed (54)`, exit 0.

---

## Self-review

**Spec coverage:**
- Feature 1 (Risk tier labels on all 14 agents): Task 1 covers all 14 agents with exact bash commands and exact label content ✓
- Feature 2 (Spec-gate protocol in architect-reviewer): Task 2 covers the full four-gate section with exact content ✓
- CLAUDE.md update (replace inline list with protocol reference): Task 3 covers this with exact old/new content ✓

**Placeholder scan:** All steps contain exact bash commands, exact file paths, and exact content. No TBD, no "similar to above", no vague instructions. ✓

**Type consistency:** No code types — all changes are markdown and bash. Line references in the spec-gate protocol (`lib/rate-limit.ts:37`, `lib/rate-limit.ts:17`, `lib/rate-limit.ts:27`, `app/api/contact/route.ts:43-47`, `app/api/ask/route.ts:110`) are verified against the actual source files read during brainstorming. ✓
