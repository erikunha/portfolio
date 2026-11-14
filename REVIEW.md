# REVIEW.md

What a reviewer reports on a diff in this repository. The CI review reads this file from the base
branch; a human or agent review of a diff follows it too.

## Severity

- **CRITICAL**: breaks production, security or data integrity, or trips a hard CI gate. Examples: a
  route that reads the body before its rate limit, a secret or PII in a log line, a gate edited so
  it passes.
- **IMPORTANT**: a real defect a maintainer would fix before merging. Examples: wrong behavior on a
  reachable path, a fix with no regression test, a gate that fails open, a client island that
  pushes a route past its JS budget, an accessibility regression, a doc or diagram that now
  contradicts the code.
- **MINOR**: optional polish that does not block the merge. Report at most five, and none when
  there is a CRITICAL or IMPORTANT finding in the same file.

The categories below decide what blocks the merge.

## What blocks

Only a finding in one of these six categories blocks the merge:

1. Correctness: wrong behavior on a reachable path, or a doc or diagram that now contradicts the code.
2. Security.
3. Accessibility.
4. Performance budget.
5. Test validity: a fix with no regression test, a test that passes for the wrong reason, an
   assertion weakened to go green.
6. Spec or plan compliance: the change does not do what the spec, plan or PR description says.

Style, naming, formatting taste and refactors the change does not need never block, whatever the
severity badge says. Report at most five nits (MINOR) in a review.

Severity follows consequence, not the verdict you want. A finding without a `file:line` on the head
commit and a statement of what breaks, and when, is dropped.

## Always check

- A path move or extraction: the `detect-changes` path filters, `.husky/**`, `scripts/**` and any
  glob still see the new location. A filter left on the old path evaluates to "unchanged" and
  skips silently.
- A weakened gate: a lowered threshold, an ignore-list entry, an audit set to `"off"`, code
  reshaped to evade a checker.
- A fix without the test that fails before it and passes after it.
- API handlers: order is rate limit, bounded read, parse, validate, handle; env is read only
  through `lib/env.ts`; the `/api/ask` budget fails closed while rate limits fail open.
- User-visible copy lives in `content/*.ts` in English and pt-BR, and every variant of a changed
  section (mobile, tablet, noscript, MOTION off, print, design-system demos) moved with it.
- Motion stays off while the MOTION switch is off (`body[data-motion="reduce"]`). No rule keys off the operating system preference.
- A change to the ask system prompt, its facts (`content/ask-facts.ts`) or the eval corpus without a passing `pnpm ask:eval`.
- A decision with no `DECISIONS.md` bullet, or a change whose docs and diagrams were not updated.
- A changed screenshot baseline under `tests/**-snapshots/` that shows clipped, overlapping or
  cut-off content, text drawn through a control, or a word split mid-word. Open each new PNG beside
  the one it replaces.

## Skip

- Anything CI already enforces: format, lint, import order, types, `*.client.tsx` naming, CSS token
  and contrast lint, route and bundle JS numbers, Lighthouse scores, dependency pinning.
- Generated and binary files: `pnpm-lock.yaml`,
  `app/(en)/design-system/changelog/page.mdx` (written by `pnpm changelog:sync`), `public/` images
  and fonts.
- Issues the diff does not touch. Mention one only when the diff makes it newly reachable.
- Style preferences, naming taste and acronym capitalization.

## Review domains

Classify each domain as material, supporting or not applicable for the diff. Each material domain
is one bounded question; a trivial diff needs no split. Open the decisive lines yourself before
posting a finding that came from a worker.

| Domain                  | Question                                                                                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Target and base         | Is the range right (a sub-PR's base is an integration branch, not `main`)? Does the diff carry unrelated work?                                    |
| Reachability            | Which changed symbols run in production, on which routes? Is the code dead or test-only?                                                         |
| Precedent               | How many comparable sites do the same thing? Why does an odd guard exist (`git log -S`, `DECISIONS.md`)?                                         |
| RSC and client boundary | Does a server-only module, a secret or a heavy dependency reach a `*.client.tsx` graph? Are props serializable?                                  |
| Client state            | For each affected fact: owner, writers, readers, derived copies (state, refs, `localStorage`, URL hash, window events). Is a persisted value validated on read? |
| Rendering and caching   | Is the route static, PPR or dynamic, and which cache owns it (Full Route, Data, Router, CDN, Redis)?                                              |
| Content and schema      | Is the copy in `content/*.ts`, validated, in both locales? Do identity and metric claims agree across home, CV, `llms.txt`, `agent.json` and the ask prompt? Does client-reachable content stay zod-free (the `content/_validate-client-content.ts` pattern)? |
| Design and responsive   | Does the render match the approved design at 390 and 1280? Overflow, clipping or unreachable controls at 320, 390, 768, 1024 and 1280?            |
| Design-system pages     | Do `/design-system/**` pages and component docs still describe the component? Did a design-system baseline (darwin only) move? An isolated doc proves nothing about the integrated page. |
| Tokens and CSS          | Raw hex, a token class that does not exist (Tailwind v4 fails silently), `outline: none` on `:focus`, radius above 2px, text under 13px from 768px up. |
| Motion                  | Is every animation off under `body[data-motion="reduce"]`, with no rule reading the operating system preference? Are CRT effects decorative only? |
| Accessibility           | Names, roles, focus order, 44px targets, live regions, dialog trap and focus return, single-key shortcuts scoped to focus (WCAG 2.1.4).           |
| Tests                   | Which defect fails each new test? Do assertions observe behavior, not source text? Is the layer right?                                            |
| API boundary            | Order of rate limit, bounded read, parse, validate, handle; envelope shape matches every client reader; honest status codes.                      |
| Security                | Actor, entry, trust boundary, control, consequence. Secrets or PII in logs, cron bearer, MCP limiter, CSP, injection into the ask prompt.          |
| Async and stores        | Who retries, who deduplicates; idempotency window against retry window; cron overlap; `maxDuration`; Redis keys, TTLs and orphaned members.       |
| AI and eval             | Model string, prompt cache, spend budget, tool authorization on MCP, untrusted model output, `pnpm ask:eval` impact.                              |
| Dependencies            | Each major's breaking changes this repository hits; overrides outside a dependent's declared range as the lockfile records it, unless shown unreachable and recorded in `DECISIONS.md`; engines. `zod`, `typescript` and the Node version move only with their own `DECISIONS.md` entry. |
| Observability           | When an operational question exists: can the owner learn that something failed (a log line, an alert email) rather than only the user seeing it?   |
| CI and docs             | Do `detect-changes` filters still see moved files? Does a new spec run in the right Playwright projects? Do docs state current behavior?         |

## Proof

- A finding needs one anchor: a count ("1 of 12 comparable handlers skips the limiter"), a sibling at
  `path:line`, a run, or an exact repository rule (a WCAG criterion, an `AGENTS.md` gate). Generic
  best practice is not an anchor.
- Reproduce a regression on the head and on the base before calling it one. A review without a shell reads both copies instead.
- Accept a finding only when its premise is true, the scenario is reachable, the version is the lockfile's, the consequence is material and this diff caused it. Uncertainty never raises severity.
- Mark what you read as read and what you infer as inferred. Name the layer (cache, boundary, version) a claim is about.
- A finding about appearance comes from an opened image: a measurement (a box size, a pixel diff) supports it and never replaces it. Review domains that owe a look are design, design-system pages, responsive, motion, accessibility of a rendered surface and baselines. With no driver, a fresh capture is impossible and stated as a limit; a committed baseline is still opened and described.
- For data the change displays, a failed fetch, an empty result and a stale cached value must render
  differently. A fallback that shows `0` or an empty list on failure is a finding.
- A tool-less review states its limits: nothing was built or run, dependency source was not
  installed, and a check still pending is not a pass.
