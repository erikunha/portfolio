# Runtime, browser and measurement

## Local production run

```bash
fnm exec --using="$(cat .nvmrc)" -- pnpm <command>   # or put the pinned Node bin first on PATH
pnpm build
DEPLOY_SALT=test pnpm start          # port 3000; playwright.config.ts hard-codes this baseURL
```

- No real Upstash, Resend or AI Gateway credentials for review runs. E2E specs mock the backend
  through `tests/e2e/_helpers/mock-backend.ts`; unmocked server paths fail closed.
- Before filing a runtime finding, check that the failure is not environment drift (stale `.next`,
  another server on 3000, missing env). A second server on the same port silently answers
  your tests with old code: `lsof -iTCP:3000 -sTCP:LISTEN` first.
- Stop every server you started before finishing.

## Gates (split into parallel validators)

| Group | Commands |
|---|---|
| Static | `pnpm check`, `pnpm typecheck`, `pnpm validate-content`, `pnpm check:client-naming`, `pnpm check:doc-drift`, `pnpm lint:css-tokens` |
| Unit | `pnpm test --run` (or targeted `pnpm exec vitest run <paths>`) |
| Budgets | `pnpm build && node scripts/check-route-js.mjs`, `pnpm bundle-check` |
| Runtime | `pnpm gates:runtime` (LHCI desktop + mobile, axe, functional e2e) |
| Security | `pnpm audit --audit-level=moderate`, `node scripts/run-semgrep.mjs --error <changed paths>` |
| Visual | `pnpm exec playwright test tests/visual --project=<p>` when a captured section changed |

Report each as passed, failed or not run, with the command. Not run is never passed.

## Browser journeys

Follow the repo's browser-verification rule: enter once, navigate by clicking, real input only,
look at a screenshot after each action. Use `product-verifier` for user-visible changes.

For each acceptance criterion: journey, action, observable, wrong outcome, post-action state.
Operate the controls; rendering alone proves nothing. Exercise the states that apply: loading,
empty, error, retry, success, disabled, long content, keyboard only, reduced motion, 320 to 1280.

UI state inventory: for each state that applies (initial, loading, empty, partial, populated,
pending, success, error, retry, offline, disabled, stale, long content, overflow, destructive
confirmation) record required, implemented, reached, observed in the browser, result. Never
certify a state that was not reached.

Compare with the design authority at the same viewport. Hide sticky chrome only with a scoped
rule (position fixed or sticky outside the subject); a broad selector can hide the subject itself.

## Network and read-back

For a changed data flow observe request count, endpoint, payload, status, response and
duplicates. A success response is not completion: read state back (Redis key, follow-up GET,
reload) when the change writes anything.

## Performance

Start from one falsifiable hypothesis. Measure with a baseline on the base branch:
LHCI numbers, a DevTools trace, request counts, DOM size, chunk bytes, or CPU and RSS sampled
over time for a long-running process:

```bash
PID=$(lsof -tiTCP:3000 -sTCP:LISTEN); for t in $(seq 0 15 600); do ps -o pcpu=,rss= -p $PID; sleep 15; done
```

"Looks slow" is never a finding.

## Negative control

For an important regression test: `~/Desktop/Projects/claude-skills/runtime/bin/scratch-worktree.py` makes a scratch checkout,
reintroduce the defect there, run the test, confirm it fails, discard the scratch tree.

## Regression attribution

Reproduce on head, reproduce on the base with the same data and environment, then classify:
REGRESSION, PRE_EXISTING, CHANGED_MANIFESTATION, FIXED or INCONCLUSIVE.
