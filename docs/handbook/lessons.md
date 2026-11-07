# Lessons

Numbered rules learned from review findings and CI reds on this repository. Every contributor,
human or agent, reads this file before a change and follows every rule. Each rule names the
check that proves it was followed. A new rule is appended when a finding or a red build reveals
a mistake that can repeat. Rules are never renumbered; a retired rule keeps its number and says
why it was retired.

The prompt for a manual or agent review that applies these rules to a diff is `docs/handbook/review-standard.md` (the claude-review bot uses `.github/claude-review-prompt.md`).

## Rules

1. Fix every blocking finding in the PR that received it (`REVIEW.md` lists what blocks). Never reply "fixed in #NNN" or cite a commit
   that is not reachable from this PR's head. Check: `git merge-base --is-ancestor <sha> HEAD`.
2. A commit body cites only SHAs reachable from the branch it lands on. Describe off-branch facts
   in words. Check: the same `merge-base --is-ancestor` test for every SHA in the body.
3. Predict CI before pushing. For every route or component the diff touches, run the matching
   `tests/e2e` specs against a production build (`pnpm build`, then `pnpm start` on a free port).
   Scope page-wide assertions (`locator('canvas')`, counts over `document`) to the element they
   guard, because a new global layer breaks them. Check: the specs pass on the production build.
4. A layout, spacing, type or color change regenerates the darwin baselines of
   `tests/visual/visual.spec.ts` and `tests/e2e/design-system-components.spec.ts` in the same
   change, and every regenerated PNG is read before it is committed. Linux baselines come from the
   CI dispatch (`update_visual_baselines`). Check: `git status tests/visual` lists the PNGs.
5. A small visual fix can stay under the screenshot tolerance. `--update-snapshots` (the changed
   mode) keeps a baseline whose diff is under `maxDiffPixels`, so a removed label survives the
   regen. Force it only for the subject you changed: `--update-snapshots=all -g <subject>`, never
   for the whole suite. Check: open the regenerated PNG and confirm the fix is in it.
6. `DECISIONS.md`: every entry sits under a dated heading, newest first, cites the SHA that lands
   it and names how to undo it. Check: read the entry as a stranger who must revert it.
7. Format before finishing: `pnpm check:fix`, then `pnpm check` reports no errors. Never call a
   lint error pre-existing without showing it on the base branch.
8. Tokens added to `app/css/theme.css` by two branches conflict; keep both sides.
9. A test that guards a property names that property in its failure message.
10. Every path, file or symbol named in a description, comment or commit body exists on the
    branch it lands on. Check: `git ls-tree -r HEAD --name-only | grep <path>`.
11. A sub-PR merged at an older head drops its later commits. Before replying "fixed" on the
    integration PR, prove the fix is on its head: `git merge-base --is-ancestor <fix> origin/<head>`
    or `git show origin/<head>:<path>` shows the fixed line.
12. Every reply in a review thread that claims a fix links the fix commit on the PR:
    `[<short-sha>](https://github.com/<owner>/<repo>/pull/<n>/commits/<full-sha>)`.
13. When a file's role changes, update its line in the `ARCHITECTURE.md` file manifest and every
    doc that describes it in the same change. Check: grep the docs for the file path.
14. No em or en dash in anything a person reads, including prompts, YAML comments, test names
    and docs. Use a comma, colon, period or parentheses.
15. Any error you meet, in the code or in the tooling, is yours to investigate: reproduce it,
    find the cause, fix the cause, add the test and report the cause in one line. Pre-existing
    does not mean ignore; outside your scope means you say so with the evidence.
16. Every review finding is addressed, minor and nit included: fixed at the root or answered in
    the thread with why it is wrong. Only blocker and major findings block a push.
17. Never stop a server by its port (`lsof -ti :PORT | xargs kill`). Two runs on one port kill
    each other's server mid-suite. Stop the process group you started.
18. A gate chained with `&&` is never piped (`gate | tail -1 && merge`): the pipeline's exit
    status is the last command's, so a failed gate passes. Use `set -o pipefail` and read each
    gate's own exit code.
19. `isolate(root)` (`lib/dom/isolate.ts`) inerts every sibling of root up the tree. Pass the
    wrapper that holds both the panel and its scrim, never the panel alone, or the scrim goes inert
    and click-outside-to-close dies. jsdom does not hit-test `inert`: prove it with a real
    Playwright mouse click.
20. A change to shared layout (hero, about, contact, footer, nav) runs the full functional e2e
    suite and LHCI locally before the push, not a hand-picked spec list.
21. A child that sets `visibility: visible` overrides an ancestor's `visibility: hidden`. A
    descendant that must follow its container uses `visibility: inherit`. Check: computed
    visibility of the child under a hidden ancestor is `hidden`.
22. A screenshot helper hides only `position: fixed` chrome. Hiding `sticky` too removes
    in-flow content such as the desktop contact card. Check: the captured section matches its
    visual baseline.
23. After a squash merge of a sub-PR that a later branch was based on, sync that branch in two
    merges: first the sub-PR's final head SHA, then the base. Add/add conflicts where the base file
    equals that head resolve to ours.
24. `DECISIONS.md` is append-only for a change: add new bullets, never reflow, rewrap or reformat
    existing lines. A rewrap turns every existing dash and SHA into a net-new line and fails the
    quality gate. Check: `git diff --stat DECISIONS.md` shows only insertions.
25. A doc that says a tool or bot uses a file names the file that wires it in, and a doc that
    forbids exact counts holds none itself. Check: grep the named consumer (for the review bot,
    `.github/claude-review-prompt.md`) for the path, and grep the doc for literal tallies.

26. An e2e test that measures a streamed section (`#sec-live-metrics`, `#sec-live-perf`) waits until
    the section has no `[aria-busy="true"]`. Until React swaps a Suspense boundary in, the DOM holds
    both the fallback and a hidden staged copy, so a class locator matches two elements.
27. A test that sets motion state clicks the MOTION toggle after `waitForHydration`. Writing
    `body.dataset.motion` before hydration is reset by the navigation store's layout effect.
28. A commit made with `--no-verify` skips commitlint, and CI's quality-fast job runs it on every
    commit in the push. Body lines over 100 characters then fail CI after the push. Check: commit
    through the hooks, or run `pnpm exec commitlint --from origin/<base>` before pushing.
29. A loading fallback is measured against what replaces it, in both locales and at 320, 390, 768 and
    1280px, with the stream held (scripts blocked, `$RC("B:` swaps removed from the document) so the
    fallback is laid out with scripting on. A reserve list shared by two states is one function, never
    two copies. Check: `tests/e2e/loading-states.spec.ts`.
30. After `pnpm update` or `pnpm add`, run `pnpm install --frozen-lockfile`. A direct dependency
    that also has a `pnpm.overrides` entry records the override as its lockfile specifier; an
    update rewrites it to the manifest range and CI's frozen install then refuses the lockfile.
31. `waitForHydration` proves React began hydrating a node (the fiber key exists), not that it
    committed. On a slow runner (headless Linux WebKit paints about four frames per second here) a
    click in that window is dropped: the submit event fires before the handler is live. A test whose
    first action after `waitForHydration` is a state-changing click repeats the click inside
    `expect(...).toPass()` until its effect shows.
32. Playwright's WebKit refuses a screenshot over 32767px on any side, and the full homepage is
    taller at phone width on Linux. A `fullPage` screenshot that nothing asserts on is an
    attachment, so it is not taken.
33. A scroll loop paced by `waitForTimeout` outruns an IntersectionObserver on a slow runner: the
    observer delivers once per frame, so sections jumped over between deliveries are never counted.
    Bring each target into the observer's band, wait for frames, and check the band geometrically.

## Pre-push judgement list

Ranked by how often review caught each class on this repository.
1. Stale sibling docs: which `ARCHITECTURE.md`, `AGENTS.md`, `STANDARDS.md`, `docs/*`, mermaid
   diagrams, agent or skill mirrors, counts or "N-point" phrases describe what changed?
2. Duplicated literal: does the value already have one source (`content/social.ts`, a token, a
   shared constant)? Import it.
3. Fail-open guard: on a transient failure, empty input or odd spelling, does each script, hook
   or workflow step fail closed?
4. Claim vs diff: does every sentence in the PR body, commit message and ADR match the final
   diff, including what the last commit removed?
5. Dead code: what imports each new export, CSS class or schema field today?
6. Accessibility: accessible name, focus-visible, keyboard path, native `disabled`, no display
   change that strips table roles.
7. Weak test: would it still pass with the feature broken? Does it assert its title's claim?
8. Rename leftovers: do comments, labels or error strings still name the old thing?
9. Identity or copy change: checked `content/*`, `lib/ask/system-prompt.ts`,
   `content/ask-eval-corpus.ts`, `public/llms.txt`, the CV PDF and JSON-LD?
