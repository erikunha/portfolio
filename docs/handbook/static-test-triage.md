# Static test triage

Some tests read the file system instead of exercising behaviour: they open a source, config, workflow or CSS file and assert on its text or on the list of files. STANDARDS.md chapter 4 allows this only where the file itself is the artifact under test, and requires a `behavioral-test-allow` tag. This page sorts every such test by what it checks and says where each check belongs long term.

## How the list was built

Run from the repository root. Each command lists test files, so counts are files, not call sites.

```sh
git grep -lE "readFileSync|readdirSync|readdir\(|readFile\(|lib/walk|behavioral-test-allow|ls-files" -- '*.test.ts' '*.test.tsx'
git grep -lE "readFileSync" -- '*.test.ts' '*.test.tsx'
git grep -lE "readdirSync|readdir\(" -- '*.test.ts' '*.test.tsx'
git grep -l "behavioral-test-allow" -- '*.test.ts' '*.test.tsx'
```

| Measure | Files |
| ------- | ----- |
| Union of all patterns (the rows below) | 147 |
| Calls `readFileSync` | 123 |
| Lists a directory (`readdirSync`, `readdir`) | 34 |
| Carries a `behavioral-test-allow` tag | 75 |

The union exceeds the 120-row limit for one row per file, so the table below has one row per group. Each group names every file in it. Groups are assigned from the paths each test reads and its file name, not from a line-by-line audit; a file that proves to belong elsewhere moves when its replacement is built.

## Classes

| Class | Meaning |
| ----- | ------- |
| rule | Asserts a repository-wide rule or a documented claim by scanning files |
| layout contract | Asserts a CSS or layout property that jsdom cannot evaluate |
| artifact | The file is the thing under test (a workflow, manifest or config) |
| keep | The file access is test setup, not an assertion about source text |

## Replacements

- A `scripts/gates` check runs in `pnpm verify` and reports a real property of the tree. It replaces a test that only exists to scan files.
- A browser e2e contract (Playwright, in `tests/`) reads computed style and geometry in a real engine.
- Keep means the test stays as it is, with the reason in the table.

## Triage

| Group | Class | Files | Replacement | Test files |
| ----- | ----- | ----- | ----------- | ---------- |
| Workflow and CI artifacts | artifact | 37 | A `scripts/gates` check that lints the workflow files; keep each test until its check lands | `__tests__/ci/biome-rules.test.ts`<br>`__tests__/ci/ci-ai-eval-needs.test.ts`<br>`__tests__/ci/ci-gate-job.test.ts`<br>`__tests__/ci/ci-job-timeouts.test.ts`<br>`__tests__/ci/ci-privilege-split.test.ts`<br>`__tests__/ci/ci-ui-filter.test.ts`<br>`__tests__/ci/claude-review-predicate.test.ts`<br>`__tests__/ci/claude-review-prompt-shapes.test.ts`<br>`__tests__/ci/claude-review-verdict-guard.test.ts`<br>`__tests__/ci/claude-workflow-hardening.test.ts`<br>`__tests__/ci/claude-workflow-tools.test.ts`<br>`__tests__/ci/codeowners-coverage.test.ts`<br>`__tests__/ci/composite-setup-action.test.ts`<br>`__tests__/ci/dependabot-config.test.ts`<br>`__tests__/ci/e2e-matrix-coverage.test.ts`<br>`__tests__/ci/high-risk-label-base-checkout.test.ts`<br>`__tests__/ci/high-risk-label-workflow.test.ts`<br>`__tests__/ci/lhci-ci-job.test.ts`<br>`__tests__/ci/lockfile-resolution-probe-workflow.test.ts`<br>`__tests__/ci/mutation-incremental-config.test.ts`<br>`__tests__/ci/semgrep-ci-job.test.ts`<br>`__tests__/ci/visual-baseline-artifact.test.ts`<br>`__tests__/ci/weekly-metrics-workflow.test.ts`<br>`__tests__/ci/workflow-action-sha-sync.test.ts`<br>`__tests__/ci/workflow-permissions.test.ts`<br>`__tests__/claude-review-ci.test.ts`<br>`__tests__/gitleaks-install.test.ts`<br>`__tests__/rollback-rehearsal-workflow.test.ts`<br>`__tests__/workflow-downloads.test.ts`<br>`lib/eval/publish-gate.test.ts`<br>`lib/eval/publish-workflows.test.ts`<br>`scripts/__tests__/build-manifest-step.test.ts`<br>`scripts/__tests__/ci-full-review-fixes.test.ts`<br>`scripts/__tests__/ci-full-stages.test.ts`<br>`scripts/__tests__/ci-verify-parity.test.ts`<br>`scripts/__tests__/ci-workflow.test.ts` |
| CSS and layout contracts | layout contract | 34 | A browser e2e contract reading computed style and geometry; jsdom does not evaluate the cascade | `__tests__/branch-coverage-gaps.test.tsx`<br>`__tests__/content-visibility.test.ts`<br>`__tests__/crt-governor-css.test.ts`<br>`__tests__/css-breakpoints.test.ts`<br>`__tests__/css-compositor-animations.test.ts`<br>`__tests__/css-layer-order.test.ts`<br>`__tests__/css-paint-cost.test.ts`<br>`__tests__/css-referenced-classes.test.ts`<br>`__tests__/css-token-boundary.test.ts`<br>`__tests__/helpers/components-css.test.ts`<br>`__tests__/home-css-entry.test.ts`<br>`__tests__/measured-heading-css.test.ts`<br>`__tests__/meta/argos-capture.test.ts`<br>`__tests__/meta/css-tokens.test.ts`<br>`__tests__/meta/e2e-menu-click-hydrated.test.ts`<br>`__tests__/meta/leading-integrity.test.ts`<br>`__tests__/module-section-visibility.test.ts`<br>`__tests__/motion-selector-spelling.test.ts`<br>`__tests__/motion-single-switch.test.ts`<br>`__tests__/nav-chrome-offsets.test.ts`<br>`__tests__/separator-token.test.ts`<br>`__tests__/type-reveal-hydration.test.ts`<br>`__tests__/viewport-tokens.test.ts`<br>`app/(en)/design-system/_lib/theme-tokens.test.ts`<br>`components/client/ContactForm/ContactForm.test.tsx`<br>`components/client/ContactTimezone/ContactTimezone.test.tsx`<br>`components/client/InteractiveShell/island-min-height.test.tsx`<br>`components/client/LazyIsland/IslandLoading.test.tsx`<br>`components/links/LatestVideoSkeleton/LatestVideoSkeleton.test.tsx`<br>`components/responsive/MatrixRain/rain-palette.test.ts`<br>`components/sections/AiMetricsSection/AiMetricsSection.test.tsx`<br>`components/sections/HottestTakesSection/HottestTakesSection.test.tsx`<br>`components/sections/LivePerfSection/LivePerfSection.test.tsx`<br>`components/sections/PerfReceiptsSection/PerfReceiptsSection.test.tsx` |
| Docs, claims and counts | rule | 21 | A `scripts/gates` check that compares the documented number or claim with its source | `__tests__/agent/agent-surfaces.test.ts`<br>`__tests__/ask/ask-surfaces-resume-sync.test.ts`<br>`__tests__/company-links.test.ts`<br>`__tests__/content-single-source.test.ts`<br>`__tests__/design-system-content-agnostic.test.ts`<br>`__tests__/design-system-doc-counts.test.ts`<br>`__tests__/design-system-route-coverage.test.ts`<br>`__tests__/docs-section-counts.test.ts`<br>`__tests__/identity-consistency.test.ts`<br>`__tests__/meta/docs-name-real-tokens.test.ts`<br>`__tests__/meta/docs-numbers.test.ts`<br>`__tests__/metric-consistency.test.ts`<br>`__tests__/removed-claims.test.ts`<br>`__tests__/retired-claims.test.ts`<br>`__tests__/scroll-regions.test.tsx`<br>`__tests__/system-prompt.test.ts`<br>`__tests__/zod-pin-wording.test.ts`<br>`components/responsive/nav-hrefs.test.tsx`<br>`content/section-labels.test.ts`<br>`content/work-scope.test.ts`<br>`scripts/__tests__/feature-map.test.ts` |
| Config, manifests and repo rules | artifact | 32 | A `scripts/gates` check on the manifest or config; keep where the read is the only way to see the file | `__tests__/audit-ignore-scope.test.ts`<br>`__tests__/brand-assets.test.ts`<br>`__tests__/browser-rum.test.ts`<br>`__tests__/client-closure-no-zod.test.ts`<br>`__tests__/contact/contact-retry-schedule.test.ts`<br>`__tests__/contact/contact-route.test.ts`<br>`__tests__/e2e-route-fetch-teardown.test.ts`<br>`__tests__/log-structured.test.ts`<br>`__tests__/meta/ai-config.test.ts`<br>`__tests__/meta/budget-mock-factory.test.ts`<br>`__tests__/meta/e2e-origin.test.ts`<br>`__tests__/meta/e2e-viewport-widths.test.ts`<br>`__tests__/meta/env-unset-in-tests.test.ts`<br>`__tests__/meta/git-history-max-buffer.test.ts`<br>`__tests__/meta/gitignore-env-files.test.ts`<br>`__tests__/meta/gitignore-worktree-symlinks.test.ts`<br>`__tests__/meta/layer-direction.test.ts`<br>`__tests__/meta/pnpm-overrides-live.test.ts`<br>`__tests__/meta/pre-commit-hook.test.ts`<br>`__tests__/meta/subprocess-test-timeout.test.ts`<br>`__tests__/release-age-exclusions.test.ts`<br>`__tests__/release-age-quarantine.test.ts`<br>`__tests__/stryker-directory-symlinks.test.ts`<br>`lib/env.test.ts`<br>`lib/links/feed.test.ts`<br>`scripts/__tests__/ai-paths-closure.test.ts`<br>`scripts/__tests__/ai-paths-eval-closure.test.ts`<br>`scripts/__tests__/bare-node-scripts.test.ts`<br>`scripts/__tests__/detect-changes-ai-lock.test.ts`<br>`scripts/__tests__/gate-negative-controls.test.ts`<br>`scripts/__tests__/main-module-guard.test.ts`<br>`scripts/__tests__/no-orphan-script-lib.test.ts` |
| Script tests with file system fixtures | keep | 23 | Keep: the read or write is setup for the script under test, not an assertion about source text | `__tests__/ask/ask-eval-harness.test.ts`<br>`__tests__/ask/ask-eval-judge-outage.test.ts`<br>`__tests__/ask/ask-eval-transport-retry.test.ts`<br>`scripts/__tests__/changelog-merge.test.ts`<br>`scripts/__tests__/check-client-naming-scan.test.ts`<br>`scripts/__tests__/check-shell-dom-writes.test.ts`<br>`scripts/__tests__/check-test-integrity.test.ts`<br>`scripts/__tests__/check-detect-changes-paths.test.ts`<br>`scripts/__tests__/check-gitleaks-fixture.test.ts`<br>`scripts/__tests__/check-mutation-kills.test.ts`<br>`scripts/__tests__/check-semgrep-fixture.test.ts`<br>`scripts/__tests__/check-staged.test.ts`<br>`scripts/__tests__/ci-full-cli.test.ts`<br>`scripts/__tests__/ci-full-run.test.ts`<br>`scripts/__tests__/detect-changes.parity.test.ts`<br>`scripts/__tests__/detect-changes.test.ts`<br>`scripts/__tests__/install-playwright-browsers.test.ts`<br>`scripts/__tests__/metrics-collect.test.ts`<br>`scripts/__tests__/run-semgrep.test.ts`<br>`scripts/__tests__/semgrep-fixtures.test.ts`<br>`scripts/__tests__/semgrep-fp-baseline.test.ts`<br>`scripts/__tests__/semgrep-lib.test.ts`<br>`scripts/__tests__/walk.test.ts` |
| Total | | 147 | | |

## Top directories

| Directory | Files |
| --------- | ----- |
| `scripts/__tests__` | 33 |
| `__tests__/ci` | 25 |
| `__tests__/meta` | 18 |
| `components` | 11 |
| `lib` | 4 |
| `__tests__/ask` | 4 |
| `__tests__/agent` | 2 |
| `content` | 2 |
| `__tests__/contact` | 2 |
| `__tests__/claude-review-ci.test.ts` | 1 |
| `__tests__/gitleaks-install.test.ts` | 1 |
| `__tests__/rollback-rehearsal-workflow.test.ts` | 1 |
| `__tests__/workflow-downloads.test.ts` | 1 |
| `__tests__/branch-coverage-gaps.test.tsx` | 1 |
| `__tests__/content-visibility.test.ts` | 1 |
| `__tests__/crt-governor-css.test.ts` | 1 |
| `__tests__/css-breakpoints.test.ts` | 1 |
| `__tests__/css-compositor-animations.test.ts` | 1 |
| `__tests__/css-layer-order.test.ts` | 1 |
| `__tests__/css-paint-cost.test.ts` | 1 |
| `__tests__/css-referenced-classes.test.ts` | 1 |
| `__tests__/css-token-boundary.test.ts` | 1 |
| `__tests__/helpers` | 1 |
| `__tests__/home-css-entry.test.ts` | 1 |
| `__tests__/measured-heading-css.test.ts` | 1 |
| `__tests__/module-section-visibility.test.ts` | 1 |
| `__tests__/motion-selector-spelling.test.ts` | 1 |
| `__tests__/motion-single-switch.test.ts` | 1 |
| `__tests__/nav-chrome-offsets.test.ts` | 1 |
| `__tests__/separator-token.test.ts` | 1 |
| `__tests__/type-reveal-hydration.test.ts` | 1 |
| `__tests__/viewport-tokens.test.ts` | 1 |
| `app` | 1 |
| `__tests__/company-links.test.ts` | 1 |
| `__tests__/content-single-source.test.ts` | 1 |
| `__tests__/design-system-content-agnostic.test.ts` | 1 |
| `__tests__/design-system-doc-counts.test.ts` | 1 |
| `__tests__/design-system-route-coverage.test.ts` | 1 |
| `__tests__/docs-section-counts.test.ts` | 1 |
| `__tests__/identity-consistency.test.ts` | 1 |
| `__tests__/metric-consistency.test.ts` | 1 |
| `__tests__/removed-claims.test.ts` | 1 |
| `__tests__/retired-claims.test.ts` | 1 |
| `__tests__/scroll-regions.test.tsx` | 1 |
| `__tests__/system-prompt.test.ts` | 1 |
| `__tests__/zod-pin-wording.test.ts` | 1 |
| `__tests__/audit-ignore-scope.test.ts` | 1 |
| `__tests__/brand-assets.test.ts` | 1 |
| `__tests__/browser-rum.test.ts` | 1 |
| `__tests__/client-closure-no-zod.test.ts` | 1 |
| `__tests__/e2e-route-fetch-teardown.test.ts` | 1 |
| `__tests__/log-structured.test.ts` | 1 |
| `__tests__/release-age-exclusions.test.ts` | 1 |
| `__tests__/release-age-quarantine.test.ts` | 1 |
| `__tests__/stryker-directory-symlinks.test.ts` | 1 |

## Terms used

- **Artifact**: a file whose exact content is the product, such as a workflow or manifest.
- **jsdom**: the simulated browser DOM Vitest uses; it does not compute the CSS cascade or layout.
