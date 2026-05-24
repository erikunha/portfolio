# Component Co-location Migration

**Date:** 2026-05-24
**Status:** Approved — pending implementation plan

## Problem

The codebase is in a mid-migration state. Some components are fully co-located
(`design-system/components/`, `components/client/InteractiveShell/`, etc.); others
are flat files in their parent directory. Two `responsive/` components have their
`.e2e.ts` inside a folder but their `.tsx` and `.module.css` still flat — the worst
of both worlds.

## Goal

Every component follows the same folder convention. No flat sibling files.
Zero logic changes — pure file moves plus barrel re-exports.

## Convention

```
ComponentName/
├── ComponentName.tsx          # or .client.tsx
├── ComponentName.module.css   # if styles exist
├── ComponentName.test.tsx     # if unit tests exist
├── ComponentName.e2e.ts       # if e2e tests exist
└── index.ts                   # export { ComponentName } from './ComponentName'
```

Sub-components and lazy wrappers live **inside** the parent folder.
Only the primary export appears in `index.ts`; internal sub-components are not
re-exported.

## Phases

### Phase 1 — `components/responsive/` (6 components)

| Component | Action |
|---|---|
| `DesktopTopbar` | Move `.client.tsx` + `.module.css` into existing `DesktopTopbar/`; add `index.ts` |
| `Dock` | Move `.client.tsx` + `.module.css` into existing `Dock/`; add `index.ts` |
| `CRTOverlay` | Create folder; move `.client.tsx` + `.module.css`; add `index.ts` |
| `MobileTitleBar` | Create folder; move `.client.tsx` + `.module.css`; add `index.ts` |
| `StatusBar` | Create folder; move `.client.tsx` + `.module.css`; add `index.ts` |
| `Module` | Create folder; move `.tsx` + `.module.css`; add `index.ts` |

**Import update after Phase 1:** `components/AppShell.client.tsx` — strip `.client`
suffix from all responsive imports:
- `./responsive/CRTOverlay.client` → `./responsive/CRTOverlay`
- `./responsive/DesktopTopbar.client` → `./responsive/DesktopTopbar`
- `./responsive/Dock.client` → `./responsive/Dock`
- `./responsive/MobileTitleBar.client` → `./responsive/MobileTitleBar`
- `./responsive/StatusBar.client` → `./responsive/StatusBar`

Also update `__tests__/content-visibility.test.ts` if it imports a responsive component
directly (verify during implementation).

### Phase 2 — Root `components/` (AppShell, ErrorBoundary, Icons)

| File | Destination |
|---|---|
| `AppShell.client.tsx` + `AppShell.module.css` | `AppShell/AppShell.client.tsx` + `AppShell/AppShell.module.css` + `AppShell/index.ts` |
| `ErrorBoundary.client.tsx` | `ErrorBoundary/ErrorBoundary.client.tsx` + `ErrorBoundary/index.ts` |
| `Icons.tsx` | `Icons/Icons.tsx` + `Icons/index.ts` |

**Import updates after Phase 2:**
- `app/page.tsx`:
  - `from '@/components/AppShell.client'` → `from '@/components/AppShell'`
  - `from '@/components/ErrorBoundary.client'` → `from '@/components/ErrorBoundary'`
- `AppShell/AppShell.client.tsx` (internal):
  - `from './ErrorBoundary.client'` → `from './ErrorBoundary'`
  - `import './AppShell.module.css'` stays (same folder)

Note: `AppShell.client.tsx` also imports `'@/lib/error-bridge.client'` — no change.

### Phase 3 — `components/sections/` flat components (17 sections)

Each flat section gets a folder + `index.ts`. No internal sub-components except
ManPageSection.

**Sections to migrate:**
CommunitySection, ContactSection, CredentialsSection, GitLogSection, GuitarSection,
HottestTakesSection, NowSection, NpmStackSection, PerfReceiptsSection, ProjectsSection,
ReadmeSection, ResponsibilitiesSection, ShellSection, SysHealthSection, UnknownsSection,
VisaSection, ManPageSection.

**ManPageSection special case:**
`ManPageDesktop.tsx` and `ManPageMobile.tsx` move **inside** `ManPageSection/` as
internal sub-components. They are not exported from `ManPageSection/index.ts`.
`ManPageSection.tsx` internal imports `./ManPageDesktop` and `./ManPageMobile` remain
valid (same folder).

**Import updates inside each migrated section** (the section's own `.tsx` file):
- `from '../Icons'` → `from '../../Icons'`
  (consistent with already-migrated AiMetricsSection and LivePerfSection which already
  use `from '../../Icons'`)
- `from '../ErrorBoundary.client'` → `from '../../ErrorBoundary'`
  (ContactSection.tsx, ShellSection.tsx)

**Callers of sections** (`app/page.tsx`, test files) import via the section name
(e.g. `from '@/components/sections/CommunitySection'`). TypeScript resolves this to
`CommunitySection/index.ts` automatically — no import path changes needed in callers.

### Phase 4 — Lazy wrappers (3 files)

| File | Destination | `index.ts` addition |
|---|---|---|
| `client/ContactFormLazy.tsx` | `client/ContactForm/ContactFormLazy.tsx` | `export { ContactFormLazy } from './ContactFormLazy'` |
| `client/InteractiveShellLazy.tsx` | `client/InteractiveShell/InteractiveShellLazy.tsx` | `export { InteractiveShellLazy } from './InteractiveShellLazy'` |
| `sections/FooterLazy.client.tsx` | `sections/Footer/FooterLazy.client.tsx` | `export { FooterLazy } from './FooterLazy.client'` |

**Caller import updates:**
- `components/sections/ContactSection.tsx`:
  `from '../client/ContactFormLazy'` → `from '../client/ContactForm'`
- `components/sections/ShellSection.tsx`:
  `from '../client/InteractiveShellLazy'` → `from '../client/InteractiveShell'`
- `app/page.tsx`:
  `from '@/components/sections/FooterLazy.client'` → `from '@/components/sections/Footer'`

## No-change zones

- `__tests__/` — integration, API, and script tests; no component tests live here
- `design-system/components/` — already fully co-located
- `components/client/` fully-migrated folders (ContactForm, HeroBootAnimation,
  HeroSystemFailure, InteractiveShell, RoleTyper, ToTopButton)
- `components/sections/` already-migrated folders (Hero, Footer, AiMetricsSection,
  LivePerfSection)
- `components/HeroStats/` — already a folder
- `vitest.config.ts` — no changes; vitest resolves `*.test.tsx` anywhere via default
  glob; coverage `include` already uses `components/**`

## Verification gate (after each phase)

```
pnpm typecheck && pnpm test && pnpm build
```

All three must pass before starting the next phase. A TS error = wrong import path,
not a logic bug. No test assertions change.

## Constraints

- Zero logic changes. If a file changes beyond path updates and `index.ts` additions,
  stop and flag.
- `index.ts` barrel files export only the primary named export (and lazy wrapper if
  one exists). No wildcard re-exports.
- The `.client` suffix stays on files that are client components. `index.ts` files
  themselves are never client components.
- `ManPageDesktop` and `ManPageMobile` are not exported from any `index.ts` — they are
  internal implementation details of `ManPageSection`.
