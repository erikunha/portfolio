# Test Coverage Enforcement + Gap-Filling Design

## Goal

Raise enforced Vitest lines coverage from 60% to 80% via an incremental ratchet, fill identified unit-test gaps in `lib/`, client islands, and design system components, add behavioral E2E tests for design system components and user journeys, and surface coverage deltas as a PR comment in CI.

## Architecture

Three unit-test batches + one E2E batch + one CI step, each building on the last. Every threshold bump only happens after the tests already cover it -- CI stays green throughout.

| Batch | Scope | Threshold after |
|---|---|---|
| 1 | `lib/` utilities + API route error branches | 60% → 70% |
| 2 | Client island edge cases | 70% → 75% |
| 3 | DS component primitives | 75% → 80% |
| 4 | E2E behavioral (DS components + user journeys) | stays at 80% |
| 5 | CI: PR coverage comment step | stays at 80% |

## Tech Stack

- **Vitest** with v8 coverage provider (already in use)
- **RTL + jsdom** for unit tests (already in use; `__tests__/helpers/render.ts`)
- **Playwright** for E2E (already configured; 4-project matrix: chromium/webkit × desktop/mobile)
- **`actions/github-script`** for PR comment (no new npm dependency)

---

## Batch 1: `lib/` utilities + API route branches

### Target files

- `lib/rate-limit.ts` -- sliding window, per-IP bucket, TTL reset
- `lib/server/` utilities not covered by existing `__tests__/` (verified against coverage report)
- API route conditional branches: error paths not exercised by existing `ask-*.test.ts` (malformed body, missing required fields, kill-switch-off state, upstream timeout)

### Conventions

- All tests go in `__tests__/` following existing file naming (`<module>.test.ts`)
- No `readFileSync` on source files (enforced by `no-source-grep.test.ts`)
- Behavioral assertions only: assert observable outputs / side effects, not internal implementation

### Threshold change

After Batch 1 passes: update `vitest.config.ts` `thresholds.lines` from `60` to `70`.

---

## Batch 2: Client island edge cases

### Target files and scenarios

**`ContactForm`** (`components/ContactForm/ContactForm.tsx`):
- Validation error states: empty name, empty email, invalid email format, empty message -- each shows correct inline error
- Submission loading state: submit button disabled + spinner visible while pending
- Server error response: 500 from API renders fallback error message

**`InteractiveShell`** (`components/client/InteractiveShell/InteractiveShell.tsx`):
- Command history navigation (up/down arrow)
- Multi-turn streaming: second prompt appends to history, does not clobber first
- Abort signal: ESC during streaming stops render, no layout shift

**`CopyButton`** (`components/CopyButton/CopyButton.tsx`):
- Clipboard write success: button state transitions to "Copied" + tooltip visible
- Clipboard write failure: graceful fallback (no unhandled rejection)

**`ToTopButton`** (`components/ToTopButton/ToTopButton.tsx`):
- Hidden below scroll threshold, visible above it (mock `IntersectionObserver`)

### Conventions

- Same as Batch 1 (`__tests__/`, behavioral, no source-grep)
- Mock `navigator.clipboard` and `IntersectionObserver` via `vi.fn()` in `rtl-setup.ts` or per-test

### Threshold change

After Batch 2 passes: update `thresholds.lines` from `70` to `75`.

---

## Batch 3: DS component primitives

### Target files and scenarios

**`CodeBlock`** (`design-system/components/CodeBlock/`):
- Renders code content inside a `<pre>/<code>` block
- Copy trigger: click fires clipboard write (same mock as CopyButton)
- No `id` collision when rendered twice

**`Callout`** (`design-system/components/Callout/`):
- Renders expected icon + text for each variant (`info`, `warning`, `error`)
- `aria-label` or role passthrough matches variant

**`Badge` / `StatusBadge`** (`design-system/components/`):
- Variant class present in rendered output
- `id`, `className`, `aria-*` passthrough from consumer (DS component pre-mortem check)
- Can render twice without `id` collision

**`DesignSystemNav`** (`design-system/components/DesignSystemNav/`):
- Active state reflects current pathname (mock `usePathname`)
- All section links render with correct `href`

### Conventions

- Co-locate in `design-system/components/<ComponentName>/<ComponentName>.test.tsx` (matching existing co-location pattern)
- Use shared RTL render helper from `__tests__/helpers/render.ts`

### Threshold change

After Batch 3 passes: update `thresholds.lines` from `75` to `80`.

---

## Batch 4: E2E behavioral tests

### DS component behavioral E2E

Co-located `.e2e.ts` files, all 4 Playwright projects (chromium/webkit × desktop/mobile):

**`CopyButton.e2e.ts`**:
- Click triggers clipboard write
- Tooltip or button text reflects "Copied" state briefly

**`CodeBlock.e2e.ts`**:
- Code content renders in `<code>` block
- Copy button present + keyboard accessible

**`Callout.e2e.ts`**:
- Icon + text renders per variant
- `prefers-reduced-motion` does not break layout

**`DesignSystemNav.e2e.ts`**:
- Section links navigate to correct routes
- Active state updates on navigation
- Keyboard tab sequence reaches all links

### User journey E2E

New files in `tests/e2e/`:

**`contact-form.spec.ts`** (chromium + webkit × desktop + mobile):
- Fill all fields with valid data + submit
- Success message visible
- Server 500: error fallback renders (Playwright route intercept on `/api/contact`)
- Validation: submit with empty fields shows errors without network call

**`ask-question.spec.ts`** (chromium + webkit × desktop + mobile):
- Type question into shell + submit
- Streaming response renders incrementally (Playwright route intercept on `/api/ask` returning chunked SSE)
- Completed answer visible in shell history
- Second question appends to history (no clobber)

### Playwright route intercept pattern

Use `page.route('/api/*', handler)` to mock API responses in user journey tests. This keeps E2E fast and deterministic without requiring live Upstash/Anthropic keys.

---

## Batch 5: PR coverage comment in CI

### CI step (`.github/workflows/ci.yml`, `test` job)

Add after `pnpm test:coverage` and the artifact upload:

```yaml
- name: Post coverage comment
  if: github.event_name == 'pull_request'
  uses: actions/github-script@v7
  with:
    script: |
      const fs = require('fs');
      const summary = JSON.parse(fs.readFileSync('coverage/coverage-summary.json', 'utf8'));
      const t = summary.total;
      const pct = (n) => `${n.pct.toFixed(1)}%`;
      const body = [
        '## Coverage',
        `| Metric | Coverage | Threshold |`,
        `|---|---|---|`,
        `| Lines | ${pct(t.lines)} | 80% |`,
        `| Functions | ${pct(t.functions)} | — |`,
        `| Branches | ${pct(t.branches)} | — |`,
        `| Statements | ${pct(t.statements)} | — |`,
      ].join('\n');
      github.rest.issues.createComment({
        issue_number: context.issue.number,
        owner: context.repo.owner,
        repo: context.repo.repo,
        body,
      });
```

### Behavior

- Runs only on `pull_request` events (not on push to main)
- Reads the already-generated `coverage/coverage-summary.json`
- Posts a clean table with lines/functions/branches/statements
- **Upserts the comment**: on subsequent pushes to the same PR branch, finds the existing coverage comment (by matching a marker string in the body) and replaces it rather than appending a new comment each time
- No new npm dependency -- `actions/github-script` is already available in GitHub Actions

---

## Coverage targets summary

| Metric | Current | Target | Enforced? |
|---|---|---|---|
| Lines | 66.4% | 80% | Yes (CI exits 1) |
| Functions | 54.5% | -- | No (visible in PR comment) |
| Branches | 46.7% | -- | No (visible in PR comment) |

Functions and branches improve naturally as tests fill gaps. They are not gated -- the PR comment makes them visible so they can be raised deliberately in a future pass.

---

## What this does NOT include

- Playwright-level code coverage (Istanbul/V8 instrumentation over a running browser) -- high complexity, low marginal value given the Vitest unit coverage already covers the same source files
- Per-directory Vitest thresholds -- global 80% is sufficient for this codebase size; per-directory thresholds add config complexity without proportional benefit
- Mutation testing (Stryker is already in package.json as `test:mutation` but not gated) -- separate concern
