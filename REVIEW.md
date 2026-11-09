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
- A decision with no `DECISIONS.md` bullet, or a change whose docs and diagrams were not updated.

## Skip

- Anything CI already enforces: format, lint, import order, types, `*.client.tsx` naming, CSS token
  and contrast lint, route and bundle JS numbers, Lighthouse scores, dependency pinning.
- Generated and binary files: `pnpm-lock.yaml`, screenshot baselines under `tests/**-snapshots/`,
  `app/(en)/design-system/changelog/page.mdx` (written by `pnpm changelog:sync`), `public/` images
  and fonts.
- Issues the diff does not touch. Mention one only when the diff makes it newly reachable.
- Style preferences, naming taste and acronym capitalization.
