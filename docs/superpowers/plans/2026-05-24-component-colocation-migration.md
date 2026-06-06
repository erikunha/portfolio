# Component Co-location Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move every flat component file into a co-located per-component folder, completing the migration pattern already established by `design-system/components/` and the already-migrated components in `components/client/` and `components/sections/`.

**Architecture:** Pure file moves using `git mv` (preserves history) + `index.ts` barrel additions + import path updates. Zero logic changes. Four phases with a `pnpm typecheck && pnpm test && pnpm build` gate between each phase.

**Tech Stack:** Next.js 16, TypeScript strict, pnpm, Vitest, `git mv`.

---

## Convention (applied everywhere)

```
ComponentName/
├── ComponentName.tsx          # or .client.tsx
├── ComponentName.module.css   # if styles exist
├── ComponentName.test.tsx     # if unit tests exist
├── ComponentName.e2e.ts       # if e2e tests exist
└── index.ts                   # named re-exports only; no wildcard except Icons
```

Sub-components and lazy wrappers live inside the parent folder. Only primary exports appear in `index.ts`.

---

## Task 1 — Finish `responsive/DesktopTopbar` and `responsive/Dock`

These two folders already exist with only their `.e2e.ts` inside. Move the remaining flat files in.

**Files:**
- Move: `components/responsive/DesktopTopbar.client.tsx` → `components/responsive/DesktopTopbar/DesktopTopbar.client.tsx`
- Move: `components/responsive/DesktopTopbar.module.css` → `components/responsive/DesktopTopbar/DesktopTopbar.module.css`
- Create: `components/responsive/DesktopTopbar/index.ts`
- Move: `components/responsive/Dock.client.tsx` → `components/responsive/Dock/Dock.client.tsx`
- Move: `components/responsive/Dock.module.css` → `components/responsive/Dock/Dock.module.css`
- Create: `components/responsive/Dock/index.ts`

- [ ] **Step 1: Establish baseline**
```bash
pnpm typecheck && pnpm test --run
```
Expected: all pass. If not, stop and fix before continuing.

- [ ] **Step 2: Move DesktopTopbar files into existing folder**
```bash
git mv components/responsive/DesktopTopbar.client.tsx components/responsive/DesktopTopbar/DesktopTopbar.client.tsx
git mv components/responsive/DesktopTopbar.module.css components/responsive/DesktopTopbar/DesktopTopbar.module.css
```

- [ ] **Step 3: Create `components/responsive/DesktopTopbar/index.ts`**
```ts
export { DesktopTopbar } from './DesktopTopbar.client';
```

- [ ] **Step 4: Move Dock files into existing folder**
```bash
git mv components/responsive/Dock.client.tsx components/responsive/Dock/Dock.client.tsx
git mv components/responsive/Dock.module.css components/responsive/Dock/Dock.module.css
```

- [ ] **Step 5: Create `components/responsive/Dock/index.ts`**
```ts
export { Dock } from './Dock.client';
```

- [ ] **Step 6: Note — AppShell errors are expected until Task 3**

`AppShell.client.tsx` still imports `DesktopTopbar.client` and `Dock.client` using the old paths (now broken). Do not run typecheck here — the gate runs at the end of Task 3 once all responsive callers are fixed.

---

## Task 2 — Migrate remaining flat `responsive/` components

Four components: CRTOverlay, MobileTitleBar, StatusBar, Module. All flat, no existing folder.

**Files:**
- Create: `components/responsive/CRTOverlay/` folder + `CRTOverlay.client.tsx` + `CRTOverlay.module.css` + `index.ts`
- Create: `components/responsive/MobileTitleBar/` folder + `MobileTitleBar.client.tsx` + `MobileTitleBar.module.css` + `index.ts`
- Create: `components/responsive/StatusBar/` folder + `StatusBar.client.tsx` + `StatusBar.module.css` + `index.ts`
- Create: `components/responsive/Module/` folder + `Module.tsx` + `Module.module.css` + `index.ts`

- [ ] **Step 1: Create folders and move CRTOverlay**
```bash
mkdir -p components/responsive/CRTOverlay
git mv components/responsive/CRTOverlay.client.tsx components/responsive/CRTOverlay/CRTOverlay.client.tsx
git mv components/responsive/CRTOverlay.module.css components/responsive/CRTOverlay/CRTOverlay.module.css
```

- [ ] **Step 2: Create `components/responsive/CRTOverlay/index.ts`**
```ts
export { CRTOverlay } from './CRTOverlay.client';
```

- [ ] **Step 3: Move MobileTitleBar**
```bash
mkdir -p components/responsive/MobileTitleBar
git mv components/responsive/MobileTitleBar.client.tsx components/responsive/MobileTitleBar/MobileTitleBar.client.tsx
git mv components/responsive/MobileTitleBar.module.css components/responsive/MobileTitleBar/MobileTitleBar.module.css
```

- [ ] **Step 4: Create `components/responsive/MobileTitleBar/index.ts`**
```ts
export { MobileTitleBar } from './MobileTitleBar.client';
```

- [ ] **Step 5: Move StatusBar**
```bash
mkdir -p components/responsive/StatusBar
git mv components/responsive/StatusBar.client.tsx components/responsive/StatusBar/StatusBar.client.tsx
git mv components/responsive/StatusBar.module.css components/responsive/StatusBar/StatusBar.module.css
```

- [ ] **Step 6: Create `components/responsive/StatusBar/index.ts`**
```ts
export { StatusBar } from './StatusBar.client';
```

- [ ] **Step 7: Move Module**
```bash
mkdir -p components/responsive/Module
git mv components/responsive/Module.tsx components/responsive/Module/Module.tsx
git mv components/responsive/Module.module.css components/responsive/Module/Module.module.css
```

- [ ] **Step 8: Create `components/responsive/Module/index.ts`**

`Module.tsx` exports both a type and a function:
```ts
export { Module, type ModuleProps } from './Module';
```

---

## Task 3 — Update callers of moved `responsive/` components

Two files need import fixes: `AppShell.client.tsx` (uses `.client` suffixes) and `__tests__/content-visibility.test.ts` (imports `Module.module.css` directly by path).

**Files:**
- Modify: `components/AppShell.client.tsx`
- Modify: `__tests__/content-visibility.test.ts`

- [ ] **Step 1: Update `components/AppShell.client.tsx` responsive imports**

Find these lines (they import with explicit `.client` suffixes — now broken because the files moved):
```ts
import { CRTOverlay } from './responsive/CRTOverlay.client';
import { DesktopTopbar } from './responsive/DesktopTopbar.client';
import { Dock } from './responsive/Dock.client';
import { MobileTitleBar } from './responsive/MobileTitleBar.client';
import { StatusBar } from './responsive/StatusBar.client';
```

Replace with (route through barrel index.ts — drop `.client`):
```ts
import { CRTOverlay } from './responsive/CRTOverlay';
import { DesktopTopbar } from './responsive/DesktopTopbar';
import { Dock } from './responsive/Dock';
import { MobileTitleBar } from './responsive/MobileTitleBar';
import { StatusBar } from './responsive/StatusBar';
```

The `MatrixRain` import (`from './responsive/MatrixRain'`) was already a folder — no change needed.

- [ ] **Step 2: Update `__tests__/content-visibility.test.ts`**

This test imports the CSS module directly by file path:
```ts
import moduleStyles from '@/components/responsive/Module.module.css';
```

After the move the file is at `components/responsive/Module/Module.module.css`. Update to:
```ts
import moduleStyles from '@/components/responsive/Module/Module.module.css';
```

- [ ] **Step 3: Verify and commit Phase 1**
```bash
pnpm typecheck && pnpm test --run && pnpm build
```
Expected: all pass.

```bash
git add -A
git commit -m "refactor(responsive): co-locate all responsive components"
```

---

## Task 4 — Migrate root components: ErrorBoundary and Icons

**Files:**
- Create: `components/ErrorBoundary/ErrorBoundary.client.tsx` (moved)
- Create: `components/ErrorBoundary/index.ts`
- Create: `components/Icons/Icons.tsx` (moved)
- Create: `components/Icons/index.ts`

- [ ] **Step 1: Move ErrorBoundary**
```bash
mkdir -p components/ErrorBoundary
git mv components/ErrorBoundary.client.tsx components/ErrorBoundary/ErrorBoundary.client.tsx
```

- [ ] **Step 2: Create `components/ErrorBoundary/index.ts`**
```ts
export { ErrorBoundary } from './ErrorBoundary.client';
```

- [ ] **Step 3: Move Icons**
```bash
mkdir -p components/Icons
git mv components/Icons.tsx components/Icons/Icons.tsx
```

- [ ] **Step 4: Create `components/Icons/index.ts`**

Icons exports 19 named functions. Use wildcard here as a pragmatic exception (all exports are public; no internal symbols):
```ts
export * from './Icons';
```

---

## Task 5 — Migrate root component: AppShell

AppShell is the most import-heavy root component. Moving it one level deeper changes every relative path inside it.

**Files:**
- Create: `components/AppShell/AppShell.client.tsx` (moved)
- Create: `components/AppShell/AppShell.module.css` (moved)
- Create: `components/AppShell/index.ts`

- [ ] **Step 1: Move AppShell files**
```bash
mkdir -p components/AppShell
git mv components/AppShell.client.tsx components/AppShell/AppShell.client.tsx
git mv components/AppShell.module.css components/AppShell/AppShell.module.css
```

- [ ] **Step 2: Update all relative imports inside `components/AppShell/AppShell.client.tsx`**

The file moved one directory deeper (`components/` → `components/AppShell/`), so every relative `./` path becomes `../`:

Find and replace these imports:
```ts
// BEFORE
import './AppShell.module.css';
import { useBreakpoint } from '@/lib/use-breakpoint.client';
import { ToTopButton } from './client/ToTopButton';
import { ErrorBoundary } from './ErrorBoundary.client';
import { CRTOverlay } from './responsive/CRTOverlay';
import { DesktopTopbar } from './responsive/DesktopTopbar';
import { Dock } from './responsive/Dock';
import { MatrixRain } from './responsive/MatrixRain';
import { MobileTitleBar } from './responsive/MobileTitleBar';
import { StatusBar } from './responsive/StatusBar';
```

```ts
// AFTER
import './AppShell.module.css';
import { useBreakpoint } from '@/lib/use-breakpoint.client';
import { ToTopButton } from '../client/ToTopButton';
import { ErrorBoundary } from '../ErrorBoundary';
import { CRTOverlay } from '../responsive/CRTOverlay';
import { DesktopTopbar } from '../responsive/DesktopTopbar';
import { Dock } from '../responsive/Dock';
import { MatrixRain } from '../responsive/MatrixRain';
import { MobileTitleBar } from '../responsive/MobileTitleBar';
import { StatusBar } from '../responsive/StatusBar';
```

Note: `import './AppShell.module.css'` and `import '@/lib/error-bridge.client'` (the first import in the file) do NOT change — the CSS is in the same folder, and the lib import is absolute.

- [ ] **Step 3: Create `components/AppShell/index.ts`**
```ts
export { AppShell } from './AppShell.client';
```

---

## Task 6 — Update callers of moved root components

**Files:**
- Modify: `app/page.tsx` (2 import path changes)
- Modify: `components/sections/ContactSection.tsx` (ErrorBoundary path)
- Modify: `components/sections/ShellSection.tsx` (ErrorBoundary path)

- [ ] **Step 1: Update `app/page.tsx`**

Change:
```ts
import { AppShell } from '@/components/AppShell.client';
import { ErrorBoundary } from '@/components/ErrorBoundary.client';
```

To:
```ts
import { AppShell } from '@/components/AppShell';
import { ErrorBoundary } from '@/components/ErrorBoundary';
```

- [ ] **Step 2: Update `components/sections/ContactSection.tsx`**

Change:
```ts
import { ErrorBoundary } from '../ErrorBoundary.client';
```

To:
```ts
import { ErrorBoundary } from '../ErrorBoundary';
```

- [ ] **Step 3: Update `components/sections/ShellSection.tsx`**

Change:
```ts
import { ErrorBoundary } from '../ErrorBoundary.client';
```

To:
```ts
import { ErrorBoundary } from '../ErrorBoundary';
```

- [ ] **Step 4: Verify and commit Phase 2**
```bash
pnpm typecheck && pnpm test --run && pnpm build
```
Expected: all pass.

```bash
git add -A
git commit -m "refactor(components): co-locate AppShell, ErrorBoundary, Icons"
```

---

## Task 7 — Migrate 12 single-export flat sections

These sections each export one named function. Pattern is identical for all: create folder, move tsx (and css if present), add `index.ts`, update `../Icons` → `../../Icons`.

**Sections:** CommunitySection, ContactSection, CredentialsSection, HottestTakesSection, NowSection, NpmStackSection, PerfReceiptsSection, ReadmeSection, ResponsibilitiesSection, ShellSection, SysHealthSection, UnknownsSection

**Files per section:**
- `mkdir -p components/sections/<Name>`
- `git mv components/sections/<Name>.tsx components/sections/<Name>/<Name>.tsx`
- `git mv components/sections/<Name>.module.css components/sections/<Name>/<Name>.module.css` (skip if no CSS)
- Create `components/sections/<Name>/index.ts`
- Edit relative imports inside the moved tsx

- [ ] **Step 1: Create folders and move all 12 sections**

Run this for each of the 12 sections (CommunitySection has CSS; ContactSection has no CSS; check file list to confirm for others):

```bash
for name in CommunitySection CredentialsSection HottestTakesSection NowSection NpmStackSection PerfReceiptsSection ReadmeSection ResponsibilitiesSection SysHealthSection UnknownsSection; do
  mkdir -p components/sections/$name
  git mv components/sections/$name.tsx components/sections/$name/$name.tsx
  git mv components/sections/$name.module.css components/sections/$name/$name.module.css
done

# ContactSection and ShellSection have no CSS
mkdir -p components/sections/ContactSection
git mv components/sections/ContactSection.tsx components/sections/ContactSection/ContactSection.tsx

mkdir -p components/sections/ShellSection
git mv components/sections/ShellSection.tsx components/sections/ShellSection/ShellSection.tsx
```

- [ ] **Step 2: Create `index.ts` for each of the 12 sections**

Each `index.ts` follows this pattern (substitute the actual section name):
```ts
// components/sections/CommunitySection/index.ts
export { CommunitySection } from './CommunitySection';
```

Create one for each section. The full list:
- `CommunitySection/index.ts` → `export { CommunitySection } from './CommunitySection';`
- `ContactSection/index.ts` → `export { ContactSection } from './ContactSection';`
- `CredentialsSection/index.ts` → `export { CredentialsSection } from './CredentialsSection';`
- `HottestTakesSection/index.ts` → `export { HottestTakesSection } from './HottestTakesSection';`
- `NowSection/index.ts` → `export { NowSection } from './NowSection';`
- `NpmStackSection/index.ts` → `export { NpmStackSection } from './NpmStackSection';`
- `PerfReceiptsSection/index.ts` → `export { PerfReceiptsSection } from './PerfReceiptsSection';`
- `ReadmeSection/index.ts` → `export { ReadmeSection } from './ReadmeSection';`
- `ResponsibilitiesSection/index.ts` → `export { ResponsibilitiesSection } from './ResponsibilitiesSection';`
- `ShellSection/index.ts` → `export { ShellSection } from './ShellSection';`
- `SysHealthSection/index.ts` → `export { SysHealthSection } from './SysHealthSection';`
- `UnknownsSection/index.ts` → `export { UnknownsSection } from './UnknownsSection';`

- [ ] **Step 3: Update `../Icons` → `../../Icons` inside each moved section tsx**

Every moved section tsx now lives one directory deeper — the relative import path to `components/Icons/` needs one more `../`. Edit each file:

- `CommunitySection/CommunitySection.tsx`: `from '../Icons'` → `from '../../Icons'`
- `ContactSection/ContactSection.tsx`: `from '../Icons'` → `from '../../Icons'`; `from '../ErrorBoundary'` → `from '../../ErrorBoundary'`; `from '../client/ContactFormLazy'` → `from '../../client/ContactFormLazy'`
- `CredentialsSection/CredentialsSection.tsx`: `from '../Icons'` → `from '../../Icons'`
- `HottestTakesSection/HottestTakesSection.tsx`: `from '../Icons'` → `from '../../Icons'`
- `NowSection/NowSection.tsx`: `from '../Icons'` → `from '../../Icons'`
- `NpmStackSection/NpmStackSection.tsx`: `from '../Icons'` → `from '../../Icons'`
- `PerfReceiptsSection/PerfReceiptsSection.tsx`: `from '../Icons'` → `from '../../Icons'`
- `ReadmeSection/ReadmeSection.tsx`: `from '../Icons'` → `from '../../Icons'`
- `ResponsibilitiesSection/ResponsibilitiesSection.tsx`: `from '../Icons'` → `from '../../Icons'`
- `ShellSection/ShellSection.tsx`: `from '../Icons'` → `from '../../Icons'`; `from '../ErrorBoundary'` → `from '../../ErrorBoundary'`; `from '../client/InteractiveShellLazy'` → `from '../../client/InteractiveShellLazy'`
- `SysHealthSection/SysHealthSection.tsx`: `from '../Icons'` → `from '../../Icons'`
- `UnknownsSection/UnknownsSection.tsx`: `from '../Icons'` → `from '../../Icons'`

Note: `ContactSection` and `ShellSection` each have three imports that need updating — Icons, ErrorBoundary, and their lazy wrapper. All three must be updated in this step. The lazy wrapper paths (`../../client/ContactFormLazy` and `../../client/InteractiveShellLazy`) will be updated again in Task 10 once the lazy files themselves move.

- [ ] **Step 4: Quick typecheck**
```bash
pnpm typecheck
```
Expected: 0 errors. Any error will name the exact file and import that needs fixing.

---

## Task 8 — Migrate 5 multi-export sections + ManPage sub-components

These sections export both a `*Section` and a `*Content` function. `ManPageSection` additionally has two sub-components (`ManPageDesktop`, `ManPageMobile`) that become internal files inside its folder.

**Sections:** GitLogSection, GuitarSection, ManPageSection, ProjectsSection, VisaSection

- [ ] **Step 1: Create folders and move files for the 4 standard multi-export sections**

```bash
for name in GitLogSection GuitarSection ProjectsSection VisaSection; do
  mkdir -p components/sections/$name
  git mv components/sections/$name.tsx components/sections/$name/$name.tsx
  git mv components/sections/$name.module.css components/sections/$name/$name.module.css
done
```

- [ ] **Step 2: Create `index.ts` for each — export both named exports**

`components/sections/GitLogSection/index.ts`:
```ts
export { GitLogContent, GitLogSection } from './GitLogSection';
```

`components/sections/GuitarSection/index.ts`:
```ts
export { GuitarContent, GuitarSection } from './GuitarSection';
```

`components/sections/ProjectsSection/index.ts`:
```ts
export { ProjectsContent, ProjectsSection } from './ProjectsSection';
```

`components/sections/VisaSection/index.ts`:
```ts
export { VisaContent, VisaSection } from './VisaSection';
```

- [ ] **Step 3: Create ManPageSection folder and move all three files into it**

```bash
mkdir -p components/sections/ManPageSection
git mv components/sections/ManPageSection.tsx components/sections/ManPageSection/ManPageSection.tsx
git mv components/sections/ManPageSection.module.css components/sections/ManPageSection/ManPageSection.module.css
git mv components/sections/ManPageDesktop.tsx components/sections/ManPageSection/ManPageDesktop.tsx
git mv components/sections/ManPageMobile.tsx components/sections/ManPageSection/ManPageMobile.tsx
```

`ManPageDesktop.tsx` and `ManPageMobile.tsx` are internal sub-components. They are NOT re-exported from `index.ts`.

`ManPageSection.tsx` currently imports them as:
```ts
import { ManPageDesktop } from './ManPageDesktop';
import { ManPageMobile } from './ManPageMobile';
```
After the move all three files are in the same folder — these relative imports still resolve correctly. No change needed inside `ManPageSection.tsx` for these.

- [ ] **Step 4: Create `components/sections/ManPageSection/index.ts`**

Only the public API is exported:
```ts
export { ManPageContent, ManPageSection } from './ManPageSection';
```

- [ ] **Step 5: Update `../Icons` inside the 5 moved section txs**

Each moved tsx now sits one level deeper; update the Icons import:

- `GitLogSection/GitLogSection.tsx`: `from '../Icons'` → `from '../../Icons'`
- `GuitarSection/GuitarSection.tsx`: `from '../Icons'` → `from '../../Icons'`
- `ProjectsSection/ProjectsSection.tsx`: `from '../Icons'` → `from '../../Icons'`
- `VisaSection/VisaSection.tsx`: `from '../Icons'` → `from '../../Icons'`
- `ManPageSection/ManPageSection.tsx`: `from '../Icons'` → `from '../../Icons'`

- [ ] **Step 6: Verify and commit Phase 3**
```bash
pnpm typecheck && pnpm test --run && pnpm build
```
Expected: all pass.

```bash
git add -A
git commit -m "refactor(sections): co-locate all section components"
```

---

## Task 9 — Move lazy wrappers into parent folders

Three lazy wrappers exist as flat siblings to their parent component folders. Move each one inside its parent and re-export from the parent's `index.ts`.

**Files:**
- Move: `components/client/ContactFormLazy.tsx` → `components/client/ContactForm/ContactFormLazy.tsx`
- Modify: `components/client/ContactForm/index.ts`
- Move: `components/client/InteractiveShellLazy.tsx` → `components/client/InteractiveShell/InteractiveShellLazy.tsx`
- Modify: `components/client/InteractiveShell/index.ts`
- Move: `components/sections/FooterLazy.client.tsx` → `components/sections/Footer/FooterLazy.client.tsx`
- Modify: `components/sections/Footer/index.ts`

- [ ] **Step 1: Move ContactFormLazy into ContactForm/**
```bash
git mv components/client/ContactFormLazy.tsx components/client/ContactForm/ContactFormLazy.tsx
```

- [ ] **Step 2: Update `components/client/ContactForm/index.ts`**

Current content:
```ts
export { ContactForm } from './ContactForm';
```

Add the lazy export:
```ts
export { ContactForm } from './ContactForm';
export { ContactFormLazy } from './ContactFormLazy';
```

- [ ] **Step 3: Move InteractiveShellLazy into InteractiveShell/**
```bash
git mv components/client/InteractiveShellLazy.tsx components/client/InteractiveShell/InteractiveShellLazy.tsx
```

- [ ] **Step 4: Update `components/client/InteractiveShell/index.ts`**

Current content:
```ts
export { InteractiveShell } from './InteractiveShell';
```

Add the lazy export:
```ts
export { InteractiveShell } from './InteractiveShell';
export { InteractiveShellLazy } from './InteractiveShellLazy';
```

- [ ] **Step 5: Move FooterLazy into Footer/**
```bash
git mv components/sections/FooterLazy.client.tsx components/sections/Footer/FooterLazy.client.tsx
```

- [ ] **Step 6: Update `components/sections/Footer/index.ts`**

Current content:
```ts
export { Footer } from './Footer.client';
```

Add the lazy export:
```ts
export { Footer } from './Footer.client';
export { FooterLazy } from './FooterLazy.client';
```

---

## Task 10 — Update callers of lazy wrappers

**Files:**
- Modify: `components/sections/ContactSection/ContactSection.tsx`
- Modify: `components/sections/ShellSection/ShellSection.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: Update `components/sections/ContactSection/ContactSection.tsx`**

Change (these files are now in `ContactSection/` subfolder — paths gained an extra `../` in Task 7):
```ts
import { ContactFormLazy } from '../../client/ContactFormLazy';
```

To (lazy file moved to `ContactForm/ContactFormLazy.tsx` in Task 9):
```ts
import { ContactFormLazy } from '../../client/ContactForm';
```

- [ ] **Step 2: Update `components/sections/ShellSection/ShellSection.tsx`**

Change (path gained an extra `../` in Task 7):
```ts
import { InteractiveShellLazy } from '../../client/InteractiveShellLazy';
```

To (lazy file moved to `InteractiveShell/InteractiveShellLazy.tsx` in Task 9):
```ts
import { InteractiveShellLazy } from '../../client/InteractiveShell';
```

- [ ] **Step 3: Update `app/page.tsx`**

Change:
```ts
import { FooterLazy } from '@/components/sections/FooterLazy.client';
```

To:
```ts
import { FooterLazy } from '@/components/sections/Footer';
```

- [ ] **Step 4: Final verification and commit**
```bash
pnpm typecheck && pnpm test --run && pnpm build
```
Expected: all pass. Zero new test failures. Zero TS errors.

```bash
git add -A
git commit -m "refactor(lazy): co-locate lazy wrappers inside parent component folders"
```

---

## Done — expected final state

Every component in `components/` now follows:
```
ComponentName/
├── ComponentName.tsx (or .client.tsx)
├── ComponentName.module.css   (if styles)
├── ComponentName.test.tsx     (if unit tests)
├── ComponentName.e2e.ts       (if e2e tests)
└── index.ts
```

No flat `.tsx` + `.module.css` sibling pairs remain outside their own folder.
`__tests__/` is unchanged (integration/API/script tests — not component tests).
`design-system/` is unchanged (already fully co-located).
