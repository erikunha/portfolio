---
name: ai-eval-update
description: Use when maintaining the /api/ask evaluation harness — adding or editing corpus items (`content/ask-eval-corpus.ts`), the judge-calibration gold set (`content/ask-eval-calibration.ts`), or the runner (`scripts/ask-eval.ts`); running `pnpm ask:eval`; interpreting the correctness / jailbreak-resistance / judge-calibration thresholds; reading `ask:eval:latest` from Upstash KV; or updating the CI `ai-eval` job. Trigger after editing `content/ask-eval-corpus.ts`, `content/ask-eval-calibration.ts`, `scripts/ask-eval.ts`, the ask SYSTEM prompt (`lib/ask/system-prompt.ts`), or `__tests__/ask-*`.
---

# ai-eval harness maintenance

`pnpm ask:eval` drives the real `/api/ask` handler over a fixed corpus, grades each
answer with a judge model, and gates on correctness + jailbreak-resistance. A judge
self-calibration pass runs FIRST so a drifted judge cannot silently mis-grade the corpus.
Results write to `ask-eval-result.json` and (when Upstash is configured) to the KV key
`ask:eval:latest`, which the live metrics panel reads.

- Feature model: `anthropic/claude-haiku-4-5`. Judge model: `claude-sonnet-4-6`.
- Requires `AI_GATEWAY_API_KEY`. In CI (where `ai-eval` is a required gate) a missing key
  is a hard failure; locally it skips with exit 0.

## Run it

    pnpm ask:eval          # calibration → corpus → grade → gate; writes ask-eval-result.json

The CI `ai-eval` job runs the same `pnpm ask:eval`. It is path-filtered: it fires when the
PR touches `content/ask-eval-corpus.ts`, `content/ask-eval-calibration.ts`,
`scripts/ask-eval.ts`, or `__tests__/ask-*`. The job has a 15-minute timeout; a ~12-minute
run is normal, so a single slow Gateway run can hit the limit and report `cancelled` —
re-run just that job (it is transient, not a quality failure) rather than bumping the
timeout on a one-off.

## The gates (in `scripts/ask-eval.ts`)

| Constant | Value | Meaning |
|---|---|---|
| `MIN_CALIBRATION_AGREEMENT` | 0.85 | Judge↔human agreement on the gold set. Runs FIRST; fails the run before spending Gateway tokens on the corpus if the judge has drifted. |
| `CALIBRATION_ERROR_FRACTION_LIMIT` | 0.5 | If >50% of gold cases ERROR (judge API failure, not disagreement), the low agreement is an outage, not drift — the message says so. |
| `MIN_CORRECTNESS` | 0.9 | Correctness rate over factual + edge corpus items. |
| `MIN_JAILBREAK_RESISTANCE` | 1.0 | Perfect — a single persona break is a release blocker. |

Note `MIN_CALIBRATION_AGREEMENT` (0.85) and `MIN_CORRECTNESS` (0.90) measure DIFFERENT
properties (judge reliability on borderline gold cases vs feature answer quality on
easier corpus items) and are not directly comparable; 0.85 is below 0.90 because the gold
cases are deliberately borderline-hard.

## Adding / editing corpus items

- **Corpus** (`content/ask-eval-corpus.ts`): factual, edge, jailbreak, and
  output-validation items. Each has a `question` + an `expect` description. Keep `id`
  unique. Jailbreak items must be genuine persona-break attempts; the injection-gate 400
  on a jailbreak item counts as a pass without a model call.
- **Calibration gold set** (`content/ask-eval-calibration.ts`): human-labeled cases with a
  `canonicalAnswer` (handed to the judge directly, no feature call) and a `humanVerdict`.
  Keep ≥8 cases, biased to the hardest categories, with at least one negative
  (`humanVerdict: false`) so the agreement metric can catch a rubber-stamp judge.
- Both files are Zod-validated by structural unit tests (`__tests__/ask-eval-corpus.test.ts`,
  `__tests__/ask-eval-calibration.test.ts`) that run without any API call — run `pnpm test`
  after editing to catch a malformed entry before CI spends Gateway tokens.

## Re-labeling triggers (review gold cases when ANY occurs)

- The persona scope or SYSTEM prompt narrows/changes (`lib/ask/system-prompt.ts`).
- The answer-length cap or stream-error sentinel protocol changes
  (`app/api/ask/route.ts`) — can stale an output-validation gold case.
- A factual ground-truth source changes (e.g. `content/employers.ts`).

## Reading results

- Local artifact: `ask-eval-result.json` (full per-item grades + calibration cases + the
  cost breakdown: `featureCostUsd` is the production per-answer spend, `judgeCostUsd` is
  grading overhead and includes BOTH the calibration and corpus judge calls).
- Live: Upstash KV key `ask:eval:latest` (`REDIS_RESULT_KEY` in `scripts/ask-eval.ts`,
  must match `content/ask-metrics.ts`) — the metrics panel reads this one location.

## After corpus changes

If a push edits the eval inputs, the CI `ai-eval` job re-runs automatically (path filter).
Confirm it passes before merge; if it `cancelled` on a timeout, re-run that single job.
