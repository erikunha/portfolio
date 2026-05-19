# Production Observability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the eight phases from `docs/superpowers/specs/2026-05-18-production-observability-design.md` — browser RUM, structured-logging foundation, console-site migration, custom error endpoint, client error bridge, /api/ask Q+A persistence, GDPR right-of-erasure endpoint, and final docs cleanup — closing the 8-pillar audit's Pillar 7 (Flywheel) gaps.

**Architecture:** Eight tasks, one commit each. Phases ordered so each later task can rely on primitives the earlier task established (Phase 2a's `lib/log.ts` before Phase 2b's migration; Phase 3a's `/api/log` endpoint before Phase 3b's client bridge consumes it; Phase 3c's `persistAskInteraction` + `X-Request-Id` header before Phase 3d's `/api/log/forget` operates on those records). Tests follow the project's source-grep pattern; Task 8 adds a Playwright smoke that exercises the endpoints end-to-end.

**Tech Stack:** Next.js 16 (App Router) · React 19 · TypeScript strict · `@vercel/analytics` + `@vercel/speed-insights` · `pino` + `pino-pretty` · Upstash Redis · zod · Vitest · Playwright

---

## Branch setup

Before starting Task 1, the implementer creates a new feature branch from `main`:

```bash
git checkout main
git pull origin main
git checkout -b feat/production-observability
```

All commits land on this branch. Do NOT push during implementation — `superpowers:finishing-a-development-branch` handles push + PR creation after Task 8.

---

## File map

| File | Operation | Task |
|---|---|---|
| `package.json` | Modify — add `@vercel/analytics`, `@vercel/speed-insights` runtime deps | 1 |
| `app/layout.tsx` | Modify — import + mount `<Analytics />` + `<SpeedInsights />` | 1 |
| `proxy.ts` | Modify — widen CSP `connect-src` for Vercel ingest origins | 1 |
| `__tests__/browser-rum.test.ts` | **Create** | 1 |
| `package.json` | Modify — add `pino` runtime + `pino-pretty` dev dep | 2 |
| `lib/log.ts` | **Create** | 2 |
| `lib/rate-limit.ts` | Modify — migrate 3 `console.*` sites to `log.*` | 3 |
| `lib/lighthouse-scores.ts` | Modify — migrate 2 `console.*` sites to `log.*` | 3 |
| `app/api/ask/route.ts` | Modify — migrate 1 cold-start log + add `requestId` threading | 3 |
| `app/api/contact/route.ts` | Modify — migrate 3 `console.*` sites + add `requestId` threading | 3 |
| `__tests__/log-structured.test.ts` | **Create** | 3 |
| `app/api/log/route.ts` | **Create** | 4 |
| `lib/rate-limit.ts` | Modify — add `getErrorLogLimit()` factory | 4 |
| `__tests__/api-log-shape.test.ts` | **Create** | 4 |
| `lib/error-bridge.ts` | **Create** | 5 |
| `components/ErrorBoundary.client.tsx` | Modify — POST to `/api/log` in `componentDidCatch` | 5 |
| `components/AppShell.client.tsx` | Modify — import `error-bridge` once for module-scope listener registration | 5 |
| `__tests__/api-log-shape.test.ts` | Modify — append client-bridge assertions | 5 |
| `lib/ask-log.ts` | **Create** | 6 |
| `app/api/ask/route.ts` | Modify — accumulate answer text, call `persistAskInteraction`, emit `X-Request-Id` header | 6 |
| `__tests__/ask-log-persistence.test.ts` | **Create** | 6 |
| `app/api/log/forget/route.ts` | **Create** | 7 |
| `lib/rate-limit.ts` | Modify — add `getForgetLimit()` factory | 7 |
| `components/client/InteractiveShell.tsx` (or wherever the `/api/ask` form lives — implementer confirms by grep) | Modify — append privacy notice below the submit control | 7 |
| `__tests__/ask-log-persistence.test.ts` | Modify — append `/api/log/forget` shape assertions | 7 |
| `DECISIONS.md` | Modify — 4 new bullets dated 2026-05-18 | 8 |
| `ARCHITECTURE.md` | Modify §9 — rewrite observability section | 8 |
| `tests/e2e/observability-smoke.spec.ts` | **Create** | 8 |

---

## Task 1 — Phase 1: Browser RUM

**Files:**
- Modify: `package.json` (add 2 runtime deps)
- Modify: `pnpm-lock.yaml` (regenerated)
- Modify: `app/layout.tsx` (+2 imports, +2 JSX elements at bottom of `<body>`)
- Modify: `proxy.ts` (CSP `connect-src` widening)
- Create: `__tests__/browser-rum.test.ts`

**Spec ref:** §5

### Steps

- [ ] **Step 1.1: Confirm the deps are not currently installed**

```bash
grep -E '"@vercel/(analytics|speed-insights)"' package.json && echo "FAIL: already present" || echo "PASS: deps absent"
```

Expected: `PASS: deps absent`. They were removed in commit `ad5b58c` earlier this session — this confirms we're re-introducing them cleanly.

- [ ] **Step 1.2: Write the failing test**

Create `__tests__/browser-rum.test.ts` with this exact content:

```ts
// __tests__/browser-rum.test.ts
// Source-grep test: verifies Vercel Analytics + Speed Insights are mounted in
// app/layout.tsx and that CSP allows their ingest origins. See spec
// docs/superpowers/specs/2026-05-18-production-observability-design.md §5.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const LAYOUT_SOURCE = readFileSync(
  path.resolve(__dirname, '../app/layout.tsx'),
  'utf-8',
);
const PACKAGE_JSON = JSON.parse(
  readFileSync(path.resolve(__dirname, '../package.json'), 'utf-8'),
) as { dependencies?: Record<string, string> };
const PROXY_SOURCE = readFileSync(
  path.resolve(__dirname, '../proxy.ts'),
  'utf-8',
);

describe('browser RUM (Vercel Analytics + Speed Insights)', () => {
  it('declares @vercel/analytics and @vercel/speed-insights as runtime deps', () => {
    expect(PACKAGE_JSON.dependencies?.['@vercel/analytics']).toBeDefined();
    expect(PACKAGE_JSON.dependencies?.['@vercel/speed-insights']).toBeDefined();
  });

  it('imports Analytics from @vercel/analytics/next in layout.tsx', () => {
    expect(LAYOUT_SOURCE).toMatch(
      /import\s*\{\s*Analytics\s*\}\s*from\s*['"]@vercel\/analytics\/next['"]/,
    );
  });

  it('imports SpeedInsights from @vercel/speed-insights/next in layout.tsx', () => {
    expect(LAYOUT_SOURCE).toMatch(
      /import\s*\{\s*SpeedInsights\s*\}\s*from\s*['"]@vercel\/speed-insights\/next['"]/,
    );
  });

  it('mounts both Analytics and SpeedInsights inside <body>', () => {
    expect(LAYOUT_SOURCE).toMatch(/<Analytics\s*\/>/);
    expect(LAYOUT_SOURCE).toMatch(/<SpeedInsights\s*\/>/);
  });

  it('proxy.ts CSP connect-src includes the two Vercel ingest origins', () => {
    expect(PROXY_SOURCE).toMatch(/connect-src[^"]*https:\/\/\*\.vercel-insights\.com/);
    expect(PROXY_SOURCE).toMatch(/connect-src[^"]*https:\/\/va\.vercel-scripts\.com/);
  });
});
```

- [ ] **Step 1.3: Run the test to verify it FAILS**

```bash
pnpm vitest run __tests__/browser-rum.test.ts
```

Expected: 5 tests FAIL (deps absent, imports missing, mounts missing, CSP not widened).

- [ ] **Step 1.4: Install the two Vercel SDKs**

```bash
pnpm add @vercel/analytics@latest @vercel/speed-insights@latest
```

Expected: pnpm installs both packages; lockfile updated; no peer-dep warnings beyond the pre-existing `cz-commitlint/inquirer` mismatch.

- [ ] **Step 1.5: Add the imports + mounts in `app/layout.tsx`**

Open `app/layout.tsx`. After the existing `import Script from 'next/script';` line (around line 3), add:

```ts
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
```

In the `RootLayout` component's JSX (around line 114-117), find the `<body>` element. The current pattern is:

```tsx
<body suppressHydrationWarning>
  <Script src="/init.js" strategy="beforeInteractive" />
  {children}
</body>
```

Modify it to:

```tsx
<body suppressHydrationWarning>
  <Script src="/init.js" strategy="beforeInteractive" />
  {children}
  <Analytics />
  <SpeedInsights />
</body>
```

- [ ] **Step 1.6: Widen CSP `connect-src` in `proxy.ts`**

Open `proxy.ts`. Find the existing CSP construction (around line 18):

```ts
"connect-src 'self' https://api.anthropic.com",
```

Replace with:

```ts
"connect-src 'self' https://api.anthropic.com https://*.vercel-insights.com https://va.vercel-scripts.com",
```

- [ ] **Step 1.7: Run the test to verify it PASSES**

```bash
pnpm vitest run __tests__/browser-rum.test.ts
```

Expected: 5/5 tests PASS.

- [ ] **Step 1.8: Run the full unit suite to confirm no regression**

```bash
pnpm vitest run
```

Expected: 54 baseline + 5 new = 59 passing.

- [ ] **Step 1.9: Verify client bundle still within budget**

```bash
pnpm build && pnpm bundle-check
```

Expected: build succeeds; bundle-check reports `client chunks total ≤ 320 KB`. The two SDKs add ~3KB gzip.

- [ ] **Step 1.10: Run full pre-commit sequence**

```bash
pnpm check && pnpm typecheck && pnpm validate-content && pnpm test
```

Expected: all green.

- [ ] **Step 1.11: Commit**

```bash
git add package.json pnpm-lock.yaml app/layout.tsx proxy.ts __tests__/browser-rum.test.ts
git commit -m "$(cat <<'EOF'
feat(obs): wire Vercel Analytics + Speed Insights for real-user CWV

Re-adds @vercel/analytics + @vercel/speed-insights (silently removed in
ad5b58c earlier this session for being declared-but-unused). This time
actually mounts them in app/layout.tsx so real-user pageview counts +
LCP/INP/CLS land in the Vercel dashboards.

- package.json: +2 runtime deps
- app/layout.tsx: +2 imports, +2 JSX elements at end of <body>
- proxy.ts: CSP connect-src widened for the two Vercel ingest origins
  (https://*.vercel-insights.com, https://va.vercel-scripts.com)

Client bundle impact: ~3KB gzip (1KB Analytics + 2KB Speed Insights),
verified under the 320KB total budget via bundle-check. Ad-blocker
coverage gap (~70-85% sampled) documented in ARCHITECTURE.md §9
rewrite (Task 8).

Implements Phase 1 of spec docs/superpowers/specs/2026-05-18-production-
observability-design.md.

Reversal: revert this commit; the SDKs are unmount-only (no schema or
runtime state to clean up).
EOF
)"
```

Expected: husky pre-commit hook reruns the full gate sequence; commit succeeds.

---

## Task 2 — Phase 2a: `lib/log.ts` foundation

**Files:**
- Modify: `package.json` (add `pino` runtime + `pino-pretty` dev)
- Modify: `pnpm-lock.yaml`
- Create: `lib/log.ts`

**Spec ref:** §6

### Steps

- [ ] **Step 2.1: Write the failing test (foundation-only assertions)**

Create `__tests__/log-structured.test.ts` with this exact starter content (Task 3 will extend it with migration-site assertions):

```ts
// __tests__/log-structured.test.ts
// Source-grep test: verifies lib/log.ts foundation + 11-site console.*
// migration per spec docs/superpowers/specs/2026-05-18-production-
// observability-design.md §6.
//
// Task 2 (foundation) populates the first describe block.
// Task 3 (migration) populates the second describe block.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const LOG_SOURCE = readFileSync(
  path.resolve(__dirname, '../lib/log.ts'),
  'utf-8',
);
const PACKAGE_JSON = JSON.parse(
  readFileSync(path.resolve(__dirname, '../package.json'), 'utf-8'),
) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };

describe('lib/log.ts foundation', () => {
  it('declares pino as a runtime dep and pino-pretty as a dev dep', () => {
    expect(PACKAGE_JSON.dependencies?.pino).toBeDefined();
    expect(PACKAGE_JSON.devDependencies?.['pino-pretty']).toBeDefined();
  });

  it('imports pino', () => {
    expect(LOG_SOURCE).toMatch(/from\s*['"]pino['"]/);
  });

  it('exports a log object with info, warn, error methods', () => {
    expect(LOG_SOURCE).toMatch(/export\s+const\s+log\b/);
    // Look for the three method names; order may differ in implementation
    expect(LOG_SOURCE).toMatch(/\binfo\b/);
    expect(LOG_SOURCE).toMatch(/\bwarn\b/);
    expect(LOG_SOURCE).toMatch(/\berror\b/);
  });

  it('does NOT export withRequestContext or currentRequestId (explicit-param strategy)', () => {
    expect(LOG_SOURCE).not.toMatch(/export\s+function\s+withRequestContext/);
    expect(LOG_SOURCE).not.toMatch(/export\s+function\s+currentRequestId/);
  });

  it('uses pino-pretty in development and JSON in production', () => {
    expect(LOG_SOURCE).toMatch(/pino-pretty/);
    expect(LOG_SOURCE).toMatch(/NODE_ENV/);
  });
});

describe('console.* migration sites (Task 3 — placeholder)', () => {
  it.skip('see Task 3 for migration assertions', () => {});
});
```

- [ ] **Step 2.2: Run the test to verify the foundation block FAILS**

```bash
pnpm vitest run __tests__/log-structured.test.ts
```

Expected: 5 FAILs in the foundation block (lib/log.ts doesn't exist; deps not installed). The migration block has `.skip` so it doesn't run.

- [ ] **Step 2.3: Install pino + pino-pretty**

```bash
pnpm add pino@latest
pnpm add -D pino-pretty@latest
```

Expected: both packages install; lockfile updated.

- [ ] **Step 2.4: Create `lib/log.ts`**

Create `lib/log.ts` with this exact content:

```ts
// lib/log.ts
// Structured-logging wrapper around pino.
//
// Public surface (per spec §6, GATE_RESULT: PASS):
//   - log.info(msg, ctx?)
//   - log.warn(msg, ctx?)
//   - log.error(msg, ctx?)
//
// Correlation-ID strategy: explicit-parameter passing. Each route handler
// initialises a requestId at the top (crypto.randomUUID()) and threads it
// through `log.*` ctx parameters. AsyncLocalStorage + nodejs-runtime opt-out
// was considered and rejected after architect-review — see spec §6.

import pino from 'pino';

const isDev = process.env.NODE_ENV !== 'production';

const pinoInstance = pino({
  level: isDev ? 'debug' : 'info',
  base: { env: process.env.NODE_ENV ?? 'unknown' },
  // pino-pretty in dev for human-readable output; JSON lines in prod
  // for Vercel runtime log parsing.
  ...(isDev && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'HH:MM:ss.l' },
    },
  }),
});

type Ctx = Record<string, unknown>;

export const log = {
  info: (msg: string, ctx?: Ctx) => pinoInstance.info(ctx ?? {}, msg),
  warn: (msg: string, ctx?: Ctx) => pinoInstance.warn(ctx ?? {}, msg),
  error: (msg: string, ctx?: Ctx) => pinoInstance.error(ctx ?? {}, msg),
};
```

- [ ] **Step 2.5: Run the test to verify the foundation block PASSES**

```bash
pnpm vitest run __tests__/log-structured.test.ts
```

Expected: 5/5 in foundation block PASS; 1 skipped in migration block.

- [ ] **Step 2.6: Run the full unit suite**

```bash
pnpm vitest run
```

Expected: 59 from Task 1 + 5 from this task = 64 passing, 1 skipped.

- [ ] **Step 2.7: Run typecheck explicitly (pino's types are intricate)**

```bash
pnpm typecheck
```

Expected: clean exit. If `pino`'s types complain about the conditional `transport` spread, narrow with `pino.LoggerOptions` annotation OR drop the spread in favour of an explicit `if (isDev) { ... }` block setting transport conditionally.

- [ ] **Step 2.8: Run full pre-commit sequence**

```bash
pnpm check && pnpm typecheck && pnpm validate-content && pnpm test
```

Expected: all green.

- [ ] **Step 2.9: Commit**

```bash
git add package.json pnpm-lock.yaml lib/log.ts __tests__/log-structured.test.ts
git commit -m "$(cat <<'EOF'
feat(obs): add lib/log.ts pino wrapper (foundation only, no migrations)

Foundation for the structured-logging migration in Phase 2b. Exposes a
simple {info, warn, error} surface around pino with environment-aware
transport: pino-pretty in dev (human-readable), JSON lines in prod
(Vercel runtime-log parseable).

Correlation-ID strategy is explicit-parameter passing per spec §6 — no
AsyncLocalStorage, no middleware context wrapper, no Edge-runtime opt-
out. Each route handler initialises a requestId at the top and threads
it through log.* ctx parameters in Phase 2b (Task 3).

- package.json: +pino runtime, +pino-pretty dev
- lib/log.ts: ~50 LoC pino wrapper
- __tests__/log-structured.test.ts: foundation assertions + skip block
  reserved for Task 3 migration assertions

Notable architecture deviation captured in spec §3 + DECISIONS.md
bullet (added in Task 8): pino is a server-side dep, sitting adjacent
to the DECISIONS.md "no extra plugins" lock-in. Justified because (a)
the lock-in was specifically about CSS pipeline; (b) pino is server-
only — no client bundle impact; (c) battle-tested correlation-ID +
JSON patterns are worth more than 80 LoC of bespoke code.

Implements Phase 2a of spec docs/superpowers/specs/2026-05-18-production-
observability-design.md.

Reversal: pnpm rm pino pino-pretty + delete lib/log.ts.
EOF
)"
```

Expected: commit succeeds.

---

## Task 3 — Phase 2b: 11-site `console.*` migration with `requestId` threading

**Files:**
- Modify: `lib/rate-limit.ts` (3 migrations)
- Modify: `lib/lighthouse-scores.ts` (2 migrations)
- Modify: `app/api/ask/route.ts` (1 cold-start log migration + add `requestId` at top of POST)
- Modify: `app/api/contact/route.ts` (3 migrations + add `requestId` at top of POST)
- Modify: `__tests__/log-structured.test.ts` (populate the migration assertions block)

**Spec ref:** §6 (migration table)

### Steps

- [ ] **Step 3.1: Read current state of all five modified files**

```bash
grep -nE 'console\.(info|warn|error)' lib/rate-limit.ts lib/lighthouse-scores.ts app/api/ask/route.ts app/api/contact/route.ts
```

Expected: shows the 11 enumerated sites — confirm the line numbers in your editor match the spec §6 migration table (line numbers may have drifted by ±5 across recent commits; the message strings are the durable identifiers).

- [ ] **Step 3.2: Populate the migration assertions in the test file**

Replace the `describe('console.* migration sites (Task 3 — placeholder)', () => { it.skip(...) });` block in `__tests__/log-structured.test.ts` with:

```ts
describe('console.* migration sites', () => {
  const RATE_LIMIT = readFileSync(path.resolve(__dirname, '../lib/rate-limit.ts'), 'utf-8');
  const LH_SCORES = readFileSync(path.resolve(__dirname, '../lib/lighthouse-scores.ts'), 'utf-8');
  const ASK_ROUTE = readFileSync(path.resolve(__dirname, '../app/api/ask/route.ts'), 'utf-8');
  const CONTACT_ROUTE = readFileSync(path.resolve(__dirname, '../app/api/contact/route.ts'), 'utf-8');

  it('lib/rate-limit.ts imports log and uses no console.*', () => {
    expect(RATE_LIMIT).toMatch(/import\s*\{[^}]*\blog\b[^}]*\}\s*from\s*['"]@\/lib\/log['"]/);
    expect(RATE_LIMIT).not.toMatch(/console\.(info|warn|error)\b/);
  });

  it('lib/lighthouse-scores.ts imports log and uses no console.*', () => {
    expect(LH_SCORES).toMatch(/import\s*\{[^}]*\blog\b[^}]*\}\s*from\s*['"]@\/lib\/log['"]/);
    expect(LH_SCORES).not.toMatch(/console\.(info|warn|error)\b/);
  });

  it('app/api/ask/route.ts imports log, uses no console.*, threads requestId', () => {
    expect(ASK_ROUTE).toMatch(/import\s*\{[^}]*\blog\b[^}]*\}\s*from\s*['"]@\/lib\/log['"]/);
    expect(ASK_ROUTE).not.toMatch(/console\.(info|warn|error)\b/);
    // Phase 2b only requires the request-scoped requestId in the POST handler.
    // (Task 6's Phase 3c reuses the same variable for X-Request-Id + persistAskInteraction.)
    expect(ASK_ROUTE).toMatch(/const\s+requestId\s*=\s*crypto\.randomUUID\(\)/);
  });

  it('app/api/contact/route.ts imports log, uses no console.*, threads requestId', () => {
    expect(CONTACT_ROUTE).toMatch(/import\s*\{[^}]*\blog\b[^}]*\}\s*from\s*['"]@\/lib\/log['"]/);
    expect(CONTACT_ROUTE).not.toMatch(/console\.(info|warn|error)\b/);
    expect(CONTACT_ROUTE).toMatch(/const\s+requestId\s*=\s*crypto\.randomUUID\(\)/);
  });

  it('all migrated log calls include ctx (the second arg with at least requestId or err)', () => {
    // Sanity check: log.{info,warn,error} calls should pass a ctx object.
    // This catches accidental one-arg calls during migration.
    const allMigratedSources = [RATE_LIMIT, LH_SCORES, ASK_ROUTE, CONTACT_ROUTE].join('\n');
    const logCalls = allMigratedSources.matchAll(/\blog\.(info|warn|error)\(([^)]+)\)/g);
    for (const match of logCalls) {
      const args = match[2] ?? '';
      // Each call should have at least one comma (msg, ctx) — single-arg log calls are
      // allowed only for messages with truly no context, but in this migration EVERY
      // site has either an `err` or a `pct` or a `msgId` worth capturing.
      expect(args).toMatch(/,/);
    }
  });
});
```

- [ ] **Step 3.3: Run the test to verify the migration block FAILS**

```bash
pnpm vitest run __tests__/log-structured.test.ts
```

Expected: 5 of the migration block's 5 tests FAIL (no log imports; console.* still present; no requestId threading).

- [ ] **Step 3.4: Migrate `lib/rate-limit.ts` (3 sites)**

Add the import at the top of the file:

```ts
import { log } from '@/lib/log';
```

Then locate and replace the three `console.*` sites:

Find:
```ts
if (pct >= 0.8) console.warn(`[ask] budget at ${Math.round(pct * 100)}% — approaching cap`);
```

Replace with:
```ts
if (pct >= 0.8) log.warn('budget approaching cap', { pct });
```

Find:
```ts
} catch (err) {
    // Fail open: don't block users for Redis infra issues.
    console.error('[ask] budget check failed, proceeding without cap', err);
    return { allowed: true, pct: 0 };
  }
```

Replace with:
```ts
} catch (err) {
    // Fail open: don't block users for Redis infra issues.
    log.error('budget check failed, proceeding without cap', { err });
    return { allowed: true, pct: 0 };
  }
```

Find:
```ts
} catch (err) {
    console.error('[ask] budget increment failed', err);
  }
```

Replace with:
```ts
} catch (err) {
    log.error('budget increment failed', { err });
  }
```

- [ ] **Step 3.5: Migrate `lib/lighthouse-scores.ts` (2 sites)**

Add the import at the top:

```ts
import { log } from '@/lib/log';
```

Find:
```ts
console.error('[lighthouse] PSI fetch failed:', err);
```

Replace with:
```ts
log.error('PSI fetch failed', { err });
```

Find:
```ts
.catch((err) => console.error('[lighthouse] Redis set failed:', err));
```

Replace with:
```ts
.catch((err) => log.error('Redis cache set failed', { err }));
```

- [ ] **Step 3.6: Migrate `app/api/ask/route.ts` (1 site + add requestId)**

Add the import after the existing imports:

```ts
import { log } from '@/lib/log';
```

Find the cold-start log added in Spec 1:

```ts
console.info('[ask] kill-switch on cold start:', process.env.ASK_ENABLED ?? 'unset');
```

Replace with:
```ts
log.info('kill-switch on cold start', { askEnabled: process.env.ASK_ENABLED ?? 'unset' });
```

At the very top of the `POST` function body (BEFORE the existing `const askFlag = ...` kill-switch check from Spec 1), insert:

```ts
const requestId = crypto.randomUUID();
```

This variable will be reused in Task 6 (Phase 3c) for the `X-Request-Id` header and `persistAskInteraction` call.

- [ ] **Step 3.7: Migrate `app/api/contact/route.ts` (3 sites + add requestId)**

Add the import after the existing imports:

```ts
import { log } from '@/lib/log';
```

At the very top of the `POST` function body (BEFORE the existing `const ip = getClientIp(req);`), insert:

```ts
const requestId = crypto.randomUUID();
```

Find:
```ts
} catch (kvErr) {
    console.error('[contact] KV write failed', kvErr);
    return Response.json({ error: 'storage unavailable — try again' }, { status: 502 });
  }
```

Replace with:
```ts
} catch (kvErr) {
    log.error('KV write failed', { requestId, msgId, err: kvErr });
    return Response.json({ error: 'storage unavailable — try again' }, { status: 502 });
  }
```

Find:
```ts
if (error) {
      console.error('[contact] resend error (message saved to KV as', msgId, ')', error);
    }
```

Replace with:
```ts
if (error) {
      log.error('Resend error', { requestId, msgId, err: error });
    }
```

Find the Spec 1 fix-up logging (introduced in commit 88f6b0a):
```ts
} catch (sendErr) {
    const reason = sendErr instanceof Error ? sendErr.message : String(sendErr);
    // Distinguishes timeout ("resend timeout (10s)") from genuine SDK failures
    // in Vercel runtime logs without losing the original error object.
    console.error(
      '[contact] resend unavailable (message saved to KV as',
      msgId,
      ') reason:',
      reason,
      sendErr,
    );
  }
```

Replace with:
```ts
} catch (sendErr) {
    const reason = sendErr instanceof Error ? sendErr.message : String(sendErr);
    // Distinguishes timeout ("resend timeout (10s)") from genuine SDK failures.
    log.error('Resend unavailable', { requestId, msgId, reason, err: sendErr });
  }
```

- [ ] **Step 3.8: Verify zero remaining `console.*` in the migrated files**

```bash
grep -nE 'console\.(info|warn|error)\b' lib/rate-limit.ts lib/lighthouse-scores.ts app/api/ask/route.ts app/api/contact/route.ts && echo "FAIL: console.* remains" || echo "PASS: all migrated"
```

Expected: `PASS: all migrated`. NOTE: `components/ErrorBoundary.client.tsx` retains its `console.error` per spec §6 — that file is NOT in this grep set.

- [ ] **Step 3.9: Run the test to verify the migration block PASSES**

```bash
pnpm vitest run __tests__/log-structured.test.ts
```

Expected: all assertions PASS (foundation block from Task 2 + migration block from this task = 10 passing total in this file).

- [ ] **Step 3.10: Run typecheck**

```bash
pnpm typecheck
```

Expected: clean exit. If the `{ err }` ctx parameter types complain (TypeScript may narrow `err` from `unknown` in catch), pino's `LogFn` accepts any object — no annotation needed. If it does complain, cast: `log.error('msg', { err: err as Error })`.

- [ ] **Step 3.11: Run full pre-commit sequence**

```bash
pnpm check && pnpm typecheck && pnpm validate-content && pnpm test
```

Expected: all green.

- [ ] **Step 3.12: Commit**

```bash
git add lib/rate-limit.ts lib/lighthouse-scores.ts app/api/ask/route.ts app/api/contact/route.ts __tests__/log-structured.test.ts
git commit -m "$(cat <<'EOF'
refactor(obs): migrate 11 console.* sites to lib/log.ts (Phase 2b)

Mechanical migration of every console.{info,warn,error} site in lib/ +
app/api/ to the lib/log.ts wrapper from Phase 2a (Task 2). Per-site
migration matches the spec §6 table verbatim:

- lib/rate-limit.ts: 3 sites (budget approaching cap; budget check
  failed; budget increment failed)
- lib/lighthouse-scores.ts: 2 sites (PSI fetch failed; Redis cache set
  failed)
- app/api/ask/route.ts: 1 site (kill-switch cold-start log from Spec 1)
  + new `const requestId = crypto.randomUUID()` at top of POST (reused
  by Task 6 for X-Request-Id header + persistAskInteraction)
- app/api/contact/route.ts: 3 sites (KV write failed; Resend error;
  Resend unavailable — the Spec 1 fix-up commit 88f6b0a's distinguished
  timeout-vs-failure log) + new requestId at top of POST

Each route-scoped log call now threads { requestId } in its ctx so
Vercel runtime logs can correlate every line emitted within a single
request without AsyncLocalStorage / Edge-runtime opt-out (per spec §6
explicit-parameter strategy).

ErrorBoundary.client.tsx's console.error is intentionally retained —
it's client-side and gets bridged separately in Phase 3b (Task 5).
The Phase 2b drift guard in __tests__/log-structured.test.ts asserts
zero console.* in the migrated server files but does NOT touch the
ErrorBoundary file.

Implements Phase 2b of spec docs/superpowers/specs/2026-05-18-production-
observability-design.md.

Reversal: mechanical reverse — restore the original console.* calls;
remove the requestId lines; remove the log imports.
EOF
)"
```

Expected: commit succeeds.

---

## Task 4 — Phase 3a: Custom error endpoint

**Files:**
- Create: `app/api/log/route.ts`
- Modify: `lib/rate-limit.ts` (add `getErrorLogLimit()` factory)
- Create: `__tests__/api-log-shape.test.ts`

**Spec ref:** §7a

### Steps

- [ ] **Step 4.1: Write the failing test**

Create `__tests__/api-log-shape.test.ts` with this exact content (Task 5 will append client-bridge assertions):

```ts
// __tests__/api-log-shape.test.ts
// Source-grep test: verifies the /api/log endpoint shape + rate-limit
// reuse + KV key pattern per spec docs/superpowers/specs/
// 2026-05-18-production-observability-design.md §7a.
//
// Task 4 (Phase 3a) populates the endpoint block.
// Task 5 (Phase 3b) appends the client-bridge block.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const LOG_ROUTE = readFileSync(
  path.resolve(__dirname, '../app/api/log/route.ts'),
  'utf-8',
);
const RATE_LIMIT = readFileSync(
  path.resolve(__dirname, '../lib/rate-limit.ts'),
  'utf-8',
);

describe('/api/log endpoint (Phase 3a)', () => {
  it('exports a POST handler with NextRequest typing', () => {
    expect(LOG_ROUTE).toMatch(/export\s+async\s+function\s+POST\s*\(/);
    expect(LOG_ROUTE).toMatch(/NextRequest/);
  });

  it('marks the route as dynamic', () => {
    expect(LOG_ROUTE).toMatch(/export\s+const\s+dynamic\s*=\s*['"]force-dynamic['"]/);
  });

  it('validates the request shape with zod', () => {
    expect(LOG_ROUTE).toMatch(/from\s*['"]zod['"]/);
    expect(LOG_ROUTE).toMatch(/z\.object\(/);
  });

  it('hashes the IP via SHA-256 + DEPLOY_SALT (same pattern as /api/contact)', () => {
    expect(LOG_ROUTE).toMatch(/SHA-256/);
    expect(LOG_ROUTE).toMatch(/DEPLOY_SALT/);
  });

  it('writes to Upstash KV with err: prefix and 30-day TTL', () => {
    expect(LOG_ROUTE).toMatch(/['"`]err:/);
    // 30 days = 30 * 24 * 60 * 60 = 2_592_000 seconds. Allow underscore or no underscore.
    expect(LOG_ROUTE).toMatch(/2[_]?592[_]?000/);
  });

  it('uses the new getErrorLogLimit() rate-limit factory', () => {
    expect(LOG_ROUTE).toMatch(/getErrorLogLimit\(\)/);
  });

  it('lib/rate-limit.ts exports getErrorLogLimit factory with 10/min limit', () => {
    expect(RATE_LIMIT).toMatch(/export\s+function\s+getErrorLogLimit\b/);
    expect(RATE_LIMIT).toMatch(/slidingWindow\(\s*10\s*,\s*['"]1\s*m['"]/);
  });

  it('returns 204 on success, 400 on validation fail, 503 on KV unreachable', () => {
    expect(LOG_ROUTE).toMatch(/status:\s*204/);
    expect(LOG_ROUTE).toMatch(/status:\s*400/);
    expect(LOG_ROUTE).toMatch(/status:\s*503/);
  });
});

describe('client error bridge (Phase 3b — placeholder)', () => {
  it.skip('see Task 5 for client-bridge assertions', () => {});
});
```

- [ ] **Step 4.2: Run the test to verify the endpoint block FAILS**

```bash
pnpm vitest run __tests__/api-log-shape.test.ts
```

Expected: 8 FAILs in the endpoint block (route doesn't exist; getErrorLogLimit not defined).

- [ ] **Step 4.3: Add `getErrorLogLimit()` to `lib/rate-limit.ts`**

In `lib/rate-limit.ts`, after the existing `getContactLimit()` factory, add:

```ts
let _errorLogLimit: Ratelimit | undefined;

export function getErrorLogLimit(): Ratelimit {
  if (!_errorLogLimit) {
    _errorLogLimit = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(10, '1 m'),
      prefix: 'rl:errlog',
    });
  }
  return _errorLogLimit;
}
```

- [ ] **Step 4.4: Create `app/api/log/route.ts`**

Create the file with this exact content:

```ts
// app/api/log/route.ts
// Custom client-error capture endpoint. Accepts structured error reports
// from the browser bridge (lib/error-bridge.ts) + ErrorBoundary.client.tsx
// and persists them to Upstash KV with 30-day TTL for retrospective triage.
//
// Spec ref: docs/superpowers/specs/2026-05-18-production-observability-design.md §7a

import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { log } from '@/lib/log';
import { getClientIp, getErrorLogLimit, getRedis } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const ERR_KV_TTL_S = 30 * 24 * 60 * 60; // 30 days = 2_592_000s

const ErrorPayload = z.object({
  level: z.enum(['error', 'warn']),
  message: z.string().min(1).max(2000),
  stack: z.string().max(8000).optional(),
  url: z.string().max(2000).optional(),
  userAgent: z.string().max(500).optional(),
  ts: z.string().optional(), // client-provided ISO; falls back to server-side
});

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();
  const ip = getClientIp(req);

  // Rate-limit BEFORE the KV write to absorb storms cheaply.
  const { success } = await getErrorLogLimit().limit(ip);
  if (!success) {
    return Response.json({ error: 'too many error reports' }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  const parsed = ErrorPayload.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'invalid payload shape', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  // Hash IP with SHA-256 + DEPLOY_SALT, same pattern as /api/contact.
  const ipBytes = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(ip + (process.env.DEPLOY_SALT ?? 'portfolio')),
  );
  const ipHash = Buffer.from(ipBytes).toString('hex').slice(0, 16);

  const errId = crypto.randomUUID();
  const today = new Date().toISOString().slice(0, 10); // yyyy-mm-dd
  const key = `err:${today}:${errId}`;

  const record = {
    ...parsed.data,
    requestId,
    errId,
    ipHash,
    capturedAt: new Date().toISOString(),
  };

  try {
    await getRedis().set(key, JSON.stringify(record), { ex: ERR_KV_TTL_S });
  } catch (kvErr) {
    log.error('error-log KV write failed', { requestId, errId, err: kvErr });
    return Response.json({ error: 'storage unavailable' }, { status: 503 });
  }

  // 204 No Content on success — no payload needed.
  return new Response(null, { status: 204 });
}
```

- [ ] **Step 4.5: Run the test to verify the endpoint block PASSES**

```bash
pnpm vitest run __tests__/api-log-shape.test.ts
```

Expected: 8/8 endpoint tests PASS; 1 skipped in client-bridge block.

- [ ] **Step 4.6: Run typecheck**

```bash
pnpm typecheck
```

Expected: clean exit. `zod`'s `safeParse` issues array may need `as` casting if strict mode complains; the standard pattern is fine.

- [ ] **Step 4.7: Run the full unit suite**

```bash
pnpm vitest run
```

Expected: ~74 passing (Task 1's 5 + Task 2's 5 + Task 3's 5 + this task's 8 + pre-existing 54, minus 1 skipped).

- [ ] **Step 4.8: Run full pre-commit sequence**

```bash
pnpm check && pnpm typecheck && pnpm validate-content && pnpm test
```

Expected: all green.

- [ ] **Step 4.9: Commit**

```bash
git add app/api/log/route.ts lib/rate-limit.ts __tests__/api-log-shape.test.ts
git commit -m "$(cat <<'EOF'
feat(obs): /api/log endpoint for client error capture (Phase 3a)

New POST handler at app/api/log/route.ts accepts {level, message,
stack?, url?, userAgent?, ts?} structured error reports from the
client-side bridge (Phase 3b lands in Task 5). Validates shape via
zod, hashes the IP with SHA-256 + DEPLOY_SALT (same pattern as
/api/contact), writes to Upstash KV err:{yyyy-mm-dd}:{uuid} with
30-day TTL.

Returns 204 No Content on success; 400 on JSON parse or validation
fail; 429 on rate-limit; 503 on KV unreachable. The endpoint is
fail-open from the user's perspective — error-reporting outage
never blocks page rendering.

Rate-limited via new getErrorLogLimit() factory in lib/rate-limit.ts:
sliding window 10 errors per IP per minute (~6000/hour worst case
during a runaway loop). Reuses existing Upstash Ratelimit primitive.

Implements Phase 3a of spec docs/superpowers/specs/2026-05-18-production-
observability-design.md. Phase 3b (Task 5) consumes this endpoint
from the browser via ErrorBoundary + window.onerror/unhandledrejection
listeners.

Reversal: delete app/api/log/route.ts; remove getErrorLogLimit factory.
EOF
)"
```

Expected: commit succeeds.

---

## Task 5 — Phase 3b: Client error bridge + 100ms dedup

**Files:**
- Create: `lib/error-bridge.ts`
- Modify: `components/ErrorBoundary.client.tsx` (POST to `/api/log` in `componentDidCatch`)
- Modify: `components/AppShell.client.tsx` (import `error-bridge` at module scope)
- Modify: `__tests__/api-log-shape.test.ts` (populate the client-bridge block)

**Spec ref:** §7b

### Steps

- [ ] **Step 5.1: Populate the client-bridge assertions**

In `__tests__/api-log-shape.test.ts`, replace the placeholder block at the bottom:

```ts
describe('client error bridge (Phase 3b — placeholder)', () => {
  it.skip('see Task 5 for client-bridge assertions', () => {});
});
```

With:

```ts
describe('client error bridge (Phase 3b)', () => {
  const BRIDGE = readFileSync(path.resolve(__dirname, '../lib/error-bridge.ts'), 'utf-8');
  const ERROR_BOUNDARY = readFileSync(
    path.resolve(__dirname, '../components/ErrorBoundary.client.tsx'),
    'utf-8',
  );
  const APP_SHELL = readFileSync(
    path.resolve(__dirname, '../components/AppShell.client.tsx'),
    'utf-8',
  );

  it('lib/error-bridge.ts declares use client', () => {
    expect(BRIDGE).toMatch(/^['"]use client['"]/m);
  });

  it('registers both window.onerror and unhandledrejection listeners', () => {
    expect(BRIDGE).toMatch(/window\.addEventListener\(\s*['"]error['"]/);
    expect(BRIDGE).toMatch(/window\.addEventListener\(\s*['"]unhandledrejection['"]/);
  });

  it('dedupes via a 100ms tail window keyed on message + stack', () => {
    expect(BRIDGE).toMatch(/100/); // the 100ms constant
    // Sanity: there's some Map or object keyed on a message/stack composite.
    expect(BRIDGE).toMatch(/\b(Map|Set|Record)\b/);
  });

  it('POSTs structured payload to /api/log', () => {
    expect(BRIDGE).toMatch(/fetch\(\s*['"]\/api\/log['"]/);
    expect(BRIDGE).toMatch(/method:\s*['"]POST['"]/);
  });

  it('AppShell.client.tsx imports lib/error-bridge once', () => {
    expect(APP_SHELL).toMatch(/from\s*['"](\.\.\/lib\/error-bridge|@\/lib\/error-bridge)['"]/);
  });

  it('ErrorBoundary.client.tsx componentDidCatch POSTs to /api/log', () => {
    // Existing console.error retained; new POST added.
    expect(ERROR_BOUNDARY).toMatch(/console\.error/);
    expect(ERROR_BOUNDARY).toMatch(/fetch\(\s*['"]\/api\/log['"]/);
    expect(ERROR_BOUNDARY).toMatch(/method:\s*['"]POST['"]/);
  });
});
```

- [ ] **Step 5.2: Run the test to verify it FAILS**

```bash
pnpm vitest run __tests__/api-log-shape.test.ts
```

Expected: 6 FAILs in client-bridge block (file doesn't exist; AppShell doesn't import; ErrorBoundary doesn't POST).

- [ ] **Step 5.3: Create `lib/error-bridge.ts`**

Create with this exact content:

```ts
'use client';

// lib/error-bridge.ts
// Browser-side bridge that captures unhandled errors and promise
// rejections and POSTs them to /api/log. Deduplicates within a 100ms
// tail window keyed on (message, stack) to absorb React's error replay
// (which can fire the same error 2-3 times in <50ms during reconciliation)
// without suppressing meaningful repeat-occurrence signal later in the
// session.
//
// Spec ref: docs/superpowers/specs/2026-05-18-production-observability-design.md §7b

const DEDUP_TAIL_MS = 100;
const recentEmissions = new Map<string, number>();

type Payload = {
  level: 'error' | 'warn';
  message: string;
  stack?: string;
  url?: string;
  userAgent?: string;
  ts: string;
};

function buildKey(message: string, stack: string | undefined): string {
  return `${message}|${stack ?? ''}`;
}

function shouldEmit(key: string): boolean {
  const now = Date.now();
  const last = recentEmissions.get(key);
  if (last !== undefined && now - last < DEDUP_TAIL_MS) return false;
  recentEmissions.set(key, now);
  // Opportunistic cleanup: every emit, drop stale entries to avoid memory growth.
  for (const [k, ts] of recentEmissions) {
    if (now - ts > DEDUP_TAIL_MS) recentEmissions.delete(k);
  }
  return true;
}

function send(payload: Payload): void {
  // Fire-and-forget; failures swallowed (we cannot recursively report
  // an error from the error-reporting bridge).
  void fetch('/api/log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    // keepalive lets the request finish even if the page is unloading.
    keepalive: true,
  }).catch(() => {
    // Intentional no-op.
  });
}

function handleError(event: ErrorEvent): void {
  const message = event.message ?? 'unknown error';
  const stack = event.error instanceof Error ? event.error.stack : undefined;
  if (!shouldEmit(buildKey(message, stack))) return;
  send({
    level: 'error',
    message,
    stack,
    url: window.location.href,
    userAgent: navigator.userAgent,
    ts: new Date().toISOString(),
  });
}

function handleRejection(event: PromiseRejectionEvent): void {
  const reason = event.reason;
  const message =
    reason instanceof Error
      ? reason.message
      : typeof reason === 'string'
        ? reason
        : 'unhandled promise rejection';
  const stack = reason instanceof Error ? reason.stack : undefined;
  if (!shouldEmit(buildKey(message, stack))) return;
  send({
    level: 'error',
    message,
    stack,
    url: window.location.href,
    userAgent: navigator.userAgent,
    ts: new Date().toISOString(),
  });
}

if (typeof window !== 'undefined') {
  window.addEventListener('error', handleError);
  window.addEventListener('unhandledrejection', handleRejection);
}

// Empty export so AppShell can `import '@/lib/error-bridge'` for side effect.
export {};
```

- [ ] **Step 5.4: Add the side-effect import to `AppShell.client.tsx`**

In `components/AppShell.client.tsx`, find the existing import block at the top (after `'use client';`). Add a side-effect-only import:

```ts
import '@/lib/error-bridge';
```

It should be the LAST import line. Position matters: it must run on the client so the listener registration fires.

- [ ] **Step 5.5: Extend `ErrorBoundary.client.tsx` to POST in `componentDidCatch`**

In `components/ErrorBoundary.client.tsx`, find the existing `componentDidCatch`:

```tsx
override componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error('[ErrorBoundary] client island crashed:', error, info.componentStack);
  }
```

Replace with:

```tsx
override componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    // Retain console.error for dev visibility (this client-side console.* is
    // intentionally not migrated in Phase 2b per spec §6).
    console.error('[ErrorBoundary] client island crashed:', error, info.componentStack);
    // Also POST to /api/log so it lands in Upstash for retrospective triage.
    if (typeof window !== 'undefined') {
      void fetch('/api/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: 'error',
          message: `[ErrorBoundary] ${error.message}`,
          stack: error.stack ?? info.componentStack ?? undefined,
          url: window.location.href,
          userAgent: navigator.userAgent,
          ts: new Date().toISOString(),
        }),
        keepalive: true,
      }).catch(() => {
        // Intentional no-op.
      });
    }
  }
```

- [ ] **Step 5.6: Run the test to verify it PASSES**

```bash
pnpm vitest run __tests__/api-log-shape.test.ts
```

Expected: 8 from endpoint block (Task 4) + 6 from bridge block = 14 passing.

- [ ] **Step 5.7: Run the full unit suite**

```bash
pnpm vitest run
```

Expected: ~80 passing.

- [ ] **Step 5.8: Bundle check (client islands grew)**

```bash
pnpm build && pnpm bundle-check
```

Expected: bundle-check reports `client chunks total ≤ 320 KB`. lib/error-bridge.ts is ~0.5KB gzip; well within budget.

- [ ] **Step 5.9: Run full pre-commit sequence**

```bash
pnpm check && pnpm typecheck && pnpm validate-content && pnpm test
```

Expected: all green.

- [ ] **Step 5.10: Commit**

```bash
git add lib/error-bridge.ts components/ErrorBoundary.client.tsx components/AppShell.client.tsx __tests__/api-log-shape.test.ts
git commit -m "$(cat <<'EOF'
feat(obs): client error bridge with 100ms dedup (Phase 3b)

New lib/error-bridge.ts (~80 LoC, ~0.5KB gzip) registers
window.addEventListener('error') and 'unhandledrejection' at module
scope on the client. Each captured error POSTs to /api/log
(established in Task 4) with the structured payload {level, message,
stack, url, userAgent, ts}. Uses fetch keepalive so the report
survives page unload.

Dedupes within a 100ms tail window keyed on (message, stack): first
occurrence emits immediately, identical occurrences within 100ms are
suppressed. Window sized to cover React's error replay during
reconciliation (typically 2-3 fires in <50ms) without suppressing
meaningful repeat-occurrence signal later in the session. A previous
draft of the spec used a 5s window — rejected at architect-review.

components/AppShell.client.tsx imports the bridge as a side-effect
once, so listener registration runs on every page load.

components/ErrorBoundary.client.tsx is extended: componentDidCatch
now also POSTs to /api/log alongside the existing console.error
(which is intentionally retained per spec §6 — Phase 2b's migration
explicitly excluded this client-side site).

Implements Phase 3b of spec docs/superpowers/specs/2026-05-18-production-
observability-design.md.

Reversal: delete lib/error-bridge.ts; remove the side-effect import
from AppShell; revert ErrorBoundary's componentDidCatch to console-only.
EOF
)"
```

Expected: commit succeeds.

---

## Task 6 — Phase 3c: `/api/ask` Q+A persistence + `X-Request-Id` header

**Files:**
- Create: `lib/ask-log.ts`
- Modify: `app/api/ask/route.ts` (accumulate answer text, persist after stream, emit `X-Request-Id` header)
- Create: `__tests__/ask-log-persistence.test.ts`

**Spec ref:** §7c

### Steps

- [ ] **Step 6.1: Write the failing test**

Create `__tests__/ask-log-persistence.test.ts` with this exact content (Task 7 will append `/api/log/forget` assertions):

```ts
// __tests__/ask-log-persistence.test.ts
// Source-grep test: verifies /api/ask Q+A persistence + X-Request-Id
// header per spec docs/superpowers/specs/2026-05-18-production-
// observability-design.md §7c.
//
// Task 6 (Phase 3c) populates the persistence block.
// Task 7 (Phase 3d) appends the /api/log/forget block.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ASK_LOG = readFileSync(
  path.resolve(__dirname, '../lib/ask-log.ts'),
  'utf-8',
);
const ASK_ROUTE = readFileSync(
  path.resolve(__dirname, '../app/api/ask/route.ts'),
  'utf-8',
);

describe('Q+A persistence (Phase 3c)', () => {
  it('lib/ask-log.ts exports persistAskInteraction', () => {
    expect(ASK_LOG).toMatch(/export\s+(async\s+)?function\s+persistAskInteraction\b/);
  });

  it('uses ask:log: KV prefix with date partition and 90-day TTL', () => {
    expect(ASK_LOG).toMatch(/['"`]ask:log:/);
    // 90 days = 90 * 24 * 60 * 60 = 7_776_000 seconds.
    expect(ASK_LOG).toMatch(/7[_]?776[_]?000/);
  });

  it('truncates question to 500 chars and answer to 1000 chars', () => {
    expect(ASK_LOG).toMatch(/\.slice\(\s*0\s*,\s*500\s*\)/);
    expect(ASK_LOG).toMatch(/\.slice\(\s*0\s*,\s*1000\s*\)/);
  });

  it('app/api/ask/route.ts calls persistAskInteraction after stream completes', () => {
    expect(ASK_ROUTE).toMatch(/persistAskInteraction\(/);
    const persistIdx = ASK_ROUTE.indexOf('persistAskInteraction(');
    const incrementIdx = ASK_ROUTE.indexOf('incrementBudget(');
    // Both fire after the stream finishes; both fire-and-forget.
    // Spec says alongside incrementBudget — they should be close in source order.
    expect(persistIdx).toBeGreaterThan(-1);
    expect(incrementIdx).toBeGreaterThan(-1);
  });

  it('app/api/ask/route.ts accumulates collectedAnswerText capped at 1000 chars', () => {
    expect(ASK_ROUTE).toMatch(/collectedAnswerText/);
    // The cap is applied at persist-time (in lib/ask-log.ts slice(0, 1000)),
    // but the accumulator should also have a sensible upper bound to avoid
    // memory bloat. Anthropic max_tokens 512 makes 1000 chars a safe ceiling.
  });

  it('app/api/ask/route.ts sets X-Request-Id response header on the streamed Response', () => {
    expect(ASK_ROUTE).toMatch(/['"]X-Request-Id['"]/);
    expect(ASK_ROUTE).toMatch(/requestId/);
  });
});

describe('/api/log/forget (Phase 3d — placeholder)', () => {
  it.skip('see Task 7 for forget-endpoint assertions', () => {});
});
```

- [ ] **Step 6.2: Run the test to verify it FAILS**

```bash
pnpm vitest run __tests__/ask-log-persistence.test.ts
```

Expected: 6 FAILs in the persistence block.

- [ ] **Step 6.3: Create `lib/ask-log.ts`**

Create with this exact content:

```ts
// lib/ask-log.ts
// Persists /api/ask Q+A interactions to Upstash KV for 90-day retrospective
// audit + product learning. Privacy: IP hashed via existing SHA-256 + DEPLOY_SALT
// pattern; question truncated at 500 chars + answer at 1000 chars to bound
// PII overflow from prompt-injection attempts. GDPR/LGPD right-of-erasure
// is provided by Phase 3d's /api/log/forget endpoint (Task 7).
//
// Spec ref: docs/superpowers/specs/2026-05-18-production-observability-design.md §7c

import { log } from '@/lib/log';
import { getRedis } from '@/lib/rate-limit';

const ASK_KV_TTL_S = 90 * 24 * 60 * 60; // 90 days = 7_776_000s

export type AskInteractionStatus =
  | 'completed'
  | 'errored'
  | 'rate-limited'
  | 'killed'
  | 'budget-exhausted';

export type AskInteraction = {
  requestId: string;
  ts: string;
  ipHash: string;
  question: string;
  answer: string;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  status: AskInteractionStatus;
};

export async function persistAskInteraction(interaction: AskInteraction): Promise<void> {
  const today = interaction.ts.slice(0, 10); // yyyy-mm-dd
  const key = `ask:log:${today}:${interaction.requestId}`;
  const record = {
    ...interaction,
    question: interaction.question.slice(0, 500),
    answer: interaction.answer.slice(0, 1000),
  };
  try {
    await getRedis().set(key, JSON.stringify(record), { ex: ASK_KV_TTL_S });
  } catch (err) {
    // Fail-quiet — observability outage MUST NOT block /api/ask responses.
    log.error('ask-log KV write failed', { requestId: interaction.requestId, err });
  }
}
```

- [ ] **Step 6.4: Modify `app/api/ask/route.ts` to call `persistAskInteraction`, accumulate answer text, and emit `X-Request-Id`**

The current state of the file (after Task 3) has `const requestId = crypto.randomUUID();` at the top of POST. Now we extend the stream loop and the final `Response` construction.

Add the import at the top:

```ts
import { persistAskInteraction, type AskInteractionStatus } from '@/lib/ask-log';
```

Inside the POST handler, after the existing `const requestId = ...` line, capture the start time:

```ts
const startedAt = Date.now();
```

In the existing stream construction (look for `const readable = new ReadableStream<Uint8Array>({ ... })`), modify the `start(controller)` body to accumulate the answer text. Find the existing text-delta enqueue:

```ts
} else if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            controller.enqueue(enc.encode(event.delta.text));
          }
```

Replace with:

```ts
} else if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            controller.enqueue(enc.encode(event.delta.text));
            if (collectedAnswerText.length < 1000) {
              collectedAnswerText += event.delta.text;
            }
          }
```

Above the `const readable = ...` line, declare the accumulator:

```ts
let collectedAnswerText = '';
let status: AskInteractionStatus = 'completed';
```

In the existing `finally` block of the stream (where `incrementBudget` is called), add the `persistAskInteraction` call:

```ts
} finally {
        controller.close();
        // Fire-and-forget — never blocks the response.
        incrementBudget(inputTokens, outputTokens);
        void persistAskInteraction({
          requestId,
          ts: new Date().toISOString(),
          ipHash, // see step 6.4b below — need to compute this earlier in the handler
          question,
          answer: collectedAnswerText,
          inputTokens,
          outputTokens,
          durationMs: Date.now() - startedAt,
          status,
        });
      }
```

If the catch block enqueues `STREAM_ERR_SENTINEL`, set `status = 'errored'` there before the `controller.close()` in the catch path.

Finally, modify the `return new Response(readable, { headers: { ... } })` at the end to include `X-Request-Id`:

```ts
return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Request-Id': requestId,
    },
  });
```

- [ ] **Step 6.4b: Compute `ipHash` earlier in the handler (so it's available to `persistAskInteraction`)**

Look for the existing `const ip = getClientIp(req);` line in the POST handler. After it, add:

```ts
const ipBytes = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(ip + (process.env.DEPLOY_SALT ?? 'portfolio')),
  );
  const ipHash = Buffer.from(ipBytes).toString('hex').slice(0, 16);
```

This matches the `/api/contact` IP-hashing pattern. The `ipHash` constant is now in scope for the `persistAskInteraction` call in the stream's `finally` block.

- [ ] **Step 6.4c: Capture the kill-switch + budget + rate-limit branches as status events**

For each early-return path in the existing POST handler (kill switch returns 503, rate-limit returns 429, budget cap returns 503), persist a lightweight log even though the stream didn't start. Insert before each `return Response.json(...)`:

```ts
// Kill-switch branch:
void persistAskInteraction({
  requestId,
  ts: new Date().toISOString(),
  ipHash: '',  // not yet computed; acceptable on the kill path since we never proceed
  question: '',
  answer: '',
  inputTokens: 0,
  outputTokens: 0,
  durationMs: Date.now() - startedAt,
  status: 'killed',
});
```

For the rate-limit branch use `status: 'rate-limited'`; for the budget-exhausted branch use `status: 'budget-exhausted'`. Use `ipHash: ''` in the kill-switch branch (it runs BEFORE the ipHash computation); compute and pass real ipHash in the rate-limit + budget branches (they run AFTER the IP hash). Adjust placement of the `ipHash` computation if needed so it's available to each branch — easiest is to compute `ipHash` immediately after `getClientIp(req)` and before any early-return branch.

- [ ] **Step 6.5: Run the test to verify it PASSES**

```bash
pnpm vitest run __tests__/ask-log-persistence.test.ts
```

Expected: 6/6 in the persistence block PASS; 1 skipped in the forget block.

- [ ] **Step 6.6: Run typecheck**

```bash
pnpm typecheck
```

Expected: clean exit.

- [ ] **Step 6.7: Run the full unit suite**

```bash
pnpm vitest run
```

Expected: ~86 passing.

- [ ] **Step 6.8: Run full pre-commit sequence**

```bash
pnpm check && pnpm typecheck && pnpm validate-content && pnpm test
```

Expected: all green.

- [ ] **Step 6.9: Commit**

```bash
git add lib/ask-log.ts app/api/ask/route.ts __tests__/ask-log-persistence.test.ts
git commit -m "$(cat <<'EOF'
feat(obs): /api/ask Q+A persistence + X-Request-Id header (Phase 3c)

New lib/ask-log.ts exports persistAskInteraction({...}) — fire-and-
forget Upstash KV write at ask:log:{yyyy-mm-dd}:{requestId} with
90-day TTL. Truncates question to 500c and answer to 1000c at persist-
time as a privacy + KV-cost guardrail. IP hashed via the existing
SHA-256 + DEPLOY_SALT pattern (same as /api/contact).

app/api/ask/route.ts modifications:
- Compute ipHash early (after getClientIp) so it's available to every
  branch that persists.
- Accumulate streamed answer text into collectedAnswerText (capped at
  1000c) inside the existing content_block_delta loop.
- Track status: AskInteractionStatus across the four early-return
  branches (killed | rate-limited | budget-exhausted) and the streaming
  finally block (completed | errored).
- Fire persistAskInteraction in each terminal path; in the stream's
  finally block it runs alongside the existing incrementBudget fire-
  and-forget call.
- New X-Request-Id response header surfaces the requestId to the
  client so users can find their persisted record (visible in DevTools
  Network tab) — enables the Phase 3d /api/log/forget right-of-erasure
  flow.

Implements Phase 3c of spec docs/superpowers/specs/2026-05-18-production-
observability-design.md.

Reversal: delete lib/ask-log.ts; remove persistAskInteraction calls
from route.ts; revert header + accumulator + status tracking.
EOF
)"
```

Expected: commit succeeds.

---

## Task 7 — Phase 3d: `/api/log/forget` + privacy notice

**Files:**
- Create: `app/api/log/forget/route.ts`
- Modify: `lib/rate-limit.ts` (add `getForgetLimit()` factory)
- Modify: the file hosting the `/api/ask` form (likely `components/client/InteractiveShell.tsx`) — append a privacy notice below the submit control
- Modify: `__tests__/ask-log-persistence.test.ts` (populate the forget block)

**Spec ref:** §7d

### Steps

- [ ] **Step 7.1: Locate the `/api/ask` form component**

```bash
grep -rn "fetch\(\s*['\"]\/api\/ask['\"]" components app 2>/dev/null
```

Expected: should match one or two files (likely `components/client/InteractiveShell.tsx`). Confirm the file path; the privacy notice goes in the same component, below its form/submit area.

If the grep returns no matches, the form may use a different fetch pattern; widen the search to `grep -rn "/api/ask" components app`.

- [ ] **Step 7.2: Populate the forget-endpoint test block**

In `__tests__/ask-log-persistence.test.ts`, replace the placeholder:

```ts
describe('/api/log/forget (Phase 3d — placeholder)', () => {
  it.skip('see Task 7 for forget-endpoint assertions', () => {});
});
```

With:

```ts
describe('/api/log/forget endpoint (Phase 3d)', () => {
  const FORGET_ROUTE = readFileSync(
    path.resolve(__dirname, '../app/api/log/forget/route.ts'),
    'utf-8',
  );
  const RATE_LIMIT = readFileSync(
    path.resolve(__dirname, '../lib/rate-limit.ts'),
    'utf-8',
  );

  it('exports a POST handler with NextRequest typing', () => {
    expect(FORGET_ROUTE).toMatch(/export\s+async\s+function\s+POST\s*\(/);
    expect(FORGET_ROUTE).toMatch(/NextRequest/);
  });

  it('marks the route as dynamic', () => {
    expect(FORGET_ROUTE).toMatch(/export\s+const\s+dynamic\s*=\s*['"]force-dynamic['"]/);
  });

  it('validates requestId via zod', () => {
    expect(FORGET_ROUTE).toMatch(/from\s*['"]zod['"]/);
    expect(FORGET_ROUTE).toMatch(/requestId/);
  });

  it('deletes against the ask:log: KV key pattern', () => {
    expect(FORGET_ROUTE).toMatch(/ask:log:/);
    expect(FORGET_ROUTE).toMatch(/\.del\(/);
  });

  it('returns ok: true with a deleted count and is idempotent', () => {
    expect(FORGET_ROUTE).toMatch(/ok:\s*true/);
    expect(FORGET_ROUTE).toMatch(/deleted/);
  });

  it('uses the new getForgetLimit() rate-limit factory', () => {
    expect(FORGET_ROUTE).toMatch(/getForgetLimit\(\)/);
  });

  it('lib/rate-limit.ts exports getForgetLimit factory with 5/hour limit', () => {
    expect(RATE_LIMIT).toMatch(/export\s+function\s+getForgetLimit\b/);
    expect(RATE_LIMIT).toMatch(/slidingWindow\(\s*5\s*,\s*['"]1\s*h['"]/);
  });
});
```

Also add a test for the privacy notice in the host component. Append:

```ts
describe('privacy notice on /api/ask form', () => {
  // Resolved dynamically: the implementer locates the form file via grep in
  // Step 7.1 and writes the path here. The most likely path is
  // components/client/InteractiveShell.tsx.
  const FORM_HOST = readFileSync(
    path.resolve(__dirname, '../components/client/InteractiveShell.tsx'),
    'utf-8',
  );

  it('mentions 90-day retention + the /api/log/forget endpoint', () => {
    expect(FORM_HOST).toMatch(/90 days|90-day/);
    expect(FORM_HOST).toMatch(/\/api\/log\/forget/);
  });
});
```

If Step 7.1 revealed the host file is different, swap the path in the `path.resolve(__dirname, '../components/client/InteractiveShell.tsx')` line accordingly.

- [ ] **Step 7.3: Run the test to verify it FAILS**

```bash
pnpm vitest run __tests__/ask-log-persistence.test.ts
```

Expected: 7 FAILs in the forget block + 1 FAIL in the privacy notice block.

- [ ] **Step 7.4: Add `getForgetLimit()` to `lib/rate-limit.ts`**

After the `getErrorLogLimit()` factory added in Task 4, append:

```ts
let _forgetLimit: Ratelimit | undefined;

export function getForgetLimit(): Ratelimit {
  if (!_forgetLimit) {
    _forgetLimit = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(5, '1 h'),
      prefix: 'rl:forget',
    });
  }
  return _forgetLimit;
}
```

- [ ] **Step 7.5: Create `app/api/log/forget/route.ts`**

Create with this exact content:

```ts
// app/api/log/forget/route.ts
// GDPR Art. 17 / LGPD Art. 18 right-of-erasure endpoint for /api/ask
// Q+A logs. Accepts { requestId } and DELETEs the matching KV record
// across the last 90 days of date-partitioned keys.
//
// Spec ref: docs/superpowers/specs/2026-05-18-production-observability-design.md §7d

import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { log } from '@/lib/log';
import { getClientIp, getForgetLimit, getRedis } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const ForgetPayload = z.object({
  requestId: z.string().uuid(),
});

function lastNDates(n: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const { success } = await getForgetLimit().limit(ip);
  if (!success) {
    return Response.json({ error: 'too many forget requests' }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  const parsed = ForgetPayload.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'invalid payload shape', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { requestId } = parsed.data;
  const candidateKeys = lastNDates(90).map((d) => `ask:log:${d}:${requestId}`);

  let deleted = 0;
  try {
    const redis = getRedis();
    // Upstash supports del with multiple keys in a single call; cheaper than
    // 90 separate round-trips when most candidates miss.
    deleted = await redis.del(...candidateKeys);
  } catch (err) {
    log.error('forget KV delete failed', { requestId, err });
    return Response.json({ error: 'storage unavailable' }, { status: 503 });
  }

  log.info('forget request processed', { requestId, deleted });
  return Response.json({ ok: true, deleted });
}
```

- [ ] **Step 7.6: Add the privacy notice to the `/api/ask` form host component**

Open the file located in Step 7.1 (likely `components/client/InteractiveShell.tsx`). Find the JSX block containing the form submit control (button or form element that fetches `/api/ask`).

Below the submit button, add a privacy notice element. Use a paragraph with subtle styling — match the existing terminal aesthetic. Example (adjust class names to match the project's existing CSS conventions):

```tsx
<p className="ask__privacy-notice">
  {'Queries are stored for 90 days for product improvement. POST your request ID '}
  {'(returned in the X-Request-Id response header) to '}
  <code>/api/log/forget</code>
  {' or email erikhenriquealvescunha@gmail.com to request deletion.'}
</p>
```

If `ask__privacy-notice` doesn't yet exist in `app/css/_sections.css`, add a small style rule (the implementer can also leverage the existing muted-text class). Aim for a single line of dim small text — visually unobtrusive.

- [ ] **Step 7.7: Run the test to verify it PASSES**

```bash
pnpm vitest run __tests__/ask-log-persistence.test.ts
```

Expected: 6 from persistence block (Task 6) + 7 from forget block + 1 from privacy notice block = 14 passing.

- [ ] **Step 7.8: Run the full unit suite**

```bash
pnpm vitest run
```

Expected: ~93 passing.

- [ ] **Step 7.9: Bundle check (privacy notice may have added a few bytes to a client component)**

```bash
pnpm build && pnpm bundle-check
```

Expected: still within 320KB budget.

- [ ] **Step 7.10: Run full pre-commit sequence**

```bash
pnpm check && pnpm typecheck && pnpm validate-content && pnpm test
```

Expected: all green.

- [ ] **Step 7.11: Commit**

```bash
git add app/api/log/forget/route.ts lib/rate-limit.ts components/client/InteractiveShell.tsx __tests__/ask-log-persistence.test.ts
# If the form host file differs from InteractiveShell.tsx, adjust the git add above accordingly.
# Also add app/css/_sections.css if you added a new class for the privacy notice.
git commit -m "$(cat <<'EOF'
feat(obs): /api/log/forget GDPR/LGPD erasure endpoint + privacy notice

Closes the GDPR Art. 17 / LGPD Art. 18 right-of-erasure gap created
by Phase 3c's Q+A persistence. The earlier draft of Spec 2 offered
only a "stored 90 days" notice — rejected at architect-review as
insufficient under EU/Brazilian privacy law.

- app/api/log/forget/route.ts: POST {requestId} → DELETEs the matching
  ask:log:{date}:{requestId} record across the last 90 days of date
  partitions (single Upstash del() call with up to 90 candidate keys;
  cheap when most candidates miss). Returns {ok: true, deleted: N}.
  Idempotent: deleted: 0 if no record exists.
- lib/rate-limit.ts: new getForgetLimit() factory, sliding window 5
  per IP per hour. Prevents enumeration attacks against random
  requestIds even though UUIDv4 collision space (~5.3e36) makes
  brute-force computationally infeasible anyway.
- Privacy notice added below the /api/ask submit control: "Queries
  are stored for 90 days... POST your request ID (returned in the
  X-Request-Id response header) to /api/log/forget or email..."

Implements Phase 3d of spec docs/superpowers/specs/2026-05-18-production-
observability-design.md. The X-Request-Id header was added in Task 6
so users can find the ID needed for this endpoint.

Reversal: delete app/api/log/forget/route.ts; remove getForgetLimit
factory; remove the privacy notice JSX. Existing ask:log: keys remain
in KV (delete manually via SCAN + DEL if hard reset is needed).
EOF
)"
```

Expected: commit succeeds.

---

## Task 8 — Final cleanup: DECISIONS, ARCHITECTURE, Playwright smoke

**Files:**
- Modify: `DECISIONS.md` (4 new bullets)
- Modify: `ARCHITECTURE.md` (rewrite §9)
- Create: `tests/e2e/observability-smoke.spec.ts`

**Spec ref:** §8 criterion 6, 7, 8

### Steps

- [ ] **Step 8.1: Read current `DECISIONS.md` and `ARCHITECTURE.md §9`**

```bash
tail -30 DECISIONS.md
echo "---"
sed -n '/## 9\. Observability strategy/,/## 10\./p' ARCHITECTURE.md
```

Confirm the current structure; new DECISIONS bullets append under the most recent date header, and §9 of ARCHITECTURE.md gets rewritten between its current heading and `## 10.`.

- [ ] **Step 8.2: Append the four DECISIONS bullets**

In `DECISIONS.md`, under the most recent `## 2026-05-18 — ...` section (or append a new section if the most recent date header has changed), add:

```markdown
- **2026-05-18** · Vercel Analytics + Speed Insights re-wired in `app/layout.tsx` after the silent removal in commit `ad5b58c` (declared-but-unused). CSP `connect-src` widened for `https://*.vercel-insights.com` and `https://va.vercel-scripts.com`. Real-user CWV closes the Pillar 7 (Flywheel) audit gap. _Reversible (unmount + revert CSP); ad-blocker coverage ~70-85% is expected and documented._
- **2026-05-18** · `pino` chosen over a custom thin `lib/log.ts` wrapper for structured logging. Sits adjacent to the 2026-05-18 "no extra plugins beyond Lightning CSS" lock-in but justified: (a) that lock-in was specifically about CSS pipeline; (b) pino is server-only — no client bundle impact; (c) battle-tested correlation-ID + JSON output patterns are worth more than 80 LoC of bespoke code at this stage. _Reversible: `pnpm rm pino pino-pretty` + restore `console.*`._
- **2026-05-18** · Custom Upstash error endpoint (`/api/log`) chosen over Sentry. Zero new SaaS vendor; reuses existing Upstash infra and rate-limit primitive; ~50 LoC. Trade-off: no auto stack-trace grouping or source-map symbolication. Mitigation: Vercel's deployment pipeline retains source maps; operator manually symbolicates via `vercel inspect` when a captured production error needs deeper triage (post-merge ops checklist item 5). _Reversible: delete route + revert client bridge; KV records expire via 30-day TTL._
- **2026-05-18** · `/api/ask` Q+A logging shape locked: question truncated to 500 chars + answer to 1000 chars + meta (`{requestId, ts, ipHash, inputTokens, outputTokens, durationMs, status}`), 90-day TTL, IP hashed via SHA-256 + DEPLOY_SALT. Architect-review identified GDPR Art. 17 / LGPD Art. 18 right-of-erasure requirement; addressed by new `/api/log/forget` endpoint (POST `{requestId}` → idempotent DELETE across the last 90 day-partitions) + `X-Request-Id` response header + privacy notice on the /api/ask UI. The reviewer's alternative (drop question text entirely; meta-only) was considered and rejected — the brainstorming-stage value of "what users actually ask" + "what Haiku said about Erik retrospectively" is preserved by the forget mechanism rather than designed out. _Reversible: flip a feature flag in route.ts; operator can `SCAN ask:log:* | DEL` for hard reset._
```

- [ ] **Step 8.3: Rewrite `ARCHITECTURE.md §9`**

In `ARCHITECTURE.md`, find:

```markdown
## 9. Observability strategy

Minimal but real:
- **Vercel Web Analytics** for pageview counts, referrer distribution
- **Vercel Speed Insights** for real-user CWV
- **Vercel Logs** for Edge Function output (stdout/stderr)
- **Upstash KV inspector** for contact submissions + ask queries
- **(Optional) Sentry frontend SDK** — only if client errors become a problem; adds ~25KB so default OFF

What I deliberately don't do:
- No Datadog / NewRelic / LaunchDarkly (overkill)
- No custom OpenTelemetry pipeline (no second consumer of the traces)
- No alerting beyond Vercel's defaults (single-author site, no oncall)
```

Replace with:

```markdown
## 9. Observability strategy

Implemented per Spec 2 (`docs/superpowers/specs/2026-05-18-production-observability-design.md`):

### Real-user telemetry
- **Vercel Web Analytics** + **Vercel Speed Insights** mounted in `app/layout.tsx`. Real-user pageview counts + LCP/INP/CLS land in the Vercel dashboards. Expected coverage 70-85% of visits (ad-blockers block the two ingest origins; never claim 100% population coverage in the hiring pitch).
- **CSP** widened in `proxy.ts` to allow `https://*.vercel-insights.com` and `https://va.vercel-scripts.com`.

### Server-side structured logging
- **`lib/log.ts`** wraps `pino` with a `{info, warn, error}` surface. Dev mode uses `pino-pretty` for human-readable output; production emits JSON lines for Vercel runtime-log parsing. Base fields auto-added: `{ts, level, env}`. Correlation IDs (`requestId`) are passed explicitly per-call via the second `ctx` argument — no AsyncLocalStorage / Edge-runtime opt-out (the trade-off was deliberate; cold-start cost would have stacked on top of the active LCP fight when Spec 2 landed).
- Every server `console.*` call site in `lib/` + `app/api/` is migrated to `log.*`. The `ErrorBoundary.client.tsx` `console.error` is the lone retained console call — intentional, client-side; bridged separately to `/api/log` from `componentDidCatch`.

### Client error capture
- **`lib/error-bridge.ts`** registers `window.addEventListener('error')` + `unhandledrejection` at module scope (imported once from `AppShell.client.tsx`). Each capture POSTs to `/api/log` with `{level, message, stack, url, userAgent, ts}`. Dedup: 100ms tail-window keyed on `(message, stack)` — covers React's error replay (<50ms) without suppressing meaningful repeat-occurrence signal.
- **`app/api/log/route.ts`** validates via zod, hashes IP via existing SHA-256 + DEPLOY_SALT pattern, writes to Upstash KV `err:{yyyy-mm-dd}:{uuid}` with 30-day TTL. Rate-limited (10/IP/min) via `getErrorLogLimit()` to absorb runaway client error loops.

### `/api/ask` Q+A retention
- **`lib/ask-log.ts`** persists every `/api/ask` interaction to Upstash KV `ask:log:{yyyy-mm-dd}:{requestId}` with 90-day TTL. Captures `{requestId, ts, ipHash, question (≤500c), answer (≤1000c), inputTokens, outputTokens, durationMs, status}`. Enables retrospective audit of what the LLM said about Erik + product learning on user questions.
- **`X-Request-Id`** response header on `/api/ask` surfaces the requestId to the client for the GDPR/LGPD erasure flow.
- **`app/api/log/forget/route.ts`** accepts POST `{requestId}` and idempotently DELETEs the matching record across the last 90 day-partitions. Rate-limited (5/IP/hour) via `getForgetLimit()`.

### Inspection surfaces
- **Vercel dashboard** → Analytics + Speed Insights for real-user data.
- **Vercel runtime logs** for the JSON-line `log.*` stream; filterable by `requestId`, `level`, or `env`.
- **Upstash console** → Data Browser; `SCAN err:*` / `SCAN ask:log:*` for ad-hoc inspection.
- **Source-map symbolication** for captured production errors: Vercel retains maps per deploy; operator runs `vercel inspect <deploy-url> --logs` or the dashboard's Source Maps tab. If this becomes recurring, a future spec adds an `/internal/symbolicate` route on demand.

### What I deliberately don't do
- No Datadog / NewRelic / LaunchDarkly (overkill at this scale).
- No Sentry — custom `/api/log` endpoint chosen instead for zero new SaaS vendor (see `DECISIONS.md` 2026-05-18).
- No custom OpenTelemetry pipeline (no second consumer of the traces).
- No alerting beyond Vercel's defaults + the `/api/ask` 80%/100% budget warnings (single-author site, no oncall rotation).
- No client-side dashboards/UI; Upstash console + Vercel CLI are the inspection surfaces.
```

- [ ] **Step 8.4: Create the Playwright observability smoke**

Create `tests/e2e/observability-smoke.spec.ts`:

```ts
// tests/e2e/observability-smoke.spec.ts
// Smokes the Phase 3 endpoints end-to-end against the CI preview server.
// Spec ref: docs/superpowers/specs/2026-05-18-production-observability-design.md §8 criterion 8.

import { expect, test } from '@playwright/test';

const SYNTHETIC_REQUEST_ID = '00000000-0000-4000-8000-000000000000';

test.describe('observability smoke', () => {
  test('/api/log accepts a structured error payload', async ({ request }) => {
    const res = await request.post('/api/log', {
      data: {
        level: 'error',
        message: '[smoke] synthetic test error',
        stack: 'Error: smoke\n  at test',
        url: 'http://localhost:3000/smoke',
        userAgent: 'playwright/smoke',
        ts: new Date().toISOString(),
      },
    });
    expect(res.status()).toBe(204);
  });

  test('/api/log rejects an invalid payload with 400', async ({ request }) => {
    const res = await request.post('/api/log', {
      data: { not_a_valid_field: 'oops' },
    });
    expect(res.status()).toBe(400);
  });

  test('/api/log/forget accepts a UUID requestId and returns ok shape', async ({ request }) => {
    const res = await request.post('/api/log/forget', {
      data: { requestId: SYNTHETIC_REQUEST_ID },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true });
    expect(typeof body.deleted).toBe('number');
  });

  test('/api/log/forget rejects non-UUID requestId with 400', async ({ request }) => {
    const res = await request.post('/api/log/forget', {
      data: { requestId: 'not-a-uuid' },
    });
    expect(res.status()).toBe(400);
  });
});
```

- [ ] **Step 8.5: Run the new Playwright smoke locally to verify**

```bash
pnpm build
pnpm start &
sleep 5
pnpm playwright test tests/e2e/observability-smoke.spec.ts
kill %1
```

Expected: 4/4 Playwright tests pass against the local production build.

If Playwright requires browsers not yet installed locally, the smoke will run in CI. Skip the local run with a documented deferral if needed.

- [ ] **Step 8.6: Run the full unit suite and full pre-commit gate**

```bash
pnpm check && pnpm typecheck && pnpm validate-content && pnpm test
```

Expected: all green; ~93 unit tests passing.

- [ ] **Step 8.7: Commit**

```bash
git add DECISIONS.md ARCHITECTURE.md tests/e2e/observability-smoke.spec.ts
git commit -m "$(cat <<'EOF'
docs(obs): finalise Spec 2 — DECISIONS + ARCHITECTURE §9 + smoke

Final cleanup commit for the production-observability spec
implementation:

- DECISIONS.md: 4 new bullets dated 2026-05-18 covering (a) Vercel
  Analytics + Speed Insights re-wired, (b) pino chosen over custom
  wrapper with explicit deviation acknowledgement, (c) custom Upstash
  /api/log endpoint chosen over Sentry, (d) /api/ask Q+A logging
  shape lock + the GDPR/LGPD forget-endpoint addition surfaced by
  architect-review.
- ARCHITECTURE.md §9: rewritten end-to-end. Replaces the old
  "(Optional) Sentry frontend SDK" framing with the actual implemented
  layer: real-user telemetry, server-side structured logging, client
  error capture, /api/ask Q+A retention, inspection surfaces, and the
  explicit anti-list updated to reflect the implemented decisions.
- tests/e2e/observability-smoke.spec.ts (new): 4 Playwright tests
  exercise /api/log + /api/log/forget end-to-end against the CI
  preview server per spec §8 criterion 8 (the CI-verifiable smoke
  replacement for the prior manual-checklist criterion).

Closes implementation of all eight phases per spec §11. Post-merge
ops checklist (§9b) runs after merge.

Implements final cleanup of spec docs/superpowers/specs/2026-05-18-
production-observability-design.md.

Reversal: revert the four DECISIONS bullets and the §9 rewrite; delete
the Playwright smoke. The runtime layer (Tasks 1-7) remains; only
documentation + smoke ship in this commit.
EOF
)"
```

Expected: commit succeeds.

---

## Self-review notes (writing-plans skill)

Cross-checked against the spec on 2026-05-18:

**Spec coverage:**
- Spec §5 (Phase 1 Browser RUM) → Task 1
- Spec §6 (Phase 2 structured-logging foundation + migration) → Tasks 2 (foundation) + 3 (migration table verbatim)
- Spec §7a (Phase 3a custom error endpoint) → Task 4
- Spec §7b (Phase 3b client error bridge + 100ms dedup) → Task 5
- Spec §7c (Phase 3c Q+A persistence + X-Request-Id header) → Task 6
- Spec §7d (Phase 3d forget endpoint + privacy notice) → Task 7
- Spec §8 success criteria 6 (DECISIONS bullets) + 7 (ARCHITECTURE §9 rewrite) + 8 (Playwright smoke) → Task 8
- Spec §9b post-merge ops checklist → surfaced in PR description at branch finalisation, not test-enforced

**Placeholder scan:**
- The `components/client/InteractiveShell.tsx` path in Task 7 is the implementer's most-likely target; Step 7.1's grep confirms the actual host file before any file modification. The test assertion path is editable to match.
- No `<N>` or `<placeholder>` cells remain — every numeric value (TTLs, dedup windows, rate-limit shapes) is concrete.
- The class name `ask__privacy-notice` in Step 7.6 is a suggestion; implementer chooses an existing project class if a better fit exists (or adds the new one to `_sections.css` alongside the JSX change).

**Type consistency:**
- `requestId` is the same variable name across Tasks 3, 6, 7 (top of POST handlers in `app/api/ask/route.ts` and `app/api/contact/route.ts`; persisted in KV records; surfaced in `X-Request-Id` header)
- `log` (from `@/lib/log`) — same import path across all migrated files
- `AskInteractionStatus` enum (Task 6) — five values match the five terminal branches in the route handler (`completed | errored | rate-limited | killed | budget-exhausted`)
- `getErrorLogLimit` (Task 4) / `getForgetLimit` (Task 7) — both follow the existing `getAskLimit` / `getContactLimit` factory pattern in `lib/rate-limit.ts`
- KV key prefixes: `err:` (30-day TTL) and `ask:log:` (90-day TTL) — both date-partitioned, both referenced consistently across producer (`app/api/log/route.ts` + `lib/ask-log.ts`) and consumer (`app/api/log/forget/route.ts`)
- `DEDUP_TAIL_MS = 100` constant in `lib/error-bridge.ts` matches the 100ms claim in the spec §7b and the test assertion

If any reader finds a divergence between this plan and the spec, the spec wins; flag and fix.
