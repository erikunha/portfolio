# Font Size Normalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace ~100 raw `font-size` px values across 8 CSS files with 9 CSS custom property tokens defined once in `_tokens.css`.

**Architecture:** Add a 9-step T-shirt scale (`--fs-2xs` through `--fs-3xl`) to `_tokens.css :root`, add mobile overrides for `--fs-3xl` and `--fs-2xl` in the existing `@media (max-width: 768px)` block in `_base.css`, then replace every raw `font-size` px value in each CSS file using the snapping map. Two intentional exceptions are left as raw px: `html, body { font-size: 16px }` (the rem anchor) and `font-size: inherit` (cascade passthrough in shell chip hints).

**Tech Stack:** CSS custom properties, no JS, no build step changes.

---

## Snapping reference (carry this across all tasks)

| Raw value(s) | Token |
|---|---|
| 9px, 9.5px | `var(--fs-2xs)` |
| 10px, 10.5px, 11px, 11.5px | `var(--fs-xs)` |
| 12px, 12.5px | `var(--fs-sm)` |
| 13px, 13.5px, 14px, 15px | `var(--fs-base)` |
| 16px | `var(--fs-md)` |
| 18px, 20px, 22px | `var(--fs-lg)` |
| 26px, 28px, 32px | `var(--fs-xl)` |
| 36px, 38px | `var(--fs-xl)` |
| 48px | `var(--fs-2xl)` |
| 56px | `var(--fs-3xl)` (mobile override only) |
| 78px | `var(--fs-3xl)` |

---

## Task 1: Add token scale to `_tokens.css`

**Files:**
- Modify: `app/css/_tokens.css`

- [ ] **Step 1: Add the 9 tokens to `:root`**

In `app/css/_tokens.css`, append inside the existing `:root {}` block (after the `--font-display-stack` line):

```css
  --fs-2xs:  9px;
  --fs-xs:  11px;
  --fs-sm:  12px;
  --fs-base: 14px;
  --fs-md:  16px;
  --fs-lg:  22px;
  --fs-xl:  32px;
  --fs-2xl: 48px;
  --fs-3xl: 78px;
```

- [ ] **Step 2: Verify the file parses — no new values yet**

Run: `pnpm build 2>&1 | head -20`  
Expected: build completes with no CSS parse errors (tokens are unused at this point).

- [ ] **Step 3: Commit**

```bash
git add app/css/_tokens.css
git commit -m "feat(tokens): add 9-step font-size scale (--fs-2xs through --fs-3xl)"
```

---

## Task 2: Update `_base.css`

**Files:**
- Modify: `app/css/_base.css`

- [ ] **Step 1: Replace `h1` font sizes and `skip-to-content`**

Current `_base.css` has these raw font-size values to replace:
- Line 68: `font-size: 16px;` on `.skip-to-content` → `var(--fs-md)`
- Line 102: `font-size: 48px;` on `h1` → `var(--fs-2xl)`
- Line 113: `font-size: 32px;` on `h1` inside `@media (max-width: 768px)` → `var(--fs-2xl)`

Make all three changes:

```css
/* skip-to-content — was 16px */
.skip-to-content {
  /* ... existing rules ... */
  font-size: var(--fs-md);
  /* ... */
}

/* h1 — was 48px */
h1 {
  font-size: var(--fs-2xl);
  font-family: var(--font-display-stack);
  font-weight: 900;
}

/* h1 mobile override — was 32px */
@media (max-width: 768px) {
  :root {
    --vrhythm: 18px;
    --pad: 14px;
  }
  h1 {
    font-size: var(--fs-2xl);
  }
}
```

- [ ] **Step 2: Add mobile token overrides to the existing `:root` media block**

In the same `@media (max-width: 768px)` `:root` block (the one that overrides `--vrhythm` and `--pad`), add the two hero/title responsive overrides:

```css
@media (max-width: 768px) {
  :root {
    --vrhythm: 18px;
    --pad: 14px;
    --fs-3xl: 56px;
    --fs-2xl: 32px;
  }
  h1 {
    font-size: var(--fs-2xl);
  }
}
```

This means `var(--fs-3xl)` resolves to 78px on desktop and 56px on mobile; `var(--fs-2xl)` resolves to 48px on desktop and 32px on mobile — matching the current rendered output exactly.

- [ ] **Step 3: Verify no stray raw font-sizes remain**

```bash
grep -n "font-size:" app/css/_base.css
```

Expected output — only these two intentional raw-px lines remain:
```
20:  font-size: 16px;   ← html, body rem anchor — intentional exception
```
All other `font-size:` lines should show `var(--fs-*)`.

- [ ] **Step 4: Commit**

```bash
git add app/css/_base.css
git commit -m "feat(tokens): normalize font-size in _base.css"
```

---

## Task 3: Update `_chrome.css`

**Files:**
- Modify: `app/css/_chrome.css`

- [ ] **Step 1: Replace all raw font-size values**

Apply the snapping map to every `font-size` declaration in `_chrome.css`:

| Selector | Old | New |
|---|---|---|
| `.topbar__tab` | `12px` | `var(--fs-sm)` |
| `.topbar__navlink` | `12px` | `var(--fs-sm)` |
| `.topbar__motion` | `11px` | `var(--fs-xs)` |
| `.topbar__btn-primary` | `12px` | `var(--fs-sm)` |
| `.topbar__btn-outline` | `11px` | `var(--fs-xs)` |
| `.statusbar` | `11px` | `var(--fs-xs)` |
| `.statusbar__time` | `12px` | `var(--fs-sm)` |
| `.statusbar__carrier` | `11px` | `var(--fs-xs)` |
| `.statusbar__cell` | `10px` | `var(--fs-xs)` |
| `.statusbar__battery-num` | `10.5px` | `var(--fs-xs)` |
| `.dock a` | `9px` | `var(--fs-2xs)` |

- [ ] **Step 2: Verify**

```bash
grep -n "font-size:" app/css/_chrome.css
```

Expected: every line shows `var(--fs-*)`, no raw px values.

- [ ] **Step 3: Commit**

```bash
git add app/css/_chrome.css
git commit -m "feat(tokens): normalize font-size in _chrome.css"
```

---

## Task 4: Update `_shell.css`

**Files:**
- Modify: `app/css/_shell.css`

- [ ] **Step 1: Replace all raw font-size values**

Apply the snapping map:

| Selector | Old | New |
|---|---|---|
| `.shell` | `13px` | `var(--fs-base)` |
| `.shell__bar` | `11px` | `var(--fs-xs)` |
| `.shell__prompt` | `13px` | `var(--fs-base)` |
| `.shell__input` | `13px` | `var(--fs-base)` |
| `.shell__placeholder-anim` | `13px` | `var(--fs-base)` |
| `.shell__chip` | `10px` | `var(--fs-xs)` |
| `.shell__commands` | `11px` | `var(--fs-xs)` |
| `.shell__feed` (mobile `@media`) | `11.5px` | `var(--fs-xs)` |
| `.shell__prompt` (mobile `@media`) | `11.5px` | `var(--fs-xs)` |
| `.shell__input` (mobile `@media`) | `12px` | `var(--fs-sm)` |

**Exception — do NOT touch:** `font-size: inherit` on `.shell__cmd-hint`. Leave as-is.

- [ ] **Step 2: Verify**

```bash
grep -n "font-size:" app/css/_shell.css
```

Expected: all lines show `var(--fs-*)` except the one `inherit` line:
```
211:  font-size: inherit;   ← intentional cascade passthrough
```

- [ ] **Step 3: Commit**

```bash
git add app/css/_shell.css
git commit -m "feat(tokens): normalize font-size in _shell.css"
```

---

## Task 5: Update `_sections.css`

**Files:**
- Modify: `app/css/_sections.css`

This is the largest file (~90 font-size declarations). Work top-to-bottom using the snapping map.

- [ ] **Step 1: Replace all font-size values in `_sections.css`**

Full replacement list (by selector / context):

| Selector | Old | New |
|---|---|---|
| `.manpage pre` | `14px` | `var(--fs-base)` |
| `.manpage--mobile` | `12px` | `var(--fs-sm)` |
| `.manpage--mobile .mp-head` | `10px` | `var(--fs-xs)` |
| `.manpage--mobile .mp-body` | `11.5px` | `var(--fs-xs)` |
| `.manpage--mobile .mp-flag` | `11px` | `var(--fs-xs)` |
| `.manpage--mobile .mp-desc` | `11.5px` | `var(--fs-xs)` |
| `.manpage--mobile .mp-ex-line` | `11px` | `var(--fs-xs)` |
| `.manpage--mobile .mp-bugs` | `11.5px` | `var(--fs-xs)` |
| `.visa pre` | `13px` | `var(--fs-base)` |
| `.visa-foot` | `12px` | `var(--fs-sm)` |
| `.readme` | `14px` | `var(--fs-base)` |
| `.readme__row--h1` | `20px` | `var(--fs-lg)` |
| `.readme__row--h2` | `15px` | `var(--fs-base)` |
| `.codesample__bar` | `11px` | `var(--fs-xs)` |
| `.codesample__pre` | `12.5px` | `var(--fs-sm)` |
| `.nowblock` | `13px` | `var(--fs-base)` |
| `.stat .slbl` | `11px` | `var(--fs-xs)` |
| `.stat .sval` | `22px` | `var(--fs-lg)` |
| `.stat .sval` (`@media 900px`) | `16px` | `var(--fs-md)` |
| `.perf-cell .pk` | `11px` | `var(--fs-xs)` |
| `.perf-cell .pv` | `32px` | `var(--fs-xl)` |
| `.perf-cell .pv .of` | `14px` | `var(--fs-base)` |
| `.perf-foot` | `11px` | `var(--fs-xs)` |
| `.perf-cell .pv` (`@media 900px`) | `26px` | `var(--fs-xl)` |
| `.npm-stack li` | `10px` | `var(--fs-xs)` |
| *(git-log section)* `11px` | `11px` | `var(--fs-xs)` |
| *(git-log section)* `16px` | `16px` | `var(--fs-md)` |
| *(git-log section)* `13px` | `13px` | `var(--fs-base)` |
| *(git-log section)* `12px` | `12px` | `var(--fs-sm)` |
| *(projects section)* `10px` | `10px` | `var(--fs-xs)` |
| *(projects section)* `14px` | `14px` | `var(--fs-base)` |
| *(projects section)* `12px` | `12px` | `var(--fs-sm)` |
| *(projects section)* `11px` | `11px` | `var(--fs-xs)` |
| *(projects section)* `12.5px` | `12.5px` | `var(--fs-sm)` |
| *(projects section)* `12px` (2nd) | `12px` | `var(--fs-sm)` |
| *(takes section)* `12px` | `12px` | `var(--fs-sm)` |
| *(takes section)* `12.5px` | `12.5px` | `var(--fs-sm)` |
| *(takes section)* `12px` (body) | `12px` | `var(--fs-sm)` |
| *(takes section)* `13.5px` | `13.5px` | `var(--fs-base)` |
| *(takes section)* `13px` | `13px` | `var(--fs-base)` |
| *(takes section)* `10.5px` | `10.5px` | `var(--fs-xs)` |
| `.receipt__delta` | `38px` | `var(--fs-xl)` |
| `.receipt__delta--hero` | `78px` | `var(--fs-3xl)` |
| `.receipt__delta--hero` (`@media 900px`) | `56px` | `var(--fs-3xl)` |
| `.receipt__delta` (`@media 768px`) | `22px` | `var(--fs-lg)` |
| `.receipt--hero .receipt__delta--hero` (`@media 768px`) | `36px` | `var(--fs-xl)` |
| `.visa-foot` (`@media 768px`) | `9.5px` | `var(--fs-2xs)` |
| `.receipt__company` | `11px` | `var(--fs-xs)` |
| `.receipt__note` | `12.5px` | `var(--fs-sm)` |
| `.receipt--hero .receipt__note` | `13.5px` | `var(--fs-base)` |
| `.community` | `13.5px` | `var(--fs-base)` |
| `.community .ctitle` | `15px` | `var(--fs-base)` |
| `.community .cstatus` | `12px` | `var(--fs-sm)` |
| `.permatrix .pm-cmd` | `12px` | `var(--fs-sm)` |
| `.permatrix pre` | `13px` | `var(--fs-base)` |
| *(unknowns section)* `11.5px` | `11.5px` | `var(--fs-xs)` |
| *(unknowns section)* `12px` | `12px` | `var(--fs-sm)` |
| *(unknowns section)* `13px` | `13px` | `var(--fs-base)` |
| *(unknowns section)* `12px` (2nd) | `12px` | `var(--fs-sm)` |
| *(unknowns section)* `11.5px` | `11.5px` | `var(--fs-xs)` |
| *(unknowns section)* `13px` (2nd) | `13px` | `var(--fs-base)` |
| *(unknowns section)* `10.5px` | `10.5px` | `var(--fs-xs)` |
| *(unknowns section)* `13.5px` | `13.5px` | `var(--fs-base)` |

- [ ] **Step 2: Verify**

```bash
grep -n "font-size:" app/css/_sections.css | grep -v "var(--fs"
```

Expected: empty output (no raw px values remain).

- [ ] **Step 3: Commit**

```bash
git add app/css/_sections.css
git commit -m "feat(tokens): normalize font-size in _sections.css"
```

---

## Task 6: Update `_layout.css`

**Files:**
- Modify: `app/css/_layout.css`

`_layout.css` has ~55 font-size declarations, mostly in responsive media query blocks for hero, modules, and section-specific layouts.

- [ ] **Step 1: Replace all raw font-size values using the snapping map**

Work top-to-bottom. All values follow the same snapping map. Key clusters to watch:

**Hero section (desktop, ~lines 90-200):**
- `12.5px` → `var(--fs-sm)`
- `9.5px` → `var(--fs-2xs)`
- `11.5px` → `var(--fs-xs)`
- `12.5px` → `var(--fs-sm)`
- `12px` → `var(--fs-sm)`
- `9px` → `var(--fs-2xs)`
- `10.5px` → `var(--fs-xs)`
- `13px` → `var(--fs-base)`
- `11px` → `var(--fs-xs)`
- `9.5px` → `var(--fs-2xs)`
- `22px` → `var(--fs-lg)`
- `9.5px` → `var(--fs-2xs)`
- `12.5px` → `var(--fs-sm)`
- `11.5px` → `var(--fs-xs)`
- `10.5px` → `var(--fs-xs)`
- `9.5px` → `var(--fs-2xs)`
- `11px` → `var(--fs-xs)`
- `10.5px` → `var(--fs-xs)`
- `10.5px` → `var(--fs-xs)`

**Module / section headers (desktop, ~lines 350-700):**
- `14px` → `var(--fs-base)`
- `28px` → `var(--fs-xl)`
- `11px` → `var(--fs-xs)`
- `22px` → `var(--fs-lg)`
- `18px` → `var(--fs-lg)`
- `22px` → `var(--fs-lg)`
- `14px` → `var(--fs-base)`
- `12px` → `var(--fs-sm)`
- `13px` → `var(--fs-base)`
- `14px` → `var(--fs-base)`
- `11px` → `var(--fs-xs)`
- `12px` → `var(--fs-sm)`

**Responsive / mobile overrides (~lines 100-210 and later blocks):**
- `12.5px` → `var(--fs-sm)`
- `9.5px` → `var(--fs-2xs)`
- `12px` → `var(--fs-sm)`
- `10px` → `var(--fs-xs)`
- `11px` → `var(--fs-xs)`
- `11.5px` → `var(--fs-xs)`
- `12.5px` → `var(--fs-sm)`
- `10.5px` → `var(--fs-xs)`
- `12px` → `var(--fs-sm)`
- `14px` → `var(--fs-base)`
- `12.5px` → `var(--fs-sm)`
- `10.5px` → `var(--fs-xs)`
- `12px` → `var(--fs-sm)`
- `12px` → `var(--fs-sm)`
- `10px` → `var(--fs-xs)`
- `9.5px` → `var(--fs-2xs)`
- `11px` → `var(--fs-xs)`
- `10.5px` → `var(--fs-xs)`
- `10.5px` → `var(--fs-xs)`
- `11.5px` → `var(--fs-xs)`
- `9.5px` → `var(--fs-2xs)`
- `11px` → `var(--fs-xs)`
- `12.5px` → `var(--fs-sm)`
- `11.5px` → `var(--fs-xs)`
- `13px` → `var(--fs-base)`
- `12px` → `var(--fs-sm)`
- `10.5px` → `var(--fs-xs)`
- `11px` → `var(--fs-xs)`
- `12px` → `var(--fs-sm)`
- `10px` → `var(--fs-xs)`
- `9.5px` → `var(--fs-2xs)`
- `11px` → `var(--fs-xs)`
- `10.5px` → `var(--fs-xs)`
- `10.5px` → `var(--fs-xs)`

- [ ] **Step 2: Verify**

```bash
grep -n "font-size:" app/css/_layout.css | grep -v "var(--fs"
```

Expected: empty output.

- [ ] **Step 3: Commit**

```bash
git add app/css/_layout.css
git commit -m "feat(tokens): normalize font-size in _layout.css"
```

---

## Task 7: Update `_footer.css`

**Files:**
- Modify: `app/css/_footer.css`

- [ ] **Step 1: Replace all raw font-size values**

| Selector | Old | New |
|---|---|---|
| `.sd-init` | `13.5px` | `var(--fs-base)` |
| `.sd-stamp` | `11.5px` | `var(--fs-xs)` |
| `.sd-cmdline` | `13px` | `var(--fs-base)` |
| `.sp-head` | `11px` | `var(--fs-xs)` |
| `.sp-row` | `12.5px` | `var(--fs-sm)` |
| `.sd-netstat pre` | `12.5px` | `var(--fs-sm)` |
| `.sd-dmesg` | `12.5px` | `var(--fs-sm)` |
| `.sd-dmesg .dm-ok` | `11px` | `var(--fs-xs)` |
| `.sd-halt` | `12px` | `var(--fs-sm)` |
| `.sd-halt-hint` | `11.5px` | `var(--fs-xs)` |
| `.sd-halt-hint kbd` | `11px` | `var(--fs-xs)` |
| `.shutdown-copy` | `12px` | `var(--fs-sm)` |
| `.sp-row` (`@media 900px`) | `12px` | `var(--fs-sm)` |
| `.sd-dmesg .dm-line` (`@media 900px`) | `11.5px` | `var(--fs-xs)` |
| `.sd-netstat pre` (`@media 900px`) | `11.5px` | `var(--fs-xs)` |
| `.sd-init` (`@media 560px`) | `12px` | `var(--fs-sm)` |
| `.sd-stamp` (`@media 560px`) | `10.5px` | `var(--fs-xs)` |

- [ ] **Step 2: Verify**

```bash
grep -n "font-size:" app/css/_footer.css | grep -v "var(--fs"
```

Expected: empty output.

- [ ] **Step 3: Commit**

```bash
git add app/css/_footer.css
git commit -m "feat(tokens): normalize font-size in _footer.css"
```

---

## Task 8: Update `_contact.css` and `_responsive.css`

**Files:**
- Modify: `app/css/_contact.css`
- Modify: `app/css/_responsive.css`

- [ ] **Step 1: Replace all raw font-size values in `_contact.css`**

| Selector | Old | New |
|---|---|---|
| `.contact__prompt` | `11.5px` | `var(--fs-xs)` |
| `.contact__input` | `13px` | `var(--fs-base)` |
| `.contact__send` | `12px` | `var(--fs-sm)` |
| `.contact__cursor` | `10.5px` | `var(--fs-xs)` |
| `.contact__error` | `12px` | `var(--fs-sm)` |

- [ ] **Step 2: Replace all raw font-size values in `_responsive.css`**

| Selector | Old | New |
|---|---|---|
| `body` (`@media 900px`) | `13px` | `var(--fs-base)` |
| `.hero--desktop .hero__dialog` | `13px` | `var(--fs-base)` |
| `.hero--mobile .hero__boot` | `12px` | `var(--fs-sm)` |
| `.hero__status` | `10.5px` | `var(--fs-xs)` |
| `.window-chrome` | `11px` | `var(--fs-xs)` |
| `.window-chrome__switch` | `9.5px` | `var(--fs-2xs)` |
| `.hero__dialog` (`@media 900px`) | `13px` | `var(--fs-base)` |
| *(scrollbar / misc)* `9.5px` | `9.5px` | `var(--fs-2xs)` |

- [ ] **Step 3: Verify both files**

```bash
grep -n "font-size:" app/css/_contact.css | grep -v "var(--fs"
grep -n "font-size:" app/css/_responsive.css | grep -v "var(--fs"
```

Expected: empty output for both.

- [ ] **Step 4: Commit**

```bash
git add app/css/_contact.css app/css/_responsive.css
git commit -m "feat(tokens): normalize font-size in _contact.css and _responsive.css"
```

---

## Task 9: Final verification

**Files:** read-only checks, no edits

- [ ] **Step 1: Confirm zero raw px font-size values remain across all 8 files**

```bash
grep -rn "font-size:" app/css/ | grep -v "var(--fs" | grep -v "_tokens.css" | grep -v "font-size: 16px" | grep -v "font-size: inherit"
```

Expected: **empty output**. Any remaining lines are unintentional — fix before proceeding.

- [ ] **Step 2: Confirm the two intentional exceptions are present**

```bash
grep -n "font-size: 16px" app/css/_base.css
grep -n "font-size: inherit" app/css/_shell.css
```

Expected:
```
20:  font-size: 16px;
211:  font-size: inherit;
```

- [ ] **Step 3: Run the test suite**

```bash
pnpm test
```

Expected: all tests pass (no font-size assertions exist in the current test suite — this is a smoke check).

- [ ] **Step 4: Build check**

```bash
pnpm build 2>&1 | tail -5
```

Expected: build completes with no errors.

- [ ] **Step 5: Visual check of shell section**

Start dev server and verify the shell section at desktop viewport looks acceptable at 14px body (up from 13px):

```bash
pnpm dev
```

Open `http://localhost:3000`, scroll to the `~/shell` section, run a command, confirm density is acceptable.
