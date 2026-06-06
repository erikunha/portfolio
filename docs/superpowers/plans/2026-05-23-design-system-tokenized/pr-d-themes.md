# Design System PR D: Theme Variants + Switcher

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a second theme (`crt-amber`) and a live switcher on `/design-system/themes` that proves the two-tier token architecture from PR A handles theme variants without a single component change.

**Architecture:** The two-tier architecture pays off here. PR D is _one new primitive ramp_ (`--ds-amber-*`) plus _one new semantic-mapping file_ (`themes/crt-amber.json`), wired through Style Dictionary's existing per-theme output. Zero component edits, zero CSS Module changes. The switcher is a ~500-byte client island scoped to one route, with SSR cookie hydration to eliminate flash-of-wrong-theme.

**Tech Stack:** React 19 RSC + targeted `*.client.tsx` island · Style Dictionary v4 (from PR A) · Next 16 cookies API · Vitest · Playwright (visual + e2e) · axe-core

**Spec references:** §3.9 (theme variants), §3.3 (semantic token table), §3.6 (contrast audit), §5.1 + §5.8 (themes route + a11y), §7.4 (PR D file inventory + failure modes), §10 (perf budget), §12 (acceptance criteria).

**Depends on:** PR A (token pipeline, `check-theme-contract.mjs`, `contrast-check.mjs`, `crt-green.json`), PR C (`/design-system` MDX layout, `_components/` island infrastructure, sidebar nav, axe spec, LHCI route matrix).

---

## File Map

| File | Action | Reason |
|---|---|---|
| `design-system/tokens/color.json` | **Modify** | Add `--ds-amber-50` → `--ds-amber-700` primitive ramp (spec §7.4) |
| `design-system/tokens/themes/crt-amber.json` | **Create** | Semantic→primitive mappings for amber theme (spec §3.9) |
| `scripts/check-theme-contract.mjs` | **Modify** | Add component-CSS-extracted pair scan in addition to hardcoded pairs (architect-reviewer concern); run contrast per theme; assert role parity |
| `scripts/contrast-check.mjs` | **Modify** | Iterate theme files instead of single token set; emit `theme=crt-amber` in failure rows |
| `app/design-system/_components/ThemeSwitcher.client.tsx` | **Create** | ~500 B gzipped switcher; sets `documentElement.dataset.theme`; persists to localStorage + cookie fallback |
| `app/design-system/themes/page.mdx` | **Create** | Themes gallery + live switcher + side-by-side token diff table (spec §5.1) |
| `app/design-system/themes/page.module.css` | **Create** | Gallery layout (CSS Module, semantic tokens only) |
| `app/layout.tsx` | **Modify** | Read `theme` cookie SSR-side; set `data-theme` on `<html>` pre-hydration (zero-flash contract, spec §3.9 + §7.4 failure mode 1) |
| `app/api/theme/route.ts` | **Create** | Tiny edge route that writes the `theme` cookie (called by switcher to persist across SSR navigations); GET returns current theme |
| `tests/e2e/design-system-components.spec.ts` | **Modify** | Add second baseline matrix: every primitive × `crt-amber` (extends PR B file) |
| `tests/e2e/design-system-pages.spec.ts` | **Modify** | Add themes-route smoke + switcher-persistence-across-reload test (extends PR C file) |
| `tests/a11y/axe.spec.ts` | **Modify** | Add `/design-system/themes` route to a11y scan (spec §5.8) |
| `__tests__/ThemeSwitcher.test.tsx` | **Create** | Unit: switches `dataset.theme`, persists, falls back when localStorage throws, no-op on invalid value |
| `__tests__/theme-cookie-ssr.test.ts` | **Create** | Unit: layout reads cookie, defaults to `crt-green`, ignores invalid cookie |
| `app/sitemap.ts` | **Modify** | Add `/design-system/themes` URL (spec §7.4) |
| `public/llms.txt` | **Modify** | Add themes route under `/design-system/*` section (spec §5.6) |
| `lighthouserc.json` | **Modify** | Add `/design-system/themes` to URL list (spec §5.11) |
| `scripts/check-bundle-size.*` (existing `bundle-check`) | **Modify if needed** | Confirm new route entry; gate 0-byte delta on `/` |
| `DECISIONS.md` | **Modify** | Append PR D ADR: amber primitive choice, cookie+localStorage dual persistence, zero-flash mechanism |
| `ARCHITECTURE.md` | **Modify** | Add §"Themes" subsection cross-referencing spec §3.9 |

---

## Task 1: `thinking-inversion` — class-of-bugs for PR D

Invoke `thinking-inversion` skill. Each answer below becomes a test or a gate in later tasks. Do not skip — bugs surfaced here drive the TDD in Task 5+.

- [ ] **What specifically makes PR D fail?** Document each failure mode with: trigger, blast radius, owning task, owning test.

  | # | Failure mode | Trigger | Owning task | Owning test/gate |
  |---|---|---|---|---|
  | 1 | Theme flash on first paint | Cookie not read SSR-side; `<html>` defaults to `crt-green`; client switches to `crt-amber` after hydration | Task 6 | `__tests__/theme-cookie-ssr.test.ts` + Playwright `expect(html).toHaveAttribute('data-theme', 'crt-amber')` on first paint screenshot |
  | 2 | Missing semantic role in `crt-amber.json` | Author forgets one of the 15 roles from spec §3.3 | Task 4 | `check-theme-contract.mjs` role-parity assertion |
  | 3 | Contrast failure on amber pair | `--ds-color-text-faint` mapped to amber lands < 4.5:1 | Task 3 + Task 4 | Extended `contrast-check.mjs` per theme |
  | 4 | Component-specific pair fails only in amber | `Badge` uses `--ds-color-signal` on `--ds-color-surface-shell` — passes in green, fails in amber | Task 4 sub-task | CSS-extracted pair scan (architect-reviewer concern) |
  | 5 | `localStorage` unavailable (Safari private mode, `Storage` quota exceeded) | `window.localStorage.setItem` throws | Task 5 | Unit test mocks `localStorage` to throw; assert switcher falls back to cookie write + no crash |
  | 6 | `ThemeSwitcher` leaks into main `/` bundle | Accidental import from a non-themes route; barrel re-export | Task 9 | `pnpm bundle-check` per-route diff; required 0-byte delta on `/` |
  | 7 | Switcher writes invalid theme value (XSS via tampered localStorage) | Attacker sets `localStorage.theme = '"><script>'` | Task 5 + Task 6 | Allowlist check `['crt-green','crt-amber'].includes(value)` before applying to DOM |
  | 8 | Cookie route triggers full SSR rerender on every toggle | Switcher posts to `/api/theme` synchronously and awaits navigation | Task 5 | Switcher applies DOM mutation first (instant feedback), writes cookie fire-and-forget |
  | 9 | Hydration mismatch warning when cookie says amber but no JS yet | Server renders amber, client default state is green | Task 5 + Task 6 | SSR sets attribute pre-hydration; client reads `document.documentElement.dataset.theme` as initial state — no `useState('crt-green')` default |
  | 10 | Amber theme name leaks into Tailwind-removed-era token names or breaks legacy `--signal` references | Codemod from PR A missed something | Task 4 | `check-theme-contract.mjs` extended to grep legacy names; ripgrep CI gate from PR A still applies |
  | 11 | `crt-amber` shipped without docs-route a11y coverage | Route exists but `axe.spec.ts` not updated | Task 7 + Task 8 | `tests/a11y/axe.spec.ts` matrix includes `/design-system/themes` |
  | 12 | Theme contract gate runs only against `crt-green` after extension | Refactor regression | Task 4 | Snapshot test of contract gate output asserts both themes named in report |

- [ ] **Record `thinking-inversion` output in the PR description** as a checklist so reviewers can verify each failure has a corresponding test.

---

## Task 2: Add `--ds-amber-*` primitive ramp

**Files:**
- Modify: `design-system/tokens/color.json` (extend, do not replace)

Mirror the green ramp shape from spec §3.2 exactly. Same stops, same alpha values, same solid/alpha split — so every semantic role that maps to `--ds-green-N` has a 1:1 amber counterpart.

**Source / rationale for amber hex choice:**
- `--ds-amber-500` = `#FFB000` — the canonical IBM 5151 / DEC VT220 amber-phosphor monitor color (~590 nm). It's the "amber CRT" of the 1980s. Picking the historical reference instead of inventing a hex anchors the theme in the same era as the green theme (P1 phosphor `#00FF41`) and reads as a deliberate alt-mode, not a random orange.
- `--ds-amber-50` = `#1f1505` — warm-dark backdrop matched in luminance to green-50 (`#0a1f0d`, L ≈ 0.011). Computed: a 5%-luminance warm tone with hue ~36°.
- Alphas at 100/150/300/400 = the same `0.10 / 0.12 / 0.20 / 0.40` ratios as green, applied to `255, 176, 0`. Identical alpha contract means borders, faint overlays, and reduced-emphasis text shift hue but not weight.
- `--ds-amber-700` = `#8A5A0A` — darker, ~36° hue, picked so the green-500→green-700 darkening ratio (relative luminance ~0.30) matches amber-500→amber-700.

- [ ] **Step 1:** Add the amber primitives under the existing `color.primitives` namespace in `design-system/tokens/color.json`.

```json
{
  "color": {
    "amber": {
      "50":  { "value": "#1f1505",                  "comment": "warm-dark surface backdrop; luminance match to green-50" },
      "100": { "value": "rgba(255, 176, 0, 0.1)",   "comment": "faintest amber overlay" },
      "150": { "value": "rgba(255, 176, 0, 0.12)",  "comment": "faint amber overlay" },
      "300": { "value": "rgba(255, 176, 0, 0.2)",   "comment": "soft amber overlay" },
      "400": { "value": "rgba(255, 176, 0, 0.4)",   "comment": "medium amber — borders / muted accents" },
      "500": { "value": "#FFB000",                  "comment": "canonical amber CRT phosphor (IBM 5151, DEC VT220)" },
      "700": { "value": "#8A5A0A",                  "comment": "darker amber for accent depth; luminance ratio matches green-700/green-500" }
    }
  }
}
```

- [ ] **Step 2:** Run `pnpm tokens:build`. Confirm `design-system/dist/tokens.css` emits `--ds-amber-50` through `--ds-amber-700` under `:root` (or under the `[data-theme="crt-amber"]` selector — Style Dictionary config from PR A determines scope; primitives stay at `:root`).

- [ ] **Step 3:** Verify the ramp visually on a throwaway scratch page (or via `node -e` HSL print) before wiring semantics. Catching a wrong alpha here is cheaper than catching it via failed contrast assertions later.

- [ ] **Step 4:** Run `code-review:code-review` on the staged JSON diff. Commit: `feat(ds-tokens): add amber primitive ramp for crt-amber theme`.

---

## Task 3: Create `themes/crt-amber.json`

**Files:**
- Create: `design-system/tokens/themes/crt-amber.json`

Per spec §3.3 the semantic role list is 15 color roles. The amber theme is **about the signal family**, not body text or surfaces — spec §3.9 explicitly says "Text, surface, layer tokens unchanged." So the file maps signal/border/highlight/accent-warm to amber primitives and re-asserts the green-theme mappings for everything else (parity required by the contract gate; we restate them rather than relying on inheritance).

- [ ] **Step 1:** Create `design-system/tokens/themes/crt-amber.json` with the full 15-role mapping.

```json
{
  "$theme": "crt-amber",
  "$description": "Alternate CRT phosphor (amber). Shifts the signal family to amber primitives; text + surface stay neutral so body legibility is unchanged.",
  "color": {
    "signal":         { "value": "{color.amber.500}" },
    "signal-subtle":  { "value": "{color.amber.400}" },
    "signal-quiet":   { "value": "{color.amber.100}" },
    "signal-faint":   { "value": "{color.amber.150}" },
    "text-body":      { "value": "{color.text.100}",      "comment": "unchanged — body legibility owns 4.5:1 contrast; amber-on-black body fails AA" },
    "text-muted":     { "value": "{color.amber.400}",     "comment": "muted text rides the signal hue (matches green theme's pattern of muted=signal-400)" },
    "text-faint":     { "value": "{color.text.300}",      "comment": "unchanged — neutral faint stays neutral" },
    "surface-base":   { "value": "{color.neutral.0}",     "comment": "unchanged — pure black background is the aesthetic constant" },
    "surface-shell":  { "value": "{color.neutral.50}",    "comment": "unchanged" },
    "border-default": { "value": "{color.amber.400}" },
    "accent-warm":    { "value": "{color.amber.500}",     "comment": "warm accent IS the signal in amber theme" },
    "accent-cool":    { "value": "{color.accent.cyan}",   "comment": "unchanged — cool accent is the contrast pole" },
    "feedback-error": { "value": "{color.feedback.error}", "comment": "unchanged — error red must remain unambiguous across themes" },
    "highlight-bg":   { "value": "{color.amber.500}" },
    "highlight-fg":   { "value": "{color.neutral.0}",     "comment": "unchanged — black on amber/green both pass AAA" }
  }
}
```

- [ ] **Step 2:** Confirm Style Dictionary config from PR A scopes this file's output under `[data-theme="crt-amber"]` selector in `tokens.css`. If PR A's config needs a tiny extension to discover `themes/*.json`, do that as part of this task (single-line glob change).

- [ ] **Step 3:** Run `pnpm tokens:build`. Inspect `dist/tokens.css` — every semantic name from `crt-green` MUST appear under the `[data-theme="crt-amber"]` block. If anything is missing it's a Style Dictionary config bug, not a content bug. Spec §3.9 ("two themes share one bundle; ~600 bytes added") is the gzip target — measure with `gzip -c dist/tokens.css | wc -c` before/after.

- [ ] **Step 4:** `code-review:code-review`, commit: `feat(ds-tokens): add crt-amber semantic theme mapping`.

---

## Task 4: Extend `scripts/check-theme-contract.mjs`

**Files:**
- Modify: `scripts/check-theme-contract.mjs` (from PR A; PR D extends its assertions)
- Modify: `scripts/contrast-check.mjs` (iterate themes)

Per the prompt and spec §7.4 failure modes 2 + 3, the contract gate must do three things:

1. **Role parity** — every role in `crt-green.json` MUST exist in `crt-amber.json` (and every other theme file).
2. **Per-theme contrast** — run the existing `contrast-check.mjs` pair list once per theme.
3. **Component-CSS-extracted pair scan** (architect-reviewer concern) — grep every `.module.css` for `var(--ds-color-text-*)` and `var(--ds-color-signal*)` adjacent to `background`/`background-color` references; assert each discovered pair passes WCAG AA in **both** themes. This catches the case where a role pair (e.g. `signal` on `surface-shell` used by Badge) is AA in green but slips in amber.

- [ ] **Step 1 — Write the failing test first (TDD per CLAUDE.md `superpowers:test-driven-development`).** Add `scripts/__tests__/check-theme-contract.test.mjs` (or extend the existing PR A test file). Test cases:
  - Fixture: one valid pair of themes → exits 0.
  - Fixture: `crt-amber` missing one role → exits non-zero with `MISSING_ROLE: <role> in crt-amber`.
  - Fixture: `crt-amber` with a pair below 4.5:1 → exits non-zero with `CONTRAST_FAIL: theme=crt-amber pair=... ratio=...`.
  - Fixture: component CSS with a `var(--ds-color-signal)` adjacent to `background: var(--ds-color-surface-shell)` whose amber computed pair fails → exits non-zero with `CONTRAST_FAIL (extracted): theme=crt-amber ...`.

- [ ] **Step 2 — Build the CSS-pair extractor** as a small helper inside `check-theme-contract.mjs`.

  ```js
  // scripts/check-theme-contract.mjs (extract excerpt)
  import { globby } from 'globby';
  import postcss from 'postcss';
  import valueParser from 'postcss-value-parser';

  // Returns Array<{ fg: string, bg: string, file: string, line: number }>
  async function extractPairs() {
    const files = await globby([
      'components/**/*.module.css',
      'app/**/*.module.css',
      'design-system/components/**/*.module.css',
    ]);
    const pairs = [];
    for (const file of files) {
      const css = await fs.readFile(file, 'utf8');
      const root = postcss.parse(css);
      root.walkRules((rule) => {
        // Within a single rule, collect the color tokens used in
        // `color` and `background[-color]` declarations.
        let fg = null;
        let bg = null;
        rule.walkDecls((decl) => {
          if (decl.prop === 'color') fg = extractToken(decl.value);
          if (decl.prop === 'background' || decl.prop === 'background-color')
            bg = extractToken(decl.value);
        });
        if (fg && bg) pairs.push({ fg, bg, file, line: rule.source.start.line });
      });
    }
    return pairs;
  }

  function extractToken(value) {
    // Find the first var(--ds-color-*) reference; ignore gradients, calc, etc. for v1.
    const parsed = valueParser(value);
    let token = null;
    parsed.walk((node) => {
      if (node.type === 'function' && node.value === 'var') {
        const first = node.nodes[0];
        if (first && first.value && first.value.startsWith('--ds-color-')) {
          token = first.value;
          return false; // stop walk
        }
      }
    });
    return token;
  }
  ```

  Document the simplification explicitly in a comment block at the top of the extractor: v1 only catches direct `color` + `background` pairs within the same rule. Pseudo-elements, gradients, shadow chains, and inherited `color` from ancestors are out of scope for v1 — call them out so a future contributor knows the boundary. The hardcoded pair list from §3.6 remains the safety net for these gaps.

- [ ] **Step 3 — Wire role-parity check.** Iterate every key under `color.*` in `crt-green.json`; assert presence under `color.*` in every other theme file. Fail with `MISSING_ROLE: <role> in <theme>`.

- [ ] **Step 4 — Wire per-theme contrast.** Reuse the existing `contrast-check.mjs` pair list (spec §3.6) but resolve each token through the theme being checked, not just `crt-green`. Extract a `resolveToken(name, theme)` helper into a shared module so `contrast-check.mjs` and `check-theme-contract.mjs` agree on resolution order.

- [ ] **Step 5 — CI wiring.** Confirm the gate already runs in PR A's CI workflow; if not, add a step `pnpm check:theme-contract`. Make sure the gate runs AFTER `pnpm tokens:build` so `dist/tokens.css` exists.

- [ ] **Step 6 — Run the gate against the real `crt-amber.json` from Task 3.** Any failure means either Task 3 is wrong (re-map the role) or the architect-reviewer concern just paid for itself (a real component pair fails in amber — file an inline note + fix it before merging).

- [ ] **Step 7:** `code-review:code-review`, commit: `feat(ds-scripts): extend theme contract gate with per-theme contrast + CSS-pair extraction`.

---

## Task 5: `ThemeSwitcher.client.tsx`

**Files:**
- Create: `app/design-system/_components/ThemeSwitcher.client.tsx`
- Create: `__tests__/ThemeSwitcher.test.tsx`

Budget per spec §5.11: ~500 B gzipped. That rules out third-party state libs, animation libs, and any non-trivial markup. Pure DOM mutation + persistence.

Persistence order:
1. **DOM mutation first** (instant; no network/storage wait).
2. **localStorage write** (best-effort; wrapped in try/catch).
3. **Cookie write via `/api/theme`** (fire-and-forget `fetch`; survives a hard reload + reaches SSR for the next navigation).

Initial state: read `document.documentElement.dataset.theme` (set by SSR layout from cookie — see Task 6). Never default to a hardcoded string in JS — that's the hydration-mismatch trap (failure mode 9).

- [ ] **Step 1 — Write the failing test first.** `__tests__/ThemeSwitcher.test.tsx`:

  ```tsx
  // __tests__/ThemeSwitcher.test.tsx
  import { render, screen } from '@testing-library/react';
  import userEvent from '@testing-library/user-event';
  import { vi } from 'vitest';
  import { ThemeSwitcher } from '@/app/design-system/_components/ThemeSwitcher.client';

  describe('ThemeSwitcher', () => {
    beforeEach(() => {
      document.documentElement.dataset.theme = 'crt-green';
      localStorage.clear();
    });

    it('mutates documentElement.dataset.theme on toggle', async () => {
      render(<ThemeSwitcher />);
      await userEvent.click(screen.getByRole('button', { name: /crt-amber/i }));
      expect(document.documentElement.dataset.theme).toBe('crt-amber');
    });

    it('persists to localStorage', async () => {
      render(<ThemeSwitcher />);
      await userEvent.click(screen.getByRole('button', { name: /crt-amber/i }));
      expect(localStorage.getItem('theme')).toBe('crt-amber');
    });

    it('falls back to cookie when localStorage throws (private mode)', async () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('QuotaExceeded');
      });
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(new Response());
      render(<ThemeSwitcher />);
      await userEvent.click(screen.getByRole('button', { name: /crt-amber/i }));
      expect(document.documentElement.dataset.theme).toBe('crt-amber'); // still updates
      expect(fetchSpy).toHaveBeenCalledWith('/api/theme', expect.objectContaining({ method: 'POST' }));
    });

    it('rejects invalid theme values (defense against tampered storage)', () => {
      localStorage.setItem('theme', '"><script>alert(1)</script>');
      render(<ThemeSwitcher />);
      // initial state ignores the bad cookie; stays on whatever the SSR attr says
      expect(document.documentElement.dataset.theme).toBe('crt-green');
    });

    it('reads initial state from documentElement.dataset.theme, not a hardcoded default', () => {
      document.documentElement.dataset.theme = 'crt-amber';
      render(<ThemeSwitcher />);
      // The active radio reflects the SSR-set theme
      expect(screen.getByRole('radio', { name: /crt-amber/i })).toBeChecked();
    });
  });
  ```

- [ ] **Step 2 — Implement the component to make the tests pass.**

  ```tsx
  // app/design-system/_components/ThemeSwitcher.client.tsx
  'use client';

  import { useState, useCallback } from 'react';
  import styles from './ThemeSwitcher.module.css';

  const THEMES = ['crt-green', 'crt-amber'] as const;
  type Theme = (typeof THEMES)[number];

  function isTheme(value: unknown): value is Theme {
    return typeof value === 'string' && (THEMES as readonly string[]).includes(value);
  }

  function readInitial(): Theme {
    if (typeof document === 'undefined') return 'crt-green';
    const attr = document.documentElement.dataset.theme;
    return isTheme(attr) ? attr : 'crt-green';
  }

  export function ThemeSwitcher() {
    const [theme, setThemeState] = useState<Theme>(readInitial);

    const apply = useCallback((next: Theme) => {
      // 1. DOM mutation — instant feedback, no await.
      document.documentElement.dataset.theme = next;
      setThemeState(next);

      // 2. localStorage — best-effort; private mode + quota throws.
      try {
        localStorage.setItem('theme', next);
      } catch {
        /* fall through to cookie */
      }

      // 3. Cookie via tiny edge route — survives reload, reaches SSR.
      // Fire-and-forget; no await; no error surfaced (cookie persistence
      // is a progressive enhancement on top of DOM mutation).
      void fetch('/api/theme', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ theme: next }),
        // keepalive ensures the request survives a quick navigation
        keepalive: true,
      }).catch(() => {});
    }, []);

    return (
      <fieldset className={styles.root}>
        <legend className={styles.legend}>Theme</legend>
        {THEMES.map((value) => (
          <label key={value} className={styles.option}>
            <input
              type="radio"
              name="ds-theme"
              value={value}
              checked={theme === value}
              onChange={() => apply(value)}
              className={styles.input}
            />
            <span className={styles.label}>{value}</span>
          </label>
        ))}
      </fieldset>
    );
  }
  ```

  Use radio inputs, not a custom button group. Native `<fieldset>` + `<legend>` carries the a11y grouping for free, satisfies axe, and ships smaller than any custom equivalent.

- [ ] **Step 3 — Companion `ThemeSwitcher.module.css`.** Semantic tokens only (boundary lint from PR A will reject primitives). Keep it minimal: radio styling, focus-visible ring with `--ds-color-signal`, 44px touch target.

- [ ] **Step 4 — Verify gzipped size.** `pnpm build && gzip -c .next/static/chunks/...ThemeSwitcher* | wc -c`. Target ≤ 500 B. If over, the most likely cause is React JSX runtime overhead — measure delta vs an empty client component to confirm the budget is realistic. If realistically 700 B, update spec §5.11 and DECISIONS.md; do NOT silently overshoot.

- [ ] **Step 5:** `code-review:code-review`, commit: `feat(ds): add ThemeSwitcher client island for /design-system/themes`.

---

## Task 6: SSR-safe theme cookie in root layout

**Files:**
- Modify: `app/layout.tsx`
- Create: `app/api/theme/route.ts`
- Create: `__tests__/theme-cookie-ssr.test.ts`

Per spec §7.4 failure mode 1, the root layout must read the cookie SSR-side and set `data-theme` on `<html>` BEFORE any client code runs. No `<script>` snippet hack — `cookies()` from `next/headers` runs at request time during SSR, the attribute is in the HTML payload that hits the browser, the client switcher reads back from the DOM without ever owning the initial value.

- [ ] **Step 1 — Write the failing test.** `__tests__/theme-cookie-ssr.test.ts`:

  ```ts
  // __tests__/theme-cookie-ssr.test.ts
  import { describe, it, expect, vi } from 'vitest';
  import { renderToStaticMarkup } from 'react-dom/server';

  // Mock next/headers cookies() to return a controllable value.
  vi.mock('next/headers', () => ({
    cookies: vi.fn(),
  }));

  import { cookies } from 'next/headers';
  import RootLayout from '@/app/layout';

  describe('RootLayout theme cookie SSR', () => {
    it('defaults to crt-green when no cookie present', async () => {
      (cookies as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        get: () => undefined,
      });
      const html = renderToStaticMarkup(await RootLayout({ children: 'x' }));
      expect(html).toContain('data-theme="crt-green"');
    });

    it('honors a valid crt-amber cookie', async () => {
      (cookies as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        get: () => ({ value: 'crt-amber' }),
      });
      const html = renderToStaticMarkup(await RootLayout({ children: 'x' }));
      expect(html).toContain('data-theme="crt-amber"');
    });

    it('falls back to crt-green when cookie value is not in the allowlist', async () => {
      (cookies as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        get: () => ({ value: 'evil-theme<script>' }),
      });
      const html = renderToStaticMarkup(await RootLayout({ children: 'x' }));
      expect(html).toContain('data-theme="crt-green"');
      expect(html).not.toContain('evil-theme');
    });
  });
  ```

- [ ] **Step 2 — Modify `app/layout.tsx` to read the cookie.**

  ```tsx
  // app/layout.tsx (relevant diff only)
  import { cookies } from 'next/headers';

  const THEMES = ['crt-green', 'crt-amber'] as const;
  type Theme = (typeof THEMES)[number];

  async function readThemeCookie(): Promise<Theme> {
    const store = await cookies();
    const raw = store.get('theme')?.value;
    return (THEMES as readonly string[]).includes(raw ?? '') ? (raw as Theme) : 'crt-green';
  }

  export default async function RootLayout({
    children,
  }: Readonly<{ children: React.ReactNode }>) {
    const theme = await readThemeCookie();
    return (
      <html
        lang="en"
        data-theme={theme}
        className={`${mono.variable} ${display.variable}`}
        suppressHydrationWarning
      >
        {/* ...existing head + body... */}
      </html>
    );
  }
  ```

  **Note:** `RootLayout` becomes `async` (was sync). This is a Next 16 RSC-compatible change; no client islands break because nothing imports `RootLayout` as a component.

- [ ] **Step 3 — Create `app/api/theme/route.ts`.** Edge runtime. POST validates the body against the allowlist, sets the cookie with `httpOnly: false` (so the switcher can also read it without a roundtrip on subsequent loads), `sameSite: 'lax'`, `secure: true` in production, 1-year `maxAge`. Reject everything else with 400. Single ~30-line file.

  ```ts
  // app/api/theme/route.ts
  import { NextResponse } from 'next/server';
  import { cookies } from 'next/headers';

  export const runtime = 'edge';

  const THEMES = ['crt-green', 'crt-amber'] as const;

  export async function POST(req: Request) {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
    }
    const theme =
      body && typeof body === 'object' && 'theme' in body ? (body as { theme: unknown }).theme : null;
    if (typeof theme !== 'string' || !(THEMES as readonly string[]).includes(theme)) {
      return NextResponse.json({ error: 'invalid_theme' }, { status: 400 });
    }
    const store = await cookies();
    store.set('theme', theme, {
      httpOnly: false,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 365, // 1 year
      path: '/',
    });
    return NextResponse.json({ ok: true, theme });
  }
  ```

  Add a route-level unit test under `__tests__/api/theme.route.test.ts`: valid → 200, invalid theme → 400, missing body → 400, invalid JSON → 400.

- [ ] **Step 4 — Verify with Playwright (manual once, automated in Task 8):** load `/design-system/themes`, switch to amber, hard-reload, screenshot first paint — `data-theme="crt-amber"` MUST be present on `<html>` in the very first byte of HTML. If a flash is visible, the cookie/SSR wiring is broken — do NOT ship.

- [ ] **Step 5:** `code-review:code-review`, commit: `feat(ds-themes): SSR-safe theme cookie hydration in root layout`.

---

## Task 7: `/design-system/themes` page

**Files:**
- Create: `app/design-system/themes/page.mdx`
- Create: `app/design-system/themes/page.module.css`

Per spec §5.1 the page is "Theme variant gallery: `crt-green` (canonical) and `crt-amber` (demo). Live switcher; tokens diffed side-by-side."

- [ ] **Step 1 — MDX structure.**

  ```mdx
  // app/design-system/themes/page.mdx
  import { ThemeSwitcher } from '../_components/ThemeSwitcher.client';
  import { Preview } from '../_components/Preview';
  import { TokenDiffTable } from '../_components/TokenDiffTable';
  import { Button } from '@/design-system/components/Button';
  import { Badge } from '@/design-system/components/Badge';
  import { TerminalPanel } from '@/design-system/components/TerminalPanel';
  import { CmdLine } from '@/design-system/components/CmdLine';
  import { Link as DsLink } from '@/design-system/components/Link';
  import styles from './page.module.css';

  export const metadata = {
    title: 'Themes — Design System',
    description:
      'Theme variants for erikunha.dev design system: CRT green (canonical) and CRT amber (demo). The two-tier token architecture means a new theme is one semantic-mapping file plus one primitive ramp — zero component changes.',
    alternates: { canonical: 'https://erikunha.dev/design-system/themes' },
  };

  # Themes

  The two-tier token architecture from PR A is the substrate. A theme is a single
  JSON file that re-maps semantic roles to a different primitive ramp. The
  `crt-amber` theme below ships zero component-level changes — every primitive
  picks up the new signal hue automatically because they consume semantic tokens
  only.

  ## Live switcher

  <div className={styles.switcherRow}>
    <ThemeSwitcher />
    <p className={styles.note}>
      Switcher is scoped to <code>/design-system/themes</code> only. The main
      portfolio stays on <code>crt-green</code> always. Theme persists across
      reloads via cookie + localStorage; SSR sets <code>data-theme</code> on{' '}
      <code>&lt;html&gt;</code> so there's no flash-of-wrong-theme.
    </p>
  </div>

  ## Gallery

  Every primitive renders below under whichever theme is currently active.

  <Preview>
    <TerminalPanel header="[ THEME PREVIEW ]">
      <CmdLine user="erik@portfolio" command="theme --current" output="crt-amber" />
      <Badge variant="dot">SIGNAL</Badge>
      <Button variant="primary">EXEC_HIRE</Button>
      <Button variant="secondary">VIEW_PROJECTS</Button>
      <DsLink href="#tokens" variant="inline">jump to token diff</DsLink>
    </TerminalPanel>
  </Preview>

  ## Token diff {#tokens}

  Side-by-side: every semantic role and the primitive it maps to in each theme.

  <TokenDiffTable
    themes={['crt-green', 'crt-amber']}
    /* Reads from design-system/dist/tokens.json at build time */
  />

  ## Why amber

  `#FFB000` is the canonical IBM 5151 / DEC VT220 amber-phosphor color (~590nm).
  The green theme is P1 phosphor (`#00FF41`). Picking the historical reference
  anchors both themes in the same era — the alt-mode reads as deliberate, not
  arbitrary.

  ## Adding a third theme

  See [enforcement](/design-system/enforcement) for the theme-contract gate.
  The minimum requirement is one new primitive ramp under `color.json` and one
  new file under `tokens/themes/<name>.json` mapping every semantic role from{' '}
  <code>crt-green</code>. CI fails on missing roles or contrast regressions.
  ```

- [ ] **Step 2 — `TokenDiffTable`** is a RSC component. Reads `design-system/dist/tokens.json` at build time, walks `crt-green` and `crt-amber` semantic sections, renders an HTML table with role | green primitive | amber primitive | "✓ same" / "→ diff" indicator. If it doesn't exist yet (PR C didn't ship it), add it as part of this task under `app/design-system/_components/TokenDiffTable.tsx` — pure RSC, ~40 LoC, no client JS.

- [ ] **Step 3 — `page.module.css`** — semantic tokens only. Switcher row + note styling + responsive layout. ~30 lines.

- [ ] **Step 4 — Lighthouse a11y = 100** on the route locally before pushing. Heading hierarchy (h1 once, h2 for sections, no skipped levels). Switcher fieldset/legend already a11y-correct from Task 5.

- [ ] **Step 5:** `code-review:code-review`, commit: `feat(ds-docs): add /design-system/themes route with live switcher`.

---

## Task 8: Visual baselines per theme + e2e + a11y

**Files:**
- Modify: `tests/e2e/design-system-components.spec.ts` (from PR B)
- Modify: `tests/e2e/design-system-pages.spec.ts` (from PR C)
- Modify: `tests/a11y/axe.spec.ts`

- [ ] **Step 1 — Extend the component visual matrix** in `tests/e2e/design-system-components.spec.ts`:

  ```ts
  // tests/e2e/design-system-components.spec.ts (extension)
  const THEMES = ['crt-green', 'crt-amber'] as const;
  const PRIMITIVES = ['Button', 'Field', 'Badge', 'TerminalPanel', 'StatTile', 'CmdLine', 'KbdKey', 'Link'];

  for (const theme of THEMES) {
    test.describe(`primitives @ ${theme}`, () => {
      test.beforeEach(async ({ page }) => {
        // Set cookie BEFORE first navigation so SSR picks it up — no flash.
        await page.context().addCookies([
          { name: 'theme', value: theme, url: 'http://localhost:3000' },
        ]);
      });

      for (const primitive of PRIMITIVES) {
        test(`${primitive} matches baseline`, async ({ page }) => {
          await page.goto(`/design-system/components#${primitive.toLowerCase()}`);
          const locator = page.getByTestId(`primitive-${primitive}`);
          await expect(locator).toHaveScreenshot(`${primitive}-${theme}.png`);
        });
      }
    });
  }
  ```

  Generate baselines: `pnpm test:e2e --update-snapshots` then **manually review** each new `*-crt-amber.png` against its `*-crt-green.png` counterpart. The diff should be hue-only on signal/border/accent surfaces; if shape or layout differs, a token resolved to a different value-class (alpha became solid, or vice versa) — fix in `crt-amber.json`, do NOT accept the baseline.

- [ ] **Step 2 — Add themes-route smoke + switcher persistence** in `tests/e2e/design-system-pages.spec.ts`:

  ```ts
  test('themes route loads and switcher persists across reload', async ({ page }) => {
    await page.goto('/design-system/themes');
    // SSR default
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'crt-green');
    // Toggle
    await page.getByRole('radio', { name: /crt-amber/i }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'crt-amber');
    // Hard reload — SSR must serve amber from cookie, no flash
    await page.reload({ waitUntil: 'commit' });
    // Assert the very first paint already has amber (no client hydration involved)
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'crt-amber');
  });

  test('main portfolio routes ignore theme cookie', async ({ page }) => {
    await page.context().addCookies([
      { name: 'theme', value: 'crt-amber', url: 'http://localhost:3000' },
    ]);
    await page.goto('/');
    // Spec §3.9 + §7.4: main portfolio stays on crt-green always
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'crt-green');
  });
  ```

  **Note on the second test:** the spec says "The portfolio itself stays on `crt-green` always" (§3.9). The simplest implementation: `RootLayout` honors the cookie everywhere (Task 6) but a small middleware-equivalent in `app/(portfolio)/layout.tsx` (or per-segment metadata) overrides back to `crt-green` for non-DS routes. **Decision point:** if this requires a layout-group restructure of the existing portfolio, escalate before implementing. Cheaper alternative: the root layout reads cookie ONLY when the request path starts with `/design-system`, using `headers()` to read the URL path. Recommended — single-file change. Document the choice in DECISIONS.md.

- [ ] **Step 3 — Extend a11y scan** in `tests/a11y/axe.spec.ts`:

  ```ts
  const DS_ROUTES = [
    '/design-system',
    '/design-system/tokens',
    '/design-system/components',
    '/design-system/themes',  // PR D
    '/design-system/enforcement',
    '/design-system/changelog',
  ];
  ```

  Run axe under both themes for `/design-system/themes` specifically (cookie set in beforeEach) — a11y violations can be theme-specific (color-contrast rule).

- [ ] **Step 4:** `code-review:code-review`, commit: `test(ds-themes): visual baselines + e2e + a11y for theme variants`.

---

## Task 9: Bundle gate — confirm zero delta on `/`

**Files:**
- Verify: existing `pnpm bundle-check` covers per-route diffs (PR B established this)

- [ ] **Step 1 — Establish baseline.** On the PR D branch base (post-PR-C, pre-PR-D), record the gzipped bundle for `/`, `/design-system`, `/design-system/themes` (will be 404 pre-PR-D — skip).

- [ ] **Step 2 — After PR D changes are in place, re-run.** Required:
  - `/` route gzipped client JS: **0-byte delta** vs PR-C baseline (spec §7.4 failure mode 5).
  - `/design-system` route: 0-byte delta (switcher is NOT mounted here).
  - `/design-system/themes` route: ≤ +500 B gzipped for the switcher (spec §5.11 budget).

- [ ] **Step 3 — If `/` regresses**, the most likely cause is the root layout import chain pulling something theme-related into the main bundle. Diagnostic: `pnpm build --analyze` (or `@next/bundle-analyzer`), look for the new ThemeSwitcher chunk on the `/` route's tree. Fix: confirm `ThemeSwitcher.client.tsx` lives under `app/design-system/_components/` (route-group-scoped), not in `components/`, and is only imported from MDX files under `app/design-system/themes/`.

- [ ] **Step 4 — Add a regression gate.** Extend `scripts/check-bundle-size.*` (or equivalent) so the 0-byte delta on `/` is enforced in CI. If PR B already wired per-route diffs, this is a one-line addition for the themes route budget.

- [ ] **Step 5:** Commit only if bundle-check passes: `chore(ds-themes): wire bundle gate for ThemeSwitcher route scope`.

---

## Task 10: Sitemap, llms.txt, lighthouse — register themes route

**Files:**
- Modify: `app/sitemap.ts`
- Modify: `public/llms.txt`
- Modify: `lighthouserc.json` (and `lighthouserc.mobile.json` if it exists with per-route URLs)

- [ ] **Step 1 — `app/sitemap.ts`:** add the themes URL. Note: the current sitemap (lines 3-14) only emits `https://erikunha.dev`. PR C should have already extended this to include the design-system routes; PR D adds one more entry.

  ```ts
  {
    url: 'https://erikunha.dev/design-system/themes',
    lastModified: process.env.CONTENT_UPDATED_AT
      ? new Date(process.env.CONTENT_UPDATED_AT)
      : new Date('2026-05-23'),
    changeFrequency: 'monthly',
    priority: 0.7,
  }
  ```

- [ ] **Step 2 — `public/llms.txt`:** under the `/design-system/*` section (added in PR C), add a bullet for themes:

  ```
  - /design-system/themes — Theme variant gallery and live switcher.
    CRT green (canonical) and CRT amber (demo). Demonstrates the two-tier
    token architecture: a new theme is one semantic-mapping file plus one
    primitive ramp, zero component changes. SSR-safe (no flash-of-wrong-theme).
  ```

- [ ] **Step 3 — `lighthouserc.json`:** add `/design-system/themes` to the `urls` array (currently only `http://localhost:3000` — depends on PR C extending this; if not extended, add the URL alongside the others).

- [ ] **Step 4 — Verify LHCI locally:** `pnpm lhci` should run all DS routes including themes and pass perf ≥ 95, a11y = 100 (spec §10).

- [ ] **Step 5:** `code-review:code-review`, commit: `chore(ds-themes): register /design-system/themes in sitemap, llms.txt, LHCI`.

---

## Task 11: DECISIONS.md + ARCHITECTURE.md

**Files:**
- Modify: `DECISIONS.md`
- Modify: `ARCHITECTURE.md`

- [ ] **Step 1 — DECISIONS.md.** Append (one bullet per CLAUDE.md convention):

  ```md
  - 2026-05-23 — Themes: shipped CRT-amber alt-theme via two-tier tokens (one
    primitive ramp + one semantic file; zero component edits). Switcher is a
    ~500 B client island scoped to `/design-system/themes` only; main portfolio
    stays on `crt-green` always. Persistence is cookie + localStorage; SSR
    reads cookie in `RootLayout` to eliminate flash-of-wrong-theme.
    Reversibility: high (pure-additive route + tokens).
  ```

- [ ] **Step 2 — ARCHITECTURE.md.** Add a short subsection under the design-system section pointing to spec §3.9 + the `themes/` directory; don't duplicate spec content.

- [ ] **Step 3:** `code-review:code-review`, commit: `docs(ds-themes): record theme variant decision and architecture pointer`.

---

## Task 12: Pre-merge gate — ready-to-merge

- [ ] **Step 1:** `pnpm ci:local` — full lint + typecheck + content validate + tests.
- [ ] **Step 2:** Playwright local check per CLAUDE.md PR merge gate item 8: visit `/design-system/themes` on desktop (1280×720) AND mobile (375×812); toggle the switcher; hard-reload; confirm no flash. Visit `/` and confirm `data-theme="crt-green"` regardless of cookie state.
- [ ] **Step 3:** `pnpm ready-to-merge <pr-number>` — runs CI gates + branch protection + unresolved-thread check. Required: 0 unresolved threads.
- [ ] **Step 4:** `git fetch && git rebase origin/main` (per CLAUDE.md merge gate item 9 — non-dependabot rebase before merge).
- [ ] **Step 5:** Re-request Copilot review per CLAUDE.md merge gate item 7 after any feedback push: `gh pr edit <pr> --add-reviewer copilot-pull-request-reviewer`. Reply to each resolved thread with the fix SHA + one-sentence technical reason. No PR-level comment.

---

## Self-review

Cross-checked against the spec:

- **§3.9 (theme variants):** Covered. Primitive ramp (Task 2), semantic file (Task 3), Style Dictionary per-theme output (Task 3 Step 2), switcher with cookie + localStorage (Task 5), SSR cookie + `<html data-theme>` (Task 6), theme-contract gate (Task 4). The "main portfolio stays on `crt-green` always" requirement is honored in Task 8 Step 2 with an explicit decision point.
- **§3.6 + §7.4 failure modes:** All 5 listed failure modes from §7.4 map to specific tasks/tests (Task 1 inversion table). Architect-reviewer concern (component-CSS pair extraction) is its own sub-task in Task 4.
- **§5.1 + §5.8 + §5.11 (docs route):** Themes route created (Task 7); a11y matrix extended (Task 8); perf budget (≤ 500 B switcher) verified in Task 5 Step 4 + Task 9.
- **§7.4 file list:** Every file from the spec's PR D inventory has a corresponding task. The `/api/theme/route.ts` and `TokenDiffTable.tsx` files are NOT in the spec's explicit list but are required by §3.9 (cookie persistence mechanism) and §5.1 (tokens diffed side-by-side) — both flagged in the file map with rationale.
- **§12 (acceptance criteria PR D):** All four PR-D checkboxes from §12 map to specific task gates. Cross-cutting items (LH perf ≥ 95 on `/`, client JS on `/` unchanged) covered by Task 9.

Open questions for Erik before/during execution:

1. **Where does the "portfolio stays on crt-green" decision land?** Task 8 Step 2 sketches two options (layout-group split vs cookie-scope-by-path). The cheaper option is path-scoped cookie reading in `RootLayout` — recommend that path, but flag here in case there's an architectural reason to prefer route-group restructure.
2. **Switcher gzipped budget realism.** Spec says ~500 B. React JSX runtime + radio markup may push to ~700 B. If so, Task 5 Step 4 says to update the spec and DECISIONS.md rather than overshoot silently — confirm that's the right call vs trimming the markup further (e.g. native button group with `aria-pressed` instead of radios).
3. **`TokenDiffTable` ownership.** If PR C didn't ship it, PR D introduces it as a small RSC component (Task 7 Step 2). If that crosses into "Task is also building a docs primitive," consider moving it into a PR-C amendment instead so PR D stays narrowly themes-focused. Recommend keeping in PR D since the consumer (themes page) doesn't exist anywhere else yet.
