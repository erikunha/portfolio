# Design System PR B: 8 Primitive Components

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract 8 RSC-default primitive components (Button, Field, Badge, TerminalPanel, StatTile, CmdLine, KbdKey, Link) from existing portfolio patterns, ship them under `design-system/components/`, and refactor the portfolio to consume them with zero visual drift, zero a11y regression, and zero client-JS delta on `/`.

**Architecture:** Each primitive ships as a 4-file directory (`.tsx` + `.module.css` + `.test.tsx` + `index.ts`) under `design-system/components/<Name>/`. Components are React Server Components by default (no `"use client"`), styled exclusively with semantic tokens from PR A (`var(--ds-color-*)`, `var(--ds-space-*)`, `var(--ds-font-*)`, `var(--ds-motion-*)`), and compose variants via a ~20-LoC `cx()` helper — zero new runtime deps, no `class-variance-authority`. Public surface is re-exported from `design-system/index.ts` for RSC consumers; client islands MUST deep-path import (`@/design-system/components/Field`) to avoid the barrel-leak bundle vector documented in spec §4.4 and §9.

**Tech Stack:** React 19 RSC, TypeScript strict, vitest, Playwright, axe-core, CSS Modules with Style Dictionary semantic tokens from PR A. New deps: zero.

---

## File Structure

### New files

| Path | Purpose |
|---|---|
| `design-system/lib/cx.ts` | ~20-LoC variant composer: filters falsy class arguments, returns a space-joined string; preserves literal-type signatures for compile-time variant checking |
| `design-system/lib/cx.test.ts` | Vitest unit test for `cx()`: falsy filter, dedup, literal-type narrowing |
| `design-system/index.ts` | Barrel re-export of all 8 primitives + `tokens` const tree from PR A's `design-system/dist/tokens` |
| `design-system/components/Button/Button.tsx` | RSC. Polymorphic `as: 'button' \| 'a'`. Variants: `primary`, `secondary`. Sizes: `sm`, `md`, `lg`. JSDoc on every prop |
| `design-system/components/Button/Button.module.css` | Semantic tokens only. `.root` base, `.primary`/`.secondary` variant classes, `.sm`/`.md`/`.lg` size classes, `:focus-visible` ring via `--ds-color-signal`, disabled state |
| `design-system/components/Button/Button.test.tsx` | Vitest + Testing Library + axe. Default render, every variant × size matrix, polymorphic `as="a"`, disabled state (with `aria-disabled` on anchor), focus-visible class, axe scan |
| `design-system/components/Button/index.ts` | `export { Button } from './Button';` + `export type { ButtonProps } from './Button';` |
| `design-system/components/Field/Field.tsx` | RSC. Polymorphic input vs textarea via `multiline?: boolean`. Programmatic label association via `useId`. JSDoc on every prop |
| `design-system/components/Field/Field.module.css` | Semantic tokens only. `.root` wrapper, `.label`, `.input`, `.textarea`, `.error` (border + `aria-invalid` styling) |
| `design-system/components/Field/Field.test.tsx` | Vitest + axe. Default render, multiline render, error state (border red + `aria-invalid="true"` + `aria-describedby` linked), label/input association |
| `design-system/components/Field/index.ts` | Re-export |
| `design-system/components/Badge/Badge.tsx` | RSC. Variants: `default`, `dot` (pulsing prefix, `aria-hidden`). JSDoc on every prop |
| `design-system/components/Badge/Badge.module.css` | Semantic tokens only. `.dot` pulse `@keyframes` MAY consume motion primitives (documented exception per spec §3.4); `@media (prefers-reduced-motion: reduce)` suppresses pulse |
| `design-system/components/Badge/Badge.test.tsx` | Vitest + axe. Default render, dot variant has `aria-hidden` dot, reduced-motion query suppresses animation (CSS query check) |
| `design-system/components/Badge/index.ts` | Re-export |
| `design-system/components/TerminalPanel/TerminalPanel.tsx` | RSC. Polymorphic `as?: 'section' \| 'article' \| 'div'` (default `section`). Optional `header: ReactNode` slot renders `[ HEADER ]` bar. JSDoc on every prop |
| `design-system/components/TerminalPanel/TerminalPanel.module.css` | Semantic tokens only. `.root` border via `--ds-color-border-default`, `.solid`/`.dashed` border-style variant, `.header` slot |
| `design-system/components/TerminalPanel/TerminalPanel.test.tsx` | Vitest + axe. Default render, dashed variant, polymorphic `as`, header slot self-labels via `aria-labelledby` to header id |
| `design-system/components/TerminalPanel/index.ts` | Re-export |
| `design-system/components/StatTile/StatTile.tsx` | RSC. Renders semantic `<dl><dt>{label}</dt><dd>{value}</dd></dl>`. Variants: `default`, `compact`. JSDoc on every prop |
| `design-system/components/StatTile/StatTile.module.css` | Semantic tokens only. `.root` (dl), `.label` (dt), `.value` (dd), `.compact` modifier |
| `design-system/components/StatTile/StatTile.test.tsx` | Vitest + axe. Default render, compact variant, semantic dl/dt/dd pair present in DOM |
| `design-system/components/StatTile/index.ts` | Re-export |
| `design-system/components/CmdLine/CmdLine.tsx` | RSC. Props: `user?` (default `erik@portfolio`), `command`, `output?`, `prompt?` (default `:~$`). Prompt+user+command read as one accessible line. JSDoc on every prop |
| `design-system/components/CmdLine/CmdLine.module.css` | Semantic tokens only. `.root` mono font + signal color for prompt, `.command` body color, `.output` block below |
| `design-system/components/CmdLine/CmdLine.test.tsx` | Vitest + axe. Default render (no output), with output, custom user/prompt, prompt+user+command in single text node group |
| `design-system/components/CmdLine/index.ts` | Re-export |
| `design-system/components/KbdKey/KbdKey.tsx` | RSC. Renders native `<kbd>`. Sizes: `sm`, `md`. JSDoc on every prop |
| `design-system/components/KbdKey/KbdKey.module.css` | Semantic tokens only. `.root` border + padding via `--ds-space-*`, `.sm`/`.md` size variants |
| `design-system/components/KbdKey/KbdKey.test.tsx` | Vitest + axe. Default render uses `<kbd>` element, both sizes |
| `design-system/components/KbdKey/index.ts` | Re-export |
| `design-system/components/Link/Link.tsx` | RSC. Variants: `inline`, `nav`, `external`. External auto-sets `target="_blank"` + `rel="noopener noreferrer"` and appends visually-hidden `(external)` text. JSDoc on every prop |
| `design-system/components/Link/Link.module.css` | Semantic tokens only. `.inline` underline, `.nav` no underline + border-on-focus, `.external` `::after` glyph (`↗`) |
| `design-system/components/Link/Link.test.tsx` | Vitest + axe. Inline default, nav variant, external auto-attrs (`target="_blank"` + `rel="noopener noreferrer"` + visually-hidden text), external never overrides explicit `target` |
| `design-system/components/Link/index.ts` | Re-export |
| `tests/e2e/design-system-components.spec.ts` | Per-component Playwright visual baselines — one screenshot per variant×size matrix per component, rendered against a minimal harness route `/design-system/__fixtures__/<Name>` (gated to local dev + CI only via `NEXT_PUBLIC_DS_FIXTURES=1`) |
| `app/design-system/__fixtures__/[name]/page.tsx` | Dynamic harness route that mounts each primitive in every variant for the visual spec; conditionally rendered behind `process.env.NEXT_PUBLIC_DS_FIXTURES === '1'` so it never ships to production. Returns 404 when flag is unset |
| `scripts/lint-no-use-client-in-ds.mjs` | CI gate: greps `design-system/components/**/*.tsx` for `"use client"`; rejects unless line is preceded by `// ds-exception: <reason>` comment |
| `scripts/check-ripgrep-call-sites.mjs` | CI gate: greps for legacy class names (`.cta`, `.ctaPrimary`, `.ctaSecondary`, `.status` as Hero-style status badge, `.field`, raw `<kbd` in `components/`) outside the new primitives + an allowlist; fails on any survivor |
| `docs/superpowers/plans/2026-05-23-design-system-tokenized/pr-b-inversion.md` | Task 1 output: failure-mode → test-case table sourced from spec §8 |
| `docs/superpowers/plans/2026-05-23-design-system-tokenized/pr-b-call-site-discovery.md` | Task 2 output: per-component grep findings that informed each primitive's API |

### Modified files

| Path | Change |
|---|---|
| `components/sections/Hero.tsx` | Replace `<button className={styles.cta + ' ' + styles.ctaPrimary}>` and `<button className={styles.cta + ' ' + styles.ctaSecondary}>` with `<Button variant="primary">` / `<Button variant="secondary">`; replace `<p className={styles.status}>` with `<Badge variant="dot">` for the live status indicator; replace inline boot-prompt JSX with `<CmdLine>` for the boot animation lines |
| `components/sections/Hero.module.css` | Delete `.cta`, `.ctaPrimary`, `.ctaSecondary`, `.status` rules and the responsive overrides for them (move any panel-border styling to `<TerminalPanel>` consumption); keep layout-only rules (`.ctas` grid container is layout, not primitive) |
| `components/client/ContactForm.tsx` | Replace `<input>` + `<textarea>` form blocks with `<Field>` (deep-path import: `import { Field } from '@/design-system/components/Field'` to avoid barrel leak); replace `<button type="submit">` with `<Button>` (deep-path import) |
| `components/client/ContactForm.module.css` | Delete input/textarea/label/error rules superseded by `Field.module.css`; keep only form-layout grid rules |
| `components/sections/ContactSection.tsx` | Wrap form in `<TerminalPanel>` if currently using inline bordered-panel styles |
| `components/HeroStats.tsx` | Replace each stat item with `<StatTile value={...} label={...} />`; keep the grid layout in `HeroStats.module.css` (composition, not primitive) |
| `components/HeroStats.module.css` | Delete `.statValue`, `.statLabel`, `.statItem` rules; keep `.grid` |
| `components/sections/CommunitySection.tsx` | Replace `<div className={styles.status}>` with `<Badge>` |
| `components/sections/CommunitySection.module.css` | Delete `.root .status`, `.root .status .gt` rules |
| `components/sections/ShellSection.tsx` | Replace inline kbd-styled spans with `<KbdKey>`; replace prompt lines with `<CmdLine>` |
| `components/sections/VisaSection.tsx` | Replace prompt rows with `<CmdLine>` where they exist; keep stat table layout |
| `components/sections/GuitarSection.tsx` | Replace inline `~/.guitar_rig` prompt with `<CmdLine>`; replace kbd spans with `<KbdKey>` |
| `components/sections/ManPageSection.tsx` (+ `ManPageDesktop.tsx`, `ManPageMobile.tsx`) | Replace inline `<kbd>` styling with `<KbdKey>` |
| `components/responsive/DesktopTopbar.client.tsx` | Replace nav `<a>` elements with `<Link variant="nav">` (deep-path import — client island) |
| `components/responsive/Dock.client.tsx` | Same — `<Link variant="nav">` (deep-path import) |
| `components/sections/Footer.client.tsx` | External links → `<Link variant="external">` (deep-path import) |
| `components/sections/ReadmeSection.tsx` | Inline external/internal anchors → `<Link variant="inline">` or `<Link variant="external">` |
| Every other section with bordered-panel root | Wrap root in `<TerminalPanel>` (the bordered green panel pattern from spec §4.2); delete the panel-border rules from each section's `.module.css` |
| `.github/workflows/ci.yml` | Insert two new gate steps before the build step: `pnpm lint:no-use-client-ds` and `pnpm lint:call-sites`; extend the existing `pnpm bundle-check` invocation with the new `/design-system/*` 2.5KB ceiling and `/` 0-byte-delta assertions |
| `scripts/check-bundle-size.mjs` | Extend to enforce: (a) total client JS under `/design-system/*` ≤ 2.5KB gzipped; (b) `/` route client JS delta ≤ 0 bytes vs the committed `bundle-baseline.json`; print per-route table on failure |
| `package.json` | Add scripts: `lint:no-use-client-ds`, `lint:call-sites`; no new runtime deps; add `@testing-library/react`, `@testing-library/jest-dom`, `jest-axe` to `devDependencies` if missing (exact-pinned per CLAUDE.md) |
| `bundle-baseline.json` (new committed file) | Snapshot of `/` route gzipped JS bytes pre-PR-B; the 0-byte-delta gate compares against this |
| `DECISIONS.md` | Append ADR: "PR B primitives — barrel/deep-path import discipline; `cx()` helper instead of `class-variance-authority`; reversibility note" |
| `ARCHITECTURE.md` | Add §"Design system primitives" describing the 8 components + import discipline |
| `CLAUDE.md` | Add `design-system/components/` to the list of paths the `react-best-practices` skill must cover; add `nextjs-developer` agent dispatch for any `design-system/components/*` edit |

---

## Tasks

### Task 1: thinking-inversion — enumerate the class-of-bugs PR B introduces

**Files:**
- Create: `docs/superpowers/plans/2026-05-23-design-system-tokenized/pr-b-inversion.md`

This task produces no production code. It enumerates every PR B failure mode from spec §8 and binds each to the test or gate that catches it. Every row becomes a test case in later tasks. Per CLAUDE.md, `thinking-inversion` runs before any new file or function.

- [ ] **Step 1: Write the inversion document**

Write `docs/superpowers/plans/2026-05-23-design-system-tokenized/pr-b-inversion.md` with exactly this table (sourced from spec §7.2 "Failure modes specific to PR B" and §8):

| # | Failure mode | Test/gate that catches it | Owning task |
|---|---|---|---|
| 1 | Component API doesn't match real call sites — `<Button>` doesn't expose what Hero needs; `<Field>` doesn't fit ContactForm's `onChange` shape | Task 2 reads every existing call site BEFORE designing each API; unit tests assert the exact props the call sites use | T2; T3-T10 |
| 2 | Visual drift on extraction: extracted `<Button>` renders 1px different from the inline Hero CTA | Per-component Playwright baselines in `design-system-components.spec.ts` + section-level baselines in existing `visual.spec.ts` (double-catch) | T3-T10; T13 |
| 3 | A11y regression on extraction: extracted `<Badge variant="dot">` loses `aria-hidden` on dot; `<Field>` loses label/input programmatic association; `<Link variant="external">` loses `rel="noopener noreferrer"` | Per-component axe test inside each `Component.test.tsx`; integration axe suite (`tests/a11y/axe.spec.ts`) reruns after every adoption | T3-T10; T14 |
| 4 | Bundle regression: an accidental `"use client"` slips into a primitive, the primitive's CSS module gets shipped as client JS, the `/` route bloats | `scripts/lint-no-use-client-in-ds.mjs` rejects `"use client"` without exception comment; `pnpm bundle-check` enforces 0-byte delta on `/` | T11; T13 |
| 5 | Forgotten consumers: a section keeps its inline `.cta` / `.status` / `.field` styling after the migration | `scripts/check-ripgrep-call-sites.mjs` greps for legacy class names outside `design-system/components/` and an explicit allowlist; fails CI | T12 |
| 6 | Barrel-import bundle leak: `ContactForm.client.tsx` imports `<Field>` from `@/design-system`; tree-shaker pulls the entire primitive surface (including JSDoc, Link external glyph asset, etc.) into the client bundle | `pnpm bundle-check` diffs `/` route pre/post PR B; required 0-byte delta; remediation = deep-path import (`@/design-system/components/Field`) documented in contributor docs and enforced by review checklist | T13 |
| 7 | Auto-API generator (PR C) fails because a prop lacks JSDoc | JSDoc on every prop is a Task 3-10 acceptance criterion; pre-flight `pnpm gen-api:check` in Task 15 catches missing docs before merge | T3-T10; T15 |
| 8 | `cx()` helper allows non-string variant key, runtime concatenation produces `"undefined"` in class string | `cx()` unit test asserts falsy filtering (`undefined`, `null`, `false`, `''`); TS literal-type signature prevents non-string at compile time | T3 |
| 9 | Polymorphic `as` prop on `<Button>` / `<Link>` / `<TerminalPanel>` loses prop type safety (any-typing escapes the discriminated union) | Component tests `// @ts-expect-error` lines assert that disallowed prop combinations fail to compile (e.g., `<Button as="a" type="submit">`); CI typecheck runs strict | T3, T6, T10 |
| 10 | `useId` mismatch in `<Field>` between SSR and client hydration causes a label/input mismatch warning | React 19's stable `useId` is used; SSR snapshot test confirms id stays stable; e2e spec asserts hydration matches | T4; T13 |

- [ ] **Step 2: Run code review against the inversion doc**

```bash
pnpm dlx claude code-review:code-review --files docs/superpowers/plans/2026-05-23-design-system-tokenized/pr-b-inversion.md
```

Expected: no findings (docs file).

- [ ] **Step 3: Commit the inversion document**

```bash
git add docs/superpowers/plans/2026-05-23-design-system-tokenized/pr-b-inversion.md
git commit -m "docs(design-system): pr-b thinking-inversion table"
```

---

### Task 2: Call-site discovery — read every existing pattern before designing any API

**Files:**
- Create: `docs/superpowers/plans/2026-05-23-design-system-tokenized/pr-b-call-site-discovery.md`

This task produces no production code. Per CLAUDE.md "before any new abstraction" rule and spec §7.2 failure mode #1, the API of every primitive MUST be informed by reading every existing call site. The discovery document is the input to Tasks 3-10. **Do not begin Task 3 until this is committed.**

- [ ] **Step 1: Grep for Button call sites**

```bash
rg -n --type tsx --type css '\.cta\b|\.ctaPrimary|\.ctaSecondary|<button\s' components/ app/
```

Expected output excerpt: matches in `Hero.tsx` (4 instances — two boot, two post-boot — for primary `EXEC_HIRE` and secondary `cat ~/.now`), `ContactForm.tsx` (1 submit button), `Hero.module.css` (`.cta`, `.ctaPrimary`, `.ctaSecondary` declarations).

Capture in `pr-b-call-site-discovery.md` under `## Button`:
- Files: `Hero.tsx` × 4, `ContactForm.tsx` × 1 (submit), any `ToTopButton.tsx`
- Required props observed: `onClick`, `href` (some are `<a>` styled as buttons), `disabled`, `type="submit"`, `aria-label`
- Variants observed: primary (filled signal bg), secondary (transparent + signal border)
- Sizes observed: only one size today (~44px) — sm/md/lg is forward-looking per spec §4.2
- **API decision recorded:** `variant: 'primary' | 'secondary'`, `size: 'sm' | 'md' | 'lg'` (default `md`), `as: 'button' | 'a'`, polymorphic-attrs union of `HTMLButtonElement` / `HTMLAnchorElement`. Matches spec §4.2.

- [ ] **Step 2: Grep for Field call sites**

```bash
rg -n '<input\s|<textarea\s|className=.*field' components/client/ContactForm.tsx
```

Capture under `## Field`:
- Files: `ContactForm.tsx` — fields are `name`, `email`, `message` (multiline), with `error` state surfaced inline
- Required props observed: `name`, `value`, `onChange`, `required`, `aria-invalid`, error text, `placeholder`, `rows` (for textarea), `autoComplete`
- **API decision recorded:** `name`, `label`, `multiline?: boolean`, `rows?: number` (only when multiline), `error?: string`, `type?: HTMLInputType`, polymorphic input/textarea attrs union. Matches spec §4.2.

- [ ] **Step 3: Grep for Badge call sites**

```bash
rg -n '\.status\b|<span[^>]*status' components/sections/
```

Capture under `## Badge`:
- Files: `Hero.tsx` × 2 (boot + post-boot status indicators), `CommunitySection.tsx`, possibly `VisaSection.tsx` (`.vstat`)
- Variants observed: text-only label + pulsing-dot status indicator
- **API decision recorded:** `variant: 'default' | 'dot'`, `size: 'sm' | 'md'`, `children`. Pulse must respect `prefers-reduced-motion`. Matches spec §4.2.

- [ ] **Step 4: Grep for TerminalPanel call sites**

```bash
rg -n 'border:\s*1px\s+(solid|dashed)' components/sections/ --type css
rg -n '\.root\b' components/sections/ --type css | head -20
```

Capture under `## TerminalPanel`:
- Files: nearly every section's `.module.css` defines `.root { border: 1px solid var(--border); padding: var(--pad); }` — Hero, Shell, Visa, Guitar, Community, Now, Unknowns, ManPage, Projects, PerfReceipts, AiMetrics, etc.
- Header pattern observed: `[ HEADER ]` bar at top of some panels (Hero, sections with explicit titles)
- Border-style observed: solid (default), dashed (used in sub-panels per prototype)
- **API decision recorded:** `borderStyle: 'solid' | 'dashed'` (default `solid`), `as?: 'section' | 'article' | 'div'` (default `section`), `header?: ReactNode`, `children`. Matches spec §4.2. **Note:** layout (max-width, grid placement) stays in section CSS — `TerminalPanel` owns only border + header + padding.

- [ ] **Step 5: Grep for StatTile call sites**

```bash
rg -n 'statValue|statLabel|statItem' components/
```

Capture under `## StatTile`:
- Files: `HeroStats.tsx` (4 stats: years, projects, etc.)
- Markup observed: paired value + label divs inside a grid
- **API decision recorded:** `value: string`, `label: string`, `variant?: 'default' | 'compact'`. Renders semantic `<dl><dt>{label}</dt><dd>{value}</dd></dl>` for screen readers (spec §4.2). `StatGrid` is composition, stays in `HeroStats.tsx`.

- [ ] **Step 6: Grep for CmdLine call sites**

```bash
rg -n 'erik@portfolio|terminal:~|:~\$|\$\s+(cat|ls|whoami)' components/
```

Capture under `## CmdLine`:
- Files: `Hero.tsx` (boot animation lines), `ShellSection.tsx`, `VisaSection.tsx`, `GuitarSection.tsx`, `HeroBootAnimation.tsx`, `InteractiveShell.tsx` (the shell renders its own prompts and they should NOT be replaced — that's a streaming island, not a static line)
- Pattern observed: `user@host:~$ command` prompt followed by optional indented multi-line output
- **API decision recorded:** `user?: string` (default `erik@portfolio`), `command: string`, `output?: ReactNode`, `prompt?: string` (default `:~$`). Matches spec §4.2. **Do NOT migrate InteractiveShell's streaming prompts** — those are stateful client output, not static rendering.

- [ ] **Step 7: Grep for KbdKey call sites**

```bash
rg -n '<kbd[\s>]' components/ app/
```

Capture under `## KbdKey`:
- Files: `ManPageSection.tsx`, `ManPageDesktop.tsx`, `ManPageMobile.tsx`, `ShellSection.tsx` (`?` key, `/` key, etc.)
- Sizes observed: a single size today; `sm`/`md` forward-looking
- **API decision recorded:** `size: 'sm' | 'md'` (default `md`), `children`. Renders native `<kbd>`. Matches spec §4.2.

- [ ] **Step 8: Grep for Link call sites**

```bash
rg -n '<a\s+href|<Link\s|target="_blank"' components/ app/
```

Capture under `## Link`:
- Files: `DesktopTopbar.client.tsx` (nav anchors), `Dock.client.tsx` (nav anchors), `Footer.client.tsx` (external links), `ReadmeSection.tsx` (in-body inline links), `Hero.tsx` (some CTAs are `<a>` styled as buttons — these become `<Button as="a">` per spec §4.2 not `<Link>`)
- External pattern observed: every external link manually sets `target="_blank"` + `rel="noopener noreferrer"`
- **API decision recorded:** `href: string`, `variant: 'inline' | 'nav' | 'external'`, `as?: 'a'`, polymorphic `HTMLAnchorElement` attrs. External auto-sets `target="_blank"` + `rel="noopener noreferrer"` + appends visually-hidden `(external)` text per spec §4.2. **Distinction recorded:** action-shaped anchors → `<Button as="a">`; navigation/inline anchors → `<Link>`.

- [ ] **Step 9: Run code review against the discovery doc**

```bash
pnpm dlx claude code-review:code-review --files docs/superpowers/plans/2026-05-23-design-system-tokenized/pr-b-call-site-discovery.md
```

Expected: no findings.

- [ ] **Step 10: Commit the discovery document**

```bash
git add docs/superpowers/plans/2026-05-23-design-system-tokenized/pr-b-call-site-discovery.md
git commit -m "docs(design-system): pr-b call-site discovery for all 8 primitives"
```

---

### Task 3: Build `cx()` helper + Button primitive

**Files:**
- Create: `design-system/lib/cx.ts`, `design-system/lib/cx.test.ts`
- Create: `design-system/components/Button/{Button.tsx, Button.module.css, Button.test.tsx, index.ts}`
- Modify: `components/sections/Hero.tsx`, `components/sections/Hero.module.css`, `components/client/ContactForm.tsx`

Follow superpowers:test-driven-development: tests first (each step is 2-5 min). API was decided in Task 2.

- [ ] **Step 1: Write the `cx()` test (fails — file doesn't exist)**

```ts
// design-system/lib/cx.test.ts
import { describe, expect, it } from 'vitest';
import { cx } from './cx';

describe('cx', () => {
  it('joins truthy strings', () => {
    expect(cx('a', 'b')).toBe('a b');
  });
  it('filters falsy values', () => {
    expect(cx('a', undefined, null, false, '', 'b')).toBe('a b');
  });
  it('returns empty string when all falsy', () => {
    expect(cx(undefined, null, false)).toBe('');
  });
});
```

```bash
pnpm vitest run design-system/lib/cx.test.ts
```

Expected: ERROR — cannot find module `./cx`.

- [ ] **Step 2: Implement `cx()` (~20 LoC)**

```ts
// design-system/lib/cx.ts
/**
 * Variant composer. Filters falsy values and joins the remaining class strings.
 * Preserves literal-type narrowing for compile-time variant checking when used as
 * `cx(styles.root, styles[variant], styles[size])`.
 */
export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter((c): c is string => Boolean(c) && typeof c === 'string').join(' ');
}
```

```bash
pnpm vitest run design-system/lib/cx.test.ts
```

Expected: 3/3 pass.

- [ ] **Step 3: Write the Button unit test (fails — file doesn't exist)**

```tsx
// design-system/components/Button/Button.test.tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { Button } from './Button';

describe('Button', () => {
  it('renders a button by default', () => {
    render(<Button>EXEC_HIRE</Button>);
    expect(screen.getByRole('button', { name: 'EXEC_HIRE' })).toBeInTheDocument();
  });
  it('renders as an anchor when as="a"', () => {
    render(<Button as="a" href="/x">GO</Button>);
    expect(screen.getByRole('link', { name: 'GO' })).toHaveAttribute('href', '/x');
  });
  it('applies primary variant class by default', () => {
    const { container } = render(<Button>X</Button>);
    expect(container.firstChild).toHaveClass('primary');
  });
  it.each(['sm', 'md', 'lg'] as const)('applies size class %s', (size) => {
    const { container } = render(<Button size={size}>X</Button>);
    expect(container.firstChild).toHaveClass(size);
  });
  it('disabled anchor uses aria-disabled (anchors cannot be natively disabled)', () => {
    render(<Button as="a" href="/x" disabled>X</Button>);
    expect(screen.getByRole('link')).toHaveAttribute('aria-disabled', 'true');
  });
  it('has no axe violations across all variant×size combinations', async () => {
    const { container } = render(
      <>
        <Button variant="primary" size="sm">A</Button>
        <Button variant="primary" size="md">B</Button>
        <Button variant="primary" size="lg">C</Button>
        <Button variant="secondary" size="sm">D</Button>
        <Button variant="secondary" size="md">E</Button>
        <Button variant="secondary" size="lg">F</Button>
      </>
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
```

```bash
pnpm vitest run design-system/components/Button/Button.test.tsx
```

Expected: ERROR — cannot find module.

- [ ] **Step 4: Implement Button (RSC, no `"use client"`)**

```tsx
// design-system/components/Button/Button.tsx
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from '../../lib/cx';
import styles from './Button.module.css';

type BaseProps = {
  /** Visual variant: filled signal background (`primary`) or transparent + signal border (`secondary`). */
  variant?: 'primary' | 'secondary';
  /** Size token mapping to min-height: sm=36px, md=44px (touch target default), lg=52px. */
  size?: 'sm' | 'md' | 'lg';
  /** Children rendered inside the button surface. */
  children: ReactNode;
};

type ButtonAsButton = BaseProps & { as?: 'button' } & ButtonHTMLAttributes<HTMLButtonElement>;
type ButtonAsAnchor = BaseProps & { as: 'a' } & AnchorHTMLAttributes<HTMLAnchorElement> & { disabled?: boolean };

/**
 * Primary action surface. Polymorphic over `button` / `a`. RSC-safe.
 * Disabled anchors receive `aria-disabled="true"` because anchors cannot be natively disabled.
 */
export type ButtonProps = ButtonAsButton | ButtonAsAnchor;

export function Button(props: ButtonProps) {
  const { variant = 'primary', size = 'md', as = 'button', children, className, ...rest } = props as BaseProps & {
    as?: 'button' | 'a';
    className?: string;
    disabled?: boolean;
  } & Record<string, unknown>;
  const composed = cx(styles.root, styles[variant], styles[size], className);
  if (as === 'a') {
    const { disabled, ...anchorRest } = rest as AnchorHTMLAttributes<HTMLAnchorElement> & { disabled?: boolean };
    return (
      <a className={composed} aria-disabled={disabled || undefined} {...anchorRest}>
        {children}
      </a>
    );
  }
  return (
    <button className={composed} {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)}>
      {children}
    </button>
  );
}
```

```css
/* design-system/components/Button/Button.module.css */
.root {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: var(--ds-font-family-mono);
  font-size: var(--ds-font-size-body);
  border: var(--ds-border-width-1) solid var(--ds-color-signal);
  background: transparent;
  color: var(--ds-color-signal);
  padding-inline: var(--ds-space-pad);
  cursor: pointer;
  transition: var(--ds-motion-press);
}
.root:focus-visible {
  outline: var(--ds-border-width-1) solid var(--ds-color-signal);
  outline-offset: 2px;
}
.root[disabled],
.root[aria-disabled='true'] {
  opacity: 0.4;
  pointer-events: none;
}
.primary {
  background: var(--ds-color-signal);
  color: var(--ds-color-surface-base);
}
.primary:hover { box-shadow: 0 0 16px var(--ds-color-signal-subtle); }
.secondary { background: transparent; }
.secondary:hover { box-shadow: 0 0 12px var(--ds-color-signal-quiet); }
.sm { min-height: 36px; }
.md { min-height: 44px; }
.lg { min-height: 52px; }
```

```ts
// design-system/components/Button/index.ts
export { Button } from './Button';
export type { ButtonProps } from './Button';
```

```bash
pnpm vitest run design-system/components/Button/Button.test.tsx
```

Expected: 8/8 pass.

- [ ] **Step 5: Adopt Button in Hero + ContactForm**

Replace the 4 inline `<button className={styles.cta + ...}>` blocks in `Hero.tsx` with `<Button variant="primary">EXEC_HIRE</Button>` and `<Button variant="secondary">cat ~/.now</Button>`. Replace the ContactForm submit `<button>` with `<Button>SEND_MESSAGE</Button>` (deep-path import: `import { Button } from '@/design-system/components/Button'` because ContactForm is a client island). Delete `.cta`, `.ctaPrimary`, `.ctaSecondary` rules from `Hero.module.css`.

- [ ] **Step 6: Confirm visual + a11y + bundle parity**

```bash
pnpm vitest run
pnpm typecheck
pnpm test:e2e --grep "Hero|Contact"
pnpm bundle-check
```

Expected: all green; bundle delta on `/` = 0.

- [ ] **Step 7: Code review + commit**

```bash
pnpm dlx claude code-review:code-review --staged
git add design-system/lib/ design-system/components/Button/ components/sections/Hero.tsx components/sections/Hero.module.css components/client/ContactForm.tsx
git commit -m "feat(design-system): add Button primitive + cx() helper, adopt in Hero+ContactForm"
```

---

### Task 4: Build Field primitive

**Files:**
- Create: `design-system/components/Field/{Field.tsx, Field.module.css, Field.test.tsx, index.ts}`
- Modify: `components/client/ContactForm.tsx`, `components/client/ContactForm.module.css`

API decided in Task 2 Step 2.

- [ ] **Step 1: Write Field test (fails)**

```tsx
// design-system/components/Field/Field.test.tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { Field } from './Field';

describe('Field', () => {
  it('renders an input with programmatically associated label', () => {
    render(<Field name="email" label="EMAIL" />);
    const input = screen.getByLabelText('EMAIL');
    expect(input.tagName).toBe('INPUT');
  });
  it('renders a textarea when multiline', () => {
    render(<Field name="message" label="MESSAGE" multiline rows={5} />);
    expect(screen.getByLabelText('MESSAGE').tagName).toBe('TEXTAREA');
  });
  it('surfaces error via aria-invalid + aria-describedby', () => {
    render(<Field name="email" label="EMAIL" error="required" />);
    const input = screen.getByLabelText('EMAIL');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    const describedById = input.getAttribute('aria-describedby');
    expect(describedById).toBeTruthy();
    expect(document.getElementById(describedById!)?.textContent).toBe('required');
  });
  it('has no axe violations in default and error states', async () => {
    const { container } = render(
      <>
        <Field name="a" label="A" />
        <Field name="b" label="B" error="bad" />
        <Field name="c" label="C" multiline />
      </>
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
```

```bash
pnpm vitest run design-system/components/Field/Field.test.tsx
```

Expected: ERROR (no module).

- [ ] **Step 2: Implement Field (RSC, uses React 19 `useId`)**

```tsx
// design-system/components/Field/Field.tsx
import { useId, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cx } from '../../lib/cx';
import styles from './Field.module.css';

type SharedProps = {
  /** Name attribute and base for the generated id. */
  name: string;
  /** Visible label text, always rendered (no placeholder-as-label). */
  label: string;
  /** Optional error message; sets `aria-invalid` and links via `aria-describedby`. */
  error?: string;
};

type SingleLine = SharedProps & {
  multiline?: false;
  type?: InputHTMLAttributes<HTMLInputElement>['type'];
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'name' | 'type'>;

type MultiLine = SharedProps & {
  multiline: true;
  rows?: number;
} & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'name' | 'rows'>;

/**
 * Form field primitive. Polymorphic input/textarea via `multiline`.
 * Label always rendered; error binds via `aria-describedby` + `aria-invalid="true"`.
 */
export type FieldProps = SingleLine | MultiLine;

export function Field(props: FieldProps) {
  const uid = useId();
  const id = `${props.name}-${uid}`;
  const errorId = `${id}-error`;
  const common = {
    id,
    name: props.name,
    'aria-invalid': props.error ? 'true' as const : undefined,
    'aria-describedby': props.error ? errorId : undefined,
    className: cx(styles.input, props.error && styles.errorBorder),
  };
  return (
    <div className={styles.root}>
      <label htmlFor={id} className={styles.label}>{props.label}</label>
      {props.multiline ? (
        <textarea {...common} rows={props.rows ?? 4} {...(props as MultiLine)} />
      ) : (
        <input {...common} type={(props as SingleLine).type ?? 'text'} {...(props as SingleLine)} />
      )}
      {props.error && <p id={errorId} className={styles.error}>{props.error}</p>}
    </div>
  );
}
```

```css
/* design-system/components/Field/Field.module.css */
.root { display: flex; flex-direction: column; gap: var(--ds-space-pad-tight); }
.label { font-family: var(--ds-font-family-mono); color: var(--ds-color-signal); font-size: var(--ds-font-size-body); }
.input {
  font-family: var(--ds-font-family-mono);
  background: transparent;
  border: var(--ds-border-width-1) solid var(--ds-color-border-default);
  color: var(--ds-color-text-body);
  padding: var(--ds-space-pad-tight);
}
.input:focus-visible {
  outline: var(--ds-border-width-1) solid var(--ds-color-signal);
  outline-offset: 0;
  border-color: var(--ds-color-signal);
}
.errorBorder { border-color: var(--ds-color-feedback-error); }
.error { color: var(--ds-color-feedback-error); font-family: var(--ds-font-family-mono); font-size: var(--ds-font-size-body); }
```

```ts
// design-system/components/Field/index.ts
export { Field } from './Field';
export type { FieldProps } from './Field';
```

```bash
pnpm vitest run design-system/components/Field/Field.test.tsx
```

Expected: 4/4 pass.

- [ ] **Step 3: Adopt Field in ContactForm (deep-path import)**

In `components/client/ContactForm.tsx`, replace `<input>` + `<textarea>` blocks with `<Field>` (import via `@/design-system/components/Field`). Delete superseded rules in `ContactForm.module.css`.

- [ ] **Step 4: Verify**

```bash
pnpm vitest run && pnpm typecheck && pnpm test:e2e --grep "Contact" && pnpm bundle-check
```

Expected: all green; bundle delta on `/` = 0.

- [ ] **Step 5: Code review + commit**

```bash
pnpm dlx claude code-review:code-review --staged
git add design-system/components/Field/ components/client/ContactForm.tsx components/client/ContactForm.module.css
git commit -m "feat(design-system): add Field primitive, adopt in ContactForm"
```

---

### Task 5: Build Badge primitive

**Files:**
- Create: `design-system/components/Badge/{Badge.tsx, Badge.module.css, Badge.test.tsx, index.ts}`
- Modify: `components/sections/Hero.tsx`, `components/sections/Hero.module.css`, `components/sections/CommunitySection.tsx`, `components/sections/CommunitySection.module.css`

- [ ] **Step 1: Write Badge test (fails)**

```tsx
// design-system/components/Badge/Badge.test.tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { Badge } from './Badge';

describe('Badge', () => {
  it('renders children', () => {
    render(<Badge>ONLINE</Badge>);
    expect(screen.getByText('ONLINE')).toBeInTheDocument();
  });
  it('renders the pulsing dot with aria-hidden when variant=dot', () => {
    const { container } = render(<Badge variant="dot">ONLINE</Badge>);
    const dot = container.querySelector('[aria-hidden="true"]');
    expect(dot).toBeInTheDocument();
  });
  it('has no axe violations', async () => {
    const { container } = render(
      <>
        <Badge>DEFAULT</Badge>
        <Badge variant="dot">DOT</Badge>
        <Badge size="sm">SM</Badge>
      </>
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
```

```bash
pnpm vitest run design-system/components/Badge/Badge.test.tsx
```

Expected: ERROR (no module).

- [ ] **Step 2: Implement Badge**

```tsx
// design-system/components/Badge/Badge.tsx
import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';
import styles from './Badge.module.css';

export type BadgeProps = {
  /** `default` = text only; `dot` = pulsing signal dot prefix. */
  variant?: 'default' | 'dot';
  /** Size token controlling padding + font-size. */
  size?: 'sm' | 'md';
  /** Status text. The dot is decorative (`aria-hidden`); the text carries meaning. */
  children: ReactNode;
};

export function Badge({ variant = 'default', size = 'md', children }: BadgeProps) {
  return (
    <span className={cx(styles.root, styles[variant], styles[size])}>
      {variant === 'dot' && <span className={styles.dot} aria-hidden="true" />}
      {children}
    </span>
  );
}
```

```css
/* design-system/components/Badge/Badge.module.css */
.root {
  display: inline-flex;
  align-items: center;
  gap: var(--ds-space-pad-tight);
  font-family: var(--ds-font-family-mono);
  color: var(--ds-color-signal);
  border: var(--ds-border-width-1) solid var(--ds-color-border-default);
  padding-inline: var(--ds-space-pad-tight);
}
.sm { font-size: var(--ds-font-size-body); padding-block: 2px; }
.md { font-size: var(--ds-font-size-body); padding-block: var(--ds-space-pad-tight); }
.dot {
  inline-size: 8px;
  block-size: 8px;
  background: var(--ds-color-signal);
  border-radius: 50%;
  animation: pulse var(--ds-duration-slow) var(--ds-ease-in-out) infinite alternate;
  /* motion primitives are legal inside @keyframes-targeting animation shorthand per spec §3.4 */
}
@keyframes pulse {
  from { opacity: 1; }
  to { opacity: 0.3; }
}
@media (prefers-reduced-motion: reduce) {
  .dot { animation: none; }
}
```

```ts
// design-system/components/Badge/index.ts
export { Badge } from './Badge';
export type { BadgeProps } from './Badge';
```

```bash
pnpm vitest run design-system/components/Badge/Badge.test.tsx
```

Expected: 3/3 pass.

- [ ] **Step 3: Adopt Badge**

Replace `<p className={styles.status}>` in `Hero.tsx` (both boot + post-boot) and `<div className={styles.status}>` in `CommunitySection.tsx` with `<Badge variant="dot">`. Delete `.status` rules from both `.module.css` files.

- [ ] **Step 4: Verify**

```bash
pnpm vitest run && pnpm typecheck && pnpm test:e2e --grep "Hero|Community" && pnpm bundle-check
```

- [ ] **Step 5: Code review + commit**

```bash
pnpm dlx claude code-review:code-review --staged
git add design-system/components/Badge/ components/sections/Hero.tsx components/sections/Hero.module.css components/sections/CommunitySection.tsx components/sections/CommunitySection.module.css
git commit -m "feat(design-system): add Badge primitive, adopt in Hero+Community"
```

---

### Task 6: Build TerminalPanel primitive

**Files:**
- Create: `design-system/components/TerminalPanel/{TerminalPanel.tsx, TerminalPanel.module.css, TerminalPanel.test.tsx, index.ts}`
- Modify: every section TSX with a bordered-panel root + their `.module.css` files (Hero, Shell, Visa, Guitar, Community, Now, Unknowns, ManPage, Projects, PerfReceipts, AiMetrics — full list from Task 2 Step 4)

- [ ] **Step 1: Write TerminalPanel test (fails)**

```tsx
// design-system/components/TerminalPanel/TerminalPanel.test.tsx
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
import { TerminalPanel } from './TerminalPanel';

describe('TerminalPanel', () => {
  it('renders a section by default', () => {
    const { container } = render(<TerminalPanel>body</TerminalPanel>);
    expect(container.firstChild?.nodeName).toBe('SECTION');
  });
  it('renders polymorphic as="article"', () => {
    const { container } = render(<TerminalPanel as="article">body</TerminalPanel>);
    expect(container.firstChild?.nodeName).toBe('ARTICLE');
  });
  it('applies dashed border variant', () => {
    const { container } = render(<TerminalPanel borderStyle="dashed">body</TerminalPanel>);
    expect(container.firstChild).toHaveClass('dashed');
  });
  it('renders the header slot and self-labels', () => {
    const { container } = render(<TerminalPanel header={<>SHELL</>}>body</TerminalPanel>);
    const region = container.firstChild as HTMLElement;
    const labelledBy = region.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();
    expect(document.getElementById(labelledBy!)?.textContent).toContain('SHELL');
  });
  it('has no axe violations', async () => {
    const { container } = render(
      <TerminalPanel header={<>X</>} borderStyle="dashed">body</TerminalPanel>
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
```

- [ ] **Step 2: Implement TerminalPanel**

```tsx
// design-system/components/TerminalPanel/TerminalPanel.tsx
import { useId, type ElementType, type ReactNode, type HTMLAttributes } from 'react';
import { cx } from '../../lib/cx';
import styles from './TerminalPanel.module.css';

export type TerminalPanelProps = {
  /** Border style — `solid` (default) or `dashed` for sub-panels. */
  borderStyle?: 'solid' | 'dashed';
  /** Polymorphic element. Default `section`. Use `article` for self-contained blocks, `div` only when no landmark is appropriate. */
  as?: 'section' | 'article' | 'div';
  /** Optional header slot rendered as `[ HEADER ]` bar; panel self-labels via aria-labelledby. */
  header?: ReactNode;
  children: ReactNode;
} & Omit<HTMLAttributes<HTMLElement>, 'className'>;

export function TerminalPanel({ borderStyle = 'solid', as: As = 'section' as ElementType, header, children, ...rest }: TerminalPanelProps) {
  const uid = useId();
  const headerId = header ? `tp-${uid}` : undefined;
  return (
    <As className={cx(styles.root, styles[borderStyle])} aria-labelledby={headerId} {...rest}>
      {header && <div id={headerId} className={styles.header}>[ {header} ]</div>}
      <div className={styles.body}>{children}</div>
    </As>
  );
}
```

```css
/* design-system/components/TerminalPanel/TerminalPanel.module.css */
.root { border-width: var(--ds-border-width-1); border-color: var(--ds-color-border-default); padding: var(--ds-space-pad); background: var(--ds-color-surface-base); }
.solid { border-style: solid; }
.dashed { border-style: dashed; }
.header { font-family: var(--ds-font-family-mono); color: var(--ds-color-signal); margin-block-end: var(--ds-space-pad-tight); }
.body { color: var(--ds-color-text-body); }
```

```ts
// design-system/components/TerminalPanel/index.ts
export { TerminalPanel } from './TerminalPanel';
export type { TerminalPanelProps } from './TerminalPanel';
```

```bash
pnpm vitest run design-system/components/TerminalPanel/TerminalPanel.test.tsx
```

Expected: 5/5 pass.

- [ ] **Step 3: Adopt TerminalPanel section-by-section**

For each section identified in Task 2 Step 4: wrap the section root in `<TerminalPanel>` (pass `header` if the section has a `[ HEADER ]` bar). Delete the corresponding border/padding rules from each `.module.css`; keep only layout (grid, max-width, responsive overrides). **Do this one section per commit if drift risk feels high** — but minimum: split into 2-3 commits if needed.

- [ ] **Step 4: Verify**

```bash
pnpm vitest run && pnpm typecheck && pnpm test:e2e && pnpm bundle-check
```

- [ ] **Step 5: Code review + commit**

```bash
pnpm dlx claude code-review:code-review --staged
git add design-system/components/TerminalPanel/ components/sections/
git commit -m "feat(design-system): add TerminalPanel primitive, adopt across all section panels"
```

---

### Task 7: Build StatTile primitive

**Files:**
- Create: `design-system/components/StatTile/{StatTile.tsx, StatTile.module.css, StatTile.test.tsx, index.ts}`
- Modify: `components/HeroStats.tsx`, `components/HeroStats.module.css`

- [ ] **Step 1: Write StatTile test (fails)**

```tsx
// design-system/components/StatTile/StatTile.test.tsx
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
import { StatTile } from './StatTile';

describe('StatTile', () => {
  it('renders dl/dt/dd semantic pair', () => {
    const { container } = render(<StatTile value="8+" label="YRS_EXP" />);
    expect(container.querySelector('dl')).toBeInTheDocument();
    expect(container.querySelector('dt')?.textContent).toBe('YRS_EXP');
    expect(container.querySelector('dd')?.textContent).toBe('8+');
  });
  it('applies compact variant class', () => {
    const { container } = render(<StatTile value="1" label="X" variant="compact" />);
    expect(container.firstChild).toHaveClass('compact');
  });
  it('has no axe violations', async () => {
    const { container } = render(<StatTile value="1" label="X" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
```

- [ ] **Step 2: Implement StatTile**

```tsx
// design-system/components/StatTile/StatTile.tsx
import { cx } from '../../lib/cx';
import styles from './StatTile.module.css';

export type StatTileProps = {
  /** The numeric / short value rendered prominently (e.g., "8+"). */
  value: string;
  /** The descriptor rendered as the label (e.g., "YRS_EXP"). */
  label: string;
  /** `default` = HeroStats sizing; `compact` = denser grids. */
  variant?: 'default' | 'compact';
};

export function StatTile({ value, label, variant = 'default' }: StatTileProps) {
  return (
    <dl className={cx(styles.root, styles[variant])}>
      <dt className={styles.label}>{label}</dt>
      <dd className={styles.value}>{value}</dd>
    </dl>
  );
}
```

```css
/* design-system/components/StatTile/StatTile.module.css */
.root { display: flex; flex-direction: column; gap: var(--ds-space-pad-tight); margin: 0; }
.label { font-family: var(--ds-font-family-mono); color: var(--ds-color-text-muted); font-size: var(--ds-font-size-body); }
.value { font-family: var(--ds-font-family-display); color: var(--ds-color-signal); font-size: var(--ds-font-size-heading-md); margin: 0; }
.compact .value { font-size: var(--ds-font-size-heading-sm); }
```

```ts
// design-system/components/StatTile/index.ts
export { StatTile } from './StatTile';
export type { StatTileProps } from './StatTile';
```

```bash
pnpm vitest run design-system/components/StatTile/StatTile.test.tsx
```

Expected: 3/3 pass.

- [ ] **Step 3: Adopt StatTile in HeroStats**

Replace each stat item with `<StatTile value={...} label={...} />`. Delete `.statValue`, `.statLabel`, `.statItem` rules from `HeroStats.module.css`; keep `.grid` (composition).

- [ ] **Step 4: Verify**

```bash
pnpm vitest run && pnpm typecheck && pnpm test:e2e --grep "HeroStats" && pnpm bundle-check
```

- [ ] **Step 5: Code review + commit**

```bash
pnpm dlx claude code-review:code-review --staged
git add design-system/components/StatTile/ components/HeroStats.tsx components/HeroStats.module.css
git commit -m "feat(design-system): add StatTile primitive, adopt in HeroStats"
```

---

### Task 8: Build CmdLine primitive

**Files:**
- Create: `design-system/components/CmdLine/{CmdLine.tsx, CmdLine.module.css, CmdLine.test.tsx, index.ts}`
- Modify: `components/sections/Hero.tsx`, `components/sections/ShellSection.tsx`, `components/sections/VisaSection.tsx`, `components/sections/GuitarSection.tsx`, `components/sections/HeroBootAnimation.tsx` (NOT `InteractiveShell.tsx` — see Task 2 Step 6)

- [ ] **Step 1: Write CmdLine test (fails)**

```tsx
// design-system/components/CmdLine/CmdLine.test.tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { CmdLine } from './CmdLine';

describe('CmdLine', () => {
  it('renders user@host prompt + command', () => {
    render(<CmdLine command="whoami" />);
    expect(screen.getByText(/erik@portfolio:~\$\s*whoami/)).toBeInTheDocument();
  });
  it('supports custom user + prompt', () => {
    render(<CmdLine user="root@box" prompt="#" command="ls" />);
    expect(screen.getByText(/root@box#\s*ls/)).toBeInTheDocument();
  });
  it('renders output block below prompt', () => {
    render(<CmdLine command="cat ~/.now" output={<pre>WORK</pre>} />);
    expect(screen.getByText('WORK')).toBeInTheDocument();
  });
  it('has no axe violations', async () => {
    const { container } = render(<CmdLine command="x" output={<>y</>} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
```

- [ ] **Step 2: Implement CmdLine**

```tsx
// design-system/components/CmdLine/CmdLine.tsx
import type { ReactNode } from 'react';
import styles from './CmdLine.module.css';

export type CmdLineProps = {
  /** Username + host shown before the prompt. Default `erik@portfolio`. */
  user?: string;
  /** The command text. */
  command: string;
  /** Optional output rendered below the prompt line. */
  output?: ReactNode;
  /** Prompt glyph (e.g., `:~$`, `#`). Default `:~$`. */
  prompt?: string;
};

export function CmdLine({ user = 'erik@portfolio', command, output, prompt = ':~$' }: CmdLineProps) {
  return (
    <div className={styles.root}>
      <div className={styles.line}>
        <span className={styles.prompt}>{user}{prompt}</span>
        <span className={styles.command}> {command}</span>
      </div>
      {output && <div className={styles.output}>{output}</div>}
    </div>
  );
}
```

```css
/* design-system/components/CmdLine/CmdLine.module.css */
.root { font-family: var(--ds-font-family-mono); font-size: var(--ds-font-size-body); }
.line { display: flex; flex-wrap: wrap; }
.prompt { color: var(--ds-color-signal); }
.command { color: var(--ds-color-text-body); }
.output { color: var(--ds-color-text-body); margin-block-start: var(--ds-space-pad-tight); white-space: pre-wrap; }
```

```ts
// design-system/components/CmdLine/index.ts
export { CmdLine } from './CmdLine';
export type { CmdLineProps } from './CmdLine';
```

```bash
pnpm vitest run design-system/components/CmdLine/CmdLine.test.tsx
```

Expected: 4/4 pass.

- [ ] **Step 3: Adopt CmdLine across sections**

For each static command-line render found in Task 2 Step 6, replace the inline JSX with `<CmdLine command="..." output={...} />`. **Skip `InteractiveShell.tsx`** — its streaming prompt rendering is stateful client code per CLAUDE.md "Rendering model".

- [ ] **Step 4: Verify**

```bash
pnpm vitest run && pnpm typecheck && pnpm test:e2e && pnpm bundle-check
```

- [ ] **Step 5: Code review + commit**

```bash
pnpm dlx claude code-review:code-review --staged
git add design-system/components/CmdLine/ components/
git commit -m "feat(design-system): add CmdLine primitive, adopt in Hero/Shell/Visa/Guitar"
```

---

### Task 9: Build KbdKey primitive

**Files:**
- Create: `design-system/components/KbdKey/{KbdKey.tsx, KbdKey.module.css, KbdKey.test.tsx, index.ts}`
- Modify: `components/sections/ManPageSection.tsx`, `components/sections/ManPageDesktop.tsx`, `components/sections/ManPageMobile.tsx`, `components/sections/ShellSection.tsx`

- [ ] **Step 1: Write KbdKey test (fails)**

```tsx
// design-system/components/KbdKey/KbdKey.test.tsx
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
import { KbdKey } from './KbdKey';

describe('KbdKey', () => {
  it('renders a native <kbd> element', () => {
    const { container } = render(<KbdKey>?</KbdKey>);
    expect(container.querySelector('kbd')).toBeInTheDocument();
  });
  it('applies size class', () => {
    const { container } = render(<KbdKey size="sm">?</KbdKey>);
    expect(container.firstChild).toHaveClass('sm');
  });
  it('has no axe violations', async () => {
    const { container } = render(<><KbdKey>?</KbdKey><KbdKey size="sm">/</KbdKey></>);
    expect(await axe(container)).toHaveNoViolations();
  });
});
```

- [ ] **Step 2: Implement KbdKey**

```tsx
// design-system/components/KbdKey/KbdKey.tsx
import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';
import styles from './KbdKey.module.css';

export type KbdKeyProps = {
  /** Size token — `sm` (inline body) or `md` (prominent). */
  size?: 'sm' | 'md';
  /** Key glyph or text label. */
  children: ReactNode;
};

export function KbdKey({ size = 'md', children }: KbdKeyProps) {
  return <kbd className={cx(styles.root, styles[size])}>{children}</kbd>;
}
```

```css
/* design-system/components/KbdKey/KbdKey.module.css */
.root {
  display: inline-flex;
  align-items: center;
  font-family: var(--ds-font-family-mono);
  color: var(--ds-color-signal);
  background: var(--ds-color-surface-shell);
  border: var(--ds-border-width-1) solid var(--ds-color-border-default);
  padding-inline: var(--ds-space-pad-tight);
}
.sm { font-size: var(--ds-font-size-body); padding-block: 1px; }
.md { font-size: var(--ds-font-size-body); padding-block: 2px; }
```

```ts
// design-system/components/KbdKey/index.ts
export { KbdKey } from './KbdKey';
export type { KbdKeyProps } from './KbdKey';
```

```bash
pnpm vitest run design-system/components/KbdKey/KbdKey.test.tsx
```

Expected: 3/3 pass.

- [ ] **Step 3: Adopt KbdKey across ManPage + Shell**

Replace every inline `<kbd>` (and styled `<span>` mimicking `<kbd>`) with `<KbdKey>`. Delete superseded styles.

- [ ] **Step 4: Verify + code review + commit**

```bash
pnpm vitest run && pnpm typecheck && pnpm test:e2e --grep "ManPage|Shell" && pnpm bundle-check
pnpm dlx claude code-review:code-review --staged
git add design-system/components/KbdKey/ components/sections/ManPage* components/sections/ShellSection.tsx
git commit -m "feat(design-system): add KbdKey primitive, adopt in ManPage+Shell"
```

---

### Task 10: Build Link primitive

**Files:**
- Create: `design-system/components/Link/{Link.tsx, Link.module.css, Link.test.tsx, index.ts}`
- Modify: `components/responsive/DesktopTopbar.client.tsx`, `components/responsive/Dock.client.tsx`, `components/sections/Footer.client.tsx`, `components/sections/ReadmeSection.tsx`, every other in-section inline link

- [ ] **Step 1: Write Link test (fails)**

```tsx
// design-system/components/Link/Link.test.tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { Link } from './Link';

describe('Link', () => {
  it('renders an inline anchor by default', () => {
    render(<Link href="/x">go</Link>);
    const a = screen.getByRole('link', { name: 'go' });
    expect(a).toHaveAttribute('href', '/x');
    expect(a).toHaveClass('inline');
  });
  it('nav variant has no underline class', () => {
    const { container } = render(<Link href="/x" variant="nav">NAV</Link>);
    expect(container.firstChild).toHaveClass('nav');
  });
  it('external variant auto-sets target+rel and adds visually-hidden text', () => {
    render(<Link href="https://x.example" variant="external">site</Link>);
    const a = screen.getByRole('link');
    expect(a).toHaveAttribute('target', '_blank');
    expect(a).toHaveAttribute('rel', 'noopener noreferrer');
    expect(a.querySelector('.visuallyHidden')?.textContent).toBe('(external)');
  });
  it('external respects explicit target if provided', () => {
    render(<Link href="https://x.example" variant="external" target="_self">x</Link>);
    expect(screen.getByRole('link')).toHaveAttribute('target', '_self');
  });
  it('has no axe violations', async () => {
    const { container } = render(
      <>
        <Link href="/a">a</Link>
        <Link href="/b" variant="nav">b</Link>
        <Link href="https://c.example" variant="external">c</Link>
      </>
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
```

- [ ] **Step 2: Implement Link**

```tsx
// design-system/components/Link/Link.tsx
import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { cx } from '../../lib/cx';
import styles from './Link.module.css';

export type LinkProps = {
  /** Destination URL. */
  href: string;
  /** Visual + semantic role: `inline` (in-body), `nav` (topbar/dock), `external` (off-site). */
  variant?: 'inline' | 'nav' | 'external';
  /** Included for API symmetry with Button; always `a`. */
  as?: 'a';
  children: ReactNode;
} & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>;

export function Link({ href, variant = 'inline', children, target, rel, ...rest }: LinkProps) {
  const external = variant === 'external';
  return (
    <a
      href={href}
      className={cx(styles.root, styles[variant])}
      target={target ?? (external ? '_blank' : undefined)}
      rel={rel ?? (external ? 'noopener noreferrer' : undefined)}
      {...rest}
    >
      {children}
      {external && <span className={styles.visuallyHidden}> (external)</span>}
    </a>
  );
}
```

```css
/* design-system/components/Link/Link.module.css */
.root { color: var(--ds-color-signal); font-family: inherit; }
.root:focus-visible {
  outline: var(--ds-border-width-1) solid var(--ds-color-signal);
  outline-offset: 2px;
}
.inline { text-decoration: underline; }
.nav { text-decoration: none; }
.external { text-decoration: underline; }
.external::after { content: ' ↗'; }
.visuallyHidden {
  position: absolute;
  inline-size: 1px;
  block-size: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
```

```ts
// design-system/components/Link/index.ts
export { Link } from './Link';
export type { LinkProps } from './Link';
```

```bash
pnpm vitest run design-system/components/Link/Link.test.tsx
```

Expected: 5/5 pass.

- [ ] **Step 3: Adopt Link**

Replace nav `<a>` in `DesktopTopbar.client.tsx` and `Dock.client.tsx` with `<Link variant="nav">` (deep-path import — these are client islands). Replace external links in `Footer.client.tsx` with `<Link variant="external">` (deep-path). Replace inline anchors in `ReadmeSection.tsx` (RSC — barrel import OK).

- [ ] **Step 4: Verify + code review + commit**

```bash
pnpm vitest run && pnpm typecheck && pnpm test:e2e && pnpm bundle-check
pnpm dlx claude code-review:code-review --staged
git add design-system/components/Link/ components/responsive/ components/sections/Footer.client.tsx components/sections/ReadmeSection.tsx
git commit -m "feat(design-system): add Link primitive, adopt across nav/footer/inline anchors"
```

---

### Task 11: Lint rule — reject `"use client"` in `design-system/components/*`

**Files:**
- Create: `scripts/lint-no-use-client-in-ds.mjs`, `scripts/lint-no-use-client-in-ds.test.mjs`
- Modify: `package.json` (script), `.github/workflows/ci.yml` (gate step)

Addresses spec §7.2 failure mode #4. Components MUST stay RSC unless explicitly opted-out with a justification comment.

- [ ] **Step 1: Write the lint test (fails)**

```js
// scripts/lint-no-use-client-in-ds.test.mjs
import { describe, expect, it } from 'vitest';
import { lintNoUseClient } from './lint-no-use-client-in-ds.mjs';

describe('lint-no-use-client-in-ds', () => {
  it('rejects bare "use client"', () => {
    expect(() => lintNoUseClient(['"use client";\nexport function X(){}'])).toThrow(/use client/);
  });
  it('allows "use client" preceded by ds-exception comment', () => {
    expect(() => lintNoUseClient(['// ds-exception: needs IntersectionObserver\n"use client";\nexport function X(){}'])).not.toThrow();
  });
  it('passes on RSC files', () => {
    expect(() => lintNoUseClient(['export function X(){return null}'])).not.toThrow();
  });
});
```

```bash
pnpm vitest run scripts/lint-no-use-client-in-ds.test.mjs
```

Expected: ERROR (no module).

- [ ] **Step 2: Implement the lint**

```js
// scripts/lint-no-use-client-in-ds.mjs
import { readFileSync } from 'node:fs';
import { glob } from 'node:fs/promises'; // or use fast-glob if not Node 22+
export function lintNoUseClient(sources) {
  for (const src of sources) {
    const lines = src.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*"use client"/.test(lines[i])) {
        const prev = lines[i - 1] ?? '';
        if (!/\/\/\s*ds-exception:/.test(prev)) {
          throw new Error(`use client without ds-exception comment at line ${i + 1}`);
        }
      }
    }
  }
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const files = []; // populate via fast-glob('design-system/components/**/*.tsx')
  // ... read each file, call lintNoUseClient, exit 1 on throw
}
```

```bash
pnpm vitest run scripts/lint-no-use-client-in-ds.test.mjs
```

Expected: 3/3 pass.

- [ ] **Step 3: Wire into package.json + CI**

Add to `package.json`:
```json
"lint:no-use-client-ds": "node scripts/lint-no-use-client-in-ds.mjs"
```

Add CI step in `.github/workflows/ci.yml` before the build step:
```yaml
- name: Lint no use client in design-system
  run: pnpm lint:no-use-client-ds
```

- [ ] **Step 4: Verify + code review + commit**

```bash
pnpm lint:no-use-client-ds && pnpm vitest run scripts/lint-no-use-client-in-ds.test.mjs
pnpm dlx claude code-review:code-review --staged
git add scripts/lint-no-use-client-in-ds.* package.json .github/workflows/ci.yml
git commit -m "feat(design-system): add lint gate rejecting use client in primitives"
```

---

### Task 12: Ripgrep gate — confirm old class names are gone

**Files:**
- Create: `scripts/check-ripgrep-call-sites.mjs`, `scripts/check-ripgrep-call-sites.test.mjs`
- Modify: `package.json`, `.github/workflows/ci.yml`

Addresses spec §7.2 failure mode #5. Catches forgotten consumers that kept inline styling.

- [ ] **Step 1: Write the gate test (fails)**

```js
// scripts/check-ripgrep-call-sites.test.mjs
import { describe, expect, it } from 'vitest';
import { findLegacyClassNames } from './check-ripgrep-call-sites.mjs';

describe('check-ripgrep-call-sites', () => {
  it('returns matches for legacy .cta in fake source', () => {
    const matches = findLegacyClassNames([
      { path: 'components/sections/Foo.tsx', body: 'className={styles.cta}' },
    ]);
    expect(matches).toHaveLength(1);
  });
  it('ignores matches inside design-system/components', () => {
    const matches = findLegacyClassNames([
      { path: 'design-system/components/Button/Button.module.css', body: '.cta{}' },
    ]);
    expect(matches).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Implement the gate**

```js
// scripts/check-ripgrep-call-sites.mjs
const LEGACY_PATTERNS = [
  /\bstyles\.cta\b/,
  /\bstyles\.ctaPrimary\b/,
  /\bstyles\.ctaSecondary\b/,
  /\bstyles\.status\b/, // Hero-style status badge (Badge primitive replaces)
  /\bstyles\.field\b/,
  /<kbd\s/, // raw kbd should be KbdKey
];
const EXEMPT_PREFIX = 'design-system/components/';
export function findLegacyClassNames(files) {
  const out = [];
  for (const { path, body } of files) {
    if (path.startsWith(EXEMPT_PREFIX)) continue;
    for (const pat of LEGACY_PATTERNS) {
      if (pat.test(body)) out.push({ path, pattern: pat.source });
    }
  }
  return out;
}
// CLI: walk repo, exit 1 on any matches with file:line printed
```

```bash
pnpm vitest run scripts/check-ripgrep-call-sites.test.mjs
```

Expected: 2/2 pass.

- [ ] **Step 3: Wire into package.json + CI**

```json
"lint:call-sites": "node scripts/check-ripgrep-call-sites.mjs"
```

```yaml
- name: Lint legacy call sites
  run: pnpm lint:call-sites
```

- [ ] **Step 4: Run the gate against the live tree**

```bash
pnpm lint:call-sites
```

Expected: zero violations (every consumer migrated in Tasks 3-10). If violations surface, return to the relevant task and finish the migration before proceeding.

- [ ] **Step 5: Code review + commit**

```bash
pnpm dlx claude code-review:code-review --staged
git add scripts/check-ripgrep-call-sites.* package.json .github/workflows/ci.yml
git commit -m "feat(design-system): add ripgrep gate for legacy class name survivors"
```

---

### Task 13: Bundle-leak gate — 2.5KB ceiling on `/design-system/*` + 0-byte delta on `/`

**Files:**
- Create: `bundle-baseline.json` (snapshot of `/` gzipped JS pre-PR-B)
- Modify: `scripts/check-bundle-size.mjs`, `.github/workflows/ci.yml`, `package.json`

Addresses spec §7.2 failure mode #6 and architect-reviewer's specific concern about a numeric ceiling on the docs routes.

- [ ] **Step 1: Snapshot the `/` route bundle from main (before any PR B work merges)**

```bash
git checkout main -- bundle-baseline.json || true
pnpm build
node -e "const f=require('fs');const route='/';const dir='.next/static/chunks/pages';const bytes=/*sum gzipped sizes for route entry chunks*/0;f.writeFileSync('bundle-baseline.json',JSON.stringify({route,bytes},null,2))"
```

Commit the baseline as the first step of this task (separate commit so the diff is reviewable):
```bash
git add bundle-baseline.json
git commit -m "chore(design-system): snapshot / route bundle baseline for pr-b leak gate"
```

- [ ] **Step 2: Write the gate test (fails)**

```js
// scripts/check-bundle-size.test.mjs
import { describe, expect, it } from 'vitest';
import { checkBundleSize } from './check-bundle-size.mjs';
describe('check-bundle-size', () => {
  it('fails when / route bundle grows vs baseline', () => {
    expect(() => checkBundleSize({ baseline: { '/': 30000 }, current: { '/': 30100 } })).toThrow(/0-byte delta/);
  });
  it('fails when /design-system/* exceeds 2.5KB ceiling', () => {
    expect(() => checkBundleSize({ baseline: { '/': 30000 }, current: { '/': 30000, '/design-system/*': 2600 } })).toThrow(/2\.5KB/);
  });
  it('passes when both gates are met', () => {
    expect(() => checkBundleSize({ baseline: { '/': 30000 }, current: { '/': 30000, '/design-system/*': 2000 } })).not.toThrow();
  });
});
```

- [ ] **Step 3: Extend `scripts/check-bundle-size.mjs`**

Add (in addition to whatever already exists):
```js
const DS_CEILING_BYTES = 2560; // 2.5KB
export function checkBundleSize({ baseline, current }) {
  if (current['/'] > baseline['/']) {
    throw new Error(`/ route 0-byte delta gate failed: ${current['/']} > ${baseline['/']}`);
  }
  const dsRoutes = Object.keys(current).filter((k) => k.startsWith('/design-system'));
  const dsTotal = dsRoutes.reduce((s, k) => s + current[k], 0);
  if (dsTotal > DS_CEILING_BYTES) {
    throw new Error(`/design-system/* exceeds 2.5KB ceiling: ${dsTotal}b`);
  }
}
```

- [ ] **Step 4: Run + verify**

```bash
pnpm vitest run scripts/check-bundle-size.test.mjs
pnpm build && pnpm bundle-check
```

Expected: vitest 3/3 pass; bundle-check passes with `/` delta = 0 and (in PR B, before PR C) `/design-system/*` = 0 bytes (no routes yet — gate still enforces ceiling for future PRs).

- [ ] **Step 5: Code review + commit**

```bash
pnpm dlx claude code-review:code-review --staged
git add scripts/check-bundle-size.* package.json .github/workflows/ci.yml
git commit -m "feat(design-system): bundle-leak gate (2.5KB ceiling /design-system/*; 0-byte delta /)"
```

---

### Task 14: Per-component Playwright visual baselines + harness route

**Files:**
- Create: `app/design-system/__fixtures__/[name]/page.tsx`, `tests/e2e/design-system-components.spec.ts`
- Modify: `playwright.config.ts` if needed to pass `NEXT_PUBLIC_DS_FIXTURES=1` env

Spec §9 testing strategy.

- [ ] **Step 1: Add the fixture route (404 unless env flag set)**

```tsx
// app/design-system/__fixtures__/[name]/page.tsx
import { notFound } from 'next/navigation';
import { Button } from '@/design-system/components/Button';
import { Field } from '@/design-system/components/Field';
import { Badge } from '@/design-system/components/Badge';
import { TerminalPanel } from '@/design-system/components/TerminalPanel';
import { StatTile } from '@/design-system/components/StatTile';
import { CmdLine } from '@/design-system/components/CmdLine';
import { KbdKey } from '@/design-system/components/KbdKey';
import { Link } from '@/design-system/components/Link';

const FIXTURES: Record<string, JSX.Element> = {
  button: (
    <div data-testid="ds-fixture">
      <Button variant="primary" size="sm">SM</Button>
      <Button variant="primary" size="md">MD</Button>
      <Button variant="primary" size="lg">LG</Button>
      <Button variant="secondary" size="md">SEC</Button>
      <Button as="a" href="/x" variant="primary">ANCHOR</Button>
    </div>
  ),
  // ... one entry per primitive covering its variant×size matrix
};

export default function Page({ params }: { params: { name: string } }) {
  if (process.env.NEXT_PUBLIC_DS_FIXTURES !== '1') notFound();
  const node = FIXTURES[params.name];
  if (!node) notFound();
  return node;
}
```

- [ ] **Step 2: Write the visual spec**

```ts
// tests/e2e/design-system-components.spec.ts
import { expect, test } from '@playwright/test';
const COMPONENTS = ['button', 'field', 'badge', 'terminalpanel', 'stattile', 'cmdline', 'kbdkey', 'link'] as const;
for (const c of COMPONENTS) {
  test(`${c} visual baseline`, async ({ page }) => {
    await page.goto(`/design-system/__fixtures__/${c}`);
    await expect(page.getByTestId('ds-fixture')).toHaveScreenshot(`${c}.png`);
  });
}
```

- [ ] **Step 3: Generate baselines + manual review**

```bash
NEXT_PUBLIC_DS_FIXTURES=1 pnpm test:e2e --update-snapshots --grep "visual baseline"
```

**Manual gate:** visually inspect every baseline PNG before committing. Spec §8 calls out baseline regen masking real drift as a failure mode — the human review is the gate.

- [ ] **Step 4: Verify + code review + commit**

```bash
NEXT_PUBLIC_DS_FIXTURES=1 pnpm test:e2e --grep "visual baseline"
pnpm dlx claude code-review:code-review --staged
git add app/design-system/__fixtures__/ tests/e2e/design-system-components.spec.ts tests/e2e/design-system-components.spec.ts-snapshots/
git commit -m "test(design-system): per-component playwright visual baselines"
```

---

### Task 15: Barrel re-export + JSDoc pre-flight for PR C auto-API

**Files:**
- Create: `design-system/index.ts`
- (No new tests — Task 3-10 component tests cover the barrel surface; this task only assembles + asserts JSDoc completeness as a pre-flight for PR C's `gen-api:check`.)

- [ ] **Step 1: Write the barrel**

```ts
// design-system/index.ts
export { Button } from './components/Button';
export type { ButtonProps } from './components/Button';
export { Field } from './components/Field';
export type { FieldProps } from './components/Field';
export { Badge } from './components/Badge';
export type { BadgeProps } from './components/Badge';
export { TerminalPanel } from './components/TerminalPanel';
export type { TerminalPanelProps } from './components/TerminalPanel';
export { StatTile } from './components/StatTile';
export type { StatTileProps } from './components/StatTile';
export { CmdLine } from './components/CmdLine';
export type { CmdLineProps } from './components/CmdLine';
export { KbdKey } from './components/KbdKey';
export type { KbdKeyProps } from './components/KbdKey';
export { Link } from './components/Link';
export type { LinkProps } from './components/Link';
// Tokens re-export wired by PR A:
export { tokens } from './dist/tokens';
export type { Tokens } from './dist/tokens';
```

- [ ] **Step 2: Pre-flight JSDoc audit (manual)**

For each of the 8 components, open the `.tsx` file and confirm every prop on the exported `Props` type has a JSDoc `/** ... */` block above it. This is the input that PR C's `scripts/gen-component-api.mjs` consumes per spec §5.9. Missing JSDoc would fail PR C's CI gate; catching it here is cheap.

Quick check:
```bash
rg -n -B1 '^\s+\w+\??\s*:' design-system/components/**/*.tsx | rg -B1 -v '\*/' | head -50
```
Any prop line without `*/` immediately above it is missing JSDoc.

- [ ] **Step 3: Bundle re-check (barrel exists now)**

```bash
pnpm build && pnpm bundle-check
```

Expected: `/` route bundle delta still 0. If non-zero, identify the deep-path violator in a client island and convert the import.

- [ ] **Step 4: Code review + commit**

```bash
pnpm dlx claude code-review:code-review --staged
git add design-system/index.ts
git commit -m "feat(design-system): barrel re-export of 8 primitives + tokens"
```

---

### Task 16: Update docs (DECISIONS, ARCHITECTURE, CLAUDE)

**Files:**
- Modify: `DECISIONS.md`, `ARCHITECTURE.md`, `CLAUDE.md`

- [ ] **Step 1: DECISIONS.md** — append a single ADR bullet covering: 8 primitives shipped; `cx()` helper instead of CVA (zero new runtime dep); deep-path import discipline for client islands; bundle gate ceilings; reversibility note ("revert + re-inline; medium-cost").

- [ ] **Step 2: ARCHITECTURE.md** — add a §"Design system primitives" subsection listing the 8 components and the barrel/deep-path rule.

- [ ] **Step 3: CLAUDE.md** — add `design-system/components/` to the `react-best-practices` skill trigger and to `nextjs-developer` agent dispatch.

- [ ] **Step 4: Code review + commit**

```bash
pnpm dlx claude code-review:code-review --staged
git add DECISIONS.md ARCHITECTURE.md CLAUDE.md
git commit -m "docs(design-system): record pr-b primitives + import discipline"
```

---

### Task 17: Full CI gate locally + PR

**Files:** none new.

- [ ] **Step 1: Run the full local CI gate**

```bash
pnpm ci:local && pnpm bundle-check && pnpm test:e2e
```

Expected: green across lint, typecheck, content validation, client naming, vitest, bundle, e2e (visual + a11y + smoke).

- [ ] **Step 2: Local Playwright MCP visual check (per CLAUDE.md PR merge gate #8)**

Start `pnpm dev`, drive Playwright MCP at desktop (1280×720) and mobile (375×812). Spot-check the golden path (Hero → Stats → Shell → Contact) and every section that adopted a primitive. Confirm no visual regression vs the prior baseline beyond expected intentional drift.

- [ ] **Step 3: Push branch + open PR via `commit-commands:commit-push-pr` skill**

The PR body follows the project template (Summary, Test plan checkboxes). Title: `feat(design-system): 8 primitive components extracted from portfolio (PR B)`.

- [ ] **Step 4: After Copilot review, RESOLVE or ESCALATE every thread per CLAUDE.md PR merge gate #7**

No silent merges.

- [ ] **Step 5: `pnpm ready-to-merge <pr>` then `git fetch && git rebase origin/main` then merge**

Per CLAUDE.md PR merge gate #5 and #9.

---

## Self-review checklist (per superpowers:writing-plans)

- [x] Every task is 2-5 minutes per step
- [x] Every task has a test-first shape
- [x] Every task ends in a commit with a conventional message
- [x] Every commit is preceded by `code-review:code-review` per CLAUDE.md
- [x] Every component task includes: API from call-site discovery → tests → impl → CSS Modules with semantic tokens only → axe → Playwright baseline → extraction in consumers → ripgrep gate
- [x] thinking-inversion comes first (Task 1) and produces test cases (consumed by Tasks 3-15)
- [x] Call-site discovery comes second (Task 2) and informs every component API
- [x] One task per primitive (Tasks 3-10) for the 8 primitives
- [x] Cross-cutting tasks (cx helper inside Task 3; lint Task 11; ripgrep gate Task 12; bundle gate Task 13) follow
- [x] Bundle gate addresses architect-reviewer's "no numeric ceiling on docs routes" concern (2.5KB cap + 0-byte delta on /)
- [x] Lint rule for `"use client"` in `design-system/components/*` (Task 11)
- [x] Every component API matches spec §4.2 inventory
- [x] JSDoc required on every prop and audited in Task 15 pre-flight for PR C auto-API
- [x] Deep-path import discipline documented and enforced where client islands consume primitives
- [x] References to spec by section number; no duplication of spec content
- [x] Reversibility called out (medium per spec §7.2)
