# Design System PR E: Storybook Subdomain (ds.erikunha.dev)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Storybook 8 as an independently-deployed engineering surface at `ds.erikunha.dev`, with one CSF 3 story file per primitive, axe + interaction addons wired, and a Vercel project bound separately from the main portfolio.

**Architecture:** Storybook 8 with the `@storybook/react-vite` framework, colocated stories under `design-system/components/<Name>/<Name>.stories.tsx`, custom Storybook UI theme matching the CRT aesthetic, design-system tokens loaded into the preview iframe via `design-system/dist/tokens.css`. Built to `storybook-static/` (gitignored), deployed via the Vercel CLI to a dedicated project `erikunha-ds` bound to `ds.erikunha.dev` — a wholly separate deploy target from `erikunha.dev`. Complements `/design-system` (MDX narrative); never replaces it (see spec §6.1 + §6.3).

**Tech Stack:** Storybook 8 (exact-pinned) — `storybook`, `@storybook/react`, `@storybook/react-vite`, `@storybook/addon-essentials`, `@storybook/addon-a11y`, `@storybook/addon-interactions`, `@storybook/test-runner`, `@testing-library/dom`, `@testing-library/user-event`, `playwright` (already in repo). Deployment: Vercel CLI to project `erikunha-ds`, DNS via Vercel-managed CNAME on `ds.erikunha.dev`.

**Dependency:** Requires PR B merged. Stories import the published primitives from `@/design-system/components/<Name>`.

**Reference:** Spec §6 (Storybook architecture), §7.5 (PR E decomposition), §8 (Storybook-specific failure modes — last 5 rows of the cross-cutting table), §9 (Storybook testing strategy), §10 (Storybook bundle budget exemption).

---

## File Structure

### Files CREATED

| File | Purpose |
|---|---|
| `.storybook/main.ts` | Story discovery, addons, framework, TS settings |
| `.storybook/preview.ts` | Global parameters, decorators, viewports, backgrounds; loads `tokens.css` |
| `.storybook/theme.ts` | Custom Storybook UI theme (CRT terminal aesthetic) |
| `.storybook/manager.ts` | Wires `theme.ts` into the Storybook manager UI |
| `design-system/components/Button/Button.stories.tsx` | CSF 3 stories: Default + variants + composition |
| `design-system/components/Field/Field.stories.tsx` | CSF 3 stories: Default + variants + composition |
| `design-system/components/Badge/Badge.stories.tsx` | CSF 3 stories: Default + variants + composition |
| `design-system/components/TerminalPanel/TerminalPanel.stories.tsx` | CSF 3 stories: Default + variants + composition |
| `design-system/components/StatTile/StatTile.stories.tsx` | CSF 3 stories: Default + variants + composition |
| `design-system/components/CmdLine/CmdLine.stories.tsx` | CSF 3 stories: Default + variants + composition |
| `design-system/components/KbdKey/KbdKey.stories.tsx` | CSF 3 stories: Default + variants + composition |
| `design-system/components/Link/Link.stories.tsx` | CSF 3 stories: Default + variants + composition |
| `tests/storybook/field-error.test.ts` | Interaction test: Field error wiring (`aria-invalid`, `aria-describedby`) |
| `tests/storybook/button-disabled.test.ts` | Interaction test: Button disabled state click suppression |
| `tests/storybook/theme-switcher.test.ts` | Interaction test: future-proofing for ThemeSwitcher persistence (skipped in PR E; activated in PR D) |
| `scripts/check-stories-exist.mjs` | CI gate: every `design-system/components/<Name>/` has `<Name>.stories.tsx` |
| `vercel.json` *(at repo root for `erikunha-ds` project)* | Output dir, framework, CORS headers — see Task 16 |
| `.github/workflows/storybook-deploy.yml` | Storybook build + Vercel CLI deploy on main pushes touching primitives |

### Files MODIFIED

| File | Change |
|---|---|
| `package.json` | Add exact-pinned Storybook deps; add `storybook`, `storybook:build`, `storybook:test` scripts; add `check:stories` script |
| `tsconfig.json` | Add `.storybook/` to includes; confirm `@/design-system/*` path alias resolves for Storybook's TS pass |
| `.gitignore` | Add `/storybook-static`, `/.storybook/cache` |
| `biome.json` | Exclude `.storybook/cache/`, `storybook-static/` from lint/format |
| `public/llms.txt` | Reference Storybook subdomain under a new "INTERACTIVE COMPONENT EXPLORER" section |
| `ARCHITECTURE.md` | New section: "Storybook subdomain (ds.erikunha.dev)" — placement + rationale + boundary with `/design-system` |
| `DECISIONS.md` | New ADR: "Storybook 8 on a separate subdomain — dual-surface design-system architecture" |

### Files NOT TOUCHED

- `app/`, `components/`, `lib/` — Storybook is an out-of-band surface; no portfolio source changes
- `next.config.ts` — Storybook does not share Next's build pipeline (Vite builder, see spec §6.2)
- `proxy.ts`, edge config — separate deploy target

---

## Task 1: thinking-inversion — what specifically makes this fail?

**Files:** none (analysis task — outputs become test cases for Tasks 2–18)

- [ ] **Step 1: Run `thinking-inversion` for PR E.** The class-of-bugs surface (drawn from spec §6.4 + §7.5 failure modes + cross-cutting failure-mode table rows 22–26):

  1. **Storybook Vite builder conflicts with Next 16's Turbopack** — symptoms: Storybook hangs on first start, or alias resolution silently picks Next's webpack config instead of Vite's. Mitigation: Storybook runs entirely on `@storybook/react-vite`; no shared bundler config. Detection: Task 3 verifies `pnpm storybook` boots clean before any story is authored.
  2. **Stories drift from primitive API** — symptoms: rename a Button prop in PR F+ and the stories still pass TS locally because Storybook only typechecks on build. Mitigation: `pnpm storybook:build` runs in CI on every PR that touches `design-system/components/**`; TS error fails the build (Task 15). Detection: Task 18 — build-time component-↔-story existence check.
  3. **`ds.erikunha.dev` SSL provisioning fails or lags** — symptoms: deploy succeeds, custom domain shows "SSL certificate pending" for 24h+. Mitigation: deploy URL `erikunha-ds.vercel.app` remains valid; documented as the fallback in DECISIONS.md (Task 17, Task 20).
  4. **CORS blocks `ds.erikunha.dev` content embedded inside `erikunha.dev`** — symptoms: future `/design-system` page tries to embed a Storybook iframe and the browser blocks it. Mitigation: `vercel.json` for `erikunha-ds` sets `Access-Control-Allow-Origin: https://erikunha.dev` (Task 16).
  5. **`addon-a11y` catches violations the PR B integration axe spec didn't** — symptoms: PR B passed axe at the section integration level but the per-story axe scan in Storybook finds a primitive-level violation (e.g., Badge dot's `aria-hidden` regression in an isolated context). Mitigation: PR E expects this is a tightening, not a new floor; if it surfaces a real bug, it is fixed in PR E and back-ported. Detection: Task 14 + the CI `storybook:test` gate (Task 15).
  6. **Storybook adds runtime dep weight to the main portfolio bundle** — symptoms: a `storybook/test` import sneaks into `design-system/components/*` and ships to `/`. Mitigation: `pnpm bundle-check` on `/` route is already the gate; Storybook addon imports MUST live only in `*.stories.tsx` files and `tests/storybook/*`. Lint check via existing `check:client-naming` patterns is sufficient — no new lint required.
  7. **Story file lives in `design-system/components/<Name>/` but the component itself is broken** — story renders pass but the primitive misbehaves in real consumers. Mitigation: out of scope for PR E; PR B test suite owns this.
  8. **`tokens.css` not loaded into preview iframe** — symptoms: every story renders unstyled black-on-white. Mitigation: `.storybook/preview.ts` imports `design-system/dist/tokens.css` explicitly (Task 4).
  9. **`design-system/dist/tokens.css` missing on fresh clone before `pnpm storybook`** — symptoms: Storybook boots, preview iframe is unstyled. Mitigation: PR A already adds a `predev` hook running `tokens:build`; add equivalent guard in the `storybook` script (`tokens:build && storybook dev`).
  10. **Vercel project setup is a one-time manual step that is easy to skip** — symptoms: CI's `storybook-deploy.yml` runs `vercel deploy` and fails because the `erikunha-ds` project does not exist. Mitigation: DECISIONS.md (Task 20) documents the manual provisioning steps; CI workflow includes a hard-fail message pointing to that doc when `vercel deploy` errors with project-not-found.

- [ ] **Step 2: Commit the analysis as `docs/superpowers/plans/2026-05-23-design-system-tokenized/pr-e-inversion-notes.md`** if and only if the human asks for a record; otherwise the failure modes are encoded directly into Tasks 2–18 below.

---

## Task 2: Install Storybook 8 with exact-pinned versions

**Files:**
- Modify: `package.json` (deps + scripts)
- Create: `.storybook/` directory scaffold (initially via `pnpm dlx storybook@latest init`, then overridden by Tasks 3–5)

**Context:** Storybook 8's `init` command auto-detects Next.js and may default to the `@storybook/nextjs` framework. We override to `@storybook/react-vite` (spec §6.2 — "No Vite override: Storybook's Vite builder used as-is; we don't fork its config except for path aliases"). This intentionally keeps Storybook off Next's build pipeline so there is no Turbopack/Vite conflict surface (failure mode 1, Task 1).

- [ ] **Step 1: Run init scaffold**

```bash
pnpm dlx storybook@latest init --type react --builder vite --yes
```

Expected output: a `.storybook/` directory + a `stories/` example folder + dep additions to `package.json`. Init may also bump some files (`tsconfig.json` includes); accept its changes only inside `.storybook/` and `package.json`. Revert any change outside those scopes (Tasks 3–5 rewrite `.storybook/*` from scratch and Task 16 owns `tsconfig.json`).

- [ ] **Step 2: Delete the scaffolded example stories**

```bash
rm -rf stories/
```

- [ ] **Step 3: Replace caret-pinned versions with exact pins**

Per CLAUDE.md "Package + manager policy" — Storybook minor bumps regularly break addon contracts; exact-pin all Storybook packages, matching the `zod` precedent. Edit `package.json` so the following devDependencies are EXACT pinned (no caret, no tilde):

```jsonc
{
  "devDependencies": {
    "storybook": "8.x.y",
    "@storybook/react": "8.x.y",
    "@storybook/react-vite": "8.x.y",
    "@storybook/addon-essentials": "8.x.y",
    "@storybook/addon-a11y": "8.x.y",
    "@storybook/addon-interactions": "8.x.y",
    "@storybook/test-runner": "0.x.y",
    "@storybook/test": "8.x.y",
    "@testing-library/dom": "10.x.y",
    "@testing-library/user-event": "14.x.y"
  }
}
```

Replace the `x.y` placeholders with whatever the latest 8.x release is on the day of implementation (use `pnpm view storybook version` to look it up). The point is that all `@storybook/*` packages share an identical exact version.

- [ ] **Step 4: Add scripts**

In `package.json`:

```jsonc
{
  "scripts": {
    "storybook": "pnpm tokens:build && storybook dev -p 6006",
    "storybook:build": "pnpm tokens:build && storybook build -o storybook-static",
    "storybook:test": "test-storybook",
    "check:stories": "node scripts/check-stories-exist.mjs"
  }
}
```

The `tokens:build &&` prefix prevents failure mode 9 (Task 1). If PR A is not yet merged in the executing environment, swap `pnpm tokens:build` for `:` (no-op) and capture the gap in the commit message.

- [ ] **Step 5: Install + verify**

```bash
pnpm install --frozen-lockfile=false
pnpm dlx storybook@latest doctor
```

Expected: doctor reports no version conflicts. If it reports a peer dep mismatch with React 19 or Next 16, do not silence it — investigate and report back; React 19 / Next 16 compatibility is part of the failure surface and the answer determines whether PR E proceeds as scoped or needs a Storybook version pin override.

- [ ] **Step 6: Update `.gitignore`**

Append:

```
# storybook
/storybook-static
/.storybook/cache
```

- [ ] **Step 7: Run `code-review:code-review` against staged changes; commit**

```bash
git add package.json pnpm-lock.yaml .gitignore .storybook/
git commit -m "feat(storybook): install Storybook 8 with exact-pinned deps + scripts"
```

---

## Task 3: `.storybook/main.ts` — Storybook config

**Files:**
- Modify (overwrite from scaffold): `.storybook/main.ts`

**Context:** Stories live colocated under `design-system/components/**/*.stories.tsx` (spec §6.2). Framework is `@storybook/react-vite` (failure mode 1). TypeScript settings enable `react-docgen-typescript` so the auto-derived prop tables populate the Controls panel — this is the Storybook-side complement to PR C's auto-API generator (spec §5.9), not a substitute.

- [ ] **Step 1: Write `.storybook/main.ts`**

```ts
import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: [
    '../design-system/components/**/*.stories.@(ts|tsx|mdx)',
  ],
  addons: [
    '@storybook/addon-essentials',
    '@storybook/addon-a11y',
    '@storybook/addon-interactions',
  ],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  typescript: {
    check: false, // CI runs `pnpm typecheck` separately
    reactDocgen: 'react-docgen-typescript',
    reactDocgenTypescriptOptions: {
      shouldExtractLiteralValuesFromEnum: true,
      shouldRemoveUndefinedFromOptional: true,
      propFilter: (prop) => !/node_modules/.test(prop.parent?.fileName ?? ''),
    },
  },
  docs: {
    autodocs: 'tag',
  },
  core: {
    disableTelemetry: true,
  },
};

export default config;
```

- [ ] **Step 2: Verify the path-alias resolution**

Storybook's Vite builder reads `tsconfig.json` `paths` automatically when the alias is plain (no fancy index resolution). The `@/design-system/*` alias defined in PR B's `tsconfig.json` MUST already work without a custom `viteFinal` hook. If `pnpm storybook` (Task 5 verification) reports `Cannot resolve @/design-system/components/Button`, only then add a minimal `viteFinal` that injects `vite-tsconfig-paths`; do not pre-emptively add it.

- [ ] **Step 3: `code-review:code-review`; commit**

```bash
git add .storybook/main.ts
git commit -m "feat(storybook): wire main.ts — react-vite framework, colocated stories, three addons"
```

---

## Task 4: `.storybook/preview.ts` — Globals, decorators, tokens

**Files:**
- Modify (overwrite from scaffold): `.storybook/preview.ts`

**Context:** Every story's preview iframe must load `design-system/dist/tokens.css` (failure mode 8, Task 1). Backgrounds default to the canonical `--ds-color-surface-base` (#000000). Viewports match the project's responsive breakpoints — desktop 1280×720 and mobile 375×812 (per CLAUDE.md PR merge gate §8). Decorator wraps every story in a black-surface, padded container so unstyled white never flashes.

- [ ] **Step 1: Write `.storybook/preview.ts`**

```ts
import type { Preview } from '@storybook/react';
import React from 'react';

// Load design system tokens into the preview iframe.
// Path is relative to this file (.storybook/) — `../design-system/dist/tokens.css`.
import '../design-system/dist/tokens.css';

const preview: Preview = {
  parameters: {
    actions: { argTypesRegex: '^on[A-Z].*' },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      default: 'crt-surface',
      values: [
        { name: 'crt-surface', value: '#000000' },
        { name: 'crt-shell', value: '#050505' },
        { name: 'white', value: '#ffffff' }, // for contrast sanity checks only
      ],
    },
    viewport: {
      viewports: {
        mobile: {
          name: 'Mobile (iPhone X)',
          styles: { width: '375px', height: '812px' },
        },
        tablet: {
          name: 'Tablet',
          styles: { width: '768px', height: '1024px' },
        },
        desktop: {
          name: 'Desktop (1280)',
          styles: { width: '1280px', height: '720px' },
        },
      },
      defaultViewport: 'desktop',
    },
    a11y: {
      // Block on serious + critical violations; warn on moderate.
      config: {
        rules: [{ id: 'color-contrast', enabled: true }],
      },
      manual: false,
    },
    layout: 'padded',
  },
  decorators: [
    (Story) =>
      React.createElement(
        'div',
        {
          style: {
            background: 'var(--ds-color-surface-base)',
            color: 'var(--ds-color-text-body)',
            fontFamily: 'var(--ds-font-family-mono)',
            padding: 'var(--ds-space-pad)',
            minHeight: '100vh',
          },
        },
        React.createElement(Story),
      ),
  ],
};

export default preview;
```

- [ ] **Step 2: Verify tokens load in preview**

After Task 5 (theme) is in place, run `pnpm storybook` and inspect a blank story — the background should be true `#000000`, not the Storybook default light grey. If the background is grey, the import path is wrong (failure mode 8); fix and re-verify before proceeding.

- [ ] **Step 3: `code-review:code-review`; commit**

```bash
git add .storybook/preview.ts
git commit -m "feat(storybook): preview.ts — load tokens.css, set CRT background + viewports + a11y addon"
```

---

## Task 5: `.storybook/theme.ts` + `manager.ts` — CRT-themed Storybook UI

**Files:**
- Create: `.storybook/theme.ts`
- Create: `.storybook/manager.ts`

**Context:** Per spec §6.2 — "Storybook surface itself uses a custom theme matching the CRT aesthetic (terminal background, signal-green accents)." This is the chrome of Storybook (sidebar, toolbar, address bar of the iframe). The preview iframe content uses tokens loaded in Task 4 — those are separate surfaces.

- [ ] **Step 1: Write `.storybook/theme.ts`**

```ts
import { create } from '@storybook/theming/create';

// CRT terminal aesthetic — matches the main portfolio's design language.
// Color values are inlined (not token references) because the Storybook manager
// renders outside the preview iframe and cannot consume tokens.css.
export const crtTheme = create({
  base: 'dark',
  brandTitle: 'erikunha.dev / design system',
  brandUrl: 'https://erikunha.dev/design-system',
  brandTarget: '_blank',

  colorPrimary: '#00FF41',        // --ds-color-signal
  colorSecondary: '#00FF41',

  // UI
  appBg: '#000000',               // --ds-color-surface-base
  appContentBg: '#000000',
  appPreviewBg: '#000000',
  appBorderColor: 'rgba(0, 255, 65, 0.4)', // --ds-color-border-default
  appBorderRadius: 0,             // sharp corners (CLAUDE.md aesthetic)

  // Typography
  fontBase:
    '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
  fontCode:
    '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',

  // Text
  textColor: '#E6FFE6',           // --ds-color-text-body
  textInverseColor: '#000000',
  textMutedColor: '#5AE07B',      // --ds-color-text-faint

  // Toolbar
  barTextColor: '#E6FFE6',
  barSelectedColor: '#00FF41',
  barHoverColor: '#00FF41',
  barBg: '#050505',               // --ds-color-surface-shell

  // Form
  inputBg: '#050505',
  inputBorder: 'rgba(0, 255, 65, 0.4)',
  inputTextColor: '#E6FFE6',
  inputBorderRadius: 0,
});
```

- [ ] **Step 2: Write `.storybook/manager.ts`**

```ts
import { addons } from '@storybook/manager-api';
import { crtTheme } from './theme';

addons.setConfig({
  theme: crtTheme,
});
```

- [ ] **Step 3: Verify**

Run `pnpm storybook`. Expected: the Storybook sidebar background is black, the brand title reads "erikunha.dev / design system" in lime green, sharp-cornered borders, JetBrains Mono everywhere. If any panel still shows the default dark-blue Storybook chrome, the `manager.ts` was not picked up — verify the file is `.storybook/manager.ts` (not `manager.tsx` or `manager.js`).

- [ ] **Step 4: `code-review:code-review`; commit**

```bash
git add .storybook/theme.ts .storybook/manager.ts
git commit -m "feat(storybook): apply CRT-themed manager UI (terminal black + signal green)"
```

---

## Task 6: `Button.stories.tsx`

**Files:**
- Create: `design-system/components/Button/Button.stories.tsx`

**Context:** Button props per spec §4.2: `variant: 'primary' | 'secondary'`, `size: 'sm' | 'md' | 'lg'`, `as: 'button' | 'a'`, native HTML attrs. Stories MUST cover every variant, every size, the disabled state (Task 14's interaction test depends on this story existing), and one composition example showing Button inside `TerminalPanel`.

- [ ] **Step 1: Write the story file**

```tsx
import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';

const meta: Meta<typeof Button> = {
  title: 'Primitives/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'inline-radio',
      options: ['primary', 'secondary'],
    },
    size: {
      control: 'inline-radio',
      options: ['sm', 'md', 'lg'],
    },
    as: {
      control: 'inline-radio',
      options: ['button', 'a'],
    },
    disabled: { control: 'boolean' },
    children: { control: 'text' },
  },
  args: {
    variant: 'primary',
    size: 'md',
    as: 'button',
    children: 'EXEC_HIRE',
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Default: Story = {};

export const PrimaryMd: Story = {
  args: { variant: 'primary', size: 'md' },
};

export const PrimarySm: Story = {
  args: { variant: 'primary', size: 'sm', children: 'EXEC' },
};

export const PrimaryLg: Story = {
  args: { variant: 'primary', size: 'lg', children: 'EXEC_HIRE >>' },
};

export const Secondary: Story = {
  args: { variant: 'secondary', children: 'VIEW_PROJECTS' },
};

export const Disabled: Story = {
  args: { disabled: true, children: 'EXEC_HIRE' },
};

export const AsAnchor: Story = {
  args: {
    as: 'a',
    // @ts-expect-error -- polymorphic `href` typed via `as` discriminator in Button
    href: 'https://example.com',
    children: 'OPEN_LINK',
  },
};

// Composition example — referenced from /design-system/components MDX
export const InTerminalPanel: Story = {
  render: (args) => (
    <div
      style={{
        border: '1px solid var(--ds-color-border-default)',
        padding: 'var(--ds-space-pad)',
        display: 'flex',
        gap: 'var(--ds-space-pad-tight)',
      }}
    >
      <Button {...args} variant="primary">EXEC_HIRE</Button>
      <Button {...args} variant="secondary">VIEW_PROJECTS</Button>
    </div>
  ),
};
```

- [ ] **Step 2: Verify in `pnpm storybook` — every story renders; controls panel populates**

- [ ] **Step 3: `code-review:code-review`; commit**

```bash
git add design-system/components/Button/Button.stories.tsx
git commit -m "feat(storybook): Button stories — all variants, sizes, disabled, anchor, composition"
```

---

## Task 7: `Field.stories.tsx`

**Files:**
- Create: `design-system/components/Field/Field.stories.tsx`

**Context:** Field props per spec §4.2: `name`, `label`, `multiline?`, `rows?`, `error?`, `type?`, native input/textarea attrs. Stories MUST include an error-state story (Task 14's interaction test asserts `aria-invalid="true"` + `aria-describedby` wiring against this story).

- [ ] **Step 1: Write the story file**

```tsx
import type { Meta, StoryObj } from '@storybook/react';
import { Field } from './Field';

const meta: Meta<typeof Field> = {
  title: 'Primitives/Field',
  component: Field,
  tags: ['autodocs'],
  argTypes: {
    name: { control: 'text' },
    label: { control: 'text' },
    multiline: { control: 'boolean' },
    rows: { control: 'number', if: { arg: 'multiline' } },
    error: { control: 'text' },
    type: {
      control: 'select',
      options: ['text', 'email', 'tel', 'url', 'password'],
    },
    disabled: { control: 'boolean' },
  },
  args: {
    name: 'email',
    label: 'EMAIL',
    type: 'email',
  },
};

export default meta;
type Story = StoryObj<typeof Field>;

export const Default: Story = {};

export const SingleLine: Story = {
  args: { name: 'name', label: 'NAME', type: 'text' },
};

export const Multiline: Story = {
  args: { name: 'message', label: 'MESSAGE', multiline: true, rows: 6 },
};

export const WithError: Story = {
  args: {
    name: 'email',
    label: 'EMAIL',
    type: 'email',
    error: 'Invalid email address',
    defaultValue: 'not-an-email',
  },
};

export const Disabled: Story = {
  args: { disabled: true, defaultValue: 'read-only-value' },
};

// Composition: full ContactForm shape
export const InContactForm: Story = {
  render: () => (
    <form
      style={{
        border: '1px solid var(--ds-color-border-default)',
        padding: 'var(--ds-space-pad)',
        display: 'grid',
        gap: 'var(--ds-space-pad-tight)',
        maxWidth: 480,
      }}
    >
      <Field name="name" label="NAME" type="text" />
      <Field name="email" label="EMAIL" type="email" />
      <Field name="message" label="MESSAGE" multiline rows={4} />
    </form>
  ),
};
```

- [ ] **Step 2: Verify; `code-review:code-review`; commit**

```bash
git add design-system/components/Field/Field.stories.tsx
git commit -m "feat(storybook): Field stories — single, multiline, error, disabled, contact form composition"
```

---

## Task 8: `Badge.stories.tsx`

**Files:**
- Create: `design-system/components/Badge/Badge.stories.tsx`

**Context:** Badge props per spec §4.2: `variant: 'default' | 'dot'`, `size: 'sm' | 'md'`, `children`. The `dot` variant pulses; the story decorator MUST allow toggling `prefers-reduced-motion` via the Storybook a11y addon to verify pulse suppression.

- [ ] **Step 1: Write the story file**

```tsx
import type { Meta, StoryObj } from '@storybook/react';
import { Badge } from './Badge';

const meta: Meta<typeof Badge> = {
  title: 'Primitives/Badge',
  component: Badge,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'inline-radio',
      options: ['default', 'dot'],
    },
    size: {
      control: 'inline-radio',
      options: ['sm', 'md'],
    },
    children: { control: 'text' },
  },
  args: {
    variant: 'default',
    size: 'md',
    children: 'STATUS_OK',
  },
};

export default meta;
type Story = StoryObj<typeof Badge>;

export const Default: Story = {};

export const Dot: Story = {
  args: { variant: 'dot', children: 'LIVE' },
};

export const DotSmall: Story = {
  args: { variant: 'dot', size: 'sm', children: 'LIVE' },
};

export const ReducedMotion: Story = {
  args: { variant: 'dot', children: 'LIVE (reduced motion)' },
  parameters: {
    // Storybook's a11y addon can override media queries; document the manual override
    // here so a contributor can verify pulse suppression visually
    docs: {
      description: {
        story:
          'Toggle the OS-level prefers-reduced-motion to verify the pulse animation is suppressed. The dot stays solid.',
      },
    },
  },
};

// Composition: multiple badges inline (typical Hero status row)
export const BadgeRow: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 'var(--ds-space-pad-tight)' }}>
      <Badge variant="dot">LIVE</Badge>
      <Badge variant="default">STAFF_TRACK</Badge>
      <Badge variant="default" size="sm">2026</Badge>
    </div>
  ),
};
```

- [ ] **Step 2: Verify; `code-review:code-review`; commit**

```bash
git add design-system/components/Badge/Badge.stories.tsx
git commit -m "feat(storybook): Badge stories — default, dot, reduced-motion, row composition"
```

---

## Task 9: `TerminalPanel.stories.tsx`

**Files:**
- Create: `design-system/components/TerminalPanel/TerminalPanel.stories.tsx`

**Context:** TerminalPanel props per spec §4.2: `borderStyle: 'solid' | 'dashed'`, `as?: 'section' | 'article' | 'div'`, `header?: ReactNode`, `children`.

- [ ] **Step 1: Write the story file**

```tsx
import type { Meta, StoryObj } from '@storybook/react';
import { TerminalPanel } from './TerminalPanel';

const meta: Meta<typeof TerminalPanel> = {
  title: 'Primitives/TerminalPanel',
  component: TerminalPanel,
  tags: ['autodocs'],
  argTypes: {
    borderStyle: {
      control: 'inline-radio',
      options: ['solid', 'dashed'],
    },
    as: {
      control: 'inline-radio',
      options: ['section', 'article', 'div'],
    },
    header: { control: 'text' },
  },
  args: {
    borderStyle: 'solid',
    as: 'section',
    header: 'HERO',
    children: 'Panel content goes here.',
  },
};

export default meta;
type Story = StoryObj<typeof TerminalPanel>;

export const Default: Story = {};

export const Solid: Story = {
  args: { borderStyle: 'solid', header: 'CONTACT' },
};

export const Dashed: Story = {
  args: { borderStyle: 'dashed', header: 'SUB_PANEL' },
};

export const NoHeader: Story = {
  args: { header: undefined, children: 'Header-less panel for nested contexts.' },
};

// Composition: nested panels (Hero pattern)
export const Nested: Story = {
  render: () => (
    <TerminalPanel header="HERO">
      <p>Outer panel.</p>
      <TerminalPanel borderStyle="dashed" header="SUB_PANEL">
        <p>Nested dashed panel.</p>
      </TerminalPanel>
    </TerminalPanel>
  ),
};
```

- [ ] **Step 2: Verify; `code-review:code-review`; commit**

```bash
git add design-system/components/TerminalPanel/TerminalPanel.stories.tsx
git commit -m "feat(storybook): TerminalPanel stories — solid, dashed, headerless, nested composition"
```

---

## Task 10: `StatTile.stories.tsx`

**Files:**
- Create: `design-system/components/StatTile/StatTile.stories.tsx`

**Context:** StatTile props per spec §4.2: `value: string`, `label: string`, `variant?: 'default' | 'compact'`. Composition example shows the `StatGrid` pattern (4-up grid) — but the grid wrapper itself stays as section code per spec §4.2 ("the parent grid layout `StatGrid` is NOT a primitive").

- [ ] **Step 1: Write the story file**

```tsx
import type { Meta, StoryObj } from '@storybook/react';
import { StatTile } from './StatTile';

const meta: Meta<typeof StatTile> = {
  title: 'Primitives/StatTile',
  component: StatTile,
  tags: ['autodocs'],
  argTypes: {
    value: { control: 'text' },
    label: { control: 'text' },
    variant: {
      control: 'inline-radio',
      options: ['default', 'compact'],
    },
  },
  args: {
    value: '-97.5%',
    label: 'API LATENCY',
    variant: 'default',
  },
};

export default meta;
type Story = StoryObj<typeof StatTile>;

export const Default: Story = {};

export const Compact: Story = {
  args: { variant: 'compact', value: '-98%', label: 'CSS BUNDLE' },
};

// Composition: the canonical 4-up grid (StatGrid lives in section code, not primitives)
export const FourUpGrid: Story = {
  render: () => (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 'var(--ds-space-pad)',
        border: '1px solid var(--ds-color-border-default)',
        padding: 'var(--ds-space-pad)',
      }}
    >
      <StatTile value="-97.5%" label="API LATENCY" />
      <StatTile value="-98%" label="CSS BUNDLE" />
      <StatTile value="-52%" label="TTI" />
      <StatTile value="8+" label="YRS XP" />
    </div>
  ),
};
```

- [ ] **Step 2: Verify; `code-review:code-review`; commit**

```bash
git add design-system/components/StatTile/StatTile.stories.tsx
git commit -m "feat(storybook): StatTile stories — default, compact, four-up grid composition"
```

---

## Task 11: `CmdLine.stories.tsx`

**Files:**
- Create: `design-system/components/CmdLine/CmdLine.stories.tsx`

**Context:** CmdLine props per spec §4.2: `user?: string` (default `erik@portfolio`), `command: string`, `output?: ReactNode`, `prompt?: string` (default `:~$`).

- [ ] **Step 1: Write the story file**

```tsx
import type { Meta, StoryObj } from '@storybook/react';
import { CmdLine } from './CmdLine';

const meta: Meta<typeof CmdLine> = {
  title: 'Primitives/CmdLine',
  component: CmdLine,
  tags: ['autodocs'],
  argTypes: {
    user: { control: 'text' },
    command: { control: 'text' },
    prompt: { control: 'text' },
    output: { control: 'text' },
  },
  args: {
    user: 'erik@portfolio',
    command: 'whoami',
    prompt: ':~$',
  },
};

export default meta;
type Story = StoryObj<typeof CmdLine>;

export const Default: Story = {};

export const WithOutput: Story = {
  args: {
    command: 'whoami',
    output: 'Erik Cunha — Staff Frontend + Applied AI',
  },
};

export const MultilineOutput: Story = {
  args: {
    command: 'cat ~/.now',
    output: (
      <>
        Building a published design system.
        <br />
        Targeting Staff/Principal Frontend + AI roles.
        <br />
        Brazil-based; remote; available 2026 Q3.
      </>
    ),
  },
};

export const CustomPrompt: Story = {
  args: {
    user: 'root@matrix',
    command: 'rm -rf /illusions',
    prompt: '#',
  },
};

// Composition: a Hero-style boot sequence
export const BootSequence: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ds-space-pad-tight)' }}>
      <CmdLine command="boot --terminal" />
      <CmdLine command="load --identity erik" output="OK" />
      <CmdLine command="whoami" output="Staff Frontend + Applied AI" />
    </div>
  ),
};
```

- [ ] **Step 2: Verify; `code-review:code-review`; commit**

```bash
git add design-system/components/CmdLine/CmdLine.stories.tsx
git commit -m "feat(storybook): CmdLine stories — default, with-output, multiline, custom prompt, boot sequence"
```

---

## Task 12: `KbdKey.stories.tsx`

**Files:**
- Create: `design-system/components/KbdKey/KbdKey.stories.tsx`

**Context:** KbdKey props per spec §4.2: `size: 'sm' | 'md'`, `children`. Composition shows keyboard chords (the ManPage / Shell use case).

- [ ] **Step 1: Write the story file**

```tsx
import type { Meta, StoryObj } from '@storybook/react';
import { KbdKey } from './KbdKey';

const meta: Meta<typeof KbdKey> = {
  title: 'Primitives/KbdKey',
  component: KbdKey,
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: 'inline-radio',
      options: ['sm', 'md'],
    },
    children: { control: 'text' },
  },
  args: {
    size: 'md',
    children: 'Enter',
  },
};

export default meta;
type Story = StoryObj<typeof KbdKey>;

export const Default: Story = {};

export const Small: Story = {
  args: { size: 'sm', children: 'Esc' },
};

export const Medium: Story = {
  args: { size: 'md', children: 'Tab' },
};

// Composition: keyboard chord (ManPage / Shell pattern)
export const Chord: Story = {
  render: () => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      Press <KbdKey>Ctrl</KbdKey> + <KbdKey>K</KbdKey> to open the shell.
    </span>
  ),
};
```

- [ ] **Step 2: Verify; `code-review:code-review`; commit**

```bash
git add design-system/components/KbdKey/KbdKey.stories.tsx
git commit -m "feat(storybook): KbdKey stories — default, sm, md, chord composition"
```

---

## Task 13: `Link.stories.tsx`

**Files:**
- Create: `design-system/components/Link/Link.stories.tsx`

**Context:** Link props per spec §4.2: `href: string`, `variant: 'inline' | 'nav' | 'external'`, `...HTMLAnchorElement attrs`. The `external` variant auto-applies `target="_blank"` + `rel="noopener noreferrer"` — surface this in the docs string so contributors see the security wiring.

- [ ] **Step 1: Write the story file**

```tsx
import type { Meta, StoryObj } from '@storybook/react';
import { Link } from './Link';

const meta: Meta<typeof Link> = {
  title: 'Primitives/Link',
  component: Link,
  tags: ['autodocs'],
  argTypes: {
    href: { control: 'text' },
    variant: {
      control: 'inline-radio',
      options: ['inline', 'nav', 'external'],
    },
    children: { control: 'text' },
  },
  args: {
    href: '#projects',
    variant: 'inline',
    children: 'projects',
  },
};

export default meta;
type Story = StoryObj<typeof Link>;

export const Default: Story = {};

export const Inline: Story = {
  args: { variant: 'inline', href: '#contact', children: 'reach out' },
};

export const Nav: Story = {
  args: { variant: 'nav', href: '#projects', children: 'PROJECTS' },
};

export const External: Story = {
  args: {
    variant: 'external',
    href: 'https://github.com/erikunha',
    children: 'GitHub',
  },
  parameters: {
    docs: {
      description: {
        story:
          'External variant auto-applies target="_blank" + rel="noopener noreferrer" + a visually-hidden "(external)" annotation for screen readers.',
      },
    },
  },
};

// Composition: typical nav-bar row
export const NavBar: Story = {
  render: () => (
    <nav
      aria-label="Demo navigation"
      style={{
        display: 'flex',
        gap: 'var(--ds-space-pad)',
        borderBottom: '1px solid var(--ds-color-border-default)',
        padding: 'var(--ds-space-pad-tight)',
      }}
    >
      <Link variant="nav" href="#hero">HOME</Link>
      <Link variant="nav" href="#projects">PROJECTS</Link>
      <Link variant="nav" href="#contact">CONTACT</Link>
      <Link variant="external" href="https://github.com/erikunha">GitHub</Link>
    </nav>
  ),
};

// Composition: inline link inside body copy
export const InlineInProse: Story = {
  render: () => (
    <p style={{ maxWidth: 480, lineHeight: 1.55 }}>
      The design system spec lives at{' '}
      <Link variant="inline" href="/design-system">/design-system</Link>{' '}
      and an exhaustive interactive playground lives at{' '}
      <Link variant="external" href="https://ds.erikunha.dev">ds.erikunha.dev</Link>.
    </p>
  ),
};
```

- [ ] **Step 2: Verify; `code-review:code-review`; commit**

```bash
git add design-system/components/Link/Link.stories.tsx
git commit -m "feat(storybook): Link stories — inline, nav, external, navbar + prose composition"
```

---

## Task 14: Interaction tests for state-bearing primitives

**Files:**
- Create: `tests/storybook/field-error.test.ts`
- Create: `tests/storybook/button-disabled.test.ts`
- Create: `tests/storybook/theme-switcher.test.ts` (skipped in PR E; activated by PR D)

**Context:** Per spec §9 — interaction tests cover the state-bearing primitives. Field error state and Button disabled state are testable in PR E. The ThemeSwitcher primitive itself does NOT exist until PR D (spec §3.9 + §7.4); the test file ships in PR E with a `test.skip` so the slot exists and PR D's implementation simply activates it.

The test runner here is `@storybook/test-runner` invoked by `pnpm storybook:test` — it walks every story and runs any exported `play` function PLUS any `tests/storybook/*.test.ts` that asserts via testing-library. Files in `tests/storybook/` are loaded by the test-runner; assertions use `@testing-library/dom`.

- [ ] **Step 1: Write `tests/storybook/field-error.test.ts`**

```ts
import { test, expect } from '@playwright/test';

// `@storybook/test-runner` exposes a Playwright `page` already navigated to the story.
// Pattern follows the documented test-runner story-level test contract.

test.describe('Field — error state wiring', () => {
  test('WithError story marks the input invalid and links the message', async ({ page }) => {
    await page.goto('http://localhost:6006/iframe.html?id=primitives-field--with-error&viewMode=story');

    const input = page.getByLabel('EMAIL');
    await expect(input).toHaveAttribute('aria-invalid', 'true');

    const describedById = await input.getAttribute('aria-describedby');
    expect(describedById).toBeTruthy();

    const errorEl = page.locator(`#${describedById}`);
    await expect(errorEl).toContainText('Invalid email address');
  });
});
```

- [ ] **Step 2: Write `tests/storybook/button-disabled.test.ts`**

```ts
import { test, expect } from '@playwright/test';

test.describe('Button — disabled state', () => {
  test('Disabled story rejects clicks and exposes aria-disabled when polymorphic anchor', async ({ page }) => {
    await page.goto('http://localhost:6006/iframe.html?id=primitives-button--disabled&viewMode=story');

    const button = page.getByRole('button', { name: 'EXEC_HIRE' });
    await expect(button).toBeDisabled();

    // Click is a no-op when native `disabled`; we verify by attempting and asserting no nav/state change.
    let clicked = false;
    await page.exposeFunction('__markClicked', () => {
      clicked = true;
    });
    await button.evaluate((el) => {
      el.addEventListener('click', () => (globalThis as { __markClicked?: () => void }).__markClicked?.());
    });
    await button.click({ force: true }).catch(() => {});
    expect(clicked).toBe(false);
  });
});
```

- [ ] **Step 3: Write `tests/storybook/theme-switcher.test.ts` (skipped placeholder)**

```ts
import { test } from '@playwright/test';

// PR D ships the ThemeSwitcher primitive + story.
// PR E reserves this test slot so the activation in PR D is a one-line `.skip` → live change.
test.describe.skip('ThemeSwitcher — persistence across reload (activated in PR D)', () => {
  test('toggles theme and persists via localStorage', async () => {
    // Implementation deferred to PR D; see /docs/superpowers/plans/2026-05-23-design-system-tokenized/pr-d-themes.md
  });
});
```

- [ ] **Step 4: Verify**

```bash
pnpm storybook --quiet &
STORYBOOK_PID=$!
# wait for storybook to be ready, then:
pnpm storybook:test
kill $STORYBOOK_PID
```

Expected: `field-error` + `button-disabled` PASS; `theme-switcher` reports as SKIPPED.

- [ ] **Step 5: `code-review:code-review`; commit**

```bash
git add tests/storybook/
git commit -m "test(storybook): Field error + Button disabled interaction tests; ThemeSwitcher placeholder"
```

---

## Task 15: Build script verification + CI workflow

**Files:**
- Create: `.github/workflows/storybook-deploy.yml`

**Context:** Per spec §6.4 — `pnpm storybook:build` runs on every PR that touches `design-system/components/**` (catches TS / story-API drift). Deploy to Vercel runs on main pushes only — preview deploys for PRs are not part of v1 scope (the dual-deploy preview surface would compete with Vercel's preview limit).

- [ ] **Step 1: Verify `pnpm storybook:build` succeeds locally**

```bash
pnpm storybook:build
ls -la storybook-static/index.html
```

Expected: build completes, `storybook-static/index.html` exists, gzipped bundle size logged.

- [ ] **Step 2: Verify `pnpm storybook:test` runs against a freshly built static site**

```bash
pnpm dlx http-server storybook-static -p 6006 &
SERVE_PID=$!
TARGET_URL=http://localhost:6006 pnpm storybook:test
kill $SERVE_PID
```

Expected: every story renders + every interaction test passes.

- [ ] **Step 3: Write `.github/workflows/storybook-deploy.yml`**

```yaml
name: Storybook deploy (ds.erikunha.dev)

on:
  push:
    branches: [main]
    paths:
      - 'design-system/components/**'
      - 'design-system/dist/tokens.css'
      - '.storybook/**'
  pull_request:
    paths:
      - 'design-system/components/**'
      - '.storybook/**'

concurrency:
  group: storybook-${{ github.ref }}
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'pnpm'

      - name: Install
        run: pnpm install --frozen-lockfile

      - name: Build tokens (PR A artifact)
        run: pnpm tokens:build

      - name: Build Storybook
        run: pnpm storybook:build

      - name: Run Storybook test-runner against static build
        run: |
          pnpm dlx http-server storybook-static -p 6006 -s &
          npx wait-on http://localhost:6006
          TARGET_URL=http://localhost:6006 pnpm storybook:test

      - name: Upload static build
        uses: actions/upload-artifact@v4
        with:
          name: storybook-static
          path: storybook-static/
          retention-days: 7

  deploy:
    needs: build
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/download-artifact@v4
        with:
          name: storybook-static
          path: storybook-static/

      - name: Install Vercel CLI
        run: pnpm add -g vercel@latest

      - name: Deploy to Vercel (project: erikunha-ds)
        run: |
          vercel pull --yes --environment=production --token=${{ secrets.VERCEL_TOKEN }}
          vercel deploy --prod \
            --token=${{ secrets.VERCEL_TOKEN }} \
            --scope=${{ secrets.VERCEL_TEAM }} \
            storybook-static
        env:
          VERCEL_PROJECT_ID: ${{ secrets.VERCEL_DS_PROJECT_ID }}
          VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
```

Note: requires the secrets `VERCEL_TOKEN`, `VERCEL_TEAM`, `VERCEL_ORG_ID`, `VERCEL_DS_PROJECT_ID` to be set in the repo settings as part of Task 16 (Vercel project setup) — the workflow is the consumer.

- [ ] **Step 4: `code-review:code-review`; commit**

```bash
git add .github/workflows/storybook-deploy.yml
git commit -m "ci(storybook): build + test-runner on PRs touching primitives; deploy to Vercel on main"
```

---

## Task 16: Vercel project setup + `vercel.json` (one-time manual + repo file)

**Files:**
- Create: `vercel.json`

**Context:** Per spec §6.2 + §7.5 — separate Vercel project `erikunha-ds`, root = `storybook-static/`, framework = "Other", CORS headers permissive for `https://erikunha.dev` (mitigates failure mode 4, Task 1). The CLI deploy command in Task 15 passes `storybook-static/` as the project root explicitly so the same repo can host both the main portfolio and the Storybook deploy without `vercel.json` conflicts at the repo root.

**Manual prerequisite (documented in Task 20's DECISIONS.md entry):**
1. In Vercel dashboard: create project `erikunha-ds`, link to this GitHub repo, set root directory to `storybook-static/`, framework preset = "Other", build command = `(empty — uploaded by CI)`, output directory = `.`.
2. Disable Vercel's automatic builds for the `erikunha-ds` project — deploys happen only via the CI workflow (Task 15) to avoid double-deploys when Vercel also auto-builds the main portfolio project from the same push.
3. Add custom domain `ds.erikunha.dev` to the project; Vercel auto-issues SSL.
4. Copy the project's IDs into repo secrets: `VERCEL_TOKEN`, `VERCEL_TEAM` (slug), `VERCEL_ORG_ID`, `VERCEL_DS_PROJECT_ID`.

- [ ] **Step 1: Write `vercel.json`**

This file is consumed by the `erikunha-ds` project specifically. The main portfolio project does NOT use this file (it relies on the Next.js defaults baked into the project settings).

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": null,
  "outputDirectory": "storybook-static",
  "framework": null,
  "trailingSlash": true,
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Access-Control-Allow-Origin",
          "value": "https://erikunha.dev"
        },
        {
          "key": "X-Frame-Options",
          "value": "ALLOW-FROM https://erikunha.dev"
        },
        {
          "key": "Content-Security-Policy",
          "value": "frame-ancestors 'self' https://erikunha.dev"
        }
      ]
    }
  ]
}
```

If the main portfolio project at the repo root ever needs its own `vercel.json` (currently it does not), this file must be moved out of the repo root and the deploy command in Task 15 must explicitly point at it (`vercel deploy --local-config storybook.vercel.json`). Document the migration in DECISIONS.md if/when that happens.

- [ ] **Step 2: Verify the Vercel project responds**

After the first successful deploy from Task 15:

```bash
curl -I https://erikunha-ds.vercel.app/
# expect: 200 OK; check `access-control-allow-origin: https://erikunha.dev` header

curl -I https://ds.erikunha.dev/
# expect: 200 OK once SSL provisions (may be ~5min after DNS — see Task 17 fallback)
```

- [ ] **Step 3: `code-review:code-review`; commit**

```bash
git add vercel.json
git commit -m "feat(storybook): vercel.json for erikunha-ds — CORS + frame-ancestors for embed safety"
```

---

## Task 17: DNS bind — `ds.erikunha.dev` (manual; documented)

**Files:** none (DNS is a registrar console step; fallback is the Vercel-issued URL)

**Context:** Per spec §6.2 — `ds.erikunha.dev` CNAME → Vercel; SSL auto-provisioned. Architect-reviewer flagged SSL provisioning latency (failure mode 3, Task 1); fallback URL `erikunha-ds.vercel.app` stays valid throughout. This task is checklist-only — the change itself happens in the DNS registrar / Vercel dashboard outside the repo.

- [ ] **Step 1: Add CNAME record**

In the DNS provider for `erikunha.dev`:

```
Type:  CNAME
Host:  ds
Value: cname.vercel-dns.com.
TTL:   300
```

- [ ] **Step 2: Add domain in Vercel project settings**

Vercel dashboard → `erikunha-ds` project → Settings → Domains → Add → `ds.erikunha.dev`.

- [ ] **Step 3: Verify SSL provisioning**

```bash
# DNS propagation check
dig ds.erikunha.dev CNAME +short
# expect: cname.vercel-dns.com.

# SSL check (may take up to 60 min after DNS resolves)
curl -vI https://ds.erikunha.dev/ 2>&1 | grep -E '^(<|>) (HTTP|SSL)'
```

- [ ] **Step 4: Fallback documented**

If `ds.erikunha.dev` is still pending SSL at the time of merge, the deploy URL `https://erikunha-ds.vercel.app/` is the public surface. DECISIONS.md (Task 20) records the dual-URL window and the cutover trigger ("SSL active + 24h soak").

No commit — DNS is out-of-band; the audit trail lives in DECISIONS.md.

---

## Task 18: Build-time component-↔-story existence check

**Files:**
- Create: `scripts/check-stories-exist.mjs`

**Context:** Failure mode 2 (Task 1) — every `design-system/components/<Name>/` directory MUST ship a `<Name>.stories.tsx`. Without this gate, a future primitive could ship without a story and only be caught visually. Pattern mirrors existing repo gates (`scripts/check-client-naming.mjs`, `scripts/check-dep-pinning.mjs`).

- [ ] **Step 1: Write `scripts/check-stories-exist.mjs`**

```js
#!/usr/bin/env node
// Fails CI if any design-system/components/<Name>/ directory
// lacks a <Name>.stories.tsx file.
//
// Pairs with PR E (Storybook subdomain): every primitive surfaced in
// design-system/components/ MUST have a colocated Storybook story so
// ds.erikunha.dev is exhaustive by construction.

import { readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd(), 'design-system', 'components');

if (!existsSync(ROOT)) {
  console.error(`check-stories-exist: ${ROOT} does not exist. Did PR B merge?`);
  process.exit(1);
}

const missing = [];
const entries = readdirSync(ROOT);

for (const name of entries) {
  const dir = join(ROOT, name);
  if (!statSync(dir).isDirectory()) continue;

  const storyPath = join(dir, `${name}.stories.tsx`);
  if (!existsSync(storyPath)) {
    missing.push(`${name}/${name}.stories.tsx`);
  }
}

if (missing.length > 0) {
  console.error('check-stories-exist: missing story files for the following primitives:');
  for (const m of missing) console.error(`  - design-system/components/${m}`);
  console.error('');
  console.error('Every primitive under design-system/components/ MUST have a colocated');
  console.error('<Name>.stories.tsx so ds.erikunha.dev is exhaustive by construction.');
  console.error('See docs/superpowers/specs/2026-05-23-design-system-tokenized/design.md §6.2.');
  process.exit(1);
}

console.log(`check-stories-exist: OK — ${entries.length} primitive(s) all have stories.`);
```

- [ ] **Step 2: Wire into `pnpm verify`**

In `package.json`, update the `verify` script to include `check:stories`:

```jsonc
{
  "scripts": {
    "verify": "pnpm check && pnpm typecheck && pnpm validate-content && pnpm check:client-naming && pnpm check:dep-pinning && pnpm check:stories && pnpm test"
  }
}
```

- [ ] **Step 3: Verify gate passes locally**

```bash
pnpm check:stories
# expect: "OK — 8 primitive(s) all have stories." (after Tasks 6–13 complete)
```

Negative-path verification: temporarily rename one story file, re-run `pnpm check:stories`, confirm non-zero exit + the listed-missing message. Restore the rename.

- [ ] **Step 4: `code-review:code-review`; commit**

```bash
git add scripts/check-stories-exist.mjs package.json
git commit -m "ci(storybook): build-time check — every primitive has a colocated <Name>.stories.tsx"
```

---

## Task 19: `llms.txt` + `ARCHITECTURE.md` updates

**Files:**
- Modify: `public/llms.txt`
- Modify: `ARCHITECTURE.md`

**Context:** Per spec §7.5 — Storybook subdomain referenced. The MDX docs route (`/design-system`) is the narrative; Storybook is the interactive surface. llms.txt MUST point AI consumers at both so they don't conflate them.

- [ ] **Step 1: Append a section to `public/llms.txt`**

Add the following section after the existing design-system reference (which PR C ships):

```
## INTERACTIVE COMPONENT EXPLORER

URL: https://ds.erikunha.dev

Storybook 8 instance hosting an exhaustive variant matrix for every primitive
in the design system. Complements /design-system (narrative MDX) by providing
the controls panel, a11y addon output, and interaction-test scenarios.

Use https://erikunha.dev/design-system for the curated narrative.
Use https://ds.erikunha.dev for the exhaustive interactive playground.
```

- [ ] **Step 2: Add a new section to `ARCHITECTURE.md`**

Insert a section "Storybook subdomain (ds.erikunha.dev)" referencing spec §6 and explaining:
- Why a separate subdomain (boundary with portfolio bundle budget, independent deploy cadence, standard DS pattern per Material/Carbon/Polaris)
- Why both surfaces ("MDX is the right format for a narrative, Storybook for an exhaustive matrix" — spec §6.5)
- Deploy topology: separate Vercel project `erikunha-ds`, CI workflow `.github/workflows/storybook-deploy.yml`, CORS configured for embed safety
- Where stories live: colocated under `design-system/components/<Name>/<Name>.stories.tsx`
- CI gates: `check:stories` (build-time existence), `storybook:build` (TS / API drift), `storybook:test` (a11y + interactions)

Keep the section terse — ARCHITECTURE.md is reference, not narrative.

- [ ] **Step 3: `code-review:code-review`; commit**

```bash
git add public/llms.txt ARCHITECTURE.md
git commit -m "docs(storybook): llms.txt + ARCHITECTURE.md reference ds.erikunha.dev subdomain"
```

---

## Task 20: DECISIONS.md entry

**Files:**
- Modify: `DECISIONS.md`

**Context:** Per CLAUDE.md "Track decisions in DECISIONS.md: one bullet, date, reversibility note." This ADR captures the dual-surface architectural decision + the Vercel project provisioning + DNS bind + SSL fallback — all in a single entry so future readers see the rationale together.

- [ ] **Step 1: Append entry to `DECISIONS.md`**

```markdown
- **2026-MM-DD — Storybook 8 on dedicated subdomain `ds.erikunha.dev`** (PR E of design-system spec). Dual-surface design system: `/design-system` (MDX narrative, on the portfolio domain, inside the perf budget) + `ds.erikunha.dev` (Storybook, separate Vercel project `erikunha-ds`, outside the perf budget). Justification: MDX is the right format for a curated narrative; Storybook is the right format for an exhaustive interactive matrix. Conflating them forces compromises in either direction. Canonical DS pattern (Material, Carbon, Polaris, Spectrum all do both). Manual provisioning prerequisites: (1) Vercel project `erikunha-ds` created in dashboard with root = `storybook-static/`, framework = "Other", auto-build disabled; (2) repo secrets `VERCEL_TOKEN`, `VERCEL_TEAM`, `VERCEL_ORG_ID`, `VERCEL_DS_PROJECT_ID` set; (3) CNAME `ds → cname.vercel-dns.com.` added in DNS provider. Fallback during SSL provisioning: `https://erikunha-ds.vercel.app/` (Vercel-issued URL) is the public surface until `ds.erikunha.dev` SSL active + 24h soak. Reversibility: HIGH — independent deploy + DNS record; revert is `git revert` + delete the Vercel project + remove the CNAME. See `docs/superpowers/specs/2026-05-23-design-system-tokenized/design.md` §6.
```

Replace `MM-DD` with the actual implementation date.

- [ ] **Step 2: `code-review:code-review`; commit**

```bash
git add DECISIONS.md
git commit -m "docs(decisions): ADR — Storybook 8 on ds.erikunha.dev subdomain (PR E)"
```

---

## Acceptance — PR E ready to merge when…

Mapped from spec §12 "Storybook (PR E)" acceptance criteria, plus the per-task verification above:

- [ ] `https://ds.erikunha.dev/` (or fallback `https://erikunha-ds.vercel.app/`) resolves to a Storybook 8 deploy
- [ ] All 8 primitives have `<Name>.stories.tsx` with Default + per-variant + composition stories (Tasks 6–13)
- [ ] `@storybook/addon-a11y` runs on every story; CI surfaces zero serious/critical violations (Task 15 workflow)
- [ ] `pnpm storybook:build` passes in CI on every PR touching `design-system/components/**` (Task 15)
- [ ] `pnpm check:stories` passes — every primitive has a colocated story file (Task 18)
- [ ] `pnpm storybook:test` passes locally + in CI — interaction tests for Field error + Button disabled pass; ThemeSwitcher slot skipped (Task 14)
- [ ] `vercel.json` ships with `Access-Control-Allow-Origin: https://erikunha.dev` + `frame-ancestors` CSP (Task 16)
- [ ] `llms.txt` references the Storybook subdomain (Task 19)
- [ ] `ARCHITECTURE.md` documents the dual-surface boundary (Task 19)
- [ ] `DECISIONS.md` records the ADR + manual provisioning prerequisites + SSL fallback (Task 20)
- [ ] `pnpm ready-to-merge <pr>` clean per CLAUDE.md PR merge gate
- [ ] Local Playwright MCP visual check on desktop (1280×720) + mobile (375×812) of `ds.erikunha.dev` AND of `/design-system/components` (still serves correctly on the main portfolio — sanity check that PR E did not regress it)
- [ ] Copilot review threads resolved per CLAUDE.md PR merge gate §7

---

## Self-review notes (kept inline; remove before opening PR if desired)

- Plan honors the spec dependency: PR E requires PR B merged (stories import from `@/design-system/components/<Name>` — listed under "Dependency").
- Every task ends with `code-review:code-review` before commit per CLAUDE.md "Code review is not optional on PR branches."
- Failure modes from spec §6.4 + §7.5 + cross-cutting table (rows 22–26) are encoded directly into Tasks 1–18, not deferred. Failure mode 6 (Storybook addon imports leaking into main bundle) is asserted to be sufficiently mitigated by existing `check:client-naming` — flag for socratic-debate at execution time if a leak is detected.
- The plan deliberately does NOT introduce preview deploys for PRs (avoids Vercel preview-quota pressure). If desired later, swap `if: github.ref == 'refs/heads/main' && github.event_name == 'push'` for an unconditional deploy.
- ThemeSwitcher test placeholder is intentionally in PR E so PR D's activation is one `.skip` removal away — minimizes PR D's surface area.
- Open questions for the human before execution begins:
  - Vercel project provisioning: does the `erikunha-ds` project already exist, or is this task creating it for the first time? (Task 16 step 1 assumes first-time creation.)
  - DNS provider: which registrar holds `erikunha.dev`? CNAME instructions vary slightly (Cloudflare proxies CNAMEs differently than route53).
  - Repo secrets: is `VERCEL_TOKEN` already configured for the main portfolio deploy? If so, the same token works for `erikunha-ds` provided it has scope on the same team.
