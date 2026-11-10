---
name: plan-review
description: Review a spec or implementation plan against this repository's hard limits before any code is written. Use when a plan adds a client island or dependency, touches app/api, lib/rate-limit.ts or proxy.ts, proposes new infrastructure, or could move a Lighthouse or route-JS budget. Returns PASS or BLOCK with the first failed gate. Do not use to review code that already exists.
---

# Plan review

Run four gates in order against the spec or plan. Stop at the first BLOCK and name the gate and
the specific item. Read current values from the code; do not trust a number quoted in a plan.

## Gate 1: scope

Does any item appear in the out-of-scope list in AGENTS.md, or in DECISIONS.md as a rejected
pattern (GraphQL, Cloudflare Workers, multi-region deploy, Sentry by default, CAPTCHA on the contact
form, per-section routes, a state management library, MDX as a content engine, a CMS, CSS modules,
CSS-in-JS)? If yes, BLOCK and cite the entry. If DECISIONS.md rejected it, the plan must say what
changed since.

## Gate 2: client JS

Does the plan add a `'use client'` file, a client island or a dependency that reaches a client
bundle? If yes, it must state which route pays for it and how much it costs against the per-route
headroom. Build and run `pnpm route-js-check` for the current figures: a framework bump can use
the headroom with no app change. BLOCK when the plan gives no budget argument.

## Gate 3: server surface

Does the plan touch `app/api/**`, `lib/rate-limit.ts` or `proxy.ts`? Then it must keep:

- the handler order `defineHandler` enforces (rate limit before parse, validate, handle), with env read only through `lib/env.ts`;
- the `/api/ask` token budget failing closed while the rate limits fail open;
- the ephemeral prompt cache (`providerOptions.anthropic.cacheControl`) on the system `instructions` and the single model constant in `lib/ask/model.ts`;
- the `ASK_ENABLED` kill switch checked first in `lib/ask/preflight.ts`, before rate limiting and token reservation, answering 503 for its off keywords;
- the CSP in `proxy.ts` and the static headers in `next.config.ts` where they are.

Grep each named symbol and compare with the plan. BLOCK on any constraint the plan does not clearly
preserve.

## Gate 4: gate regression

Could the plan lower Lighthouse performance, accessibility, best practices or SEO below the floors in
`lighthouserc.json` and `lighthouserc.mobile.json`, or move a screenshot baseline? If yes, the plan
needs a measurement step and a baseline regeneration step. This gate does not BLOCK; it adds the
tasks.

## Output

End with exactly these lines:

```text
GATE_RESULT: PASS | BLOCK
BLOCKED_BY: <gate and specific item, or none>
ADDED_TASKS: <measurement or baseline tasks gate 4 requires, or none>
```
