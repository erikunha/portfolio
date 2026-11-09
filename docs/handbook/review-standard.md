# Review Standard

Every rule below was extracted from real review findings on this repository. Apply the rule before you write the code, run the check before you push. An agent or person reviewing a diff by hand uses this file as the prompt (the claude-review bot, when requested, runs `.github/claude-review-prompt.md` instead): read the diff, check it against every rule whose file type it touches and against `docs/handbook/lessons.md`, and report each finding with file, line, rule number, severity (blocker, major, minor, nit) and the fix.

## Where findings cluster

Classes, most frequent first: stale docs or manifest; fail-open guard or swallowed error; weak or source-grepping test; duplicated literal or magic value; claim not matching the diff; security; CSS token or layout; dead code; content fact or copy; accessibility; commit or PR hygiene; type or contract drift; performance or bundle.

File types, most frequent first: workflow or script; markdown doc; test; tsx component; server code, config and agent files; content ts; DECISIONS and css.

---

## Markdown doc and DECISIONS

Docs drift because the code moved and the doc did not.

**Rule 1. Never write an exact count, an exact list, or a literal transcription into a doc.**
Counts age on every PR. A number nobody recomputes is a lie by next month.
Before writing: if the sentence contains a number that a machine could check, write an approximation or point at the source of truth.
Check: `pnpm check:doc-drift` (drifts the ARCHITECTURE tree), then grep the doc for numbers and confirm each one against the code.
Examples:
- PR127 `docs/handbook/README.md`: the ADR count said 75 while `DECISIONS.md` held 190; the fix replaced the exact count with an approximation.
- PR305 `docs/08-performance-and-accessibility.md`: the scroll container list still named the deleted Profile manual; the fix dropped it.

**Rule 2. A doc that describes code must be updated in the same PR that changes the code.**
Before writing: list every doc, ADR, diagram and skill file that mentions the symbol you are changing, and treat each one as part of the diff.
Check: after the diff, grep the repo for the old symbol name and the old path and fix every hit. A renamed path left in one doc fails the review every time.
Examples:
- PR144 `lib/__tests__/env.test.ts`: the comment above the test still listed the old consumer script; the fix updated the list.
- A skill copy for one tool asserted a control that the other tool's copy did not have; the fix corrected the claim.

**Rule 3. A diagram, mermaid graph and prose list inside the same doc must agree.**
Before writing: after editing a node, read the prose sentence that summarises that graph.
Check: read the doc top to bottom once. Diagrams and the sentence below them drift apart silently.
Examples:
- PR208 `docs/handbook/review-merge-release.md`: the table row was renamed but the mermaid diagram above it kept the old role name.
- PR235 `docs/handbook/workflow-playbook.md`: collapsing two numbered steps left the list numbering skipping a number.

**Rule 4. An ADR entry states one decision, cites the commit SHA, and names how to undo it.**
Before writing: put the SHA of the commit that lands the decision in the bullet, not the PR number, because PR numbers survive rebases and SHAs do not.
Check: read the bullet and ask whether a stranger could undo it from the text alone.
Examples:
- PR185 `DECISIONS.md`: bullets cited `PR #185` and one cited a SHA that no longer resolved; the fix moved to SHAs that exist.
- PR220 `DECISIONS.md`: seven dependency overrides shipped with the ADR checklist marked N/A; the fix added the ADR entry.

**Rule 5. Source code carries machine directives only.**
A short comment that says why the next line is correct is a decision and belongs in `DECISIONS.md` or in a test failure message. A comment that narrates what the code does is banned.
Check: `pnpm check` (Biome) plus a read of your own diff for comment blocks longer than one line.
Examples:
- PR209 `scripts/pr-size-lib.ts`: a five line prose comment broke the bare source rule; the fix deleted it and moved the rationale to `DECISIONS.md`.
- PR235 `.husky/pre-push`: a prose comment was reintroduced in the hook; the fix removed it.

---

## Workflow or script

The largest single cluster of security findings. Scripts and CI are where a small mistake becomes an invisible hole.

**Rule 6. A guard that cannot prove the thing it guards must fail closed.**
Never let a missing input, a null value, an unreadable file or a parse error turn into a skip. Fail the check instead.
Before writing: for every `if (!x) return;` in a guard, decide what the safe answer is when `x` is missing. The safe answer is failure.
Check: run the gate, then delete or corrupt the input it reads and confirm it still fails.
Examples:
- PR151 `.github/workflows/ci.yml`: the `ai_changed` pathspec did not include the newly extracted `lib/eval/judge.ts`, so the AI eval gate never ran; the fix added the path.

**Rule 7. A caught error must be reported, not swallowed.**
No empty catch, no `.catch(() => '')`, no `|| true` on a command that can hide a real failure.
Before writing: for each catch block, name the signal that reaches the operator. If there is none, do not catch.
Check: search your diff for `catch`, `2>/dev/null`, `|| true` and `process.exit(0)` and justify each one.
Examples:
- PR154 `.github/workflows/mutation.yml`: the error was written to stderr where GitHub Actions never reads it; the fix used a workflow command.

**Rule 8. A script must exit non-zero on failure and zero only on success.**
Before writing: every branch that means "something is wrong" ends in a non-zero exit, and the process is allowed to unwind so `finally` runs.
Check: `bash script.sh; echo $?` on the success path and on a deliberately broken path.
Examples:
- PR193 `scripts/check-gitleaks-fixture.mjs`: the exit code path ignored the real result; the fix made the code match the outcome.

**Rule 9. A gate that scans files must scan the same set of files the other gate scans.**
Path filters, allowlists and directories are duplicated in more than one place and they drift apart.
Before writing: when you add a path or an allowlist entry, search for every other list of the same kind in the repo and update them in the same change.
Check: compare the new path against every pathspec, allowlist and directory list in `.github/` and `scripts/`.
Examples:
- PR193 `scripts/check-gitleaks-fixture.mjs`: the allowlist of files permitted to name the secret phrase did not include the test file that names it; the fix widened the list.

**Rule 10. Shell and Git invocations must not interpolate untrusted or path-derived values into a pattern.**
Before writing: quote every expansion, and pass values as arguments rather than pasting them into a `sed` or `grep` pattern.
Check: read the command as if the value contained a slash, a dot or a space.
Examples:
- PR214, a push-guard shell script: the repository root was pasted unescaped into a `sed` pattern; the fix used parameter expansion instead.

**Rule 11. A hook must cover the long and short form of every option it blocks.**
Before writing: list the ways the command can be spelled, including equals form, short form and env assignment form.
Check: for each blocked command, write down the three spellings and confirm all three are covered.
Examples:
- PR261 `.github/workflows/claude-review.yml`: the denied tool list missed one agent type, so the tool was still reachable; the fix denied the whole set.

---

## Test

Almost all findings here are tests that pass for the wrong reason.

**Rule 12. A test must fail when the behaviour it claims to cover is broken.**
Before writing: state the sentence the test proves. Then break the code and confirm the test fails. If it still passes, the test is worthless.
Check: mutate the value under test and watch the test fail before you watch it pass.
Examples:
- PR148 `__tests__/agent-eval-ab.test.ts`: the assertion matched the substring `$4`, so `$4.01` satisfied it; the fix anchored it to the cap clause.
- PR301 `tests/e2e/type-reveal.spec.ts`: the per route guard visited zero marked elements, so it passed for free; the fix asserted a marked count above zero.

**Rule 13. A loop that filters items must assert that the filter produced something.**
A `for` over a filtered list that can be empty is a test that never runs.
Before writing: every filtered loop needs an assertion on the length of the result.
Check: `expect(filtered.length).toBeGreaterThan(0)` as the first line after the filter.
Examples:
- PR263 `tests/e2e/design-system-components.spec.ts`: the computed colours were asserted without confirming the element existed; the fix added the existence check.
- PR302 `tests/e2e/layout-tokens.spec.ts`: the `.first()` locator matched the wrong section, so the assertion proved nothing; the fix scoped the locator.

**Rule 14. Do not assert on the source text. Assert on the behaviour.**
Reading a file and matching a string is a source grep, not a test. It passes when the code is wrong and fails when the code is right.
Before writing: ask what a user or a caller would observe. Assert that.
Check: `pnpm test` plus the repository rule that bans `readFileSync` in tests without an explicit allow tag.
Examples:
- PR159 `evals/agents/claude-review-request/CASE.ts`: the assert predicate had a boundary nobody tested, so a bad phrase passed; the fix added the boundary case.
- PR280 `components/sections/ContactSection/ContactSection.test.tsx`: the test read text right after a click and raced the render; the fix awaited the state.

**Rule 15. A test that guards a gate must cover the guard, not the happy path.**
Before writing: for each gate, write the test that proves the gate blocks the bad case.
Check: run the gate against a deliberately bad input and confirm the test fails.
Examples:
- PR227 `__tests__/battery-roles-resolve.test.ts`: the scan roots did not include every surface the gate covers, so a stale role in one place went unseen; the fix widened the roots.
- PR305 `scripts/check-section-order.mjs`: the gate only checked live ids, so a section with no mobile order entry passed; the fix checks both directions.

---

## TSX component

Findings here weigh toward accessibility and duplicated constants.

**Rule 16. Every interactive element needs a name that a screen reader can read.**
An icon only button needs an `aria-label`. A disabled control needs the native `disabled` attribute, not only `aria-disabled`.
Before writing: for each button, link and input, name the accessible name you are providing and where it comes from.
Check: `pnpm test:e2e` (the axe scan lives in `tests/a11y/axe.spec.ts`) plus a manual tab through the section and listen to the order.
Examples:
- PR283 `components/links/client/TaglineTyper.client.tsx`: a polite live region re-announced the tagline every cycle; the fix removes the region and lists every phrase once as static text.
- PR284 `components/sections/About/About.tsx`: the type reveal effect was placed on the whole heading, which also held an icon; the fix scoped the effect to the text.

**Rule 17. Changing layout properties changes meaning.**
`display: block` on a table removes its implicit ARIA roles. Removing an icon removes the only accessible name.
Before writing: when a style change removes an implicit role or a visible label, restore the role or the label in the same change.
Check: `pnpm test:e2e` after any layout change (the axe scan and the visual baselines both run there).
Examples:
- PR284 `app/css/components.css`: `display: block` on the table elements stripped the implicit `table` and `rowgroup` roles; the fix added explicit roles.
- PR284 `app/(en)/design-system/_components/LabelledTable.tsx`: `aria-hidden` on the per cell label removed the only column context on mobile; the fix restored it.

**Rule 18. A value used in two places lives in one named place.**
Before writing: when you type a URL, a number, a label or a token twice, extract it to a constant on the first repetition.
Check: `pnpm check` plus a grep for the literal across `app/`, `components/`, `content/` and `lib/`.
Examples:
- PR267 `lib/rate-limit.ts`: `ASK_MAX_OUTPUT_TOKENS = 512` duplicated the cap in the ask route; the fix moved it to `lib/ask/limits.ts` and imported it.
- PR245 `content/links.constants.ts`: `LINKS_CANONICAL_URL` had no consumer and duplicated the canonical host; the fix removed it.

**Rule 19. A client island that is deleted leaves its test, its icon and its export behind.**
Before writing: when you delete a component, delete its test, its styles, its icon and its entry in every list that enumerates islands.
Check: grep the deleted component name across the repo. Zero hits outside `DECISIONS.md`.
Examples:
- PR282 `components/Icons/Icons.tsx`: the PR deleted the sections that used the icons but left the icons exported; the fix removed them.
- PR263 `content/schemas.ts`: a new required `company` field was populated in every entry but nothing read it; the fix wired it to the reader.

**Rule 20. A component must not reimplement a hook that already exists.**
Before writing: check the shared hooks before writing a media query listener or a timer.
Check: `pnpm check:client-naming` and a grep for the hook name in `components/`.
Examples:
- PR267 `components/client/GlobalMotion/GlobalMotion.client.tsx`: the mobile breakpoint was reimplemented with local state instead of the shared hook; the fix reused it.

---

## Content ts

Mostly facts that must agree across files.

**Rule 21. A fact lives in exactly one content module.**
The employer, the role, the company, the education and the links are written once and read from everywhere.
Before writing: before adding a field to `content/`, check whether an existing module already carries that fact.
Check: `pnpm validate-content` plus the identity consistency test.
Examples:
- PR263 `content/git-log.ts`: a new body text repeated a claim that `content/projects.ts` already carried; the fix reused the source.
- PR263 `content/projects.ts`: the new `company` field was populated in every entry but nothing consumed it; the fix wired it to the reader.

**Rule 22. A content field with no consumer is dead weight.**
Before writing: a new field must have a reader in the same change. If the reader comes later, the field does not go in first.
Check: grep the field name outside `content/` and outside its schema.
Examples:
- PR263 `content/profile.ts`: `profile.actions` was schema validated and exported but never rendered; the fix removed it.
- PR282 `content/about.ts`: the new rows duplicated the content that another module already owned; the fix removed the copy.

**Rule 23. Values that look like data must be shaped like data.**
A hash of 42 characters next to hashes of 40 is a typo. A raw enum spliced into a sentence is a leak of the internal shape into the reader.
Before writing: check the shape of every value against the shape of its siblings.
Check: `pnpm validate-content` and a read of the rendered section.
Examples:
- PR263 `content/git-log.ts`: one hash had 42 characters where every sibling had 40; the fix corrected it.

---

## CSS

**Rule 24. Every token comes from the theme, and every class has a consumer.**
Before writing: use the existing token names, and check that a new class name is actually used by a component.
Check: `pnpm lint:contrast` and a grep for each new class selector.
Examples:
- PR271 `app/css/components.css`: the `.opinions-more` rules were added but no component used the class; the fix deleted the rules.
- PR302 `app/css/theme.css`: the leading tokens were declared inside `@theme`, so Tailwind treated them as theme scale keys; the fix renamed them out of that namespace.

**Rule 25. A specificity fix that relies on equal specificity is a fix that will break.**
Before writing: when you override a rule, make the override unambiguous by construction, not by ordering luck.
Check: read the two rules together and confirm the winner does not depend on file order.
Examples:
- PR302 `app/css/components.css`: the override worked only because both rules had identical specificity; the fix used a structural selector.
- PR302 `app/css/components.css`: a rule inside `@layer components` could never apply because of the layer order; the fix moved it out.

**Rule 26. Any change to layout or colour needs regenerated visual baselines.**
Before writing: decide the visual baseline impact before the push, not after CI fails.
Check: `pnpm test:e2e` with regenerated baselines on both platforms.
Examples:
- PR271 `components/sections/HottestTakesSection/HottestTakesSection.tsx`: nesting another section inside the capturable element changed the captured size; the fix regenerated the baseline.
- PR284 `app/(en)/design-system/primitives/button/page.mdx`: a wrong statement about the native button default misled every reader; the fix corrected it.

---

## Other file

Server routes, settings, hooks config and agent files.

**Rule 27. A new API route uses the standard handler and the standard envelope.**
Before writing: a route that returns a bare `Response.json` is wrong even when the payload is right.
Check: `pnpm typecheck` and the API contract test.
Examples:
- PR267 `app/api/contact-retry/route.ts`: the route returned a bare `Response.json(counts)` instead of `defineHandler` and `ok()`; the fix used the envelope.
- PR262 `lib/server/body-limit.ts`: the new file was missing `import 'server-only'`, so client code could pull it in; the fix added it.

**Rule 28. Retired: merged into Rule 33, which covers the same schema contract and adds the fixture.**

---

## PR body, commit message and the contract

The classes that cross every file type: the PR body, the commit message, the checklist box, the schema and the bundle budget.

**Rule 29. Write the PR body last and make every sentence in it point at the diff.**
Before writing: for each sentence, name the file and the line it describes. If you cannot, cut the sentence.
Check: read the body and the diff side by side, one sentence at a time.
Examples:
- PR220 `package.json`: the body said brace-expansion was "already present, unchanged" while the diff added the override; the fix corrected the body.
- PR262 `app/api/mcp/route.ts`: the body claimed the body limit wrapped the transport route itself; the fix described what the code does.

**Rule 30. A comment, a commit message and an ADR reason must be true about the code.**
Before writing: if you write "pure", "never", "always", "safe" or "prevents", prove the sentence against the implementation.
Check: grep your new comments and your commit messages for absolute words and confirm each one.
Examples:
- PR147 `scripts/agent-eval.ts`: the doc comment called the function a pure aggregate assembler while it read the clock; the fix passed the timestamp in.
- PR142 `DECISIONS.md`: the ADR said the linter flag stopped an in-progress import from being deleted, which the code said it does not; the fix aligned the ADR to the code.

**Rule 31. The checklist box and the ADR entry are part of the change, not paperwork after it.**
Before writing: fill every box that applies, write why every box that does not apply does not apply, and land the ADR in the same commit as the decision.
Check: `pnpm pr:gate` plus a read of the checklist against the diff.
Examples:
- PR220 `package.json`: seven dependency overrides shipped with the ADR box marked N/A; the fix added the ADR entry.

**Rule 32. Every new client island, effect and dependency moves a budget.**
Before writing: a new client island is inside the existing JS budget or it changes the budget in the same PR. An effect always gets its dependency array.
Check: `pnpm bundle-check` and `pnpm route-js-check` before the push.
Examples:
- PR286 `components/responsive/MatrixRain/index.ts`: the barrel re-exported the real component next to the lazy wrapper, so the lazy path was not the thing that shipped; the fix made the barrel export only the wrapper.
- PR265 `components/sections/Footer/Footer.client.tsx`: the new keydown effect had no dependency array, so React re-attached the listener on every render; the fix added the array.

**Rule 33. A schema is the contract, and the code, the fixture and the schema must agree.**
Before writing: when a value can only take one shape, say so in the schema, not in a comment. When a field is removed, the fixture that still builds it is updated in the same change.
Check: `pnpm typecheck` plus the schema test that covers the boundary.
Examples:
- PR191 `__tests__/metric-consistency.test.ts`: the sign helper assumed a signed delta while the schema allowed any string; the fix made the schema require the sign.
- PR262 `docs/05-api-and-integrations.md`: the new error code was added to the union and to the prose, but two other documents still listed the old set; the fix updated all of them.
- PR262 `lib/server/body-limit.ts`: the catch branch reported a JSON error for a transport failure that happened before parsing; the fix gave the branch its own code.

---

## Before you push

Ordered by how often the finding was missed.
1. Grep the repo for every symbol, path and literal you changed, and fix each remaining hit in the same PR.
2. Grep the docs for every count and list you wrote, and confirm each one against the code.
3. Prove every guard fails closed: delete the input it reads and confirm the gate still fails.
4. Make every test fail when you break the behaviour it claims to cover.
5. Write the PR body last, then check every sentence in it against the diff.
6. Extract every literal you typed twice into one named constant.
7. Confirm every deleted component left no test, icon, export or style rule behind.
8. Check the accessible name and the native attributes on every element you touched.
9. Confirm every new content field has a reader in the same change.
10. Check every changed file against the file type rules above.
11. Update the ADR with the commit SHA and the way to undo it, in the same change as the code.
12. Run `pnpm ci:local`, then `pnpm bundle-check` and `pnpm route-js-check`.
13. Run `pnpm gates:runtime` and regenerate the visual baselines if the change touched layout or colour.
14. Fill the whole PR template, and make every box true about the diff.
15. Re-read `git diff origin/main...HEAD` end to end and fix what you find.
