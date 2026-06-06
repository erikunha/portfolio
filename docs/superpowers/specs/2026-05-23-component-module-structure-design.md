> **Status: Superseded by PR #80** — Tailwind v4 migration replaces the CSS module + Style Dictionary system described here. See `docs/superpowers/specs/2026-05-31-tailwind-v4-migration-design.md` and `DECISIONS.md` (2026-05-31 entry).

# Component Module Structure

**Date:** 2026-05-23
**Status:** Approved — ready for implementation plan

## Goal

Every component owns its complete test surface co-located in its folder. No test lives more than one directory away from the component it tests. The design system primitives already follow this shape; this spec extends it to all app-level components.

## Canonical folder shape

```
ComponentName/
  ComponentName.tsx           component implementation
  ComponentName.module.css    scoped styles
  ComponentName.test.tsx      unit test (present only when logic warrants)
  ComponentName.e2e.ts        BDD E2E spec (present only when behavior warrants)
  index.ts                    barrel re-export (keeps consumer import paths stable)
```

Playwright auto-creates `ComponentName.e2e.ts-snapshots/` adjacent to the spec when visual assertions are added. That folder is co-located by default — no special config needed.

## BDD E2E convention

E2E specs use Playwright behavioral naming — no Gherkin/Cucumber dependency.

```ts
test.describe('DesktopTopbar — navigation', () => {
  test('design system link navigates to /design-system', async ({ page }) => { ... });
  test('active section updates on scroll', async ({ page }) => { ... });
});
```

Descriptions read as user-observable behaviors, not implementation details.

## Component classification

### DS Primitives — `design-system/components/`

All 7 (Button, Field, Badge, TerminalPanel, StatTile, CmdLine, KbdKey):
- **Unit:** ✓ already co-located — no change
- **E2E:** ✗ — visual regression via `/design-system/components` route covers rendering contract

### Sections — `components/sections/`

| Component | Unit | E2E | Action |
|---|---|---|---|
| Hero | ✓ | ✓ | Migrate `hero-heading.test.ts` + `hero-rsc.test.ts` → `Hero/Hero.test.tsx`. Create `Hero/Hero.e2e.ts`: CTA links navigate, RoleTyper fires. |
| HeroStats | ✓ | ✗ | Migrate `HeroStats.test.ts` → `HeroStats/HeroStats.test.tsx`. E2E absorbed by Hero visual baseline. |
| AiMetricsSection | ✓ | ✗ | Migrate `ai-metrics-section.test.ts` → `AiMetricsSection/AiMetricsSection.test.tsx`. Async RSC with Redis + null/fallback paths — real contract worth isolating. |
| LivePerfSection | ✓ | ✗ | Create `LivePerfSection/LivePerfSection.test.tsx`: mock `getScores()` throwing → assert rendered HTML shows unavailable marker, not fabricated scores. `lighthouse-fallback.test.ts` tests the lib constant — different concern, stays in `__tests__/`. |
| Footer | ✓ | ✓ | Migrate `footer-lazy.test.ts` → `Footer/Footer.test.tsx`. Create `Footer/Footer.e2e.ts`: external links render with correct href targets (visual regression cannot verify link targets). |
| ManPageSection | assess | ✗ | `section-mobile-variants.test.ts` and `section-viewport-variants.test.ts` test multiple sections — assess during migration. If ManPage-specific content, move to `ManPageSection/ManPageSection.test.tsx`; if cross-section, leave in `__tests__/`. |
| ContactSection | ✗ | ✗ | Thin RSC wrapper over ContactFormLazy. No independent logic. ContactForm owns all testing. |
| ShellSection | ✗ | ✗ | Thin wrapper over InteractiveShellLazy. InteractiveShell owns all testing. |
| HottestTakesSection | ✗ | ✗ | Visual baseline exists. Content Zod-validated. Pure data→markup. |
| All other RSC sections | ✗ | ✗ | CommunitySection, CredentialsSection, GitLogSection, GuitarSection, NowSection, NpmStackSection, PerfReceiptsSection, ProjectsSection, ReadmeSection, ResponsibilitiesSection, SysHealthSection, UnknownsSection, VisaSection — all pure data→markup. Zod covers content shape, axe covers a11y, visual regression covers layout. Additional tests are theater. |

### Client components — `components/client/`

| Component | Unit | E2E | Action |
|---|---|---|---|
| ContactForm | ✓ | ✓ | Merge `contact-form-a11y.test.ts` + `contact-honeypot.test.ts` + `contact-rate-limit.test.ts` + `focus-and-error.test.ts` → `ContactForm/ContactForm.test.tsx`. Move `tests/e2e/contact.spec.ts` → `ContactForm/ContactForm.e2e.ts`. |
| InteractiveShell | ✓ | ✓ | Merge `InteractiveShell.streaming.test.ts` + `shell-aria.test.ts` → `InteractiveShell/InteractiveShell.test.tsx`. Move `tests/e2e/ask.spec.ts` → `InteractiveShell/InteractiveShell.e2e.ts`. |
| HeroBootAnimation | ✓ | ✗ | Migrate `boot-animation-no-usestate.test.ts` → `HeroBootAnimation/HeroBootAnimation.test.tsx`. Enforces the `useRef.textContent` constraint (CLAUDE.md requirement). E2E covered by visual baseline + cross-cutting reduced-motion test. |
| HeroSystemFailure | ✓ | ✗ | Migrate `sysfail-loop.test.ts` → `HeroSystemFailure/HeroSystemFailure.test.tsx`. E2E not realistic — only appears on actual system failure. |
| RoleTyper | ✓ | ✗ | Migrate `roletyper-a11y.test.ts` → `RoleTyper/RoleTyper.test.tsx`. ARIA live region contract. E2E absorbed by Hero E2E. |
| ToTopButton | ✗ | ✓ | Create `ToTopButton/ToTopButton.e2e.ts`: button appears after scroll threshold, click returns viewport to top. Requires real browser — no useful logic to unit test in isolation. |
| ContactFormLazy, InteractiveShellLazy | ✗ | ✗ | Dynamic import wrappers. No logic. Parent component covers them. |

### Responsive infrastructure — `components/responsive/`

| Component | Unit | E2E | Action |
|---|---|---|---|
| DesktopTopbar | ✗ | ✓ | Create `DesktopTopbar/DesktopTopbar.e2e.ts`: nav links navigate correctly, design system link goes to `/design-system`, active-section state updates on scroll. |
| Dock | ✗ | ✓ | Create `Dock/Dock.e2e.ts`: dock items navigate to correct section anchors on mobile viewport. |
| MatrixRain | ✓ | ✗ | Migrate `matrix-rain.test.ts` → `MatrixRain/MatrixRain.test.tsx`. Canvas behavior. E2E covered by visual regression + cross-cutting. |
| CRTOverlay | ✗ | ✗ | Visual regression captures render. Cross-cutting test 3 covers `prefers-reduced-motion`. |
| MobileTitleBar, StatusBar | ✗ | ✗ | Display-only. Visual regression covers. |
| Module, AppShell, ErrorBoundary | ✗ | ✗ | Layout wrappers / error boundary — page-level contracts, not component-level. |

### DS docs — `app/design-system/_components/`

| Component | Unit | E2E | Action |
|---|---|---|---|
| CopyButton | ✗ | ✓ | Create `CopyButton/CopyButton.e2e.ts`: click copies expected code string to clipboard. Clipboard behavior requires a real browser. |
| Preview | ✗ | ✗ | `design-system-pages.spec.ts` already verifies VIEW SOURCE toggle. No gap. |
| Sidebar | ✗ | ✗ | `design-system-pages.spec.ts` already verifies navigation. No gap. |

## What stays in `__tests__/`

Tests that are not owned by a single component remain centralized:

**API / lib / route tests:** `ask-*.test.ts`, `api-log-shape.test.ts`, `agent-surfaces.test.ts`, `browser-rum.test.ts`, `budget-cap.test.ts`, `csp-report.test.ts`, `css-paint-cost.test.ts`, `erik-json.test.ts`, `lighthouse-fallback.test.ts` (tests `lib/lighthouse-scores` constant, not the component), `log-structured.test.ts`, `motion.test.ts`, `proxy-csp.test.ts`, `redis-singleton.test.ts`, `route-handler.test.ts`, `system-prompt.test.ts`, `ua.test.ts`

**Cross-cutting / page-level:** `content-visibility.test.ts`, `skip-to-content.test.ts`, `lighthouse-fallback.test.ts` (if cross-section), `section-mobile-variants.test.ts`, `section-viewport-variants.test.ts` (if cross-section — assess on migration)

**Script tests:** `scripts/check-branch-protection.test.ts`, `scripts/check-dep-pinning.test.ts`, `scripts/check-pr-comments.test.ts`, `scripts/sanitize-secrets.test.ts`

**Stays in `tests/e2e/` (page-level E2E):** `visual.spec.ts`, `cross-cutting.spec.ts`, `observability-smoke.spec.ts`, `design-system-pages.spec.ts`, `design-system-components.spec.ts`

## Config changes

### Playwright — add one project for co-located E2E

Add to `playwright.config.ts` a project group targeting `components/**/*.e2e.ts` and `app/**/*.e2e.ts`. Same 4-browser matrix (chromium, chromium-mobile, webkit-desktop, webkit-mobile) already used for `design-system-components`. Zero change to existing projects.

```ts
{
  name: 'chromium-components',
  use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } },
  testMatch: /components\/.*\.e2e\.ts$|app\/.*\.e2e\.ts$/,
},
// + webkit-desktop-components, chromium-mobile-components, webkit-mobile-components
```

Helpers in `tests/e2e/_helpers/` remain importable from any co-located spec — TypeScript path resolution works across directories.

### Vitest — coverage include

Add `design-system/components/**` to `coverage.include` in `vitest.config.ts`. Currently missing — DS unit tests run but are invisible to the coverage threshold gate.

```ts
include: ['lib/**', 'components/**', 'app/**', 'design-system/components/**'],
```

### Vitest — test discovery

No change. Vitest already discovers `*.test.tsx` anywhere not explicitly excluded. Co-located tests are picked up automatically.

## Migration scope summary

**Unit tests migrating out of `__tests__/`:**
- `hero-heading.test.ts` + `hero-rsc.test.ts` → `components/sections/Hero/Hero.test.tsx`
- `HeroStats.test.ts` → `components/sections/HeroStats/HeroStats.test.tsx`
- `ai-metrics-section.test.ts` → `components/sections/AiMetricsSection/AiMetricsSection.test.tsx`
- `footer-lazy.test.ts` → `components/sections/Footer/Footer.test.tsx`
- `boot-animation-no-usestate.test.ts` → `components/client/HeroBootAnimation/HeroBootAnimation.test.tsx`
- `sysfail-loop.test.ts` → `components/client/HeroSystemFailure/HeroSystemFailure.test.tsx`
- `roletyper-a11y.test.ts` → `components/client/RoleTyper/RoleTyper.test.tsx`
- `matrix-rain.test.ts` → `components/responsive/MatrixRain/MatrixRain.test.tsx`
- `contact-form-a11y.test.ts` + `contact-honeypot.test.ts` + `contact-rate-limit.test.ts` + `focus-and-error.test.ts` → merge into `components/client/ContactForm/ContactForm.test.tsx`
- `InteractiveShell.streaming.test.ts` + `shell-aria.test.ts` → merge into `components/client/InteractiveShell/InteractiveShell.test.tsx`

**E2E tests moving from `tests/e2e/`:**
- `contact.spec.ts` → `components/client/ContactForm/ContactForm.e2e.ts`
- `ask.spec.ts` → `components/client/InteractiveShell/InteractiveShell.e2e.ts`

**New E2E specs (created):**
- `components/sections/Hero/Hero.e2e.ts`
- `components/sections/Footer/Footer.e2e.ts`
- `components/client/ToTopButton/ToTopButton.e2e.ts`
- `components/responsive/DesktopTopbar/DesktopTopbar.e2e.ts`
- `components/responsive/Dock/Dock.e2e.ts`
- `app/design-system/_components/CopyButton/CopyButton.e2e.ts`

## Structural migration notes

Flat component files (`Hero.tsx` + `Hero.module.css`) must move into their own subfolder (`Hero/Hero.tsx`). Every consumer import of that component must be updated. The barrel `index.ts` in each new folder prevents import churn for future moves:

```ts
// components/sections/Hero/index.ts
export { Hero } from './Hero';
```

Consumer imports that currently reference `'@/components/sections/Hero'` (resolved to `Hero.tsx` by Next.js) will resolve to `Hero/index.ts` after the move — transparent to consumers when the folder name matches the old file name.

Components that don't move to a folder (pure RSC data sections, thin wrappers) are left as flat files — no artificial folder for components with nothing to co-locate.

## Out of scope

- Adding new component functionality
- Changing test assertions or E2E behavior (tests migrate as-is, then improve separately)
- Storybook or visual tooling changes
- `lib/`, `app/api/`, or `scripts/` restructuring
