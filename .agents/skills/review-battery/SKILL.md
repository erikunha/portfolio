---
name: review-battery
description: Use at the two battery triggers (before any git push, and whenever coding work stops) to dispatch the local pre-push / pre-PR review battery. Holds the four reviewer prompts, the assembly order, and the finding contract that battery-synthesis and `pnpm review:findings add` consume. Not a gate; `pnpm review:stamp` is the gate.
---
> **Codex note:** hook activation is not configured in this repo, so every "the hook blocks", "enforced", "WIRED", or "exit 2" claim here — including in this file's description — is a **hard rule to self-enforce**, not an automated gate.


# Local review battery

Four reviewers, one contract. Dispatch all four in parallel, then run
`battery-synthesis` over their reports and `pnpm review:stamp`.

The roles are aimed at the defect distribution this repo actually produces.
Measured 2026-07-25 over `.review-findings-archive.jsonl`, deduplicated by
finding id: 226 cycles, 293 unique findings, 236 non-minor. The archive grows
every cycle, so re-derive before citing:

| class | share | owned by |
|---|---|---|
| a doc, ADR, comment, or PR body contradicts the code | 35% | claim-drift |
| logic and correctness | 27% | correctness |
| a gate, hook, workflow, or script that fails open | 22% | gate-robustness |
| a test that asserts less than the invariant it names | 12% | test-strength |
| security | 3% | gate-robustness |
| performance, a11y, dependencies | ~1% combined | CI gates, not agents |

The bottom row is why perf, a11y, and dependency reviewers are conditional
rather than standing: LHCI, axe-core, `check-bundle-size.mjs`,
`check-route-js.mjs`, `check-dep-pinning.mjs`, and `pnpm audit` already hold
those properties, and a standing agent restating a gate is the exact
redundancy AGENTS.md forbids everywhere else.

## Run every standing reviewer on opus

Measured, 2026-07-25, one controlled mutation eval: 13 real defects planted
across all four classes in a detached worktree, plus 4 decoys. Same assembled
prompt shape for each role; only role and tier varied.

| reviewer | tier | found |
|---|---|---|
| gate-robustness | opus | 13/13 |
| correctness | opus | 11/13 |
| test-strength | sonnet | 7/13 |
| claim-drift | sonnet | 6/13 |

False positives: zero. Three decoys were flagged by nobody; the fourth was a
defective control that contained two real errors, and the reviewers that flagged
it cited exactly those.

**Tier explains nearly all of the coverage variance and role explains almost
none.** Both opus reviewers found most of the full set regardless of which role
prompt they received — correctness found every claim-drift defect, and
gate-robustness found the weak-test defects. A sonnet reviewer is not a
specialist, it is a weaker generalist that finds roughly half.

Role pays off only at the margin, and it does pay: gate-robustness alone caught
a AGENTS.md edit that reds `check:codex-sync`, and test-strength alone caught a
test whose title claimed "rejects every origin" while asserting one. Each role
prompt bought at least one finding no other reviewer produced.

So: **never dispatch a standing reviewer below opus**, and keep the roles for the
marginal findings rather than for coverage. Do not read a role's low score as
grounds for deleting it unless it was measured at opus — claim-drift scored
lowest here and owns the largest defect class, and its score is a tier artifact.

Limits of this measurement: one diff, planted defects, a single run per cell, so
per-run variance is unmeasured and real defects are subtler than planted ones.
Re-run before citing these numbers.

## Assembly order

Each dispatch is exactly three blocks, concatenated in this order. The order is
load-bearing: a model attends most to the start and end of a long prompt, so the
role goes first and the output contract goes last. Putting the shared rules last
buries the contract in the middle, where it is the first thing to be ignored.

```
1. ROLE PROMPT      (the numbered section for that reviewer, below)
2. SHARED RULES     (verbatim, identical across all four)
3. THE CONTRACT     (verbatim, including its worked example)
```

## Scope, and the one rule that overrides it

The shared rules say review only what the diff changed. **claim-drift and the
move-completeness clause are explicit exceptions and they win**, because both
defect classes live entirely outside the diff — that is what makes them the two
a diff-scoped reviewer structurally cannot see. State the exception in the
dispatch; do not leave the reviewer to resolve two rules that appear to fight.

## The finding contract

Every reviewer returns findings in exactly this shape and nothing else. The
shape is fixed by its consumers: `battery-synthesis` merges on file + issue
class, and `pnpm review:findings add <severity> <source> "<title>"` hashes
`source::title` into the ledger id, so a title that restates itself differently
between rounds forks into two ledger entries.

```
FINDING
severity: critical | important | minor
file: <repo-relative path>:<line>
title: <one line, max 110 chars, names the DEFECT, not the fix>
evidence: <the exact source line, command, or output you read>
why: <the failure this causes in one sentence — inputs -> wrong behaviour>
fix: <the minimal change>
```

Close with one line: `VERDICT: <n> critical, <n> important, <n> minor` or
`VERDICT: clean`.

Severity is assigned by consequence, never by how confident you are:
**critical** breaks production, security, or data integrity, or trips a hard CI
gate. **important** is a real defect a maintainer fixes before merging.
**minor** is optional polish and is explicitly non-blocking.

A worked example, from this repo's own ledger. Every reviewer gets this one
verbatim, because the judgment boundary — what counts as evidence, how specific
a title must be — is far easier to show than to describe:

```
FINDING
severity: critical
file: .codex/hooks/architect-gate.sh:44
title: architect-gate fail-open: needle scanned over the whole task file including the echoed prompt
evidence: grep -q "GATE_RESULT: PASS" "$TASK_FILE"
why: the dispatch prompt itself contains the literal string, so a task whose verdict was GATE_RESULT: FAIL still matched and the gate passed.
fix: scope the match to a tool_result block rather than the whole file.

VERDICT: 1 critical, 0 important, 0 minor
```

Note what the title does: it names the defect and its mechanism in one line
under 110 characters, and it would hash identically if re-derived next cycle.
`"architect-gate is broken"` and `"fix the grep in architect-gate.sh"` are both
wrong — one is unhashable, the other names the fix.

**The contract is a convention, not a gate.** Nothing parses reviewer output;
the main agent transcribes findings into `pnpm review:findings add` by hand. A
reviewer that free-forms its output costs a transcription pass, it does not fail
loudly. Treat a malformed report as a reason to re-dispatch, not to hand-repair.

## Shared rules

Paste verbatim into all four dispatches, as block 2.

```
Review what THIS diff changed; read the rest of the tree for context. Three
things outside the diff are still findings and are part of every role, not just
the one they sound like: (1) prose anywhere in the tree that this diff just made
false — a doc, an ADR, a comment, a test name, a failure message, a PR body; (2) any gate, CI path-filter,
allowlist, config, or doc still pointing at a location this diff moved or
renamed; (3) a behaviour this diff introduces that no test covers. Everything
else outside the diff is out of scope — do not hunt unrelated pre-existing
defects.

Ground every finding in something you read, and quote it in the evidence line.
If you cannot quote it, you do not have a finding — drop it. Never report that a
command "would" fail: run it, or say plainly that you did not run it.

Report a finding only when a competent maintainer would change the code because
of it. Within that bar, be exhaustive: report every real defect you can
substantiate in this one pass, never only the most salient one. Outside it, stay
silent — preferences, style, and restatements of a passing gate are not
findings. Before returning, re-read each candidate adversarially: is it already
handled elsewhere in the diff, already enforced by a CI gate, or refutable on a
closer read? Drop what does not survive. A clean file gets no finding, and a
clean diff gets VERDICT: clean, which is a valid and expected answer — return it
rather than manufacturing a minor.

Leave these to the gates that already enforce them: formatting, lint, import
order, naming, contrast ratios, bundle size, Lighthouse scores, dependency
pinning. Biome, axe, LHCI, check-bundle-size.mjs, check-route-js.mjs, and
check-dep-pinning.mjs each fail the build on their own property, so a second
opinion on one is noise.

This repo's conventions are documented and often differ from generic React or
Next.js advice. Read AGENTS.md, STANDARDS.md, and .codex/rules/ before judging,
and follow the convention over the generic best practice unless the convention
itself causes a correctness, security, a11y, or performance defect. Read budget
numbers from the file; do not recite them from memory.

Stage with `git add -u` or `git add <specific files>`. Write no git state except
staging and committing inside the tree you were dispatched into; that exception
is the only one. No checkout, switch, reset, restore, bisect, update-ref,
branch -f, rebase, cherry-pick, am, stash, or `git config` writes. Read another
revision with `git show <sha>:<path>`. This is a verification-only run: return
your report and make no commits.
```

## 1 — correctness

`subagent_type: pr-review-toolkit:code-reviewer` · model: **opus**. Never omit
`model` — an omitted tier silently inherits the session model, which is how a
review quietly ran on the wrong tier.

```
You are the correctness reviewer for this diff. You answer one question: for
what input or state does this code produce the wrong result, crash, or silently
do nothing?

Trace, do not skim. For each changed function, name the inputs it can actually
receive at its call sites, then follow the ones that reach an untested branch:
empty, null, undefined, zero, NaN, a duplicate, a concurrent second call, a
rejected promise, a value arriving after the component unmounted.

Weight these, in order, because they recur here:
1. A guard that fails open — a check that passes when the thing it checks is
   undefined, absent, or unparseable, so the disabled state reads as healthy.
2. A predicate that is a superset or subset of the one it must mirror: two
   copies of a condition that must stay identical, where only one was updated.
3. An async boundary: a dropped promise, an await serializing independent work,
   an effect with no cleanup whose stale response overwrites fresh state.
4. Mutation of a borrowed value — a caller's array or object, a store slice, or
   props during render.
5. A return contract that forks shape across branches (object, null, false,
   throw) and forces every caller into defensive narrowing.

React specifics that generic review misses here: state mirroring a derivable
value, an effect doing an event handler's job, an index used as a list key, a
`value` that can become undefined on a controlled input.
```

## 2 — claim-drift

`subagent_type: documentation-engineer` · model: **opus**. The largest single defect
class, and the one no named agent owned before this. It scored lowest in the
eval above and that was a tier artifact, not a verdict on the role — it ran on
sonnet while both opus reviewers found every claim-drift defect it did. The eval
ran this role on `general-purpose`; the accept-list takes only
`documentation-engineer`, because the stamp matches `subagent_type` alone and
cannot see what an agent was asked to do, so accepting `general-purpose` would
let any unrelated dispatch satisfy the role.

```
You are the claim-drift reviewer. Every sentence in this repo that asserts
something about the code is a claim, and your job is to find the ones this diff
just made false. This is the most common real defect here, 35% of recorded
findings, and it is invisible to a reviewer reading only the diff — so searching
the whole tree is your assignment, not a scope violation.

Work in this order:

1. From the diff, list every FACT that changed: a renamed path or symbol, a
   changed threshold, default, flag, command, or version, a deleted script, a
   changed behaviour, a measured number.
2. For each fact, grep the whole tree for prose still asserting the old value:
   the harness spine file for your runtime, plus STANDARDS.md, ARCHITECTURE.md, DECISIONS.md, README,
   docs/**, .codex/rules/**, .agents/skills/**, package.json scripts, and the
   diff's own commit messages and PR body.
3. Check the diff's OWN new prose against the code it ships with, including test
   names, failure messages, and `biome-ignore` reasons.

Three specific shapes, each a finding on its own:
- A number carrying no command and date that produced it. Every measurement here
  carries its provenance; one that does not is folklore. A number measured with
  a different tool than the gate uses is also wrong — `gzip -c` and
  `zlib.gzipSync` disagree on identical bytes.
- "Held by <gate>" where the gate's actual predicate is narrower than the claim.
  Read the predicate, not the gate's name.
- A source comment that is not one of the three permitted shapes: an external
  quirk pin, a constant-drift pin, or a public API contract. Rationale,
  mechanism narration, and process history in source are findings.

Append-only history never drifts and is not a finding. Decide by PREDICATE, not
by a path list, because a list goes stale the first time a file is added: a
file is history if it is a dated entry in an append-only log, or if its own
heading declares it historical or superseded. Read the top of the file and let
it tell you. Everything else is current state and does drift — including the
numbered `docs/NN-*.md` pages and all of `docs/handbook/**`, which describe how
the system works today. Never exempt `docs/` wholesale.

Worked example of the judgment, from this repo's ledger:
  FOUND — "ADR claimed 'sweeps every public surface' but METRIC_SURFACES
  hand-listed 9 of 29 content modules" — the claim is strictly wider than the
  code, so the doc tells the next reader a check exists that does not.
  NOT A FINDING — a 2026-05 ADR describing the pipeline as it stood in May,
  superseded by a later dated entry. History, not drift.
```

## 3 — gate-robustness

`subagent_type: security-auditor` · model: **opus**. Highest scorer in the eval
and the only reviewer to catch a `check:codex-sync` break. It already finds more
gate defects than security ones here, and dispatching it also satisfies the
`api-security-push-guard.sh` hook on API edits. It is Read/Grep/Glob only, so it
cannot execute: never ask it for an exit code, and tell it to say plainly what
it did not run.

```
You are the gate-robustness reviewer. Everything under .github/workflows,
.husky, scripts/, and .codex/hooks is control-plane code: when it is wrong it
does not fail loudly, it evaluates to "nothing to check" and a regression ships
unguarded. Assume every gate this diff touches or relies on is broken, and find
how.

For each gate, hook, workflow, or script:
- Does it fail OPEN? For a missing binary, an unset variable, an unresolvable
  path, an empty match, a parse error, a `|| true`, a `continue-on-error` — say
  for each whether the outcome is "blocked" or "silently passed".
- Does a pipe swallow the exit code? `cmd | tail` reports tail's status. A gate
  whose verdict is read downstream of a pipe without `set -o pipefail` is a
  finding.
- Is the blocking exit code right? A PreToolUse hook that must BLOCK exits 2;
  exit 1 prints a warning and the command still runs.
- Is a path relative to cwd, so it breaks from a subdirectory or a linked
  worktree?
- Is a matcher a PREFIX match being used to mean "this flag anywhere"? A rule
  matching `git push --force` does not match `git push origin main --force`.
- Does a path-filter, pathspec, allowlist, or detect-changes glob still point at
  a location this diff moved? That gate now evaluates to unchanged and skips.
- Does the assertion fire on the bad state, or only on one that cannot occur? An
  assertion passing on both the ideal and the broken state tests nothing.
- Does the gate scan a whole file for a sentinel the input itself can contain?
  That is the architect-gate fail-open in the contract example above.

If the diff touches app/api/, lib/rate-limit.ts, proxy.ts, CSP, auth, secrets,
or rate limiting, additionally trace each attacker-controlled input to its sink
and report only paths you can trace end to end.
```

## 4 — test-strength

`subagent_type: pr-review-toolkit:pr-test-analyzer` · model: **opus**. The only
reviewer to catch a test whose title claimed a universal property while
asserting one case — opus-correctness walked past it.

```
You are the test-strength reviewer. A test that passes while the property it
names is broken is worse than no test, because it gets cited as proof. Find
those.

For every test this diff adds or changes, and every test it CLAIMS holds a
property:
- Mutation-check it: what is the smallest edit to the source that breaks the
  stated property but leaves this test green? If such an edit exists, the test
  does not hold the property, and any prose saying it does is a second finding.
- Does the assertion's SCOPE match the claim? A test banning two tokens does not
  ban a re-implementation avoiding those tokens.
- Does the test compute its expected value from the code under test? An expected
  value is a literal a human reasoned to, never a re-derivation.
- Does it assert on the public surface, or pin an implementation detail that a
  correctness-preserving refactor would break?
- Is it deterministic? Wall clock, real network, unseeded randomness, execution
  order, shared mutable state, `process.chdir` in a parallel suite.
- Does a stub or env mutation leak across files?
- Is a mock standing in for something we own? Mock the boundary; use the real
  thing for our own code.

Report the inverse too: a behaviour this diff introduces that no test covers,
where the failure would be silent.
```

## Conditional reviewers

Not in the stamp. Dispatch when the trigger fires, not by habit.

| trigger | agent | model |
|---|---|---|
| the diff touches JSX or a component's markup | a11y pass — `web-design-guidelines` skill inline, plus a Playwright MCP check at 1280x720 and 375x812 | — |
| `package.json` or `pnpm-lock.yaml` changed | `dependency-auditor`, scoped to `pnpm audit --audit-level=moderate`, no test suite | sonnet |
| a perf gate actually regressed (LHCI, bundle-check, route-js-check) | `performance-engineer`, pointed at the failing metric | sonnet |
| new client component or significant client state | `react-best-practices` skill, inline | — |

The a11y row is a deliberate hedge against the weakest assumption behind the
role table. a11y measures ~0.4% of recorded findings, which normally means a
gate holds it — but axe-core automates roughly a third of WCAG, and the semantic
remainder (a meaningless `aria-label`, a focus trap, an unreachable control) has
no owner in either the gates or the standing roles. The near-zero count is
therefore consistent with two very different worlds, and this row costs one
inline skill invocation to cover the bad one.

`security-auditor` is not listed here: it is the standing gate-robustness
reviewer, so the `api-security-push-guard.sh` hook is already satisfied on every
cycle. When the diff touches `app/api/`, `lib/rate-limit.ts`, or `proxy.ts`, say
so in its dispatch so it runs the input-to-sink trace as well.

## Scoping by commit type

The stamp counts dispatch, not depth. Running the whole suite for a docs-only
commit costs many minutes and proves nothing.

- **docs-only** — "read `git diff HEAD~1..HEAD` to confirm docs-only, verify
  accuracy against the code, do NOT run the test suite or build."
- **config-only** — "verify the logic of the changed config only, no test suite."
- **deps-only** — audit at the stated level only; no `pnpm test`, no build.
- **code** — targeted tests for the changed area only.
