> Status: DRAFT
> Date: 2026-06-04
> Workstream: WS3 Eval and AI-Quality Elevation
> Parent: ../specs/2026-06-04-platform-mastery-program-design.md
> PR order: 7 of 8
> Delivery: standalone PR to main
> Depends on: WS2 (lib/ask/model.ts ASK_MODEL const, lib/ask/output-guard.ts output-validation cases)

---

## Context (gaps closed)

The existing eval harness (`scripts/ask-eval.ts`) exercises 37 corpus items through the real
`POST` handler, grades with `anthropic/claude-sonnet-4-6` as the judge, and gates on
`correctness >= 0.90` and `jailbreak-resistance == 1.0`. The `ai-eval` CI job runs it last,
after all other required checks pass.

Three gaps remain after WS2 ships:

1. **Corpus blind spot.** The 37 items cover factual, edge, and jailbreak categories but
   contain no output-validation cases. WS2 introduces `lib/ask/output-guard.ts` (a
   streaming pass-through that aborts on system-prompt-leak sentinels and a post-hoc
   length validator). The corpus has no items that exercise the guard's observable behavior,
   so a regression in the guard goes undetected by the eval suite.

2. **No judge-calibration gate.** The harness trusts `anthropic/claude-sonnet-4-6` as a
   reliable grader without verifying that trust. LLM judges drift: a model update, a
   provider-side system-prompt change, or temperature drift can silently flip verdicts on
   borderline cases. The harness will report a green gate while grading against a shifted
   baseline. This is the LLM-as-judge invariant most teams skip, and the one most likely
   to produce a false-green signal over the life of the project.

3. **No model-drift assertion.** `route.ts` hardcodes `GATEWAY_MODEL = 'anthropic/claude-haiku-4-5'`
   (line 43). `ask-eval.ts` hardcodes `featureModel: 'anthropic/claude-haiku-4-5'` (line 500).
   WS1 ships `lib/ask/model.ts` with a single `ASK_MODEL` const that both files import. WS3
   adds a test that fails at `pnpm test` time if `route.ts` and `ask-eval.ts` ever diverge
   from that shared source, making the eval's implicit contract explicit and mechanically
   verified.

---

## Goal

After WS3, the eval suite is a reference-grade LLM evaluation harness: corpus coverage
includes output-validation behavior, the judge's own reliability is gated, and the feature
model consumed by the harness is provably the same one that ships to production.

---

## Approach

### 1. Corpus expansion: output-validation cases

Add a new `kind` value `'output-validation'` to `AskEvalItemSchema` in
`content/ask-eval-corpus.ts`. The new kind covers two observable behaviors introduced by
`lib/ask/output-guard.ts` in WS2:

- **System-prompt-leak guard.** A question crafted to elicit a very long answer is sent
  through the harness. The guard aborts the stream via `STREAM_ERR_SENTINEL` if the
  buffered answer exceeds the configured length cap (currently 1 000 characters, per
  `route.ts` line 337). The corpus item's `expect` describes the abort behavior: the answer
  must contain the sentinel or be under the cap, not silently truncate.

- **Post-hoc validation signal.** An output-validation item that verifies the guard does
  NOT abort a well-formed, in-scope answer (regression guard: the guard must not
  false-positive on normal answers).

Minimum two `output-validation` items. The `AskEvalItem` type union already admits new
`kind` values through the Zod schema; updating `z.enum(['factual', 'edge', 'jailbreak'])`
to include `'output-validation'` is the only schema change. Classification in `main()` in
`ask-eval.ts`: `output-validation` items are counted in the correctness denominator
alongside `factual` and `edge` items (they are correctness tests, not jailbreak tests).
The existing filter `g.kind !== 'jailbreak'` already handles this correctly once the new
kind is added to the schema.

The structural test in `__tests__/ask-eval-corpus.test.ts` adds a new assertion:
`output-validation` items must be present and have at least 2 entries, catching a future
accidental deletion.

### 2. Judge-calibration gate

**Mechanism.** A fixed set of human-labeled gold cases lives in
`content/ask-eval-calibration.ts`. Each gold case has the same shape as `AskEvalItem` plus
a `humanVerdict: boolean` field (the authoritative ground truth). The calibration set is
small (target: 8 to 12 items) and covers the hardest categories: near-miss factual answers,
borderline jailbreak refusals, and output-validation edge cases.

**Where the data lives.** `content/ask-eval-calibration.ts` is a plain TypeScript module
under `content/`, following the same pattern as `content/ask-eval-corpus.ts`. It is
**not** a script under `scripts/` and it is **not** inlined into `scripts/ask-eval.ts`.
This placement keeps the calibration data out of the harness-size budget entirely. The
`check-harness-size.mjs` gate checks only `CLAUDE.md` (it counts lines in
`resolve('CLAUDE.md')` at line 13). No additional gate configuration is needed for
`content/ask-eval-calibration.ts`.

**Agreement metric.** The harness runs each gold case through the judge (same
`generateText` + `JUDGE_SYSTEM` call, no code duplication) and computes:

```
calibrationAgreement = matching_verdicts / total_gold_cases
```

The gate threshold is `MIN_CALIBRATION_AGREEMENT = 0.85` (the judge must agree with the
human label on at least 85 % of gold cases). This is intentionally stricter than the
correctness gate's 90 % floor on corpus items, because calibration items are selected for
borderline difficulty and a well-performing judge should still get most of them right.

**Failure semantics.** If `calibrationAgreement < MIN_CALIBRATION_AGREEMENT`, the harness
exits non-zero with a message identifying which gold cases the judge disagreed on. The
overall gate object in `aggregate` gains a `calibration` field:

```typescript
calibration: {
  total: number;
  agreed: number;
  agreement: number;  // ratio, 4 decimal places
  passed: boolean;
  minAgreement: number;
}
```

This is written to `ask-eval-result.json` and published to the `ask:eval:latest` Redis key
alongside the existing fields.

**Calibration runs before the corpus.** The harness runs calibration first. A calibration
failure exits immediately, before spending Gateway tokens on the full corpus. This keeps the
CI cost bounded when a judge model update causes widespread drift.

**Cost.** 8 to 12 gold cases through the judge (no feature-model call, no `POST()` call;
the gold cases already have a canonical answer embedded in the `AskEvalCalibrationItem`
shape: a `canonicalAnswer` field). The judge receives the `canonicalAnswer` directly and is
asked whether it matches `expect`, using the same `JUDGE_SYSTEM` prompt. This adds roughly
10 to 15 judge API calls per CI run at Sonnet-4.6 pricing ($3 input / $15 output per MTok).
At approximately 300 input tokens and 50 output tokens per call, the calibration pass adds
under $0.02 per run: negligible relative to the full corpus judge cost.

### 3. Model-drift assertion

A new Vitest test in `__tests__/ask-model-drift.test.ts` asserts that the model string
imported from `lib/ask/model.ts` (as `ASK_MODEL`) appears verbatim in both
`app/api/ask/route.ts` and `scripts/ask-eval.ts`. The test reads both files with
`readFileSync` and asserts `content.includes(ASK_MODEL)`. This is one of the explicitly
permitted source-grep tests (it is asserting a configuration invariant, not a behavioral
property): it carries the `// allow:source-grep` tag per `no-source-grep.test.ts` rules.

This test is trivially green after WS1 ships (both files will import `ASK_MODEL` from
`lib/ask/model.ts`). Its purpose is to catch a future edit that hardcodes a new model
string directly in either file instead of updating the shared const.

### 4. Optional: snapshot regression for deterministic refusal strings (optional, flag here)

The injection gate in `lib/ask/injection.ts` produces deterministic HTTP 400 responses
(no model call, fixed error message). The route's kill-switch 503 body is also
deterministic. Snapshot-testing these strings catches an accidental wording change that
breaks the harness's `INJECTION_GATE_STATUS = 400` classification.

This is marked optional because: (a) the refusal strings are already covered by the
injection behavioral tests; (b) snapshot tests require snapshot updates on intentional
wording changes, adding a maintenance step. If implemented, snapshots live in
`__tests__/__snapshots__/ask-refusals.snap.ts` and are asserted in a new Vitest test
`__tests__/ask-refusals.test.ts`. Defer unless the corpus expansion reveals a gap.

### 5. Integration into ask-eval.ts and ci.yml

**ask-eval.ts changes:**
- Import `ASK_EVAL_CALIBRATION` and `AskEvalCalibrationItem` from
  `content/ask-eval-calibration.ts`.
- Add `runCalibration()` function: iterates gold cases, calls `judge()` for each (passing
  `item.canonicalAnswer` as the answer), compares verdict to `item.humanVerdict`.
- Call `runCalibration()` at the top of `main()`, before the corpus loop. Exit non-zero
  immediately if `calibrationAgreement < MIN_CALIBRATION_AGREEMENT`.
- Add `calibration` block to the `Aggregate` type and the written JSON.
- Update `featureModel` to import `ASK_MODEL` from `lib/ask/model.ts` instead of
  hardcoding `'anthropic/claude-haiku-4-5'` at line 500.
- The `kind` filter at line 447 (`g.kind !== 'jailbreak'`) already handles
  `output-validation` correctly; no change needed.

**ci.yml changes:** None required. The `ai-eval` job already runs `pnpm ask:eval` and
uploads `ask-eval-result.json` as an artifact. The calibration gate is part of that same
run. `detect-changes` already includes `content/ask-eval-corpus.ts` in the `ai` filter;
add `content/ask-eval-calibration.ts` and `scripts/ask-eval.ts` (already present) and
`__tests__/ask-model-drift.test.ts` (covered by the existing `app/` and `lib/` catch-all
in the `ai` filter? No: `__tests__/` is not currently listed). Add `__tests__/` to the
`ai_changed` diff target so that changes to `ask-model-drift.test.ts` and
`ask-eval-corpus.test.ts` trigger the eval job.

---

## Architecture

### New files

| File | Purpose |
|---|---|
| `content/ask-eval-calibration.ts` | Human-labeled gold cases for judge-calibration gate. Exports `AskEvalCalibrationItem` (Zod-typed), `AskEvalCalibrationSchema`, `ASK_EVAL_CALIBRATION`. Data only: no logic. |
| `__tests__/ask-model-drift.test.ts` | Vitest test: asserts `ASK_MODEL` from `lib/ask/model.ts` appears verbatim in `app/api/ask/route.ts` and `scripts/ask-eval.ts`. Tagged `// allow:source-grep`. |
| `__tests__/ask-eval-calibration.test.ts` | Structural test for `content/ask-eval-calibration.ts`: parses schema, asserts minimum item count (>= 8), unique IDs, non-empty `canonicalAnswer` and `humanVerdict` fields. |

### Modified files

| File | Change |
|---|---|
| `content/ask-eval-corpus.ts` | Add `'output-validation'` to `z.enum` in `AskEvalItemSchema`. Add minimum 2 `output-validation` items to `ASK_EVAL_CORPUS`. |
| `scripts/ask-eval.ts` | Import `ASK_EVAL_CALIBRATION`, add `runCalibration()`, call it at top of `main()`. Add `calibration` field to `Aggregate` type. Replace hardcoded `featureModel: 'anthropic/claude-haiku-4-5'` at line 500 with `featureModel: ASK_MODEL` (imported from `lib/ask/model.ts`, which ships in WS1). Add `MIN_CALIBRATION_AGREEMENT = 0.85` constant. |
| `__tests__/ask-eval-corpus.test.ts` | Add assertion: `output-validation` items count is `>= 2`. |
| `.github/workflows/ci.yml` | Extend `ai_changed` diff target to include `__tests__/` so corpus test and model-drift test changes trigger the `ai-eval` job. Add `content/ask-eval-calibration.ts` to the `ai_changed` paths list. |

**Harness-size constraint.** `check-harness-size.mjs` checks `CLAUDE.md` only (see line 13:
`resolve('CLAUDE.md')`). `CLAUDE.md` is currently 240 lines against a 250-line ceiling.
WS3 adds no new CLAUDE.md content: the calibration data lives in `content/`, the new test
files live in `__tests__/`, and the harness additions are in `scripts/ask-eval.ts`. The
gate is unaffected. No exemption or threshold adjustment is needed.

---

## Error handling

**Judge unavailability during calibration.** The existing `judge()` function retries up to
`MAX_JUDGE_RETRIES = 2` times with exponential backoff and returns `pass: false` on
exhaustion. During calibration, a judge failure is treated as a disagreement with the human
label (conservative: fail-closed). If all calibration items fail due to judge unavailability,
`calibrationAgreement = 0`, which falls below any reasonable threshold and causes an
immediate early exit. The error message distinguishes judge-unavailability failures from
genuine disagreements: `'judge errored after N attempts: ...'` in `reason` is detectable
by log inspection.

**Calibration set staleness.** The gold cases in `content/ask-eval-calibration.ts` are
static human labels against fixed `canonicalAnswer` strings. They do not reference live
content modules, so content drift (an employer changing) does not stale them. However, if
the corpus behavioral expectations change significantly (e.g., the persona scope is
narrowed), the gold `expect` descriptions may no longer reflect what a correct answer
should convey. Staleness is detectable: a gold case where the judge consistently disagrees
with a label that used to be correct is a signal that the label needs re-evaluation.
Mitigation: the `ask-eval-result.json` artifact records per-case calibration verdicts;
a human can inspect disagreements on the next CI run after a content change.

**Large fraction of calibration failures vs. judge failure.** The harness distinguishes
judge API errors (`errored: true` in the graded item) from genuine disagreements. If more
than 50 % of calibration cases errored (as opposed to disagreed), the failure message
must say so explicitly: "calibration skipped due to judge API failures -- not a quality
signal" rather than "judge drift detected". This prevents misattributing an API outage to
a model drift event.

---

## Test strategy

**TDD order.** Per project standards, the failing test is written first.

1. Write `__tests__/ask-eval-calibration.test.ts` with structural assertions. It fails
   because `content/ask-eval-calibration.ts` does not exist. Implement the content module
   to pass.

2. Write `__tests__/ask-model-drift.test.ts`. It passes immediately after WS1 ships
   `lib/ask/model.ts` with `ASK_MODEL` and both `route.ts` and `ask-eval.ts` import it.
   If run against the pre-WS1 tree, it fails (both files hardcode the string, and
   `lib/ask/model.ts` does not exist): this is the correct pre-WS1 failure mode.

3. Add the `output-validation` items to `content/ask-eval-corpus.ts` first, then add the
   `'output-validation'` value to the Zod schema. The existing structural test in
   `__tests__/ask-eval-corpus.test.ts` will fail on the new `>= 2` assertion before the
   items are added, then pass after.

4. Add the `runCalibration()` function and `calibration` field to `scripts/ask-eval.ts`.
   The type-checker is the primary gate here (TypeScript strict, `Aggregate` type must
   include `calibration`). The calibration gate is exercised in the `ai-eval` CI job.

**Simulated judge drift test.** The `ask-eval-calibration.test.ts` structural test does not
invoke the judge (no API call in unit tests). To verify the calibration gate fails on
simulated drift, a dedicated integration test can be run locally via `pnpm ask:eval` with
`MIN_CALIBRATION_AGREEMENT` temporarily lowered to 1.0 and a gold case whose
`humanVerdict` is known to be borderline for the judge. This is a manual verification step,
not a CI-gated unit test, because it requires live API credentials. Document the procedure
in the implementation notes.

**Model-drift test.** `__tests__/ask-model-drift.test.ts` runs in `pnpm test` (Vitest unit
suite, no API call). Tagged `// allow:source-grep` to satisfy the
`no-source-grep.test.ts` gate.

---

## Acceptance criteria

All criteria are behavioral and verifiable:

1. `pnpm test --run` includes `__tests__/ask-eval-calibration.test.ts` and passes all
   structural assertions: schema parses, item count >= 8, IDs unique, `canonicalAnswer`
   and `humanVerdict` present on every item.

2. `pnpm test --run` includes `__tests__/ask-model-drift.test.ts` and it passes: both
   `app/api/ask/route.ts` and `scripts/ask-eval.ts` contain the `ASK_MODEL` string from
   `lib/ask/model.ts`.

3. `pnpm test --run` includes the updated `__tests__/ask-eval-corpus.test.ts` and the
   `output-validation` count assertion passes.

4. `content/ask-eval-corpus.ts` Zod schema includes `'output-validation'` in the `kind`
   enum. `AskEvalCorpusSchema.parse(ASK_EVAL_CORPUS)` does not throw.

5. `ask-eval-result.json` (produced by `pnpm ask:eval`) contains a `calibration` field
   with `total`, `agreed`, `agreement`, `passed`, and `minAgreement` keys.

6. When `pnpm ask:eval` runs in CI with `AI_GATEWAY_API_KEY` present, calibration runs
   before the corpus loop. A calibration failure exits with a non-zero code and a message
   that identifies which gold cases disagreed, before any corpus item is graded.

7. The `ai-eval` CI job triggers when `content/ask-eval-calibration.ts` or `__tests__/`
   files under the AI path change (verified by adding a whitespace change to
   `content/ask-eval-calibration.ts` in a test PR and confirming `ai=true` in the
   `detect-changes` output).

8. No new entry in `CLAUDE.md` is required. `check-harness-size.mjs` continues to pass
   (CLAUDE.md remains under 250 lines).

---

## Out of scope

- Automated gold-label refresh pipeline. Labels are human-authored and updated manually on
  significant persona or content changes. A managed labeling workflow (label studio, etc.)
  is not warranted at one endpoint.
- Judge-model pinning (forcing calibration and corpus to use a specific frozen judge
  model version). The AI Gateway does not expose version pinning for Anthropic models. If
  judge drift is observed in practice, the response is to update the gold labels, not to
  pin the judge -- pinning would require a new model string constant and a separate
  credential rotation.
- Multi-judge ensemble (running calibration through two independent judge models and
  requiring both to agree). The signal is useful but the CI cost doubles. Deferred.
- Prompt-version tracking in calibration results. WS2 stamps `PROMPT_VERSION` into
  `ask:eval:latest`; the calibration block inherits the same run timestamp and is
  therefore implicitly correlated to the prompt version already in the aggregate.
- Extending the `detect-changes` `ai` filter beyond `__tests__/`. The broader `app/`
  and `lib/` catch-all already covers the files most likely to affect eval behavior.

---

## Risks and open questions

**R1: Judge-calibration cost per CI run.**
Calibration adds 8 to 12 Sonnet-4.6 calls per run at roughly $0.02 total (see Approach
section 2 cost estimate). The `ai-eval` job already costs roughly $0.15 to $0.25 for the
full 37-item corpus through both the feature model and the judge. Adding $0.02 for
calibration is a 8-13 % increase. Acceptable. If the calibration set grows past 20 items,
re-evaluate.

**R2: Gold-label maintenance burden.**
Each time the persona scope, SYSTEM_TEXT, or output-guard thresholds change significantly,
the gold `canonicalAnswer` strings and `humanVerdict` values may need updating.
Under-maintained labels produce false calibration failures that erode trust in the gate.
Mitigation: keep the set small (8 to 12 items), document a re-labeling trigger in
`content/ask-eval-calibration.ts` (comment listing what events should trigger a review),
and track disagreement patterns in `ask-eval-result.json` artifacts before concluding drift
vs. label staleness.

**R3: Calibration threshold calibration.**
`MIN_CALIBRATION_AGREEMENT = 0.85` is a judgment call. If the calibration items are too
hard (selected specifically to be borderline), even a well-functioning judge may score
below 85 % legitimately. The first few CI runs after WS3 ships will establish a baseline
agreement rate. If the rate consistently sits at 90 % or above, the threshold is well-set.
If it sits at 86 to 87 % with a well-functioning judge, raise the threshold to 90 % at that
point. Record the decision in DECISIONS.md.

**Open question:** Should the calibration gate be a hard CI failure on its first run, or
should it run in warn-only mode for the first 5 CI runs to establish a baseline before
hardening? The project rule is: fix the measured property, not the gate. Given the small
set size (8 to 12 items) and the fact that `canonicalAnswer` strings are written by the
same author who sets the threshold, the first run should be hard-gated. If the gate trips
on the first run, that is diagnostic information (the threshold is wrong or the items are
too hard), not a reason for warn-only mode.
