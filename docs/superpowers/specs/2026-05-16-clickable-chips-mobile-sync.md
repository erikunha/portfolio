# Clickable Command Chips + Mobile Content Sync — Design Spec

**Date:** 2026-05-16
**Status:** Approved

---

## Scope

Two distinct but related improvements:

1. **Clickable command chips** — shell command hints become interactive on both desktop (hover-glow buttons) and mobile (typewriter-fill + auto-submit chips).
2. **Mobile content sync** — section order aligned to desktop DOM order; missing guitar fields added; pre-formatted sections get overflow wrapping.

---

## Feature 1: Clickable Command Chips

### Problem

- Desktop: command hints are static text in `postBody` — no click affordance.
- Mobile: chips call `runCommand(cmd)` immediately with no visual typing feedback.

### Solution

**Shared `COMMANDS` const** in `InteractiveShell.tsx` replaces both `CHIPS` and the `postBody` string:

```ts
const COMMANDS = [
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

**`runWithEffect(cmd)`** — new function, typewriter-fills input then auto-submits:

```ts
function runWithEffect(cmd: string) {
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
}
```

`typingRef` is a new `useRef<boolean>(false)` — prevents double-invocation if the user clicks a chip while typing is in progress.

**Desktop rendering** (below the shell `<form>`, only when `!isMobile`):

```tsx
<div className="shell__commands">
  <span className="shell__commands-prefix">commands:</span>
  {COMMANDS.map(({ label, cmd }, i) => (
    <Fragment key={cmd}>
      {i > 0 && <span className="shell__commands-sep"> · </span>}
      <button
        type="button"
        className="shell__cmd-hint"
        onClick={() => !busy && runWithEffect(cmd)}
        disabled={busy}
      >
        {label}
      </button>
    </Fragment>
  ))}
  <span className="shell__commands-tail"> · anything else → Claude</span>
</div>
```

**Mobile rendering** — chips stay as pill buttons, click triggers `runWithEffect` (not `runCommand`):

```tsx
{isMobile && (
  <div className="shell__chips" role="toolbar" aria-label="quick commands"
    onClick={(e) => {
      const cmd = (e.target as HTMLElement).closest<HTMLElement>('[data-cmd]')?.dataset.cmd;
      if (cmd && !busy) runWithEffect(cmd);
    }}
  >
    {COMMANDS.map(({ label, cmd }) => (
      <button key={cmd} type="button" className="shell__chip" data-cmd={cmd}>{label}</button>
    ))}
  </div>
)}
```

**`ShellSection.tsx`**: remove `postBody` prop entirely — desktop hints now rendered inside `InteractiveShell`.

**CSS** — new `.shell__cmd-hint` class (inline button reset + hover glow):

```css
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
.shell__cmd-hint:disabled { cursor: default; }
.shell__commands-sep,
.shell__commands-prefix,
.shell__commands-tail { pointer-events: none; }
```

---

## Feature 2: Mobile Content Sync

### 2a. Section Order

Current mobile CSS `order` values were independently crafted and diverge from desktop DOM order. Align them to match.

Desktop DOM order (positions used as new mobile CSS order values):

| Section | New `order` | Old `order` |
|---|---|---|
| Hero | (none — DOM first) | (none) |
| readme | 1 | 1 |
| shell | 2 | 11 |
| man-page | 3 | 2 |
| now | 4 | 3 |
| projects | 5 | 4 |
| git-log | 6 | 6 |
| npm-stack | 7 | 7 |
| sys-health | 8 | 8 |
| live-perf | 9 | 9 |
| perf-receipts | 10 | 5 |
| guitar | 11 | 12 |
| visa | 12 | 13 |
| credentials | 13, `display:none` | 14 |
| community | 14 | 16 |
| hottest-takes | 15 | 10 |
| responsibilities | 16 | 15 |
| unknowns | 17 | 17 |
| contact | 18 | 18 |

File: `app/css/_layout.css`.

### 2b. GuitarSection Mobile — Missing Fields

Desktop has two fields absent from mobile: `PRACTICE` and `NEVER_LEARNED`. Add them to the mobile `<pre>` block in `GuitarSection.tsx` after the GIGS row:

```tsx
<span className="gr-label">{'PRACTICE'}</span>
{'       '}
<span className="gr-val">{'jams · tones · live takes'}</span>
{'\n'}
<span className="gr-label">{'NEVER_LRND'}</span>
{'   '}
<span className="gr-val">{'tabs only · no staff notation'}</span>
{'\n'}
```

### 2c. Pre-Wrap for ResponsibilitiesSection + UnknownsSection

Both have long lines in `<pre>` blocks that can overflow on narrow viewports (< 390px).

Add to `_layout.css` inside the existing `@media (max-width: 768px)` block:

```css
.permatrix pre { white-space: pre-wrap; overflow-wrap: break-word; }
.unknowns pre  { white-space: pre-wrap; overflow-wrap: break-word; }
```

---

## Files Changed

| File | Change |
|---|---|
| `components/client/InteractiveShell.tsx` | `COMMANDS` const, `typingRef`, `runWithEffect`, desktop hints block, chips use `runWithEffect` |
| `components/sections/ShellSection.tsx` | Remove `postBody` prop |
| `app/css/_shell.css` | Add `.shell__cmd-hint` + hover CSS |
| `app/css/_layout.css` | Update mobile `order` values; add pre-wrap rules |
| `components/sections/GuitarSection.tsx` | Add `PRACTICE` + `NEVER_LEARNED` to mobile pre |

---

## Non-Goals

- Chip animation on desktop (too far from terminal aesthetic)
- Persisted chip state / "recently used" ordering
- Removing `busy` guard from chips (prevents double-submit)
