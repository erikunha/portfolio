---
paths:
  - "app/api/**"
  - "lib/rate-limit.ts"
  - "lib/server/**"
  - "proxy.ts"
---
> **Codex note:** mirror of a `.claude/` harness file. Any "the hook blocks", "enforced", "WIRED", or "exit 2" claim here — including in this file's description — is a **Claude Code** control. Codex hook activation is not wired in this repo, so for Codex treat these as **hard rules to self-enforce**, not automated gates. See `AGENTS.md` / `DECISIONS.md`.


# API & server boundary rules

Path-scoped: loads only when working on API/server files. Full rationale in
`STANDARDS.md` Ch.2 (API & Server Boundary) and Ch.9 (Security & Privacy). The
hard gates below are enforced by hooks regardless of whether this file is in
context; this is the implementation guidance, not the enforcement.

## Handler contract

- Route handlers go through `defineHandler`, which enforces the response
  envelope and the fixed order: **rate-limit → parse → validate → handle**. Do
  not reorder; the order is a security property (reject before parsing untrusted
  input). Held by behavioral tests + e2e, not source-grep.
- Read env only through the Zod accessor `lib/env.ts`. Never read
  `process.env.*` directly in a handler.
- Rate limiting is Upstash sliding-window via `lib/rate-limit.ts` and is
  **fail-open** (Redis down must not 500 the user). Keep that property.

## Security gate (hook-enforced)

- Editing `app/api/**`, `lib/rate-limit.ts`, or `proxy.ts` records a marker
  (`.claude/.api-edit-pending`) via the PostToolUse `api-edit-marker.sh` hook.
  The next `git push` is blocked by `api-security-push-guard.sh` until a
  `security-auditor` agent is dispatched after that edit. Dispatch
  `security-auditor` as part of the change, not as an afterthought.
- CSP and `Reporting-Endpoints` headers come from **`proxy.ts`**, not
  `next.config.ts` (which sets the static headers: COOP, X-Frame-Options, HSTS,
  etc.). The CSP is asserted against the live host by the deploy smoke test, not
  a unit test.

## Skill dispatch

- After editing `app/api/`, `lib/server/route.ts`, `lib/rate-limit.ts`, or
  `proxy.ts`, invoke the `vercel:vercel-functions` skill.
- (`next.config.ts` / `.env.example` / Vercel config are not in this rule's
  paths; the `vercel:nextjs` trigger for those stays in AGENTS.md.)

## The `/api/ask` AI feature

- Single model source of truth: `lib/ask/model.ts` (`ASK_MODEL` =
  `anthropic/claude-haiku-4-5`); the eval harness imports the same const so it
  grades the shipped model. Do not hardcode a model string in the route.
- Ephemeral prompt cache via `providerOptions.anthropic.cacheControl` on the
  system message; output capped (`MAX_OUTPUT_TOKENS`), request-timeout guarded.
- Changes to the ask corpus/calibration/system-prompt trigger the
  `ai-eval-update` skill and `pnpm ask:eval`.
