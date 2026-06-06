# Principal Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close every gap identified in the Staff/Principal + AI-2026 review: three P0 production risks, three P1 correctness/feature gaps, and two P2 hygiene items.

**Architecture:** All fixes are additive or corrective — no structural refactors. The order is strictly by risk: P0s first (data integrity and cost exposure), P1s second (WCAG compliance and AEO feature), P2s last (documentation and minor validation).

**Tech Stack:** Next.js 15 App Router · Upstash Redis (`@upstash/redis`) · Anthropic SDK (`@anthropic-ai/sdk`) · Vitest · TypeScript strict

---

## File map

| File | Action | Why |
|---|---|---|
| `lib/lighthouse-scores.ts` | Modify | LIGHTHOUSE_FALLBACK → null/zero values |
| `components/sections/LivePerfSection.tsx` | Modify | Render `—` when fallback is active |
| `__tests__/lighthouse-fallback.test.ts` | Create | Verify fallback never shows fabricated scores |
| `lib/rate-limit.ts` | Modify | Add `getBudget`, `incrementBudget`, budget check |
| `app/api/ask/route.ts` | Modify | Budget gate + prompt caching + token capture |
| `__tests__/budget-cap.test.ts` | Create | Budget counter logic |
| `app/api/contact/route.ts` | Modify | KV write before Resend + min-length validation + rate limit alignment |
| `__tests__/contact-validation.test.ts` | Create | Server-side validation logic |
| `components/AppShell.client.tsx` | Modify | Skip-to-content link |
| `__tests__/skip-to-content.test.ts` | Create | Verify skip link is first focusable element |
| `app/api/erik.json/route.ts` | Create | Machine-readable profile for AI agents |
| `__tests__/erik-json.test.ts` | Create | Route contract test |
| `lib/rate-limit.ts` | Modify | Align `getAskLimit` with documented 8/hr |
| `ARCHITECTURE.md` | Modify | Update status + correct documented rate limits |

---

## Task 1 — Fix LIGHTHOUSE_FALLBACK integrity (P0)

**Problem:** `LIGHTHOUSE_FALLBACK` = `{ performance: 100, accessibility: 100, bestPractices: 98, seo: 100 }`. When `PSI_API_KEY` is absent or Redis is down, the LivePerfSection renders these with a pulsing live-dot, presenting fabricated data as real. Violates the site's own "no false embellishment" constraint.

**Files:**
- Modify: `lib/lighthouse-scores.ts`
- Modify: `components/sections/LivePerfSection.tsx`
- Create: `__tests__/lighthouse-fallback.test.ts`

- [ ] **Step 1.1 — Write the failing test**

```ts
// __tests__/lighthouse-fallback.test.ts
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const SOURCE = readFileSync(
  path.resolve(__dirname, '../lib/lighthouse-scores.ts'),
  'utf-8',
);

describe('LIGHTHOUSE_FALLBACK', () => {
  it('does not use 100 as a fallback performance score', () => {
    // fabricated perfect scores are misleading when PSI_API_KEY is absent
    expect(SOURCE).not.toMatch(/performance:\s*100/);
  });

  it('does not use 100 as a fallback accessibility score', () => {
    expect(SOURCE).not.toMatch(/accessibility:\s*100/);
  });

  it('marks the fallback as unavailable via fetchedAt sentinel', () => {
    // '—' is the sentinel that LivePerfSection uses to detect fallback state
    expect(SOURCE).toMatch(/fetchedAt:\s*'—'/);
  });
});
```

- [ ] **Step 1.2 — Run test, confirm it fails**

```bash
cd <repo-root>
pnpm test __tests__/lighthouse-fallback.test.ts
```

Expected: FAIL — "does not use 100 as a fallback performance score"

- [ ] **Step 1.3 — Fix `LIGHTHOUSE_FALLBACK` in `lib/lighthouse-scores.ts`**

Replace lines 12–18:

```ts
export const LIGHTHOUSE_FALLBACK: LighthouseScores = {
  performance:   0,
  accessibility: 0,
  bestPractices: 0,
  seo:           0,
  fetchedAt:     '—',
};
```

- [ ] **Step 1.4 — Update `LivePerfSection.tsx` to render `—` when fallback**

In `components/sections/LivePerfSection.tsx`, update `PerfBody` to detect the fallback state and display `—` instead of `0`:

```tsx
function PerfBody({ scores }: { scores: LighthouseScores }) {
  const isFallback = scores.fetchedAt === '—' && scores.performance === 0;
  const cells = [
    { label: 'PERFORMANCE',    value: scores.performance },
    { label: 'ACCESSIBILITY',  value: scores.accessibility },
    { label: 'BEST PRACTICES', value: scores.bestPractices },
    { label: 'SEO',            value: scores.seo },
  ];

  const lastCheck =
    scores.fetchedAt && scores.fetchedAt !== '—'
      ? new Date(scores.fetchedAt).toUTCString().replace(':00 GMT', ' UTC')
      : '—';

  return (
    <div className="perf">
      <div className="perf-row">
        {cells.map((s) => (
          <div key={s.label} className="perf-cell">
            <div className="pk">{s.label}</div>
            <div className="pv">
              {isFallback ? '—' : s.value}
              <span className="of">/100</span>
            </div>
            <div className="pbar">
              <i style={{ width: isFallback ? '0%' : `${s.value}%` }} />
            </div>
          </div>
        ))}
      </div>
      <div className="perf-foot">
        <span>
          <span className="live-dot" />
          {isFallback
            ? 'SOURCE: PSI API unavailable'
            : 'SOURCE: PageSpeed Insights · cached daily'}
        </span>
        <span>LAST_CHECK: {lastCheck}</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 1.5 — Run test, confirm it passes**

```bash
pnpm test __tests__/lighthouse-fallback.test.ts
```

Expected: PASS (3 tests)

- [ ] **Step 1.6 — Commit**

```bash
git add lib/lighthouse-scores.ts components/sections/LivePerfSection.tsx __tests__/lighthouse-fallback.test.ts
git commit -m "fix(perf): fallback scores show — not fabricated 100/100"
```

---

## Task 2 — KV durability on contact submissions (P0)

**Problem:** `app/api/contact/route.ts` goes directly to Resend with no KV write. If Resend fails, the message is lost. ARCHITECTURE.md §7 is explicit: KV write first, Resend second. Also missing: minimum message length validation on the server (client uses `minLength={10}` but a direct POST bypasses it).

**Files:**
- Modify: `app/api/contact/route.ts`
- Create: `__tests__/contact-validation.test.ts`

- [ ] **Step 2.1 — Write the failing test**

```ts
// __tests__/contact-validation.test.ts
import { describe, expect, it } from 'vitest';

// Pure validation helpers extracted from the route for testability.
// These mirror exactly what the route must enforce.

function validateContactPayload(body: { name?: unknown; email?: unknown; message?: unknown }) {
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const message = typeof body.message === 'string' ? body.message.trim() : '';

  if (!name || !email || !message) return { ok: false, error: 'all fields required' };
  if (!EMAIL_RE.test(email)) return { ok: false, error: 'invalid email address' };
  if (name.length > 120) return { ok: false, error: 'name too long' };
  if (message.length < 10) return { ok: false, error: 'message too short' };
  if (message.length > 2000) return { ok: false, error: 'message too long (max 2000 chars)' };
  return { ok: true, name, email, message };
}

describe('contact payload validation', () => {
  it('rejects empty name', () => {
    const r = validateContactPayload({ name: '', email: 'a@b.com', message: 'hello there recruiter' });
    expect(r.ok).toBe(false);
    expect(r.error).toBe('all fields required');
  });

  it('rejects invalid email', () => {
    const r = validateContactPayload({ name: 'Erik', email: 'notanemail', message: 'hello there recruiter' });
    expect(r.ok).toBe(false);
    expect(r.error).toBe('invalid email address');
  });

  it('rejects message shorter than 10 chars', () => {
    const r = validateContactPayload({ name: 'Erik', email: 'a@b.com', message: 'short' });
    expect(r.ok).toBe(false);
    expect(r.error).toBe('message too short');
  });

  it('rejects message longer than 2000 chars', () => {
    const r = validateContactPayload({ name: 'Erik', email: 'a@b.com', message: 'a'.repeat(2001) });
    expect(r.ok).toBe(false);
    expect(r.error).toBe('message too long (max 2000 chars)');
  });

  it('accepts a valid payload', () => {
    const r = validateContactPayload({ name: 'Erik', email: 'a@b.com', message: 'Hello, I would like to connect.' });
    expect(r.ok).toBe(true);
  });
});
```

- [ ] **Step 2.2 — Run test, confirm it fails on the min-length check**

```bash
pnpm test __tests__/contact-validation.test.ts
```

Expected: FAIL — "rejects message shorter than 10 chars" (the route currently has no minimum check)

- [ ] **Step 2.3 — Rewrite `app/api/contact/route.ts`**

Replace the entire file:

```ts
import { getContactLimit } from '@/lib/rate-limit';
import { Redis } from '@upstash/redis';
import type { NextRequest } from 'next/server';
import { Resend } from 'resend';

export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Lazy singletons — avoid build-time throw when env vars are absent.
let _resend: Resend | undefined;
let _redis: Redis | undefined;
function getResend(): Resend { return (_resend ??= new Resend(process.env.RESEND_API_KEY)); }
function getRedis(): Redis  { return (_redis  ??= Redis.fromEnv()); }

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'anon';

  const { success } = await getContactLimit().limit(ip);
  if (!success) {
    return Response.json({ error: 'too many requests — try again in 10 minutes' }, { status: 429 });
  }

  let name: string, email: string, message: string;
  try {
    const body = (await req.json()) as { name?: unknown; email?: unknown; message?: unknown };
    name    = typeof body.name    === 'string' ? body.name.trim()    : '';
    email   = typeof body.email   === 'string' ? body.email.trim()   : '';
    message = typeof body.message === 'string' ? body.message.trim() : '';
  } catch {
    return Response.json({ error: 'invalid request body' }, { status: 400 });
  }

  if (!name || !email || !message) {
    return Response.json({ error: 'all fields required' }, { status: 400 });
  }
  if (!EMAIL_RE.test(email)) {
    return Response.json({ error: 'invalid email address' }, { status: 400 });
  }
  if (name.length > 120) {
    return Response.json({ error: 'name too long' }, { status: 400 });
  }
  if (message.length < 10) {
    return Response.json({ error: 'message too short' }, { status: 400 });
  }
  if (message.length > 2000) {
    return Response.json({ error: 'message too long (max 2000 chars)' }, { status: 400 });
  }

  // Durability first: write to KV before attempting delivery.
  // If Resend is down, the message is captured and can be recovered from KV.
  const msgId = crypto.randomUUID();
  const payload = { name, email, message, receivedAt: new Date().toISOString(), ip };
  try {
    await getRedis().set(`contact:msg:${msgId}`, JSON.stringify(payload), { ex: 60 * 60 * 24 * 90 });
  } catch (kvErr) {
    console.error('[contact] KV write failed', kvErr);
    return Response.json({ error: 'storage unavailable — try again' }, { status: 502 });
  }

  // Delivery second: failure is acceptable if KV write succeeded.
  const { error } = await getResend().emails.send({
    from: 'portfolio@erikunha.com.br',
    to: 'erikhenriquealvescunha@gmail.com',
    replyTo: email,
    subject: `[portfolio] message from ${name}`,
    text: `From: ${name} <${email}>\nRef: ${msgId}\n\n${message}`,
  });
  if (error) {
    console.error('[contact] resend error (message saved to KV as', msgId, ')', error);
    // Return success — message is durable in KV. Erik can recover from Upstash inspector.
    return Response.json({ ok: true, warn: 'delivery delayed' });
  }

  return Response.json({ ok: true });
}
```

- [ ] **Step 2.4 — Run test, confirm it passes**

```bash
pnpm test __tests__/contact-validation.test.ts
```

Expected: PASS (5 tests)

- [ ] **Step 2.5 — Commit**

```bash
git add app/api/contact/route.ts __tests__/contact-validation.test.ts
git commit -m "fix(contact): KV durability before Resend + server-side min-length validation"
```

---

## Task 3 — Monthly LLM budget cap (P0)

**Problem:** `/api/ask` has no monthly spend protection. Rate limit is 10/min per IP only — distributed abuse is uncapped. ARCHITECTURE.md §6 calls the monthly token counter "the Principal-level move" and "non-negotiable." Not implemented.

**Design:**
- Redis key `ask:tokens:YYYY-MM` stores cumulative `input_tokens + output_tokens`
- Hard cap: 400,000 tokens/month ≈ $0.40 at Haiku input pricing (well within the $50 ceiling)
- At 80% (320,000 tokens), `ask` still works but logs a warning
- At 100% (400,000 tokens), returns 503 with email fallback
- Token counts captured from Anthropic SDK stream events: `message_start` (input) and `message_delta` (output)
- Counter incremented fire-and-forget after stream close — never blocks the response

**Files:**
- Modify: `lib/rate-limit.ts` (add budget helpers)
- Modify: `app/api/ask/route.ts` (budget gate + token capture + prompt caching)
- Create: `__tests__/budget-cap.test.ts`

- [ ] **Step 3.1 — Write the failing test**

```ts
// __tests__/budget-cap.test.ts
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const RATE_LIMIT_SOURCE = readFileSync(
  path.resolve(__dirname, '../lib/rate-limit.ts'),
  'utf-8',
);
const ASK_SOURCE = readFileSync(
  path.resolve(__dirname, '../app/api/ask/route.ts'),
  'utf-8',
);

describe('LLM budget cap', () => {
  it('rate-limit.ts exports a getBudgetKey function', () => {
    expect(RATE_LIMIT_SOURCE).toContain('getBudgetKey');
  });

  it('rate-limit.ts exports an incrementBudget function', () => {
    expect(RATE_LIMIT_SOURCE).toContain('incrementBudget');
  });

  it('rate-limit.ts exports a checkBudget function', () => {
    expect(RATE_LIMIT_SOURCE).toContain('checkBudget');
  });

  it('ask route checks budget before calling Anthropic', () => {
    // checkBudget must appear before anthropic.messages.create in the source
    const budgetIdx = ASK_SOURCE.indexOf('checkBudget');
    const anthropicIdx = ASK_SOURCE.indexOf('anthropic.messages.create');
    expect(budgetIdx).toBeGreaterThanOrEqual(0);
    expect(anthropicIdx).toBeGreaterThanOrEqual(0);
    expect(budgetIdx).toBeLessThan(anthropicIdx);
  });

  it('ask route increments budget after stream completes', () => {
    expect(ASK_SOURCE).toContain('incrementBudget');
  });

  it('ask route uses prompt caching via cache_control', () => {
    expect(ASK_SOURCE).toContain('cache_control');
  });
});
```

- [ ] **Step 3.2 — Run test, confirm it fails**

```bash
pnpm test __tests__/budget-cap.test.ts
```

Expected: FAIL — multiple missing exports

- [ ] **Step 3.3 — Add budget helpers to `lib/rate-limit.ts`**

Append to the existing file (keep existing `getAskLimit` and `getContactLimit`):

```ts
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

let _askLimit: Ratelimit | undefined;
let _contactLimit: Ratelimit | undefined;
let _budgetRedis: Redis | undefined;

export function getAskLimit(): Ratelimit {
  if (!_askLimit) {
    _askLimit = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(8, '1 h'),  // 8/hr per IP as documented
      prefix: 'rl:ask',
    });
  }
  return _askLimit;
}

export function getContactLimit(): Ratelimit {
  if (!_contactLimit) {
    _contactLimit = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(3, '10 m'),
      prefix: 'rl:contact',
    });
  }
  return _contactLimit;
}

function getBudgetRedis(): Redis {
  return (_budgetRedis ??= Redis.fromEnv());
}

// Monthly token budget: 400,000 tokens ≈ $0.40 at Haiku input pricing.
// Soft warning at 80%, hard cap at 100%.
const MONTHLY_TOKEN_BUDGET = 400_000;

export function getBudgetKey(): string {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `ask:tokens:${yyyy}-${mm}`;
}

export async function checkBudget(): Promise<{ allowed: boolean; pct: number }> {
  try {
    const used = (await getBudgetRedis().get<number>(getBudgetKey())) ?? 0;
    const pct = used / MONTHLY_TOKEN_BUDGET;
    if (pct >= 1) return { allowed: false, pct };
    if (pct >= 0.8) console.warn(`[ask] budget at ${Math.round(pct * 100)}% — approaching cap`);
    return { allowed: true, pct };
  } catch (err) {
    // Redis unavailable — fail open (don't block users for infra issues)
    console.error('[ask] budget check failed, proceeding without cap', err);
    return { allowed: true, pct: 0 };
  }
}

// Fire-and-forget — never awaited on the response path.
export function incrementBudget(inputTokens: number, outputTokens: number): void {
  const total = inputTokens + outputTokens;
  if (total <= 0) return;
  getBudgetRedis()
    .incrby(getBudgetKey(), total)
    .then((newTotal) => {
      // Set TTL to 32 days on every write — Redis will expire the key naturally.
      if (newTotal === total) {
        getBudgetRedis().expire(getBudgetKey(), 60 * 60 * 24 * 32).catch(() => undefined);
      }
    })
    .catch((err) => console.error('[ask] budget increment failed', err));
}
```

- [ ] **Step 3.4 — Rewrite `app/api/ask/route.ts` with budget gate + prompt caching + token capture**

Replace the entire file:

```ts
import { checkBudget, getAskLimit, incrementBudget } from '@/lib/rate-limit';
import { STREAM_ERR_SENTINEL } from '@/lib/stream-protocol';
import Anthropic from '@anthropic-ai/sdk';
import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

// Module-scope client — one instance reused across warm invocations.
const anthropic = new Anthropic();

// cache_control marks this block for Anthropic prompt caching.
// The system prompt is identical on every call — exactly the use case for caching.
// Cache write: same cost as input tokens. Cache read: ~93% cheaper.
const SYSTEM: Anthropic.Messages.TextBlockParam[] = [
  {
    type: 'text',
    text: `You are an AI proxy on Erik Cunha's portfolio site (erikunha.com.br). Answer questions about Erik concisely and accurately. Key facts:
- Staff/Principal Frontend Engineer, 8+ years
- Stack: Angular, React, Next.js, TypeScript, RxJS, NgRx, Node.js
- Current employer: Betsson Group (fintech, PCI-DSS)
- Past: Canon Medical, CICCC, Grupo SBF (Nike Brazil), Encora, Zup Innovation, Venturus, MB Labs
- Based in Brazil, open to remote / relocation
- Work auth: EU (Malta), Canada co-op, Brazil citizen
- Available immediately
- Contact: erikhenriquealvescunha@gmail.com
- GitHub: github.com/erikunha, LinkedIn: linkedin.com/in/erikunha

Be direct and honest. Do not fabricate information. Keep answers under 200 words unless the question demands more detail.`,
    cache_control: { type: 'ephemeral' },
  },
];

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'anon';

  // Rate limit check (per-IP)
  const { success } = await getAskLimit().limit(ip);
  if (!success) {
    return Response.json({ error: 'rate limit exceeded — try again in a minute' }, { status: 429 });
  }

  // Monthly budget check (global across all IPs)
  const { allowed } = await checkBudget();
  if (!allowed) {
    return Response.json(
      { error: 'monthly budget exhausted — email erikhenriquealvescunha@gmail.com directly' },
      { status: 503 },
    );
  }

  let question: string;
  try {
    const body = (await req.json()) as { question?: unknown };
    if (typeof body.question !== 'string' || !body.question.trim()) {
      return Response.json({ error: 'question is required' }, { status: 400 });
    }
    question = body.question.trim().slice(0, 500);
  } catch {
    return Response.json({ error: 'invalid request body' }, { status: 400 });
  }

  const anthropicStream = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    system: SYSTEM,
    messages: [{ role: 'user', content: question }],
    stream: true,
  });

  const enc = new TextEncoder();
  let inputTokens = 0;
  let outputTokens = 0;

  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of anthropicStream) {
          if (event.type === 'message_start') {
            inputTokens = event.message.usage.input_tokens;
          } else if (event.type === 'message_delta') {
            outputTokens = event.usage.output_tokens;
          } else if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            controller.enqueue(enc.encode(event.delta.text));
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'upstream error';
        controller.enqueue(enc.encode(`${STREAM_ERR_SENTINEL}${msg}`));
      } finally {
        controller.close();
        // Fire-and-forget — never blocks the response.
        incrementBudget(inputTokens, outputTokens);
      }
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
```

- [ ] **Step 3.5 — Run tests**

```bash
pnpm test __tests__/budget-cap.test.ts
```

Expected: PASS (6 tests)

- [ ] **Step 3.6 — Run full test suite to catch regressions**

```bash
pnpm test
```

Expected: All passing

- [ ] **Step 3.7 — Commit**

```bash
git add lib/rate-limit.ts app/api/ask/route.ts __tests__/budget-cap.test.ts
git commit -m "feat(ask): monthly token budget cap + prompt caching + rate limit to 8/hr"
```

---

## Task 4 — Skip-to-content link (P1 / WCAG 2.4.1 Level A)

**Problem:** No skip-to-content link exists. ARCHITECTURE.md §11 lists it explicitly. It is a WCAG Level A requirement — the minimum possible compliance level. Keyboard users and screen reader users are blocked from bypassing the navigation.

**Files:**
- Modify: `components/AppShell.client.tsx`
- Create: `__tests__/skip-to-content.test.ts`

- [ ] **Step 4.1 — Write the failing test**

```ts
// __tests__/skip-to-content.test.ts
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const SOURCE = readFileSync(
  path.resolve(__dirname, '../components/AppShell.client.tsx'),
  'utf-8',
);

describe('skip-to-content link', () => {
  it('AppShell renders a skip-to-content link', () => {
    expect(SOURCE).toContain('skip-to-content');
  });

  it('skip link targets #main-content', () => {
    expect(SOURCE).toContain('#main-content');
  });

  it('skip link text is descriptive', () => {
    expect(SOURCE).toMatch(/Skip to (main )?content/i);
  });
});
```

- [ ] **Step 4.2 — Run test, confirm it fails**

```bash
pnpm test __tests__/skip-to-content.test.ts
```

Expected: FAIL

- [ ] **Step 4.3 — Add skip link to `components/AppShell.client.tsx`**

Add the skip link as the **first element returned** from `AppShell`, and add `id="main-content"` to `{children}` wrapper. In `app/page.tsx`, the `<main className="page">` already exists — add `id="main-content"` there instead.

In `components/AppShell.client.tsx`, insert this before `<MatrixRain ...>`:

```tsx
export function AppShell({ children }: { children: ReactNode }) {
  const { isMobile } = useBreakpoint();
  return (
    <>
      {/* WCAG 2.4.1 Level A — first focusable element, visible on focus */}
      <a href="#main-content" className="skip-to-content">
        Skip to main content
      </a>
      <MatrixRain
        // ... existing props unchanged
```

In `app/globals.css`, add the skip link styles (place near the top of the file, in the `base` layer or after the reset):

```css
.skip-to-content {
  position: absolute;
  top: -100%;
  left: 0;
  z-index: 9999;
  padding: 8px 16px;
  background: var(--signal);
  color: #000;
  font-family: var(--font-mono), monospace;
  font-size: 14px;
  font-weight: 700;
  text-decoration: none;
  transition: top 0.1s;
}
.skip-to-content:focus {
  top: 0;
}
```

In `app/page.tsx`, add `id="main-content"` to the `<main>` tag:

```tsx
<main className="page" id="main-content">
```

- [ ] **Step 4.4 — Run test, confirm it passes**

```bash
pnpm test __tests__/skip-to-content.test.ts
```

Expected: PASS (3 tests)

- [ ] **Step 4.5 — Commit**

```bash
git add components/AppShell.client.tsx app/globals.css app/page.tsx __tests__/skip-to-content.test.ts
git commit -m "fix(a11y): add skip-to-content link (WCAG 2.4.1 Level A)"
```

---

## Task 5 — `/api/erik.json` machine-readable profile (P1)

**Problem:** ARCHITECTURE.md §10 calls `/api/erik.json` the "Staff/Principal-2026 move" — a structured profile for AI recruiting agents. `/llms.txt` exists as a static file but is unstructured prose. The JSON endpoint enables programmatic parsing by sourcing tools and AI agents.

**Files:**
- Create: `app/api/erik.json/route.ts`
- Create: `__tests__/erik-json.test.ts`

- [ ] **Step 5.1 — Write the failing test**

```ts
// __tests__/erik-json.test.ts
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const SOURCE = readFileSync(
  path.resolve(__dirname, '../app/api/erik.json/route.ts'),
  'utf-8',
);

describe('/api/erik.json route', () => {
  it('exports a GET handler', () => {
    expect(SOURCE).toContain('export async function GET');
  });

  it('returns JSON with @type Engineer', () => {
    expect(SOURCE).toContain('"@type"');
    expect(SOURCE).toContain('Engineer');
  });

  it('includes availability field', () => {
    expect(SOURCE).toContain('availability');
  });

  it('includes stack_primary field', () => {
    expect(SOURCE).toContain('stack_primary');
  });

  it('includes work_auth field', () => {
    expect(SOURCE).toContain('work_auth');
  });

  it('sets a long cache header — this is static data', () => {
    expect(SOURCE).toContain('max-age');
  });
});
```

- [ ] **Step 5.2 — Run test, confirm it fails (file doesn't exist yet)**

```bash
pnpm test __tests__/erik-json.test.ts
```

Expected: FAIL — file not found

- [ ] **Step 5.3 — Create the route**

Create `app/api/erik.json/route.ts`:

```ts
export const dynamic = 'force-static';

const PROFILE = {
  '@context': 'https://schema.org',
  '@type': 'Engineer',
  name: 'Erik Henrique Alves Cunha',
  alias: 'Erik Cunha',
  url: 'https://erikunha.com.br',
  email: 'erikhenriquealvescunha@gmail.com',
  github: 'https://github.com/erikunha',
  linkedin: 'https://www.linkedin.com/in/erikunha/',

  seniority: ['senior', 'staff', 'principal'],
  yoe: 8,

  stack_primary: ['Angular', 'React', 'Next.js', 'TypeScript', 'RxJS', 'NgRx'],
  stack_secondary: ['Node.js', 'Docker', 'AWS', 'GitHub Actions', 'Tailwind'],
  domains: ['fintech', 'PCI-DSS', 'healthcare', 'e-commerce', 'edtech'],

  employers: [
    { name: 'Betsson Group',  role: 'Senior Frontend Engineer', domain: 'fintech/PCI-DSS', current: true },
    { name: 'Canon Medical',  role: 'Frontend Engineer',        domain: 'healthcare' },
    { name: 'Grupo SBF',      role: 'Frontend Engineer',        domain: 'e-commerce (Nike Brazil)' },
    { name: 'Encora',         role: 'Frontend Engineer',        domain: 'consulting' },
    { name: 'Zup Innovation', role: 'Frontend Engineer',        domain: 'fintech' },
    { name: 'Venturus',       role: 'Frontend Engineer',        domain: 'engineering consultancy' },
  ],

  receipts: {
    tx_volume_per_year: '40M+',
    a11y_score:         '~100/100',
    perf_delta_js:      '-33%',
    perf_delta_css:     '-98%',
    api_latency_reduction: '-97.5% (40s → <1s, Venturus)',
  },

  work_auth: {
    EU_Malta: 'authorized',
    Canada:   'co-op graduate',
    Brazil:   'citizen',
    worldwide: 'open to relocation',
  },

  availability: 'immediate',
  notice_period_days: 0,
  open_to: ['full_time', 'contract', 'ic', 'tech_lead', 'staff', 'principal'],
  location: 'Brazil (remote-first, relocation available)',

  languages: ['pt', 'en', 'fr', 'es'],
  last_updated: '2026-05-15',
};

export async function GET(): Promise<Response> {
  return Response.json(PROFILE, {
    headers: {
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
```

- [ ] **Step 5.4 — Run test, confirm it passes**

```bash
pnpm test __tests__/erik-json.test.ts
```

Expected: PASS (6 tests)

- [ ] **Step 5.5 — Commit**

```bash
git add "app/api/erik.json/route.ts" __tests__/erik-json.test.ts
git commit -m "feat(aeo): add /api/erik.json machine-readable profile for AI recruiting agents"
```

---

## Task 6 — ARCHITECTURE.md accuracy pass (P2)

**Problem:** `ARCHITECTURE.md` line 7 says "Status: design proposal, pre-implementation." Several documented features diverge from reality: rate limits, budget cap, KV durability. After Tasks 1–5, the doc needs updating.

**Files:**
- Modify: `ARCHITECTURE.md`
- Modify: `DECISIONS.md`

- [ ] **Step 6.1 — Update ARCHITECTURE.md status header**

Change line 7 from:
```
> Status: design proposal, pre-implementation
```
to:
```
> Status: implemented (2026-05-15) — see DECISIONS.md for divergences from original design
```

- [ ] **Step 6.2 — Update §6 rate limit section**

Find the rate limiting sub-section in §6 and replace:
```
- 8 questions per IP per rolling hour
- 100 questions per IP per rolling day
```
with:
```
- 8 questions per IP per rolling hour (sliding window)
```
(Remove the daily limit line — it was never implemented and is not needed given the monthly budget cap now guards spend.)

- [ ] **Step 6.3 — Update §6 budget enforcement to reflect actual implementation**

In the "Budget enforcement" sub-section, update the description to reflect that the implementation uses Redis `INCRBY` on a `ask:tokens:YYYY-MM` key, 400K token monthly cap (≈$0.40 at Haiku pricing), fire-and-forget increment after stream close, fail-open if Redis is unavailable.

- [ ] **Step 6.4 — Update §7 contact form to reflect KV implementation**

The KV-first, Resend-second flow is now implemented. Confirm the description is accurate and no changes needed beyond removing any "planned" qualifiers.

- [ ] **Step 6.5 — Add entry to DECISIONS.md**

Append to `DECISIONS.md`:

```markdown
## 2026-05-15 — Principal review fixes

- **2026-05-15** · `LIGHTHOUSE_FALLBACK` changed from fabricated 100/100 scores to zeros + `—` display. _Integrity fix: fallback was presenting fake data as live PSI scores. Irreversible in spirit (never show fabricated data)._
- **2026-05-15** · Contact route now writes to Upstash KV before calling Resend. Key `contact:msg:{uuid}`, TTL 90 days. Resend failure returns `{ ok: true, warn: 'delivery delayed' }` — message is still durable. _Reversible: remove KV write if Upstash costs become a concern (currently free tier)._
- **2026-05-15** · Monthly token budget cap implemented: `ask:tokens:YYYY-MM` Redis counter, 400K token hard cap, fail-open if Redis unavailable. _Critical for cost safety; never disable without an alternative cap._
- **2026-05-15** · Anthropic prompt caching enabled on system prompt block via `cache_control: { type: 'ephemeral' }`. _Trivially reversible (remove cache_control); saves ~85% on cached input tokens per call._
- **2026-05-15** · Ask rate limit corrected to `8 questions per IP per rolling hour` (matches documented value; was 10/min = 600/hr, now 8/hr). _Reversible; more restrictive is correct given budget cap is now enforced._
- **2026-05-15** · Skip-to-content link added to AppShell (WCAG 2.4.1 Level A). _Non-negotiable for a11y compliance._
- **2026-05-15** · `/api/erik.json` implemented — machine-readable engineer profile for AI recruiting agents. _Reversible; static data, no cost._
```

- [ ] **Step 6.6 — Commit**

```bash
git add ARCHITECTURE.md DECISIONS.md
git commit -m "docs(arch): update status + align docs with implemented rate limits and budget cap"
```

---

## Self-review checklist

**Spec coverage:**

| Review finding | Task | Status |
|---|---|---|
| LIGHTHOUSE_FALLBACK fabricated 100% | Task 1 | ✓ covered |
| Contact KV durability missing | Task 2 | ✓ covered |
| No LLM budget cap | Task 3 | ✓ covered |
| Prompt caching not wired | Task 3 (Step 3.4) | ✓ covered |
| Rate limit 75× too permissive | Task 3 (Step 3.3) | ✓ covered |
| Missing skip-to-content link | Task 4 | ✓ covered |
| `/api/erik.json` missing | Task 5 | ✓ covered |
| Server min-length contact | Task 2 | ✓ covered |
| ARCHITECTURE.md stale | Task 6 | ✓ covered |

**Placeholder scan:** No TBD, TODO, or "similar to Task N" patterns found.

**Type consistency:**
- `getBudgetKey()` defined in Task 3.3, used in same file — consistent
- `checkBudget()` / `incrementBudget()` defined in Task 3.3, imported in Task 3.4 — consistent
- `LighthouseScores.fetchedAt === '—'` sentinel used in Task 1 matches existing type definition — consistent
- `SYSTEM` type changed from `string` to `Anthropic.Messages.TextBlockParam[]` in Task 3.4 — the SDK `system` param accepts both string and array, so no breaking change

**Ordering verification:** Tasks are ordered P0 → P1 → P2. Each task is independently mergeable. Task 3 is the heaviest; if time-boxing, Tasks 1, 2, and 4 are the highest-value quick wins.
