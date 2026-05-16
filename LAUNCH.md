# Launch Playbook — Portfolio Production

> From prototype to deployed at erikunha.com.br
> Companion to ARCHITECTURE.md (system design) and DECISIONS.md (ADR log)
> Started: 2026-05-13
> Estimated to ship: 2 focused weeks part-time, ~40 hours total

This is the operational sequence. ARCHITECTURE.md tells you what to build; this tells you what to do **next**, in order, with the commands.

---

## Day 1 — Account + repo setup (1-2 hours)

**Goal:** every external account exists, the repo is initialized, Vercel sees it.

### Accounts (free tiers)

- [ ] **Anthropic API key** — console.anthropic.com → create key, set spend cap at $50/month, save the key
- [ ] **Upstash Redis** — upstash.com → create one Redis database (region: us-east-1 or fra1, free tier) → grab URL + token
- [ ] **Resend** — resend.com → sign up, verify your domain `erikunha.com.br` for sending, grab API key
- [ ] **Vercel** — vercel.com → sign in with GitHub, connect erikunha.com.br domain (DNS records: A or CNAME per Vercel docs)
- [ ] **PageSpeed Insights API** — console.cloud.google.com → enable PSI API → grab key (free, daily quota plenty)

### Export the prototype HTML

- [ ] In Claude Design: `Portfolio.html` tab → Share → Download. Save it as `prototype/Portfolio.html` in the repo (committed for reference, NOT served).

### Local repo

> **Package policy:** every dependency installed `@latest` at scaffold time, then `pnpm up --latest` after install to bump any transitive deps that resolved older. Lockfile (`pnpm-lock.yaml`) is the source of truth from PR 1 onward. Renovate or Dependabot can be wired in later for automated bumps.

```bash
cd <repo-root>

# verify pnpm is current (10.x or newer as of 2026)
pnpm --version
pnpm self-update  # if older than 10

# scaffold next.js (latest stable)
pnpm create next-app@latest . \
  --typescript --eslint=false --tailwind --src-dir=false \
  --app --turbopack --import-alias="@/*" --use-pnpm

# remove the eslint defaults — biome replaces them
pnpm remove eslint eslint-config-next

# runtime deps — explicit @latest
pnpm add -E zod@latest
pnpm add @upstash/redis@latest @upstash/ratelimit@latest
pnpm add @anthropic-ai/sdk@latest resend@latest
pnpm add @vercel/analytics@latest @vercel/speed-insights@latest

# dev deps — explicit @latest
pnpm add -D @biomejs/biome@latest typescript@latest @types/node@latest
pnpm add -D @tailwindcss/postcss@latest
pnpm add -D vitest@latest @vitest/ui@latest
pnpm add -D playwright@latest @axe-core/playwright@latest
pnpm add -D @lhci/cli@latest
pnpm add -D @next/bundle-analyzer@latest

# bump everything to absolute latest after install (catches transitive lag)
pnpm up --latest

# drop the scaffold configs over the defaults
cp scaffold/biome.json scaffold/tsconfig.json scaffold/lighthouserc.json scaffold/.npmrc scaffold/postcss.config.mjs ./
cp scaffold/app/globals.css ./app/globals.css
mkdir -p .github/workflows scripts content
cp scaffold/.github/workflows/ci.yml ./.github/workflows/
cp scaffold/scripts/check-bundle-size.mjs ./scripts/
cp scaffold/content/schemas.ts scaffold/content/social.ts ./content/

# install playwright browsers
pnpm playwright install --with-deps chromium

# verify the gates fire on the empty scaffold
pnpm biome check .
pnpm tsc --noEmit
pnpm build
node scripts/check-bundle-size.mjs

git init && git add . && git commit -m "feat: foundation"
gh repo create erikunha/portfolio --public --source=. --remote=origin --push
```

**Why `-E` (exact) on zod:** Zod's release cadence can break consumer code on minor bumps when new validators are added with stricter inference. Exact-pin until you've upgraded once intentionally. Everything else uses caret semver — `pnpm up --latest` is how you bump deliberately.

### Vercel project

```bash
pnpm dlx vercel link
pnpm dlx vercel env add ANTHROPIC_API_KEY production
pnpm dlx vercel env add UPSTASH_REDIS_REST_URL production
pnpm dlx vercel env add UPSTASH_REDIS_REST_TOKEN production
pnpm dlx vercel env add RESEND_API_KEY production
pnpm dlx vercel env add PSI_API_KEY production
pnpm dlx vercel env add IP_HASH_SALT production
# also add same vars for preview and development
```

Drop the opinionated configs from `scaffold/` over the defaults Next.js created. Commit. Push. Confirm Vercel preview deploys green.

**End of Day 1:** empty Next.js app live at `erik-portfolio-<hash>.vercel.app`, all env vars wired, CI green on every PR.

---

## Day 2-3 — PR 1: Foundation hardening + design tokens (3-4 hours)

### Drop in the opinionated configs

Copy from `scaffold/`:
- `biome.json` → repo root
- `tsconfig.json` → replace (strict + noUncheckedIndexedAccess + exactOptionalPropertyTypes)
- `app/globals.css` → terminal palette as CSS vars
- `.github/workflows/ci.yml` → bundle-size + lighthouse + axe gates
- `scripts/check-bundle-size.mjs` → the enforcer
- `lighthouserc.json` → CI gate config

### Verify the gates

```bash
pnpm biome check .
pnpm tsc --noEmit
pnpm build
node scripts/check-bundle-size.mjs
```

All four should pass on an empty `app/page.tsx`.

### Set up the layout shell

`app/layout.tsx`:
- JetBrains Mono via `next/font/local` (self-hosted, not Google CDN — the BUILT_WITH line claims zero external)
- Person JSON-LD inline
- `metadata` export with title/description
- HTML comment at top: `<!-- if you're inspecting this, you're hiring me. erik@erikunha.com.br · https://github.com/erikunha -->`
- console.log greeting script tag

**End of Day 3:** the page is empty but the build, CI, and design-token foundation are bulletproof.

---

## Day 4-5 — PR 2: Content layer (4-6 hours)

### Schemas

`content/schemas.ts` already drafted in scaffold/. Drop it in. Adjust as you write content.

### Content files

Create one per section, drop in real values from your CV + the prototype:

- `content/bio.ts` (README content)
- `content/projects.ts` (6 project tiles)
- `content/employers.ts` (8 git log entries)
- `content/perf-receipts.ts` (8 tiles)
- `content/npm-stack.ts` (12 tiles — Docker/AWS/GitHub Actions/Express included)
- `content/hottest-takes.ts` (**write these in your own voice; the prototype's are placeholders**)
- `content/responsibilities.ts` (permissions matrix)
- `content/guitar-rig.ts` (your real rig + influences)
- `content/unknowns.ts` (the 5 Staff/Principal items)
- `content/visa.ts` + `content/credentials.ts` (after the recent split)
- `content/community.ts` (DevOpsDays)
- `content/man-page.ts` (MAN ERIK content)
- `content/social.ts` (links, contact)

### Validation gate

`scripts/validate-content.mjs` runs all schemas at build time. Build fails if any file violates. Already in the CI workflow.

**End of Day 5:** every piece of content on the page is typed, validated, and diff-friendly. Future-you thanks past-you.

---

## Day 6-9 — PR 3: Static sections (12-16 hours)

The bulk of the work. Each section is a server component that imports its content and renders. Zero JS shipped for any of these.

Suggested order:
1. **Hero shell** (no Matrix loop yet — just the static boot text + top bar)
2. **CAT README.MD** + code sample
3. **CAT ~/.now** + **MAN ERIK(1)**
4. **LS -LA ./PROJECTS** grid
5. **GIT LOG --pretty=fuller** with the graph characters
6. **NPM LIST** grid
7. **SYS_HEALTH_MONITOR** + **PERF_RECEIPTS** wall
8. **CAT ~/.visa** + **CAT ~/.credentials** (new pair)
9. **CAT ~/.community** + **HOTTEST_TAKES** + **RESPONSIBILITIES**
10. **CAT ~/.guitar_rig** + **CAT ~/.unknowns**
11. **SUDO CONTACT --INIT** (form markup only; backend in PR 5)
12. **Shutdown sequence footer**

After each section: `pnpm build && pnpm lhci autorun --collect.url=http://localhost:3000`. Score must stay ≥ 95 perf, = 100 a11y.

**Tactical advice:** copy the Tailwind classes from the prototype HTML directly into your JSX. Don't redesign anything. The visual is locked.

**End of Day 9:** page renders all 18+ sections as static HTML. No JS. Lighthouse passes.

---

## Day 10 — PR 4: Client islands (4-5 hours)

The four interactive pieces. All `.client.tsx` files.

### `components/client/matrix-dialog.client.tsx`

The Matrix dialog loop. **Critical: use `useRef.textContent` mutation, NOT `useState` for per-keystroke updates.** PR includes a Vitest test that asserts no React re-render during typing.

```tsx
'use client';
import { useEffect, useRef } from 'react';

const phrases = ['Wake up, Neo...', 'Wake up...', 'The Matrix has you...', 'Knock, knock, Neo...'];
const TYPE_MS = 80; const HOLD_MS = 2000; const DELETE_MS = 40;

export function MatrixDialog() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      if (ref.current) ref.current.textContent = 'The Matrix has you...';
      return;
    }
    let cancelled = false; let phraseIdx = 0;
    const tick = async () => {
      while (!cancelled) {
        const text = phrases[phraseIdx];
        for (let i = 0; i <= text.length; i++) {
          if (cancelled) return;
          if (ref.current) ref.current.textContent = text.slice(0, i);
          await new Promise(r => setTimeout(r, TYPE_MS));
        }
        await new Promise(r => setTimeout(r, HOLD_MS));
        for (let i = text.length; i >= 0; i--) {
          if (cancelled) return;
          if (ref.current) ref.current.textContent = text.slice(0, i);
          await new Promise(r => setTimeout(r, DELETE_MS));
        }
        phraseIdx = (phraseIdx + 1) % phrases.length;
      }
    };
    tick();
    return () => { cancelled = true; };
  }, []);
  return <span ref={ref} aria-live="off" />;
}
```

Pair with IntersectionObserver to pause when hero is off-screen.

### `components/client/typewriter-on-view.client.tsx`

Wraps any text block. On first scroll-into-view, types out at 22ms/char with a 4s cap for big blocks. Single shared IntersectionObserver instance.

### `components/client/shell.client.tsx`

The `./EXEC INTERACTIVE_SHELL` widget. Handles input, dispatches commands (`whoami`, `face`, `hire`, `ls`, `clear`), and POSTs to `/api/ask` for the `ask` command (streaming response).

### `components/client/contact-form.client.tsx`

Thin wrapper around the Server Action defined in PR 5. Just optimistic UI + error display.

### `components/client/motion-indicator.client.tsx`

Reads `prefers-reduced-motion` via `matchMedia`, listens for changes, updates the badge.

**Total client JS budget after this PR:** ~43KB gzipped. CI fails if over.

---

## Day 11 — PR 5: Contact backend (3-4 hours)

`app/contact/action.ts`:

```ts
'use server';
import { z } from 'zod';
import { Resend } from 'resend';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { headers } from 'next/headers';

const schema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().max(200),
  message: z.string().min(10).max(2000),
  field_company: z.string().max(0),  // honeypot — must be empty
});

const redis = Redis.fromEnv();
const ratelimit = new Ratelimit({ redis, limiter: Ratelimit.tokenBucket(1, '5 m', 1) });

export async function submitContact(formData: FormData) {
  const ip = (await headers()).get('x-forwarded-for')?.split(',')[0] ?? 'unknown';
  const ipHash = await hashIp(ip);
  const { success } = await ratelimit.limit(ipHash);
  if (!success) return { ok: true };  // silent succeed on rate-limit

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: 'invalid' };
  if (parsed.data.field_company !== '') return { ok: true };  // honeypot fired, silent succeed

  // durable first
  const id = crypto.randomUUID();
  await redis.set(`contact:${id}`, JSON.stringify({
    ...parsed.data, at: Date.now(), ipHash,
  }), { ex: 60 * 60 * 24 * 90 });  // 90-day retention

  // delivery second
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: 'portfolio@erikunha.com.br',
      to: 'erikhenriquealvescunha@gmail.com',
      subject: `[portfolio] ${parsed.data.name}`,
      text: `From: ${parsed.data.name} <${parsed.data.email}>\n\n${parsed.data.message}`,
    });
  } catch (e) {
    console.error('resend failed; message saved to KV', id, e);
  }

  return { ok: true };
}

async function hashIp(ip: string) {
  const data = new TextEncoder().encode(ip + process.env.IP_HASH_SALT);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
```

Playwright happy + spam-trap paths.

**End of Day 11:** the form actually delivers email + persists. Test it on the live preview.

---

## Day 12 — PR 6: `/api/ask` endpoint (4-5 hours)

`app/api/ask/route.ts`:

```ts
import Anthropic from '@anthropic-ai/sdk';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

export const runtime = 'edge';

const redis = Redis.fromEnv();
const ratelimit = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(8, '1 h') });

const MONTHLY_TOKEN_CAP = 5_000_000;  // ~$50 at haiku 4.5 prices

const SYSTEM_PROMPT = `You are an AI assistant trained on Erik Henrique Alves Cunha's CV and portfolio.
Answer in Erik's voice: terse, lowercase-leaning, specific. Cite receipts (numbers, employers, dates) when possible.
If you don't know, say so directly. Never fabricate.

CV CONTEXT:
${require('@/content/bio').rawCv}

PROJECTS:
${JSON.stringify(require('@/content/projects').projects)}

RECEIPTS:
${JSON.stringify(require('@/content/perf-receipts').perfReceipts)}
`;

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown';
  const { success } = await ratelimit.limit(ip);
  if (!success) return Response.json({ error: 'rate_limited' }, { status: 429 });

  // budget check
  const month = new Date().toISOString().slice(0, 7);
  const used = Number(await redis.get(`ask:tokens:${month}`) ?? 0);
  if (used > MONTHLY_TOKEN_CAP * 0.95) {
    return Response.json({
      error: 'budget_exhausted',
      fallback: 'erikhenriquealvescunha@gmail.com',
    }, { status: 503 });
  }

  const { q } = await req.json();
  if (typeof q !== 'string' || q.length > 500) {
    return Response.json({ error: 'bad_request' }, { status: 400 });
  }

  // cache lookup
  const qHash = await hash(q);
  const cached = await redis.get(`ask:cache:${qHash}`);
  if (cached) return new Response(cached as string, {
    headers: { 'content-type': 'text/event-stream', 'x-cache': 'HIT' },
  });

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const stream = await anthropic.messages.stream({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 800,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: q }],
  });

  // SSE encode + bump counter on completion
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    async start(controller) {
      let totalTokens = 0;
      let fullText = '';
      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          fullText += chunk.delta.text;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'delta', text: chunk.delta.text })}\n\n`));
        }
        if (chunk.type === 'message_delta' && chunk.usage) {
          totalTokens = chunk.usage.input_tokens + chunk.usage.output_tokens;
        }
      }
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done', tokens: totalTokens })}\n\n`));
      controller.close();
      // bookkeeping
      await redis.incrby(`ask:tokens:${month}`, totalTokens);
      await redis.set(`ask:cache:${qHash}`, fullText, { ex: 60 * 60 * 24 });
    },
  });

  return new Response(body, { headers: { 'content-type': 'text/event-stream' } });
}

async function hash(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
```

Spend alerts in Anthropic console at 80% / 95%.

**End of Day 12:** `ask` answers real questions with your voice, cached aggressively, capped hard.

---

## Day 13 — PR 7: SEO + OG + meta (2-3 hours)

- `app/opengraph-image.tsx` — Next.js dynamic OG, recruiter-safe variant (your name, role, "Open to your role", clean dark bg, NOT the Matrix aesthetic)
- `app/robots.ts` + `app/sitemap.ts` — static
- `app/erik.json/route.ts` — machine-readable profile
- `app/llms.txt/route.ts` — AI-agent manifest
- `app/api/lighthouse/route.ts` — Edge function reading PSI cache from KV
- `app/api/lighthouse-cron/route.ts` — daily Vercel cron, hits PSI API, writes KV

Verify in Slack/LinkedIn link preview, structured-data tester, securityheaders.com (target A+).

---

## Day 14 — PR 8: Polish + ship (3-4 hours)

- [ ] Mobile audit at 375 / 414 / 768 px (real devices if possible)
- [ ] Screen-reader pass on contact form (VoiceOver Mac)
- [ ] axe-core final scan: zero violations
- [ ] Toggle OS reduced-motion → verify MOTION badge flips, dialog loop stops, typewriters skip
- [ ] Spend alerts confirmed firing at 80%/95%
- [ ] securityheaders.com A+
- [ ] Lighthouse production run: ≥95 / =100 / ≥95 / =100
- [ ] Domain DNS propagated; `erikunha.com.br` resolves
- [ ] HSTS, CSP active
- [ ] Vercel Speed Insights enabled
- [ ] Web Analytics enabled
- [ ] Test the `ask` flow end-to-end with a real recruiter-style question
- [ ] Test the contact form delivers to inbox + persists to KV

### Pre-launch content sanity check

- [ ] HOTTEST_TAKES rewritten in Erik's voice (none of my placeholders left)
- [ ] CICCC concurrency note in git log
- [ ] CA visa status verified (PGWP active OR downgraded language)
- [ ] Phone number NOT on page
- [ ] BUILT_WITH line updated if claiming Next.js stack now

### Launch

```bash
git checkout main
git pull
git tag v1.0.0
git push --tags
pnpm dlx vercel --prod
```

Tweet the URL. Post on LinkedIn. Wait for recruiters.

---

## Maintenance cadence (post-launch)

| Frequency | Action |
|---|---|
| Weekly | Glance at Web Analytics + Speed Insights p75 |
| Weekly | Update `~/.now` block (forces freshness) |
| Monthly | Check Anthropic spend; rotate IP hash salt quarterly |
| Quarterly | Review HOTTEST_TAKES — kill any you've stopped defending |
| As needed | When you change roles: update `git log`, `~/.now`, `~/.visa`, `cred` table |

---

## What to do if something breaks

- **Build fails on bundle size:** check the latest client island. Did you accidentally use `useState` where `useRef` was the choice? See Decisions §Matrix loop.
- **Lighthouse perf drops:** Speed Insights tells you which CWV. Probably LCP from the hero image (you don't have one) or INP from the Matrix loop (verify ref.current.textContent mutation pattern is intact).
- **`ask` returns 503 budget_exhausted before month is over:** spike traffic OR someone is abusing. Check `ask:tokens:YYYY-MM` in Redis. Decide: raise cap, tighten rate-limit, or both.
- **Contact form fails silently:** check Vercel logs for the Server Action. KV write should succeed even if Resend fails. The KV is your source of truth.

---

## If you only have 4 hours and want it live this weekend

Compressed plan:
1. Day 1 (1h)
2. Skip PR 1 (just use defaults)
3. Skip PR 2 (hardcode content inline, refactor later)
4. PR 3 in one block: paste the prototype HTML into a single `app/page.tsx` as a giant template literal, render it server-side, ship it
5. Skip PRs 4-6 (no Matrix loop, no shell, no contact backend) — use a `mailto:` link instead
6. Skip PR 7
7. Push to Vercel, point DNS, done

You'd lose the interactive shell, the live dialog loop, the LLM ask, the working contact form — but you'd have a static portfolio under your domain in 4 hours. The full plan above is what makes it good. Pick the version that ships.

---

*— end of playbook —*
