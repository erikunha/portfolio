# Clickable Command Chips + Mobile Content Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make shell command hints interactive on desktop (hover-glow buttons) and mobile (typewriter-fill + auto-submit chips), and sync mobile section order + missing content to match desktop.

**Architecture:** All interactivity lives in `InteractiveShell.tsx` (already a client island) — a single `COMMANDS` const drives both the desktop hint buttons and mobile chip pills. The RSC `postBody` prop in `ShellSection.tsx` is removed since it cannot carry click handlers. Section order and pre-wrap overflows are pure CSS in `_layout.css`. Guitar content parity is a JSX edit.

**Tech Stack:** React 19, TypeScript strict, Next.js 15 App Router, pnpm

---

## File Map

| File | What changes |
|---|---|
| `app/css/_shell.css` | Update `.shell__commands` to panel-internal padding; add `.shell__cmd-hint` hover styles |
| `components/client/InteractiveShell.tsx` | Add `Fragment` import, replace `CHIPS` with `COMMANDS`, add `typingRef` + `runWithEffect`, update chips handler, add desktop hints block |
| `components/sections/ShellSection.tsx` | Remove `postBody` prop |
| `app/css/_layout.css` | Update 8 mobile `order` values; merge pre-wrap into existing `.permatrix pre` rule; add `.unknowns pre` wrap |
| `components/sections/GuitarSection.tsx` | Add `PRACTICE` + `NEVER_LEARNED` rows to the mobile `<pre>` block |

---

### Task 1: Update shell CSS for panel-internal hints + hover glow

The `.shell__commands` rule was written for rendering *outside* the panel (via `postBody`). It used `margin-top`. After this feature it will render *inside* the shell's dark panel — same position as `.shell__chips` but on desktop only. Update the rule and add `.shell__cmd-hint` hover styles.

**Files:**
- Modify: `app/css/_shell.css` (lines 118–128)

- [ ] **Step 1: Replace the `.shell__commands` block and add hint styles**

Find this block in `app/css/_shell.css` (currently lines 117–128):

```css
/* Hint shown below the shell panel — matches .ishell-hint outside .ishell in prototype */
.shell__commands {
  color: var(--muted);
  font-size: 11px;
  letter-spacing: 0.1em;
  margin-top: 8px;
  opacity: 0.75;
}

@media (max-width: 768px) {
  .shell__commands { display: none; }
}
```

Replace with:

```css
/* Desktop command hints row — rendered inside shell panel, below the input form */
.shell__commands {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0;
  color: var(--muted);
  font-size: 11px;
  letter-spacing: 0.1em;
  padding: 8px 16px 12px;
  border-top: 1px dashed var(--signal-dim-2);
  opacity: 0.75;
}

@media (max-width: 768px) {
  .shell__commands { display: none; }
}

.shell__cmd-hint {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  font-family: inherit;
  font-size: inherit;
  letter-spacing: inherit;
  color: inherit;
  transition: color 150ms ease, text-shadow 150ms ease;
}

.shell__cmd-hint:hover:not(:disabled) {
  color: var(--signal);
  text-shadow: 0 0 6px rgba(0, 255, 65, 0.5);
}

.shell__cmd-hint:disabled {
  cursor: default;
}

.shell__commands-sep,
.shell__commands-prefix,
.shell__commands-tail {
  pointer-events: none;
}
```

- [ ] **Step 2: Build to verify no errors**

```bash
pnpm build
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add app/css/_shell.css
git commit -m "feat(shell): update command hints CSS for panel-internal rendering + hover glow"
```

---

### Task 2: Update InteractiveShell — COMMANDS const + runWithEffect + desktop hints

This is the core implementation. Three logical changes happen in one file: replace the chips data, add the typewriter function, render desktop hints.

**Files:**
- Modify: `components/client/InteractiveShell.tsx`

Background: The file is at `components/client/InteractiveShell.tsx`. It currently imports `useCallback, useEffect, useRef, useState` from React (no `Fragment`). It has a `CHIPS` const at the top. Inside `export function InteractiveShell()` there is a `feedRef` useRef. The `runCommand` useCallback is the last hook before the `return`. The JSX has a `{isMobile && (<div className="shell__chips" ...>)}` block near the bottom.

- [ ] **Step 1: Add `Fragment` to the React import**

Find:
```ts
import { useCallback, useEffect, useRef, useState } from 'react';
```

Replace with:
```ts
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
```

- [ ] **Step 2: Replace `CHIPS` const with `COMMANDS`**

Find the entire `CHIPS` const (lines 21–30 currently):
```ts
const CHIPS: { label: string; cmd: string }[] = [
  { label: 'whoami', cmd: 'whoami' },
  { label: 'skills', cmd: 'cat skills.md' },
  { label: '.now', cmd: 'cat ~/.now' },
  { label: 'open to relocate?', cmd: 'open to relocate?' },
  { label: 'strongest project?', cmd: 'strongest project?' },
  { label: 'contact', cmd: 'contact' },
  { label: 'help', cmd: 'help' },
  { label: 'clear', cmd: 'clear' },
];
```

Replace with:
```ts
const COMMANDS: { label: string; cmd: string }[] = [
  { label: 'help',               cmd: 'help' },
  { label: 'whoami',             cmd: 'whoami' },
  { label: 'whoami --recursive', cmd: 'whoami --recursive' },
  { label: 'ls',                 cmd: 'ls' },
  { label: 'cat skills.md',      cmd: 'cat skills.md' },
  { label: 'cat ~/.now',         cmd: 'cat ~/.now' },
  { label: 'contact',            cmd: 'contact' },
  { label: 'face',               cmd: 'face' },
  { label: 'hire',               cmd: 'hire' },
  { label: 'clear',              cmd: 'clear' },
];
```

- [ ] **Step 3: Add `typingRef` inside the component**

Inside `export function InteractiveShell()`, after the `feedRef` line:
```ts
const feedRef = useRef<HTMLDivElement>(null);
```

Add immediately after:
```ts
const typingRef = useRef(false);
```

- [ ] **Step 4: Add `runWithEffect` after `runCommand`**

Find the closing of the `runCommand` useCallback (the line ending with `}, [isMobile, nextId, streamQuestion]);`). After that entire block, add:

```ts
const runWithEffect = useCallback((cmd: string) => {
  if (typingRef.current || busy) return;
  typingRef.current = true;
  let i = 0;
  function tick() {
    if (i <= cmd.length) {
      setInput(cmd.slice(0, i));
      i++;
      setTimeout(tick, 30);
    } else {
      setTimeout(() => {
        runCommand(cmd);
        typingRef.current = false;
      }, 300);
    }
  }
  tick();
}, [busy, runCommand]);
```

- [ ] **Step 5: Update chips to use `runWithEffect` and reference `COMMANDS`**

Find the entire chips block (currently around lines 227–243):
```tsx
{isMobile && (
  <div
    className="shell__chips"
    role="toolbar"
    aria-label="quick commands"
    onClick={(e) => {
      const cmd = (e.target as HTMLElement).closest<HTMLElement>('[data-cmd]')?.dataset.cmd;
      if (cmd && !busy) runCommand(cmd);
    }}
  >
    {CHIPS.map(({ label, cmd }) => (
      <button key={cmd} type="button" className="shell__chip" data-cmd={cmd}>
        {label}
      </button>
    ))}
  </div>
)}
```

Replace with:
```tsx
{isMobile && (
  <div
    className="shell__chips"
    role="toolbar"
    aria-label="quick commands"
    onClick={(e) => {
      const cmd = (e.target as HTMLElement).closest<HTMLElement>('[data-cmd]')?.dataset.cmd;
      if (cmd && !busy) runWithEffect(cmd);
    }}
  >
    {COMMANDS.map(({ label, cmd }) => (
      <button key={cmd} type="button" className="shell__chip" data-cmd={cmd}>
        {label}
      </button>
    ))}
  </div>
)}
```

- [ ] **Step 6: Add desktop hints block before the chips block**

Immediately before the `{isMobile && (<div className="shell__chips"...>)}` block (which you just updated above), add:

```tsx
{!isMobile && (
  <div className="shell__commands">
    <span className="shell__commands-prefix">{'commands: '}</span>
    {COMMANDS.map(({ label, cmd }, i) => (
      <Fragment key={cmd}>
        {i > 0 && <span className="shell__commands-sep">{' · '}</span>}
        <button
          type="button"
          className="shell__cmd-hint"
          onClick={() => { if (!busy) runWithEffect(cmd); }}
          disabled={busy}
        >
          {label}
        </button>
      </Fragment>
    ))}
    <span className="shell__commands-tail">{' · anything else → Claude'}</span>
  </div>
)}
```

Note: ` ` is a non-breaking space after "commands:" so the prefix and first command don't split across lines. `→` is the → arrow character.

- [ ] **Step 7: TypeScript build check**

```bash
pnpm build
```

Expected: exit 0, no type errors. Common issues:
- If TypeScript complains about `runWithEffect` being used before defined — ensure it is declared *after* `runCommand` (which it depends on).
- If it complains about `Fragment` — verify the import in Step 1 was applied.

- [ ] **Step 8: Commit**

```bash
git add components/client/InteractiveShell.tsx
git commit -m "feat(shell): COMMANDS const, typewriter runWithEffect, desktop hint buttons"
```

---

### Task 3: Remove `postBody` from ShellSection

Desktop hints now render inside `InteractiveShell`. The RSC `postBody` is dead code.

**Files:**
- Modify: `components/sections/ShellSection.tsx`

- [ ] **Step 1: Remove `postBody` prop**

Find these lines in `ShellSection.tsx`:
```tsx
      postBody={
        <p className="shell__commands">
          {'commands: help · whoami · whoami --recursive · ls · cat skills.md · cat ~/.now · contact · face · hire · clear · anything else → Claude'}
        </p>
      }
```

Delete them. The `<Module>` opening tag should become:
```tsx
    <Module
      id="sec-shell"
      header="./EXEC INTERACTIVE_SHELL"
      mobileHeader="/BIN/SH · INTERACTIVE"
      icon={<IconShell />}
    >
```

- [ ] **Step 2: Build**

```bash
pnpm build
```

Expected: exit 0. If TypeScript complains that `postBody` is required on `Module`, open `components/responsive/Module.tsx` and verify the prop is typed as optional (`postBody?: ReactNode`). It should already be optional — if not, add `?`.

- [ ] **Step 3: Commit**

```bash
git add components/sections/ShellSection.tsx
git commit -m "feat(shell): remove static postBody — hints now rendered inside InteractiveShell"
```

---

### Task 4: Sync mobile section order to desktop DOM order

Eight CSS `order` values are out of sync with desktop DOM order. Update them all at once.

**Files:**
- Modify: `app/css/_layout.css` (the `@media (max-width: 768px)` section order block, currently lines 28–45)

- [ ] **Step 1: Replace the section order block**

Find the block that starts with:
```css
  /* Section order — all sections visible on mobile */
  #sec-readme          { order: 1; }
```

…and ends with:
```css
  #sec-contact         { order: 18; }
```

Replace the entire block (comment + all 18 rules) with:

```css
  /* Section order — matches desktop DOM order */
  #sec-readme          { order: 1; }
  #sec-shell           { order: 2; }
  #sec-man-page        { order: 3; }
  #sec-now             { order: 4; }
  #sec-projects        { order: 5; }
  #sec-git-log         { order: 6; }
  #sec-npm-stack       { order: 7; }
  #sec-sys-health      { order: 8; }
  #sec-live-perf       { order: 9; }
  #sec-perf-receipts   { order: 10; }
  #sec-guitar          { order: 11; }
  #sec-visa            { order: 12; }
  #sec-credentials     { order: 13; display: none; }
  #sec-community       { order: 14; }
  #sec-hottest-takes   { order: 15; }
  #sec-responsibilities { order: 16; }
  #sec-unknowns        { order: 17; }
  #sec-contact         { order: 18; }
```

- [ ] **Step 2: Build**

```bash
pnpm build
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add app/css/_layout.css
git commit -m "feat(layout): sync mobile section order to desktop DOM order"
```

---

### Task 5: Guitar section — add missing mobile fields

Desktop shows `PRACTICE` and `NEVER_LEARNED`. Mobile omits both. Add them after the `GIGS` row.

**Files:**
- Modify: `components/sections/GuitarSection.tsx`

- [ ] **Step 1: Add the two missing rows**

In `GuitarSection.tsx`, find the mobile pre's `GIGS` row (inside the `<pre className="guitar-mobile" ...>` block):

```tsx
          <span className="gr-label">{'GIGS'}</span>
          {'         '}
          <span className="gr-val">{'small venues · band setting'}</span>
          {'\n'}
```

After that `{'\n'}`, add:

```tsx
          <span className="gr-label">{'PRACTICE'}</span>
          {'      '}
          <span className="gr-val">{'jams · tones · live takes'}</span>
          {'\n'}
          <span className="gr-label">{'NEVER_LRND'}</span>
          {'    '}
          <span className="gr-val">{'tabs only · no staff notation'}</span>
          {'\n'}
```

Note: The label column width on mobile uses short names (4–10 chars) with trailing spaces to align the values. `PRACTICE` = 8 chars + 6 spaces = 14-char column. `NEVER_LRND` = 10 chars + 4 spaces = 14-char column. Consistent with GIGS (4 chars + 9 spaces = 13 chars) and the other rows.

- [ ] **Step 2: Build**

```bash
pnpm build
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add components/sections/GuitarSection.tsx
git commit -m "feat(guitar): add PRACTICE and NEVER_LEARNED to mobile view"
```

---

### Task 6: Pre-wrap overflow fix for Responsibilities + Unknowns

Both `<pre>` blocks have long lines that can overflow on narrow mobile viewports.

**Files:**
- Modify: `app/css/_layout.css`

- [ ] **Step 1: Update `.permatrix pre` and add `.unknowns pre`**

In `app/css/_layout.css`, inside the `@media (max-width: 768px)` block, find:
```css
  .permatrix pre { font-size: 11px; }
```

Replace with:
```css
  .permatrix pre { font-size: 11px; white-space: pre-wrap; overflow-wrap: break-word; }
```

Then find (a few lines below):
```css
  .unknowns pre { font-size: 11.5px; }
```

Replace with:
```css
  .unknowns pre { font-size: 11.5px; white-space: pre-wrap; overflow-wrap: break-word; }
```

- [ ] **Step 2: Build**

```bash
pnpm build
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add app/css/_layout.css
git commit -m "feat(mobile): pre-wrap overflow fix for responsibilities and unknowns sections"
```

---

## Final verification

After all 6 tasks are committed:

```bash
pnpm build && pnpm test
```

Expected: build exit 0, tests pass with no regressions.

Manual smoke test on mobile viewport (390px width):
1. Sections appear in order: readme → shell → man-page → now → projects → git-log → npm-stack → sys-health → live-perf → perf-receipts → guitar → visa → community → hottest-takes → responsibilities → unknowns → contact
2. Shell chips show the 10 commands from `COMMANDS`; tapping one types the command character-by-character then submits
3. Guitar section shows PRACTICE and NEVER_LEARNED rows
4. Responsibilities and Unknowns pre blocks wrap gracefully on narrow viewports

Manual smoke test on desktop (1280px width):
1. Shell shows "commands: help · whoami · whoami --recursive · …" below the input
2. Hovering a command word glows green (`var(--signal)` color + text-shadow)
3. Clicking a command types it into the input and submits
4. "anything else → Claude" is non-clickable static text
