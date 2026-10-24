# Evidence, findings and the draft

## Worker return format

```text
STATUS: complete | partial | blocked
ANSWER: <one or two sentences answering the track question>
OBSERVATIONS: direct facts
EVIDENCE: file:line, count/denominator, command and result, source reference
INFERENCES: kept separate from observations
CANDIDATE FINDINGS: claim, consequence, proof anchor, certainty
REFUTED: concern, and the evidence that refuted it
UNKNOWNS:
FOLLOW-UP: none, or question + trigger + suggested domain
```

## Evidence tags

SOURCE_CONFIRMED, COUNTED, TEST_CONFIRMED, RUNTIME_OBSERVED, BROWSER_OBSERVED,
NETWORK_OBSERVED, PERSISTENCE_OBSERVED, PERFORMANCE_MEASURED, BASELINE_COMPARED,
DOC_CONFIRMED, UPSTREAM_CONFIRMED, INFERRED, UNKNOWN, BLOCKED.

## Proof anchors (a finding needs one)

- **Count:** "1 of 12 comparable route handlers skips the limiter."
- **Sibling:** "the equivalent path at file:line does X."
- **Run:** "after X locally, Y happened."
- **Contract:** an exact applicable standard or repo rule (WCAG criterion, CLAUDE.md gate).

Books and generic best practice are never proof anchors. A convention needs N of M; if M is too
small, say no convention exists.

## Accept a finding only when

The premise is true, the scenario is reachable, the version is right, the expected behaviour is
authoritative, the consequence is material, the evidence is sufficient, the change caused it,
and the obvious alternative explanations were checked. Reasons to dismiss a concern are claims
too; check them when the concern is consequential.

## Severity

- **BLOCKER:** confirmed high-consequence issue; do not merge. A failed CLAUDE.md gate is a blocker.
- **MAJOR:** confirmed reachable correctness, data, security, accessibility, reliability or budget issue.
- **CONSIDER:** evidence-backed improvement that should not hold the merge.
- **QUESTION:** unresolved intent that only the author or owner can answer.

Uncertainty does not raise severity.

## Completion matrix (before writing)

Every domain from `domains.md` plus: runtime, browser, network, read-back, regression
attribution, external research, challenge. Each is COMPLETE, RUN_AND_EMPTY, NOT_APPLICABLE,
BLOCKED or UNKNOWN. Also check: tracks planned vs launched vs completed, follow-ups answered,
validators run, challengers run. A material gap with capacity left means launch it, not write.

## Done when

1. Exact target and base are known; repo rules were respected.
2. Product intent and acceptance criteria are known, or explicitly unresolved.
3. Capabilities were calibrated enough to route correctly; skills loaded progressively.
4. Material independent questions became bounded tracks with minimal context.
5. At least one reviewer came from a provider other than the maker's, for a consequential change.
6. Version-sensitive answers used installed versions; overrides checked against peer ranges.
7. Deterministic gates ran; user-visible behaviour was exercised locally, or marked not run.
8. Persistence or async completion was read back when the change writes state.
9. Quantitative claims were measured; regressions compared with the base.
10. Consequential findings were challenged; every accepted finding has a proof anchor.
11. Speculative, stylistic, duplicate and refuted findings were removed; uncertainty is explicit.
12. The completion matrix has no blank row; the draft is short and in the owner's voice.

Then run `readiness-verdict` when the review decides a merge.

## The draft

```markdown
**Readiness:** <ready | ready with risk | not ready>, in one sentence.

**Findings**
<file:line or runtime flow>
<paste-ready comment: what happens, when, evidence, consequence, smallest useful direction>

**Verification that matters**
<only evidence that changes how the findings or the verdict read>

**Limits**
<only unresolved checks that matter, marked not run or blocked>
```

Write as the owner, in plain engineering language: no "the agent found", no AI attribution, no
session links, no em or en dashes, no verification ledgers. Declarative for demonstrated breakage,
a question when correctness depends on intent. Bounded claims ("the exercised flow passed"), never
"everything works". Run `humanizer` in embedded mode last.
