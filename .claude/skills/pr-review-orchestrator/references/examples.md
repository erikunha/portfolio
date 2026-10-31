# Worked shapes, anti-patterns, completion

## Example: dependency upgrade PR (majors, overrides, a moved route)

Wave 1 tracks:
1. Breaking changes per major that this repo hits (Codex, read-only, `dependency-upgrade-steward`)
2. Overrides vs dependents' peer ranges (MiMo flash on `package.json` + the dependents' manifests)
3. Moved route: limiter, budget, methods, protocol paths that bypass controls (Claude `routing-reviewer-high`, `senior-security`)
4. Test changes: weakened assertions, raised timeouts (Claude `routing-reviewer`, `vitest`)
5. Docs and budget numbers consistent with the gate scripts (Claude `routing-reviewer`)

Wave 3: `ci:local`, `route-js-check`, `bundle-check`, `gates:runtime`, `audit` as parallel
validators; main thread runs the production server, drives the affected journeys and samples
CPU/RSS for ten minutes under load, then sends SIGTERM with any long-lived connection the change
allows (an SSE stream, a websocket) still open.

Wave 2 triggers: a library behaviour the change depends on gets exact-version research; a
suspected hang gets a reproduction on head and on the base.

## Example: section redesign PR (RSC + client island + CSS)

Wave 1: semantic diff and route JS delta; RSC/client boundary; design fidelity against the
prototype at 390 and 1280; accessibility and keyboard; tests and visual baseline impact; content
schema and identity consistency. Wave 3: build, `route-js-check`, real-input journeys at
320/390/768/1024/1280 with reduced motion on and off, measured section height against the
budget. Wave 4: challenge any finding that would block on taste rather than on the design authority.

## Example: API change (route handler + Redis + email)

Wave 1: envelope and status honesty vs every client reader; retry and idempotency ownership
(who retries, who deduplicates, key lifetime vs retry window); cron auth and overlap; PII in
logs; docs claims. Wave 3: route tests, a negative control on the most important branch, read-back
of the Redis keys after a mocked failure. Wave 4: challenge any data-loss or duplicate-send claim.

## Anti-patterns

- One broad reviewer for a cross-system PR; or three generic reviewers rereading the same diff.
- Two Claude passes counted as cross-provider review.
- Loading every skill or integration up front; strongest model everywhere.
- "Double-check everything" instead of a falsifiable question per track.
- Worker agreement counted as proof without opening the decisive line.
- Workers drifting into another domain instead of returning FOLLOW-UP.
- One validator running every gate in sequence.
- Agent fan-out replacing running the product; render success taken as interaction success.
- Books or generic best practice used as the proof of a finding.
- A test server on the port the suite targets, answering with old code.

## Mindset

Know what the system does: read it and run it. Know what it should do: the spec, DECISIONS.md,
the design authority. Name the cache, the boundary and the version. Retries mean repeated
execution: find the idempotency. Failure and zero are different states. Tests are evidence only
when they can fail for the defect. A review thread costs another engineer's attention: keep only
what is worth it, and write much less than you investigated.
