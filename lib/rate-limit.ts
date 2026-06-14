import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { log } from '@/lib/log';

let _redis: Redis | undefined;
let _askLimit: Ratelimit | undefined;
let _contactLimit: Ratelimit | undefined;

export function getRedis(): Redis {
  if (_redis) return _redis;
  // Construct once. If construction throws, _redis stays undefined so the
  // next call retries; the caller's try/catch keeps the request fail-open.
  const instance = Redis.fromEnv();
  _redis = instance;
  return instance;
}

export function getAskLimit(): Ratelimit {
  if (!_askLimit) {
    _askLimit = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(8, '1 h'),
      prefix: 'rl:ask',
    });
  }
  return _askLimit;
}

export function getContactLimit(): Ratelimit {
  if (!_contactLimit) {
    _contactLimit = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(3, '10 m'),
      prefix: 'rl:contact',
    });
  }
  return _contactLimit;
}

let _healthzLimit: Ratelimit | undefined;

export function getHealthzLimit(): Ratelimit {
  if (!_healthzLimit) {
    _healthzLimit = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(120, '1 m'),
      prefix: 'rl:healthz',
    });
  }
  return _healthzLimit;
}

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

// Proxy trust posture for getClientIp:
//
// Header precedence: x-forwarded-for → x-real-ip → 'unknown'.
//
// On Vercel, both headers are set authoritatively by Vercel's edge
// infrastructure BEFORE the request reaches this function. Vercel strips
// any client-injected values for these headers, so spoofing is not
// possible in the Vercel deployment context. Index 0 of x-forwarded-for
// is the real client IP because Vercel rewrites the entire header value,
// guaranteeing all entries are Vercel-controlled and trustworthy.
//
// In local development (no proxy layer): neither header is set by the
// Node server, so the function returns 'unknown'. Rate-limit and
// identical-question gates are keyed to 'unknown' locally, meaning all
// local requests share one bucket — acceptable for a single-developer
// workflow. The MCP ask_erik tool also resolves to 'unknown' for the
// same reason (synthetic Request, no proxy headers); see DECISIONS.md
// 2026-05-21 "MCP ask_erik shares one global rate-limit bucket".
export function getClientIp(req: import('next/server').NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  );
}

// Monthly token budget — 3,000,000 tokens ≈ $5 blended Haiku 4.5 pricing.
// Blended rate: 77% input × $0.80/MTok + 23% output × $4.00/MTok ≈ $1.54/MTok.
// reserveBudget() reserves RESERVED_INPUT_TOKENS (2,200) + maxOutputTokens (512) = ~2,700
// tokens per request, so the cap allows ~1,100 requests before it exhausts.
// Hard cap at 100%; warn at 80%.
const MONTHLY_TOKEN_BUDGET = 3_000_000;
const BUDGET_WINDOW_S = 60 * 60 * 24 * 32;

// Reservation pattern constants. Worst-case input tokens cover:
//   - SYSTEM prompt: ~1500 tokens cache-cold (SYSTEM_TEXT in
//     lib/ask/system-prompt.ts is ~5500 chars ≈ 1500-1600 tokens).
//   - Wrapped user question: max 500 chars of input + ~200 chars of
//     <question> delimiter + re-anchor instruction ≈ 200 tokens.
//   - Anthropic SDK framing overhead: ~100 tokens.
// Total worst-case input ≈ 1800 tokens; reserve 2200 for a ~20% safety
// buffer. If actual billed input > reserved, settleBudget() becomes a
// no-op (the refund branch is `if (refund <= 0) return`) and the counter
// undercounts, defeating the "never below actual usage" guarantee. With
// 2200 tokens reserved against worst-case 1800 actual, there is always
// positive headroom to refund — settleBudget never undercounts.
//
// Drift-protected by __tests__/budget-cap.test.ts. Update both when SYSTEM
// size moves (also update lib/ask/system-prompt.ts CACHE_ELIGIBILITY_MIN_CHARS
// if relevant).
const RESERVED_INPUT_TOKENS = 2200;

export function getBudgetKey(): string {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `ask:tokens:${yyyy}-${mm}`;
}

// Reserve worst-case (input + max_tokens) against the monthly counter BEFORE
// the Anthropic call. If the reservation crosses the cap, refund and reject.
// Returns `reserved` so settleBudget() can refund the unused portion after
// the stream completes. Fail-open on Redis infra failure (same posture as
// rate-limit) — operator must rely on the out-of-band Anthropic spend alert
// when Upstash is degraded.
export async function reserveBudget(
  maxOutputTokens: number,
): Promise<{ allowed: boolean; reserved: number; pct: number; budgetKey: string }> {
  const reserved = RESERVED_INPUT_TOKENS + maxOutputTokens;
  const budgetKey = getBudgetKey();
  try {
    const pipe = getRedis().pipeline();
    pipe.incrby(budgetKey, reserved);
    pipe.expire(budgetKey, BUDGET_WINDOW_S, 'NX');
    const [used] = await pipe.exec<[number, number]>();
    const pct = used / MONTHLY_TOKEN_BUDGET;
    if (pct > 1) {
      // Reservation pushed us over — refund and reject.
      try {
        await getRedis().decrby(budgetKey, reserved);
      } catch (refundErr) {
        log.error('budget reservation refund-on-reject failed', { err: refundErr });
      }
      return { allowed: false, reserved: 0, pct, budgetKey };
    }
    if (pct >= 0.8) log.warn('budget approaching cap', { pct });
    return { allowed: true, reserved, pct, budgetKey };
  } catch (err) {
    log.error('budget reservation failed, proceeding without cap', { err });
    return { allowed: true, reserved: 0, pct: 0, budgetKey };
  }
}

// After the Anthropic stream ends (or errors), refund (reserved - actual).
// budgetKey must be the same key returned by reserveBudget — callers must not
// call getBudgetKey() independently, to avoid a month-boundary TOCTOU where
// reserve and settle operate on different monthly keys.
export async function settleBudget(
  reserved: number,
  actualInputTokens: number,
  actualOutputTokens: number,
  budgetKey: string,
): Promise<void> {
  if (reserved <= 0) {
    log.warn(
      'budget settlement skipped — reserved=0 (Redis fail-open bypassed cap for this request)',
      { budgetKey },
    );
    return;
  }
  const actual = actualInputTokens + actualOutputTokens;
  const refund = reserved - actual;
  if (refund <= 0) return;
  try {
    await getRedis().decrby(budgetKey, refund);
  } catch (err) {
    log.error('budget settlement refund failed', { err });
  }
}

// Identical-question gate. Stores ipHash + sha256(question) in Redis with a
// 60s TTL using SET NX. If the key already exists, the same IP asked the
// exact question within the last 60 seconds — reject. Fail-open on Redis
// failure (same posture as rate-limit).
export async function checkIdenticalQuestion(
  ipHash: string,
  question: string,
): Promise<{ allowed: boolean }> {
  try {
    const qBytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(question));
    const qHash = Buffer.from(qBytes).toString('hex').slice(0, 16);
    const key = `ask:dedup:${ipHash}:${qHash}`;
    const result = await getRedis().set(key, '1', { nx: true, ex: 60 });
    return { allowed: result === 'OK' };
  } catch (err) {
    log.error('identical-question check failed, allowing', { err });
    return { allowed: true };
  }
}
