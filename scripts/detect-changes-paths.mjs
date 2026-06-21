// Single source of truth for the detect-changes job's git pathspecs. Plain node,
// zero deps: the CI detect-changes job and the quality-fast meta-gate run it
// without pnpm install. These lists live ONLY here; the ci.yml shell no longer
// holds a copy, so there is nothing to drift against.

// `ai` gates the ai-eval job (AI Gateway credits). package.json/pnpm-lock are
// intentionally excluded (avoid burning credits on lockfile churn).
export const AI_PATHS = [
  'app/api/ask/',
  'lib/ask/',
  'lib/ask-log.ts',
  'lib/ip-hash.ts',
  'lib/stream-protocol.ts',
  'lib/rate-limit.ts',
  'lib/agent/',
  'lib/hiring-profile.ts',
  'lib/eval/',
  'content/ask-eval-corpus.ts',
  'content/ask-eval-calibration.ts',
  'content/perf-receipts.ts',
  'content/projects.ts',
  'content/unknowns.ts',
  'content/visa.ts',
  'scripts/ask-eval.ts',
  '__tests__/ask-*',
];

// `app` gates performance, e2e-functional, e2e-visual-chromium.
export const APP_PATHS = [
  'app/',
  'components/',
  'design-system/',
  'lib/',
  'content/',
  'public/',
  'next.config.ts',
  '.github/workflows/',
  'lighthouserc.json',
  'lighthouserc.mobile.json',
  'scripts/check-bundle-size.mjs',
  'playwright.config.ts',
  'package.json',
  'pnpm-lock.yaml',
];

// `ui` gates the visual/Argos job and is a deliberate SUBSET of app: it drops
// .github/workflows/, lighthouserc*, and the bundle-size script (they affect
// build/e2e/perf but cannot change a rendered pixel). package.json is NOT in this
// literal list; the runner compares its { browserslist, pnpm } slices semantically
// instead (a script-only package.json edit must not trip the visual suite, but a
// browserslist or pnpm.overrides change can change emitted CSS/JS). lib/eval and
// lib/__tests__ are excluded: never in the Next runtime, cannot change a pixel,
// yet live under lib/ and would otherwise trip spurious Argos diffs.
export const UI_PATHS = [
  'app/',
  'components/',
  'design-system/',
  'lib/',
  'content/',
  'public/',
  'next.config.ts',
  'playwright.config.ts',
  'pnpm-lock.yaml',
  ':(exclude)lib/eval/**',
  ':(exclude)lib/__tests__/**',
];
