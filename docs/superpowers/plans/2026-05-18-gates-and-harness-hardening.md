# Production Harness Hardening — Gates & Stop-Loss Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the four fixes from `docs/superpowers/specs/2026-05-18-gates-and-harness-hardening-design.md` — Claude harness permissions lockdown, `ASK_ENABLED` kill switch, explicit upstream timeouts, mobile LHCI gate — so the audit-identified production-harness gaps close.

**Architecture:** Five tasks, one commit each. Order matches spec §11: smallest-blast-radius first (Permissions), then env-var read (ASK_ENABLED), then route-handler changes (timeouts), then a calibration step before the CI workflow change ships (Mobile LHCI prep + ship split). Tests follow the project's source-grep pattern (read source, assert on text content) — no SDK mocking, no flake.

**Tech Stack:** Next.js 16 (App Router) · TypeScript strict · Vitest · GitHub Actions · @lhci/cli · Claude Code settings · Husky pre-commit gates

---

## File map

| File | Operation | Task |
|---|---|---|
| `.claude/settings.json` | **Create** (committed, project baseline) | 1 |
| `.claude/settings.local.json` | Modify (gitignored, machine-local) | 1 |
| `ARCHITECTURE.md` | Modify §13 — add "Claude harness configuration" subsection with jq inspection recipe | 1 |
| `__tests__/ask-killswitch.test.ts` | **Create** | 2 |
| `app/api/ask/route.ts` | Modify — kill-switch check + cold-start log line | 2 |
| `.env.example` | Modify — add `ASK_ENABLED` with off-keyword comment | 2 |
| `ARCHITECTURE.md` | Modify §6 — add "Kill switches" subsection | 2 |
| `DECISIONS.md` | Modify — add 2 bullets dated 2026-05-18 (env-var choice + off-by-keyword semantics) | 2 |
| `__tests__/ask-timeout.test.ts` | **Create** | 3 |
| `app/api/ask/route.ts` | Modify — `timeout: 30_000` on Anthropic init | 3 |
| `app/api/contact/route.ts` | Modify — Promise.race wrapper around Resend send | 3 |
| `lighthouserc.mobile.json` | **Create** (TARGET thresholds, pending calibration) | 4 |
| `package.json` | Modify — add `lhci:mobile` script | 4 |
| `docs/superpowers/plans/2026-05-18-gates-and-harness-hardening.md` | Modify — append calibration evidence (this file) | 4 |
| `lighthouserc.mobile.json` | Modify — bake in calibrated thresholds if needed | 4 |
| `.github/workflows/ci.yml` | Modify — add `lhci-mobile` parallel job | 5 |
| `package.json` | Modify — make `lhci` script explicit with `--config=lighthouserc.json` | 5 |

---

## Task 1 — Permissions lockdown (Fix 4)

**Files:**
- Create: `.claude/settings.json` (committed)
- Modify: `.claude/settings.local.json` (gitignored)
- Modify: `ARCHITECTURE.md` (§13)

### Steps

- [ ] **Step 1.1: Confirm current `.claude/settings.local.json` state**

```bash
cat .claude/settings.local.json | head -50
```

Expected output: should include `"defaultMode": "bypassPermissions"` and three `Bash(...)` entries — `Bash(rm -rf .git)`, `Bash(git init *)`, `Bash(git branch *)`. If any of those three entries are already missing, note it; the cleanup is still safe (idempotent).

- [ ] **Step 1.2: Confirm `.claude/settings.json` does NOT exist yet**

```bash
test -f .claude/settings.json && echo "EXISTS — investigate before proceeding" || echo "missing — good, will create"
```

Expected: `missing — good, will create`. If it exists, stop and investigate — it may contain prior decisions.

- [ ] **Step 1.3: Create `.claude/settings.json` with the project baseline**

Create `.claude/settings.json` with this exact content:

```json
{
  "permissions": {
    "allow": [
      "Skill(superpowers:brainstorming)",
      "Skill(superpowers:writing-plans)",
      "Skill(superpowers:verification-before-completion)",
      "Skill(superpowers:systematic-debugging)",
      "Skill(commit-commands:commit)",
      "Skill(commit-commands:commit-push-pr)",
      "Skill(code-review:code-review)",
      "Skill(pr-review-toolkit:review-pr)",
      "Skill(security-review)"
    ],
    "defaultMode": "acceptEdits"
  }
}
```

- [ ] **Step 1.4: Verify the new file is JSON-valid**

```bash
node -e "JSON.parse(require('fs').readFileSync('.claude/settings.json', 'utf8'))" && echo "valid JSON"
```

Expected: `valid JSON`. If a `SyntaxError` prints, re-check Step 1.3 for stray commas or quotes.

- [ ] **Step 1.5: Verify `.claude/settings.json` is NOT gitignored (this one MUST be tracked)**

```bash
git check-ignore -v .claude/settings.json && echo "PROBLEM: tracked file is ignored" || echo "not ignored — good, will commit"
```

Expected: `not ignored — good, will commit`. If it IS ignored, inspect `.gitignore` for an entry that overshoots; only `.claude/settings.local.json` should be in `.gitignore`.

- [ ] **Step 1.6: Edit `.claude/settings.local.json` — remove the three risky Bash entries**

Open `.claude/settings.local.json` in your editor. Delete the three lines containing:
- `"Bash(rm -rf .git)"`
- `"Bash(git init *)"`
- `"Bash(git branch *)"`

Preserve all other entries unchanged. Watch for trailing commas — the JSON array must remain syntactically valid.

- [ ] **Step 1.7: Edit `.claude/settings.local.json` — remove the `defaultMode` line**

In the same file, delete the line `"defaultMode": "bypassPermissions"` (and its preceding comma if present). The project baseline (`acceptEdits` from `.claude/settings.json`) will now apply.

- [ ] **Step 1.8: Verify the local file is still JSON-valid**

```bash
node -e "JSON.parse(require('fs').readFileSync('.claude/settings.local.json', 'utf8'))" && echo "valid JSON"
```

Expected: `valid JSON`.

- [ ] **Step 1.9: Verify no risky entries remain in local file**

```bash
grep -E '"Bash\((rm -rf \.git|git init |git branch )' .claude/settings.local.json && echo "FAIL: risky entry still present" || echo "PASS: no risky entries"
```

Expected: `PASS: no risky entries`.

- [ ] **Step 1.10: Verify `bypassPermissions` line removed**

```bash
grep '"defaultMode"' .claude/settings.local.json && echo "FAIL: defaultMode line remains" || echo "PASS: defaultMode removed"
```

Expected: `PASS: defaultMode removed`.

- [ ] **Step 1.11: Verify effective merged allowlist via jq recipe**

```bash
jq -s '(.[0].permissions.allow + (.[1].permissions.allow // [])) | unique' \
  .claude/settings.json .claude/settings.local.json 2>/dev/null
```

Expected output: a JSON array containing the union of allowlists from both files. Spot-check that none of the three risky `Bash(...)` entries appear in the output.

- [ ] **Step 1.12: Add the inspection recipe to `ARCHITECTURE.md` §13**

Find section 13 of `ARCHITECTURE.md` (the "Deployment + CI/CD" section). After the existing content of §13 (which ends with "Rollback"), append this new subsection:

```markdown
### Claude harness configuration

The repo ships a project-level Claude Code permissions baseline in `.claude/settings.json` (committed) — `defaultMode: "acceptEdits"` plus the minimum skill allowlist mandated by CLAUDE.md's dispatch matrix. Per-machine additions live in `.claude/settings.local.json` (gitignored). The effective merged allowlist is inspectable via:

```bash
jq -s '(.[0].permissions.allow + (.[1].permissions.allow // [])) | unique' \
  .claude/settings.json .claude/settings.local.json 2>/dev/null
```

Configuration history and rationale: see `DECISIONS.md` 2026-05-18 (permissions lockdown bullet).
```

- [ ] **Step 1.13: Verify the subsection was appended cleanly**

```bash
grep -A2 "Claude harness configuration" ARCHITECTURE.md | head -5
```

Expected: shows the subsection header and the first two lines.

- [ ] **Step 1.14: Run pre-commit gates manually before committing**

```bash
pnpm check && pnpm typecheck && pnpm validate-content && pnpm test
```

Expected: all four green. None of the changes touched TypeScript or content, but the husky `pre-commit` hook runs this same sequence — better to surface failures now than mid-commit.

- [ ] **Step 1.15: Smoke test that a fresh Claude session resolves to `acceptEdits`**

In a fresh terminal: `cd` to this repo, run `claude --version` to confirm Claude Code is installed, then open a one-line session and ask it to print its current `defaultMode`. Skip if not feasible — manual verification is acceptable, but if you skip, NOTE in the commit message that the runtime check was deferred.

- [ ] **Step 1.16: Commit**

```bash
git add .claude/settings.json ARCHITECTURE.md
git commit -m "$(cat <<'EOF'
feat(harness): commit Claude permissions baseline, drop risky local entries

- Adds .claude/settings.json (committed): defaultMode acceptEdits +
  minimum project-mandated skill allowlist per CLAUDE.md dispatch matrix.
- Removes Bash(rm -rf .git), Bash(git init *), Bash(git branch *) and
  the defaultMode=bypassPermissions line from .claude/settings.local.json
  (gitignored; not in this diff).
- ARCHITECTURE.md §13: new "Claude harness configuration" subsection
  documenting the inspection jq recipe.

Implements Fix 4 of spec docs/superpowers/specs/2026-05-18-gates-and-
harness-hardening-design.md. Effective merged allowlist now project-
level baseline + per-machine additions; risky destructive Bash commands
no longer pre-approved.

Reversal: git rm .claude/settings.json + restore deleted entries in
local file.
EOF
)"
```

Expected: commit succeeds; husky `pre-commit` hook reruns the full gate sequence; commit lands. `.claude/settings.local.json` does NOT appear in the diff (gitignored).

---

## Task 2 — `ASK_ENABLED` kill switch (Fix 3)

**Files:**
- Create: `__tests__/ask-killswitch.test.ts`
- Modify: `app/api/ask/route.ts`
- Modify: `.env.example`
- Modify: `ARCHITECTURE.md` (§6)
- Modify: `DECISIONS.md`

### Steps

- [ ] **Step 2.1: Read the current top of `app/api/ask/route.ts`**

```bash
sed -n '1,20p' app/api/ask/route.ts
```

Note line numbers for the existing `import` and `const anthropic = new Anthropic();` lines — referenced in Steps 2.5 and 2.6.

- [ ] **Step 2.2: Write the failing test**

Create `__tests__/ask-killswitch.test.ts` with this exact content:

```ts
// __tests__/ask-killswitch.test.ts
// Source-grep test: verifies the kill-switch shape and ordering in
// app/api/ask/route.ts. See spec docs/superpowers/specs/
// 2026-05-18-gates-and-harness-hardening-design.md §6.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ASK_SOURCE = readFileSync(
  path.resolve(__dirname, '../app/api/ask/route.ts'),
  'utf-8',
);

describe('/api/ask kill switch', () => {
  it('declares OFF_KEYWORDS Set with the five off keywords', () => {
    expect(ASK_SOURCE).toMatch(/const OFF_KEYWORDS = new Set\(/);
    expect(ASK_SOURCE).toMatch(/'false'/);
    expect(ASK_SOURCE).toMatch(/'0'/);
    expect(ASK_SOURCE).toMatch(/'off'/);
    expect(ASK_SOURCE).toMatch(/'no'/);
    expect(ASK_SOURCE).toMatch(/'disabled'/);
  });

  it('normalizes the env var via trim + toLowerCase before matching', () => {
    expect(ASK_SOURCE).toMatch(/process\.env\.ASK_ENABLED\s*\?\?\s*''/);
    expect(ASK_SOURCE).toMatch(/\.trim\(\)/);
    expect(ASK_SOURCE).toMatch(/\.toLowerCase\(\)/);
  });

  it('returns 503 with the email-fallback message when disabled', () => {
    expect(ASK_SOURCE).toMatch(/status:\s*503/);
    expect(ASK_SOURCE).toMatch(/email erikhenriquealvescunha@gmail\.com directly/);
  });

  it('kill-switch check runs BEFORE the rate-limit call', () => {
    const killIdx = ASK_SOURCE.indexOf('OFF_KEYWORDS.has');
    const rateLimitIdx = ASK_SOURCE.indexOf('getAskLimit()');
    expect(killIdx).toBeGreaterThan(-1);
    expect(rateLimitIdx).toBeGreaterThan(-1);
    expect(killIdx).toBeLessThan(rateLimitIdx);
  });

  it('emits a cold-start log line for ASK_ENABLED at module scope', () => {
    expect(ASK_SOURCE).toMatch(
      /console\.info\(\s*'\[ask\] kill-switch on cold start:'/,
    );
  });
});
```

- [ ] **Step 2.3: Run the new test to verify it FAILS**

```bash
pnpm vitest run __tests__/ask-killswitch.test.ts
```

Expected: all 5 tests FAIL because `app/api/ask/route.ts` doesn't yet contain `OFF_KEYWORDS`, the trim/lowerCase pipeline, the 503 message structure (it has 503 elsewhere but not in the kill-switch shape), the ordering before `getAskLimit()`, or the cold-start log line.

- [ ] **Step 2.4: Add the cold-start log line at module scope**

In `app/api/ask/route.ts`, find the existing module-scope `const anthropic = new Anthropic();` line (around line 9). Immediately AFTER it (still at module scope, before the `SYSTEM` constant), add:

```ts
// Logs once per warm function instance. The value reveals the configured
// state of the kill switch without inspecting the Vercel env-var dashboard.
console.info('[ask] kill-switch on cold start:', process.env.ASK_ENABLED ?? 'unset');
```

- [ ] **Step 2.5: Add the kill-switch check at the top of the `POST` handler**

In `app/api/ask/route.ts`, find the `export async function POST(req: NextRequest) {` line. The current body starts with `const ip = getClientIp(req);`. Insert the kill switch BEFORE that line, so the new top of POST looks like:

```ts
export async function POST(req: NextRequest) {
  // Kill switch: any "off" keyword (case-insensitive, trimmed) disables the route.
  // Asymmetry is intentional: a typo during a billing/abuse emergency must STILL
  // disable the route. The cost of "stays on accidentally" during a cost incident
  // is exactly what this switch exists to prevent.
  const askFlag = (process.env.ASK_ENABLED ?? '').trim().toLowerCase();
  const OFF_KEYWORDS = new Set(['false', '0', 'off', 'no', 'disabled']);
  if (OFF_KEYWORDS.has(askFlag)) {
    return Response.json(
      { error: 'temporarily unavailable — email erikhenriquealvescunha@gmail.com directly' },
      { status: 503 },
    );
  }

  const ip = getClientIp(req);
  // ... existing rate-limit + budget + body parsing + Anthropic call unchanged
```

(Do not delete or modify anything below `const ip = getClientIp(req);`. Only insert the new block.)

- [ ] **Step 2.6: Run the test to verify it PASSES**

```bash
pnpm vitest run __tests__/ask-killswitch.test.ts
```

Expected: all 5 tests PASS.

- [ ] **Step 2.7: Run the full unit suite to confirm no regression**

```bash
pnpm vitest run
```

Expected: 56 passing (54 pre-existing + 2 from this task — wait, this task added 5 it() blocks in 1 file. Re-count: pre-existing 54 + 5 new = 59 passing). No failures.

- [ ] **Step 2.8: Update `.env.example`**

Open `.env.example`. After the existing `PSI_API_KEY=...` block (the last block in the file), append:

```bash
# /api/ask kill switch — emergency stop without redeploy of code.
# Any of these values (case-insensitive, trimmed) disables the route and
# returns 503 with the email-fallback message:
#   false | 0 | off | no | disabled
# Anything else (including unset) keeps /api/ask live. Cold-start log line
# `[ask] kill-switch on cold start: <value>` shows the deployed value.
ASK_ENABLED=true
```

- [ ] **Step 2.9: Append the "Kill switches" subsection to `ARCHITECTURE.md` §6**

Find §6 in `ARCHITECTURE.md` (the `/api/ask` deep dive). At the end of that section (just before the `---` separator that introduces §7), append:

```markdown
### Kill switches

A single env var, `ASK_ENABLED`, gates the route. The check runs first in the POST handler — before rate-limit and budget calls — so a trip costs zero Redis round-trips. The value is normalized with `.trim().toLowerCase()` and matched against the off-keyword set `{ 'false', '0', 'off', 'no', 'disabled' }`. Any match returns 503 with the email-fallback message; any other value (or unset) keeps the route live.

The asymmetry is intentional: this is a kill switch, not a feature flag. During a billing or abuse incident, the operator is reaching for the off lever and may type any plausible off-keyword. False-positive disablement (typing `'no'` when meaning to enable) recovers in 60-90 seconds via env-var edit + redeploy. False-negative non-disablement during a cost emergency — what the alternative "typos default to enabled" semantics would produce — is exactly the failure mode the switch exists to prevent.

A module-scope `console.info('[ask] kill-switch on cold start:', process.env.ASK_ENABLED ?? 'unset')` emits once per warm instance, providing deploy-time proof of the env-var value in Vercel runtime logs without inspecting the dashboard.

History and rationale: see `DECISIONS.md` 2026-05-18.
```

- [ ] **Step 2.10: Append two `DECISIONS.md` bullets**

Open `DECISIONS.md`. Under the existing `## 2026-05-18 — Mobile Lighthouse pass + CSS architecture lock-in` section (the most recent dated heading), append two new bullets:

```markdown
- **2026-05-18** · `/api/ask` kill switch chosen as env-var (`ASK_ENABLED`) rather than Vercel Edge Config or Upstash Redis flag. Rationale: 60-90s redeploy round-trip is acceptable for cost-emergency scenarios; live-toggle infra not justified at single-author scale. _Trivially reversible (env-var edit + redeploy). If abuse patterns ever materialize that require sub-90s response, migrate to Redis flag (read on existing Upstash; +5ms per request)._
- **2026-05-18** · Kill-switch semantics are "off-by-keyword" (case-insensitive trimmed set: `false | 0 | off | no | disabled`) rather than "off-by-strict-literal". Asymmetry rejects the "typos default to enabled" alternative as architecturally wrong for a kill switch — during a cost emergency a typo MUST still disable. False-positive disablement recovers in <90s; false-negative non-disablement is the exact failure mode the switch prevents. _Reversible by editing the OFF_KEYWORDS Set in `app/api/ask/route.ts`._
```

- [ ] **Step 2.11: Run full pre-commit sequence**

```bash
pnpm check && pnpm typecheck && pnpm validate-content && pnpm test
```

Expected: all green.

- [ ] **Step 2.12: Commit**

```bash
git add __tests__/ask-killswitch.test.ts app/api/ask/route.ts .env.example ARCHITECTURE.md DECISIONS.md
git commit -m "$(cat <<'EOF'
feat(ask): ASK_ENABLED kill switch with off-by-keyword semantics

Adds env-var-gated emergency stop to /api/ask. Any of the off-keywords
{ false | 0 | off | no | disabled } (case-insensitive, trimmed) returns
503 with the existing email-fallback message; any other value or unset
keeps the route live.

- app/api/ask/route.ts: OFF_KEYWORDS Set check at top of POST (before
  rate-limit, so trips cost zero Redis round-trips); module-scope
  console.info cold-start log line for deploy-time visibility.
- .env.example: ASK_ENABLED=true documented with off-keyword list.
- ARCHITECTURE.md §6: new "Kill switches" subsection.
- DECISIONS.md: two bullets (env-var-over-Redis-flag + off-by-keyword
  semantics rationale).
- __tests__/ask-killswitch.test.ts: 5 source-grep tests verifying
  shape, env-var normalization, response, ordering before rate-limit,
  and cold-start log.

Implements Fix 3 of spec docs/superpowers/specs/2026-05-18-gates-and-
harness-hardening-design.md.

Reversal: trivial — flip ASK_ENABLED unset/true; remove check block.
EOF
)"
```

Expected: commit succeeds.

---

## Task 3 — Explicit Anthropic + Resend timeouts (Fix 2)

**Files:**
- Create: `__tests__/ask-timeout.test.ts`
- Modify: `app/api/ask/route.ts`
- Modify: `app/api/contact/route.ts`

### Steps

- [ ] **Step 3.1: Write the failing test**

Create `__tests__/ask-timeout.test.ts` with this exact content:

```ts
// __tests__/ask-timeout.test.ts
// Source-grep test: verifies explicit upstream timeouts on Anthropic
// (/api/ask) and Resend (/api/contact). See spec docs/superpowers/
// specs/2026-05-18-gates-and-harness-hardening-design.md §5.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ASK_SOURCE = readFileSync(
  path.resolve(__dirname, '../app/api/ask/route.ts'),
  'utf-8',
);
const CONTACT_SOURCE = readFileSync(
  path.resolve(__dirname, '../app/api/contact/route.ts'),
  'utf-8',
);

describe('upstream timeouts', () => {
  describe('/api/ask Anthropic SDK init', () => {
    it('passes explicit timeout: 30_000 to the Anthropic constructor', () => {
      expect(ASK_SOURCE).toMatch(/new Anthropic\(\s*\{\s*timeout:\s*30_000/);
    });

    it('does NOT set maxRetries: 0 (keeps SDK default of 2 retries)', () => {
      expect(ASK_SOURCE).not.toMatch(/maxRetries:\s*0\b/);
    });
  });

  describe('/api/contact Resend send', () => {
    it('wraps the Resend send in a Promise.race against a 10_000 ms timer', () => {
      expect(CONTACT_SOURCE).toMatch(/Promise\.race/);
      expect(CONTACT_SOURCE).toMatch(/setTimeout\(\s*[^,]+,\s*10_000/);
    });

    it('still preserves the existing graceful-fail logging on error', () => {
      expect(CONTACT_SOURCE).toMatch(/\[contact\] resend unavailable/);
    });
  });
});
```

- [ ] **Step 3.2: Run the new test to verify it FAILS**

```bash
pnpm vitest run __tests__/ask-timeout.test.ts
```

Expected: 4 FAILs — `app/api/ask/route.ts` currently calls `new Anthropic()` with no options, and `app/api/contact/route.ts` calls `getResend().emails.send(...)` directly without a race. The "no maxRetries: 0" assertion passes trivially (the source doesn't contain it).

- [ ] **Step 3.3: Add the Anthropic timeout**

In `app/api/ask/route.ts`, find the module-scope line (around line 9):

```ts
const anthropic = new Anthropic();
```

Replace it with:

```ts
// 30s covers normal Haiku-4.5 streams (typical <10s; max_tokens 512 caps duration).
// Default maxRetries (2) preserved — stream init is idempotent (no SSE events
// before first content_block_delta), so absorbing transient 5xx is safe.
const anthropic = new Anthropic({ timeout: 30_000 });
```

- [ ] **Step 3.4: Add the Resend timeout wrapper**

In `app/api/contact/route.ts`, find the existing block (around lines 56-70):

```ts
  // Delivery second: failure is acceptable if KV write succeeded.
  try {
    const { error } = await getResend().emails.send({
      from: 'onboarding@resend.dev',
      to: 'erikhenriquealvescunha@gmail.com',
      replyTo: email,
      subject: `[portfolio] message from ${name}`,
      text: `From: ${name} <${email}>\nRef: ${msgId}\n\n${message}`,
    });
    if (error) {
      console.error('[contact] resend error (message saved to KV as', msgId, ')', error);
    }
  } catch (sendErr) {
    console.error('[contact] resend unavailable (message saved to KV as', msgId, ')', sendErr);
  }
```

Replace the whole block with:

```ts
  // Delivery second: failure is acceptable if KV write succeeded.
  // 10s timeout via Promise.race — Resend SDK v6 doesn't accept AbortSignal
  // natively. On timeout, the rejected Promise enters the existing catch path
  // and the message remains durably persisted in KV with msgId for recovery.
  try {
    const sendPromise = getResend().emails.send({
      from: 'onboarding@resend.dev',
      to: 'erikhenriquealvescunha@gmail.com',
      replyTo: email,
      subject: `[portfolio] message from ${name}`,
      text: `From: ${name} <${email}>\nRef: ${msgId}\n\n${message}`,
    });
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('resend timeout (10s)')), 10_000),
    );
    const { error } = await Promise.race([sendPromise, timeoutPromise]);
    if (error) {
      console.error('[contact] resend error (message saved to KV as', msgId, ')', error);
    }
  } catch (sendErr) {
    console.error('[contact] resend unavailable (message saved to KV as', msgId, ')', sendErr);
  }
```

- [ ] **Step 3.5: Run the new test to verify it PASSES**

```bash
pnpm vitest run __tests__/ask-timeout.test.ts
```

Expected: all 4 tests PASS.

- [ ] **Step 3.6: Run typecheck to catch any TypeScript regression from the Resend change**

```bash
pnpm typecheck
```

Expected: clean exit. If TS complains about the `Promise.race` return type, the explicit `Promise<never>` annotation on `timeoutPromise` should already handle it; if not, narrow the race result type with `await Promise.race<typeof sendPromise extends Promise<infer R> ? R : never>([...])` or extract the send-result type alias.

- [ ] **Step 3.7: Run the full unit suite to confirm no regression**

```bash
pnpm vitest run
```

Expected: pre-existing 54 + 5 from Task 2 + 4 from this task = 63 passing.

- [ ] **Step 3.8: Run the contact e2e to confirm the timeout wrapper doesn't break the happy path**

```bash
pnpm playwright test tests/e2e
```

Expected: e2e green. The wrapper is transparent on the success path; this confirms it.

- [ ] **Step 3.9: Run full pre-commit sequence**

```bash
pnpm check && pnpm typecheck && pnpm validate-content && pnpm test
```

Expected: all green.

- [ ] **Step 3.10: Commit**

```bash
git add __tests__/ask-timeout.test.ts app/api/ask/route.ts app/api/contact/route.ts
git commit -m "$(cat <<'EOF'
feat(api): explicit Anthropic + Resend client timeouts

- app/api/ask/route.ts: new Anthropic({ timeout: 30_000 }). 30s covers
  typical Haiku-4.5 streams (<10s; max_tokens 512 caps duration). SDK
  default maxRetries (2) preserved — stream init is idempotent (no SSE
  events emitted before first content_block_delta), so absorbing
  transient 5xx is safe and avoids exporting upstream blips to users.
- app/api/contact/route.ts: Resend send wrapped in Promise.race against
  a 10s timer. Resend SDK v6 doesn't accept AbortSignal natively; race
  pattern is the cleanest workaround. Timeout enters the existing
  graceful-fail catch (message remains durably persisted in KV with
  msgId for recovery).
- __tests__/ask-timeout.test.ts: 4 source-grep tests covering Anthropic
  timeout constant, no-maxRetries:0 guarantee, Resend race pattern, and
  preservation of the existing logging.

Implements Fix 2 of spec docs/superpowers/specs/2026-05-18-gates-and-
harness-hardening-design.md.

Reversal: trivial — remove the options object on Anthropic; restore
the original send block on contact.
EOF
)"
```

Expected: commit succeeds.

---

## Task 4 — Mobile LHCI calibration (Fix 1 prep)

**Files:**
- Create: `lighthouserc.mobile.json`
- Modify: `package.json` (add `lhci:mobile` script)
- Modify: `docs/superpowers/plans/2026-05-18-gates-and-harness-hardening.md` (append calibration evidence to this file)
- Modify: `lighthouserc.mobile.json` (after calibration: bake in thresholds if needed)

### Steps

- [ ] **Step 4.1: Create `lighthouserc.mobile.json` with TARGET thresholds**

Create `lighthouserc.mobile.json` with this exact content (mirrors `lighthouserc.json` structure with mobile form-factor emulation + spec §4 targets). NOTE: the original draft of this step used `"preset": "mobile"` which is not a valid Lighthouse 12 setting (LH12 accepts `perf | experimental | desktop` for preset). The correct LH12 way to emulate mobile is `emulatedFormFactor: "mobile"` plus explicit `throttling` constants matching `mobileSlow4G`:

```json
{
  "ci": {
    "collect": {
      "startServerCommand": "pnpm start",
      "startServerReadyPattern": "ready started server",
      "url": ["http://localhost:3000"],
      "numberOfRuns": 3,
      "settings": {
        "emulatedFormFactor": "mobile",
        "throttlingMethod": "simulate",
        "throttling": {
          "rttMs": 150,
          "throughputKbps": 1638.4,
          "cpuSlowdownMultiplier": 4,
          "requestLatencyMs": 562.5,
          "downloadThroughputKbps": 1474.56,
          "uploadThroughputKbps": 675
        }
      }
    },
    "assert": {
      "preset": "lighthouse:no-pwa",
      "assertions": {
        "categories:performance": ["error", { "minScore": 0.95 }],
        "categories:accessibility": ["error", { "minScore": 1.0 }],
        "categories:best-practices": ["error", { "minScore": 0.95 }],
        "categories:seo": ["error", { "minScore": 1.0 }],

        "largest-contentful-paint": ["error", { "maxNumericValue": 1800 }],
        "cumulative-layout-shift": ["error", { "maxNumericValue": 0.05 }],
        "total-blocking-time": ["error", { "maxNumericValue": 400 }],
        "interactive": ["error", { "maxNumericValue": 3500 }],

        "uses-text-compression": "error",
        "uses-responsive-images": "error",
        "uses-rel-preconnect": "off",
        "render-blocking-resources": "error",
        "font-display": "error",

        "color-contrast": "error",
        "aria-required-attr": "error",
        "label": "error",
        "heading-order": "error",
        "html-has-lang": "error",

        "is-crawlable": "error",
        "robots-txt": "error",
        "structured-data": "off",

        "tap-targets": "off",
        "network-dependency-tree-insight": "off",
        "render-blocking-insight": "off",
        "unused-javascript": "off",
        "dom-size": "off"
      }
    },
    "upload": {
      "target": "temporary-public-storage"
    }
  }
}
```

Differences from `lighthouserc.json` (intentional, per spec §4):
- `emulatedFormFactor: "mobile"` + explicit `mobileSlow4G` throttling constants (replaces the desktop preset's near-no-throttle defaults)
- `total-blocking-time` maxNumericValue: `400` (was 200)
- `interactive` maxNumericValue: `3500` (was 2500)
- `render-blocking-resources`: `"error"` (was `"warn"`)
- `tap-targets`: `"off"` (the audit was removed in LH12; left in the assertions list explicitly turned off so future readers see the deliberate suppression)
- Four `"off"` overrides for LH12's `lighthouse:no-pwa` preset noise audits (`network-dependency-tree-insight`, `render-blocking-insight`, `unused-javascript`, `dom-size`) — these are LH12-introduced insight-style audits that are out of scope for spec §4 assertions
- All other thresholds identical to desktop config

- [ ] **Step 4.2: Add `lhci:mobile` script to `package.json`**

Open `package.json`. Find the existing `"lhci": "lhci autorun"` line in the `scripts` block. Add a sibling line directly after it:

```json
"lhci:mobile": "lhci autorun --config=lighthouserc.mobile.json",
```

(Watch for trailing comma — the line must end with `,` if any scripts follow it.)

- [ ] **Step 4.3: Verify JSON validity of package.json**

```bash
node -e "JSON.parse(require('fs').readFileSync('package.json', 'utf8'))" && echo "valid JSON"
```

Expected: `valid JSON`.

- [ ] **Step 4.4: Build, then run the mobile LHCI locally — first calibration pass**

```bash
pnpm build
pnpm lhci:mobile
```

Expected: command runs (may take 60-120s for 3 LHCI runs). End-of-run output prints a table with median values for each metric.

- [ ] **Step 4.5: Capture observed p50 metrics**

From the LHCI output, find the median values for:
- `largest-contentful-paint` (ms)
- `total-blocking-time` (ms)
- `interactive` (ms)
- `cumulative-layout-shift`
- `categories:performance` (0-1 score)

Compute `observed_p50 × 1.2` for each numeric metric.

- [ ] **Step 4.6: Append calibration evidence to this plan file**

Open `docs/superpowers/plans/2026-05-18-gates-and-harness-hardening.md` (this file). Find the placeholder section "## Calibration evidence" near the end (if it doesn't exist, append it at the bottom under `## Calibration evidence`). Fill in:

```markdown
## Calibration evidence

Captured: <YYYY-MM-DD HH:MM local>
Local machine: <e.g. macOS arm64, Node 22.x, pnpm 10.x>

| Metric | Target (spec §4) | Observed p50 | p50 × 1.2 | Final threshold | Decision |
|---|---|---|---|---|---|
| `largest-contentful-paint` | < 1800 | <N>ms | <N>ms | <N>ms | KEEP_TARGET / LOOSEN / FIX_PERF |
| `total-blocking-time` | < 400 | <N>ms | <N>ms | <N>ms | KEEP_TARGET / LOOSEN / FIX_PERF |
| `interactive` | < 3500 | <N>ms | <N>ms | <N>ms | KEEP_TARGET / LOOSEN / FIX_PERF |
| `cumulative-layout-shift` | < 0.05 | <N> | <N> | <N> | KEEP_TARGET / LOOSEN / FIX_PERF |
| `categories:performance` | ≥ 0.95 | <N> | n/a | ≥ <N> | KEEP_TARGET / LOOSEN / FIX_PERF |

Decision rules per spec §11 step 4:
- **KEEP_TARGET** if `observed_p50 × 1.2 ≤ target` (site already meets target with headroom)
- **LOOSEN** if not meeting target but `observed_p50 × 1.2` is acceptable for this PR
- **FIX_PERF** if observed misses are large enough that the proper response is a follow-up perf PR before this gate ships

Notes: <any observed flake, cold-start effects, surprising results>
```

- [ ] **Step 4.7: Decision branch — KEEP_TARGET / LOOSEN / FIX_PERF**

If ALL rows decide `KEEP_TARGET`: proceed to Step 4.8. `lighthouserc.mobile.json` is correct as-is.

If ANY row decides `LOOSEN`: edit `lighthouserc.mobile.json` to replace the affected threshold(s) with `observed_p50 × 1.2` (rounded UP to next 50ms for ms-based metrics; up to next 0.01 for CLS; up to next 0.01 for performance score). Re-run `pnpm lhci:mobile` once more to confirm the new threshold passes.

If ANY row decides `FIX_PERF`: STOP this task. Do NOT commit. Open a follow-up perf PR to fix the underlying issue, merge it, then re-run from Step 4.4. The gate must NEVER ship at known-failing thresholds (CLAUDE.md hard rule + spec §4).

- [ ] **Step 4.8: Run full pre-commit sequence**

```bash
pnpm check && pnpm typecheck && pnpm validate-content && pnpm test
```

Expected: all green.

- [ ] **Step 4.9: Commit**

```bash
git add lighthouserc.mobile.json package.json docs/superpowers/plans/2026-05-18-gates-and-harness-hardening.md
git commit -m "$(cat <<'EOF'
feat(ci): mobile LHCI config + lhci:mobile script + calibration evidence

Adds lighthouserc.mobile.json with mobile preset and spec §4 thresholds
(performance ≥0.95, LCP <1800, CLS <0.05, TBT <400, TTI <3500,
render-blocking-resources promoted to error). Adds lhci:mobile script
in package.json. Appends 3-run calibration evidence against current main
to docs/superpowers/plans/2026-05-18-gates-and-harness-hardening.md
per spec §11 step 4 (calibration step).

Implements Fix 1 PREP (calibration) of spec docs/superpowers/specs/
2026-05-18-gates-and-harness-hardening-design.md. Workflow change
(adding the lhci-mobile job to ci.yml) lands separately as Task 5.

Reversal: trivial — delete lighthouserc.mobile.json + remove the script.
EOF
)"
```

Expected: commit succeeds.

---

## Task 5 — Mobile LHCI workflow change (Fix 1 ship)

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `package.json` (make existing `lhci` script explicit)

### Steps

- [ ] **Step 5.1: Update the `lhci` script in `package.json` to be explicit**

In `package.json`, find the line `"lhci": "lhci autorun",` and change it to:

```json
"lhci": "lhci autorun --config=lighthouserc.json",
```

(Adds `--config=lighthouserc.json` so the desktop script is symmetric with the mobile script added in Task 4.)

- [ ] **Step 5.2: Add the `lhci-mobile` parallel job to `ci.yml`**

In `.github/workflows/ci.yml`, the current file ends with the `e2e` job (which has `needs: build-and-gate`). Add a new job `lhci-mobile` between `build-and-gate` and `e2e` (or at the end — order in YAML doesn't affect execution; jobs run in parallel unless `needs:` says otherwise). The new job has NO `needs:` clause, so it runs in parallel with `build-and-gate`.

Append this block to `.github/workflows/ci.yml` (at the same indentation level as the other `jobs:` children):

```yaml
  lhci-mobile:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: pnpm/action-setup@v4
        with:
          version: 10
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - name: Install
        run: pnpm install --frozen-lockfile
      - name: Build
        run: pnpm build
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY_BUILD }}
          UPSTASH_REDIS_REST_URL: ${{ secrets.UPSTASH_REDIS_REST_URL_BUILD }}
          UPSTASH_REDIS_REST_TOKEN: ${{ secrets.UPSTASH_REDIS_REST_TOKEN_BUILD }}
          RESEND_API_KEY: ${{ secrets.RESEND_API_KEY_BUILD }}
          IP_HASH_SALT: ci-build-salt
      - name: Start preview server
        run: pnpm start &
        env:
          PORT: 3000
      - name: Wait for server
        run: npx wait-on http://localhost:3000 --timeout 30000
      - name: Lighthouse CI (mobile)
        run: pnpm lhci:mobile
        env:
          LHCI_BUILD_CONTEXT__EXTERNAL_BUILD_URL: ${{ github.event.pull_request.html_url || github.event.head_commit.url }}
```

- [ ] **Step 5.3: Verify YAML validity**

```bash
python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/ci.yml')); print('valid YAML')"
```

Expected: `valid YAML`. (If `python3` isn't available, install it or use any YAML linter — invalid YAML will silently break CI.)

- [ ] **Step 5.4: Verify the `lhci` script still works locally with the explicit config**

```bash
pnpm build
pnpm lhci
```

Expected: succeeds against `lighthouserc.json` (desktop).

- [ ] **Step 5.5: Run full pre-commit sequence**

```bash
pnpm check && pnpm typecheck && pnpm validate-content && pnpm test
```

Expected: all green.

- [ ] **Step 5.6: Commit**

```bash
git add .github/workflows/ci.yml package.json
git commit -m "$(cat <<'EOF'
ci(gates): add lhci-mobile parallel job, make desktop config explicit

- .github/workflows/ci.yml: new lhci-mobile job, parallel to
  build-and-gate (no needs: clause). Runs against
  lighthouserc.mobile.json with thresholds calibrated in the prior
  commit. render-blocking-resources promoted to error on mobile (the
  exact finding that triggered today's perf pass).
- package.json: lhci script now explicit (--config=lighthouserc.json)
  for symmetry with lhci:mobile added in the prior commit.

Implements Fix 1 SHIP of spec docs/superpowers/specs/2026-05-18-gates-
and-harness-hardening-design.md. Calibration evidence is in
docs/superpowers/plans/2026-05-18-gates-and-harness-hardening.md.

Closes the audit-identified hole where lighthouserc.json ran the
desktop preset only and mobile regressions slipped through (per the
2026-05-18 8-pillar production-harness audit).

Reversal: trivial — delete the lhci-mobile job block; revert the
explicit --config addition on the lhci script.
EOF
)"
```

Expected: commit succeeds.

- [ ] **Step 5.7: Push and verify CI runs the new mobile job**

```bash
git push origin main
```

Expected: GitHub Actions runs three jobs: `build-and-gate`, `lhci-mobile`, `e2e`. All three should be green. If `lhci-mobile` fails, refer back to the Task 4 calibration evidence — was a threshold set tighter than `observed_p50 × 1.2`? Loosen and re-commit (the calibration step is supposed to prevent this, but real CI environments can vary from local).

---

## Post-merge ops checklist (NOT success criteria — one-time human action)

After all five tasks merge to main:

1. Open Vercel dashboard → Project → Settings → Environment Variables.
2. Add `ASK_ENABLED=true` to Production, Preview, and Development environments. (Adding it explicitly — even though unset already defaults to enabled — makes flipping to `false` a known, reversible action rather than "did anyone configure this?".)
3. Trigger a redeploy (push a no-op commit, or click "Redeploy" on the latest deployment in Vercel UI).
4. Tail the Vercel runtime logs after the redeploy and confirm the cold-start log line appears on the first `/api/ask` request:
   ```
   [ask] kill-switch on cold start: true
   ```
5. Validate the kill switch end-to-end: flip `ASK_ENABLED=false` in Vercel env, redeploy, verify `/api/ask` returns 503, then flip back to `true`, redeploy, verify normal operation.

This checklist is intentionally OUTSIDE the spec's success criteria (which are code-property assertions). It's an operator action that depends on environment access not present in CI.

---

## Calibration evidence

> **STATUS: PRE-PERF-FIX SNAPSHOT (2026-05-18).** Calibration triggered the FIX_PERF branch per spec §11 step 4 — observed mobile LCP is 3071ms vs the 1800ms target (70% over). Task 4 ship and Task 5 (workflow change) are **paused** pending a separate perf-fix PR addressing render-blocking CSS + JetBrains Mono font load on Slow 4G + Hero RSC conversion. When the perf work lands, re-run from Step 4.4 against the new baseline and replace this section with fresh data. The findings below are kept verbatim because the 3 candidate fixes at the bottom are the input to the perf-fix spec/plan brainstorm.

Captured: 2026-05-18 (local time, Brazil/BRT)
Local machine: macOS arm64, Node 24.14.0, pnpm 10.15.0
LHCI version: @lhci/cli@0.15.1 (Lighthouse 12.6.1 bundled)

Config note: `"preset": "mobile"` is not a valid Lighthouse preset (choices: perf, experimental, desktop).
Mobile simulation uses `emulatedFormFactor: "mobile"` with explicit Slow 4G throttling (rttMs: 150, throughputKbps: 1638.4, cpuSlowdownMultiplier: 4) — matches Lighthouse `mobileSlow4G` constants exactly.

Raw 3-run results:
- Run 1: LCP=3152ms, TBT=331ms, TTI=3246ms, CLS=0.0, Perf=0.85, A11y=1.0, BP=1.0, SEO=1.0
- Run 2: LCP=3071ms, TBT=13ms,  TTI=3071ms, CLS=0.0, Perf=0.93, A11y=1.0, BP=1.0, SEO=1.0
- Run 3: LCP=3071ms, TBT=14ms,  TTI=3071ms, CLS=0.0, Perf=0.93, A11y=1.0, BP=1.0, SEO=1.0

| Metric | Target (spec §4) | Observed p50 | p50 x 1.2 | Final threshold | Decision |
|---|---|---|---|---|---|
| `largest-contentful-paint` | < 1800ms | 3071ms | 3685ms | n/a | FIX_PERF |
| `total-blocking-time` | < 400ms | 14ms | 17ms | < 400ms | KEEP_TARGET |
| `interactive` | < 3500ms | 3071ms | 3685ms | < 3700ms | LOOSEN (if LCP fixed) |
| `cumulative-layout-shift` | < 0.05 | 0.0 | 0.0 | < 0.05 | KEEP_TARGET |
| `categories:performance` | >= 0.95 | 0.93 | n/a | >= 0.93 | LOOSEN (if LCP fixed: score would improve) |

Decision rules per spec §11 step 4:
- **KEEP_TARGET** if `observed_p50 x 1.2 <= target` (site already meets target with headroom)
- **LOOSEN** if `observed_p50 x 1.2 > target` but the gap is small (e.g., observed TBT is 410ms vs 400ms target)
- **FIX_PERF** if the gap is large enough that the right move is to fix the underlying perf issue in a separate PR before this gate ships

**Overall decision: FIX_PERF_REQUIRED**

Root cause of LCP failure:
- LCP element: `p.hero__tagline` (static text, SSR-rendered, visible above fold on mobile)
- FCP: 1718ms, LCP: 3071ms — gap of 1353ms between first content and LCP element paint
- Render-blocking CSS identified: `_next/static/chunks/0z6nds3k0-iey.css` (10KB, 303ms estimated waste)
- Under Slow 4G simulation (1638 Kbps), self-hosted JetBrains Mono font files take longer to download
- Font-display audit passes (score 1.0) — fonts use `swap`, but swap delay still causes FOIT/FOUT gap
- Hero component is `"use client"` — `useBreakpoint` hook runs after hydration, causing a second render that may shift the largest element

Additional Lighthouse 12 preset noise (not in spec §4 assertions; suppressed in updated config):
- `tap-targets`: not a known audit in LH12 (removed; must be turned off explicitly)
- `network-dependency-tree-insight`: new LH12 insight audit, fires on critical request chains; score=0 (fail)
- `render-blocking-insight`: new LH12 insight, 1 item (the CSS chunk above); preset warns
- `unused-javascript`: 2 items (~43KB wasted); preset asserts maxLength: 0 (fails); acceptable given bundle-check gate
- `dom-size`: large DOM warning (score 0.5); the 18-section single-page composition produces a large DOM

Config changes made during calibration (not in original spec Step 4.1 content):
1. Replaced `"preset": "mobile"` with `emulatedFormFactor: "mobile"` + explicit Slow 4G throttling (LH12 rejects "mobile" as a preset)
2. Added explicit `"off"` overrides for: `tap-targets`, `network-dependency-tree-insight`, `render-blocking-insight`, `unused-javascript`, `dom-size` (suppress LH12 preset noise not in spec §4 assertion scope)

Escalation path per spec §11 step 4:
Fix the LCP root cause in a separate perf PR, then re-run from Step 4.4. Candidate fixes:
1. Preload the self-hosted JetBrains Mono woff2 font files (eliminates font load delay from LCP critical path)
2. Inline critical CSS (the render-blocking chunk) or defer it — or investigate if Next.js 15 is chunking CSS suboptimally on this route
3. Convert Hero to RSC with a static fallback so LCP text is paint-ready before hydration; move `useBreakpoint` to a smaller island

Notes: TBT run-to-run flakiness is significant (13ms vs 331ms between runs). Run 1 had a cold-start effect (TBT spike), runs 2-3 were stable. The p50 is 14ms (robust), confirming TBT is not the issue. CLS is 0.0 across all runs (perfect). A11y, BP, and SEO all score 1.0 across all runs (perfect). The performance score of 0.93 is entirely driven by the LCP score (0.76 on run 2/3) since all other metrics score 1.0.

---

## Self-review notes (writing-plans skill)

Cross-checked against the spec on 2026-05-18:

- **Spec coverage:** Every spec section §4-§7 (the four fixes) has its own task. Spec §8 (testing strategy) drives the two new test files in Tasks 2 and 3 — verified the test assertions match the spec's "Test surface" rows. Spec §9 success criteria 1-8 each mapped: (1) covered by Task 5 final push; (2) covered by Steps 2.7 and 3.7; (3) covered by Steps 1.9 + 1.10 + 1.11; (4) covered by Steps 2.5 + 2.4 + 2.8; (5) covered by Steps 1.12 + 2.9 + 2.10; (6) covered by post-merge checklist (operator-side); (7) implicit via existing `pnpm bundle-check` in CI; (8) covered by Step 1.12 + the jq recipe in ARCHITECTURE.md. Spec §11 implementation order followed exactly. Spec §10 risks acknowledged in commit messages and post-merge checklist.

- **Placeholder scan:** None. All file paths concrete, all code shown in full, all expected outputs explicit. The "Calibration evidence" section has placeholder cells `<N>` which are filled at Task 4 Step 4.6 — this is the spec-mandated calibration step output, not a writing-plans placeholder.

- **Type consistency:** `OFF_KEYWORDS` is the same identifier in Step 2.5 (implementation) and Step 2.2 (test). `ASK_ENABLED` is the only env-var name used across Steps 2.5, 2.8, 2.9, 2.10. `lighthouserc.mobile.json` is the same filename across Tasks 4 and 5. `lhci:mobile` is the same script name across Tasks 4 and 5. No drift detected.

If any reader finds a divergence between this plan and the spec, the spec wins; flag and fix.
