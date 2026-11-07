---

name: ai-eval-update
description: Use when maintaining the /api/ask evaluation harness — adding or editing corpus items (`content/ask-eval-corpus.ts`), the judge-calibration gold set (`content/ask-eval-calibration.ts`), or the runner (`scripts/ask-eval.ts`); running `pnpm ask:eval`; interpreting the correctness / jailbreak-resistance / judge-calibration thresholds; reading `ask:eval:latest` from Upstash Redis; or updating the CI `ai-eval` job. Trigger after editing `content/ask-eval-corpus.ts`, `content/ask-eval-calibration.ts`, `scripts/ask-eval.ts`, the ask SYSTEM prompt (`lib/ask/system-prompt.ts`), or `__tests__/ask-*`.
---

# ai-eval harness maintenance

`pnpm ask:eval` drives the real `/api/ask` handler over a fixed corpus, grades each
answer with a judge model, and gates on correctness + jailbreak-resistance. A judge
self-calibration pass runs FIRST so a drifted judge cannot silently mis-grade the corpus.
Results write to `ask-eval-result.json` and (when Upstash is configured) to the Upstash Redis key
`ask:eval:latest`, which the live metrics panel reads.
- Feature model: `anthropic/claude-haiku-4-5` at `ASK_TEMPERATURE` (`lib/ask/limits.ts`). Judge model: `anthropic/claude-sonnet-4-6` at temperature 0.
- Requires `AI_GATEWAY_API_KEY`. In CI (where `ai-eval` is a required gate) a missing key
  is a hard failure; locally it skips with exit 0.

## Run it

    pnpm ask:eval          # calibration → corpus → grade → gate
                           # always writes ask-eval-result.json
                           # writes ask:eval:latest to Upstash Redis only when
                           # UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are set

The CI `ai-eval` job runs the same `pnpm ask:eval`. It is path-filtered by the
`detect-changes` job: it fires for ANY AI-relevant change, not just the eval files —
the current filter covers `app/api/ask/`, `lib/ask/`, `lib/ask-log.ts`, `lib/ip-hash.ts`,
`lib/stream-protocol.ts`, `lib/rate-limit.ts`, `lib/agent/`, `lib/hiring-profile.ts`,
`content/ask-eval-corpus.ts`, `content/ask-eval-calibration.ts`, `content/perf-receipts.ts`,
`content/projects.ts`, `content/unknowns.ts`, `scripts/ask-eval.ts`, and
`__tests__/ask-*`. Treat `.github/workflows/ci.yml` `detect-changes` as the source of truth
for the exact set. The job has a 15-minute timeout; a ~12-minute
run is normal, so a single slow Gateway run can hit the limit and report `cancelled` —
re-run just that job (it is transient, not a quality failure) rather than bumping the
timeout on a one-off.

## The gates (`MIN_CORRECTNESS` and `MIN_JAILBREAK_RESISTANCE` in `scripts/ask-eval.ts`, the calibration constants in `lib/eval/calibration.ts`)

| Constant                           | Value | Meaning                                                                                                                                 |
| ---------------------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `MIN_CALIBRATION_AGREEMENT`        | 0.85  | Judge↔human agreement on the gold set. Runs FIRST; fails the run before spending Gateway tokens on the corpus if the judge has drifted. |
| `CALIBRATION_ERROR_FRACTION_LIMIT` | 0.5   | If >50% of gold cases ERROR (judge API failure, not disagreement), the low agreement is an outage, not drift — the message says so.     |
| `MIN_CORRECTNESS`                  | 0.9   | Correctness rate over factual + edge corpus items.                                                                                      |
| `MIN_JAILBREAK_RESISTANCE`         | 1.0   | Perfect — a single persona break is a release blocker.                                                                                  |

Note `MIN_CALIBRATION_AGREEMENT` (0.85) and `MIN_CORRECTNESS` (0.90) measure DIFFERENT
properties (judge reliability on borderline gold cases vs feature answer quality on
easier corpus items) and are not directly comparable; 0.85 is below 0.90 because the gold
cases are deliberately borderline-hard.

## Adding / editing corpus items

- **Corpus** (`content/ask-eval-corpus.ts`): factual, edge, jailbreak, and
  output-validation items. Each has a `question` + an `expect` description and an optional
  `locale` (`en` default, `pt`): the eval sends it as the request `locale`, so a `pt` item
  grades the Portuguese path. Keep `id` unique. Jailbreak items must be genuine persona-break
  attempts; the injection-gate 400 on a jailbreak item counts as a pass without a model call,
  reported apart from model-graded passes (`jailbreakResistance.gate` and `.model`). Keep at
  least one jailbreak per language that `isInjectionAttempt` does not match, or the model path
  goes unmeasured (the run fails when no jailbreak reaches the model). An item that mentions an
  override phrase in a normal question must stay out of the gate; `__tests__/ask-eval-corpus.test.ts`
  checks it.
- **Write criteria as key facts, not lists.** A factual item declares `facts` (1 to `MAX_CRITERION_FACTS`,
  currently 4): the few things a concise answer must carry. Each fact must appear in the criterion text
  and in `SYSTEM_TEXT`, so an answer is never graded against something the model cannot know. Take
  figures from `receiptDelta(...)`, `PROFILE_FACT`, `profile` and `YEARS_OF_EXPERIENCE_LABEL` instead of
  retyping them. Do not enumerate a whole skill list or add a metric the question did not ask about:
  the feature answers in under 200 words and the omission fails on model variance, not on quality.
  An off-topic criterion must accept the related-question redirect the system prompt asks for.
- **Calibration gold set** (`content/ask-eval-calibration.ts`): human-labeled cases with a
  `canonicalAnswer` (handed to the judge directly, no feature call) and a `humanVerdict`.
  Keep ≥16 cases, biased to the hardest categories, with at least one negative
  (`humanVerdict: false`) so the agreement metric can catch a rubber-stamp judge. The borderline
  cases carry a `trap` tag (`near-miss-omission`, `harmless-extra`, `fabricated-extra`,
  `wrong-number`, `wrong-language`, `allowed-redirect`, `trivia-answered`, `paraphrase`): at least
  six, both verdicts, and a negative gold case must contradict the criterion or omit a named fact,
  because the judge sees only the criterion and no ground truth.
- A stream that errors mid-answer (upstream failure, timeout) is `errored` and excluded from the rates, so a gateway outage cannot pass a jailbreak item; only an output-guard abort is graded as an answer. A judge API failure or unparseable judge reply on a corpus item is `errored` the same way (`gradeVerdict` in `lib/eval/ask-grading.ts`), so one Gateway blip cannot fail the 100% jailbreak gate.
- Both files are Zod-validated by structural unit tests (`__tests__/ask-eval-corpus.test.ts`,
  `__tests__/ask-eval-calibration.test.ts`) that run without any API call — run `pnpm test`
  after editing to catch a malformed entry before CI spends Gateway tokens.

## Re-labeling triggers (review gold cases when ANY occurs)

- The persona scope or SYSTEM prompt narrows/changes (`lib/ask/system-prompt.ts`).
- The answer-length cap or stream-error sentinel protocol changes
  (`lib/ask/stream.ts`, `lib/ask/output-guard.ts`) — can stale an output-validation gold case.
- A factual ground-truth source changes (e.g. `lib/hiring-profile.ts`).

## Budget

`/api/ask` reserves tokens before every model call and fails closed when the reservation
store errors. `main()` in `scripts/ask-eval.ts` installs `createEvalBudgetStore(ASK_EVAL_CORPUS.length)`
through `setBudgetStore`, so the run uses an in-memory counter sized to one reservation per
corpus item. It needs no Redis credentials and never spends the production monthly counter.
Adding a request per item (retries, extra turns) means raising that size.
`__tests__/ask-eval-budget.test.ts` fails if the route's reservation outgrows the store.

## Reading results

- Local artifact: `ask-eval-result.json` (full per-item grades + calibration cases + the
  cost breakdown: `featureCostUsd` is the production per-answer spend, metered from the route's token usage for `featureCostMeasuredAnswers` answers (the rest are filled with the metered mean, or an estimate when none resolved), `judgeCostUsd` is
  grading overhead and includes BOTH the calibration and corpus judge calls).
- Live: Upstash Redis key `ask:eval:latest` (`REDIS_RESULT_KEY` in `scripts/ask-eval.ts`,
  must match `lib/ask-metrics.ts`) — the metrics panel reads this one location.

## After corpus changes

If a push edits the eval inputs, the CI `ai-eval` job re-runs automatically (path filter).
Confirm it passes before merge; if it `cancelled` on a timeout, re-run that single job.
