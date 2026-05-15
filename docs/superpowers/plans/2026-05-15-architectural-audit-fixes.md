# Architectural Audit Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close all 13 findings from the May-2026 Staff/Principal audit: 3 P0 correctness bugs, 4 P1 architecture violations, and 2 P2 code-quality issues.

**Architecture:** Fixes are strictly corrective — no new abstractions. Order is P0 → P1 → P2. Each task is independently shippable. The CSS split (Task 7) is the only large-scale mechanical change; all others are targeted edits.

**Tech Stack:** Next.js 15 App Router · React 19 · TypeScript strict · Tailwind v4 · Vitest · pnpm 10

---

## File map

| File | Action | Reason |
|---|---|---|
| `components/sections/Hero.tsx` | Modify | P0-1: restore one-shot sysfail guard |
| `lib/lighthouse-scores.ts` | Modify | P0-2: use shared Redis singleton |
| `.github/workflows/ci.yml` | Modify | P0-3: upgrade pnpm version pin 9 → 10 |
| `content/schemas.ts` | Modify | P1-4: add ShellResponseSchema |
| `content/shell-commands.ts` | Create | P1-4: move localCommand strings out of JSX |
| `scripts/validate-content.mjs` | Modify | P1-4: validate shell-commands at build |
| `components/client/InteractiveShell.tsx` | Modify | P1-4: replace hardcoded switch with content lookup |
| `app/not-found.tsx` | Modify | P1-5: replace inline styles with CSS class |
| `app/globals.css` | Modify | P1-5: add .not-found class; P1-7: replace body with @imports |
| `app/css/_tokens.css` | Create | P1-7 |
| `app/css/_base.css` | Create | P1-7 |
| `app/css/_crt.css` | Create | P1-7 |
| `app/css/_layout.css` | Create | P1-7 |
| `app/css/_sections.css` | Create | P1-7 |
| `app/css/_chrome.css` | Create | P1-7 |
| `app/css/_shell.css` | Create | P1-7 |
| `app/css/_contact.css` | Create | P1-7 |
| `app/css/_footer.css` | Create | P1-7 |
| `app/css/_responsive.css` | Create | P1-7 |
| `app/page.tsx` | Modify | P1-6: wrap Hero + Footer with ErrorBoundary |
| `components/AppShell.client.tsx` | Modify | P1-6: wrap MatrixRain + CRTOverlay |
| `components/client/InteractiveShell.tsx` | Modify | P2-8: memoize runCommand |
| `components/responsive/DesktopTopbar.tsx` | Modify | P2-9: explicit typeof-window guard on useLayoutEffect |
| `__tests__/sysfail-loop.test.ts` | Create | P0-1: verify onFirstLoop fires exactly once |
| `__tests__/redis-singleton.test.ts` | Create | P0-2: verify single Redis instance |

---

## Task 1 — P0: Fix sysfail every-loop bug

The linter stripped the `loopCount` variable from `runBoot`. Now `onFirstLoop?.()` fires on every full `phraseIdx` wrap (every dialog cycle), not just the first. A `fired` boolean inside `startDialog` restores the one-shot behaviour.

**Files:**
- Modify: `components/sections/Hero.tsx:162-164` (inside `startDialog`)
- Create: `__tests__/sysfail-loop.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/sysfail-loop.test.ts
import { describe, expect, it, vi } from 'vitest';

// Minimal stubs so runBoot can run in jsdom without a canvas
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
});

// We're testing the exported helper indirectly by mounting a container and
// counting how many times the callback fires after two full dialog cycles.
describe('runBoot onFirstLoop', () => {
  it('fires exactly once across multiple dialog loops', async () => {
    const { runBoot } = await import('../components/sections/Hero');
    const container = document.createElement('div');
    const calls: number[] = [];

    const ctrl = runBoot(
      container,
      [[' ']],
      ['Hi', 'Yo'],
      {
        lineMs: 0, lineJitter: 0,
        cmdMs: 0,  cmdJitter: 0,
        typeMs: 0, holdMs: 0, backMs: 0, interMs: 0,
        startMs: 0,
        onFirstLoop: () => calls.push(Date.now()),
      },
    );

    // Wait enough for multiple dialog loops at 0ms delays
    await new Promise((r) => setTimeout(r, 200));
    ctrl.cancel();
    expect(calls.length).toBe(1);
  });
});
```

- [ ] **Step 2: Export `runBoot` so the test can import it**

In `components/sections/Hero.tsx`, change:

```ts
// Before (line ~75):
function runBoot(
```

to:

```ts
export function runBoot(
```

- [ ] **Step 3: Run test to verify it fails**

```bash
pnpm vitest run __tests__/sysfail-loop.test.ts
```

Expected: FAIL — `calls.length` will be > 1 (fires on every loop).

- [ ] **Step 4: Add the `fired` guard**

In `components/sections/Hero.tsx`, inside `startDialog`, add a `fired` boolean before `phraseIdx`:

```ts
// In startDialog(), after  container.appendChild(line);  — around line 162
let phraseIdx = 0;
let charIdx   = 0;
let phase: 'type' | 'hold' | 'back' = 'type';
let firedOnce = false;         // ← add this
```

Then in the `else` branch (backspace phase) where `phraseIdx` wraps, change:

```ts
// Before:
if (phraseIdx === 0) {
  opts.onFirstLoop?.();
}
```

to:

```ts
// After:
if (phraseIdx === 0 && !firedOnce) {
  firedOnce = true;
  opts.onFirstLoop?.();
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
pnpm vitest run __tests__/sysfail-loop.test.ts
```

Expected: PASS — `calls.length === 1`.

- [ ] **Step 6: TypeScript check**

```bash
pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add components/sections/Hero.tsx __tests__/sysfail-loop.test.ts
git commit -m "fix(hero): sysfail fires once per session — restore one-shot guard lost to linter"
```

---

## Task 2 — P0: Unify Redis singleton

`lib/lighthouse-scores.ts` creates its own `_redis` lazy singleton, separate from the one in `lib/rate-limit.ts`. Two `Redis.fromEnv()` instances = two connection pools on the same Upstash URL. Fix: import and reuse `getRedis()` from `lib/rate-limit.ts`.

**Files:**
- Modify: `lib/lighthouse-scores.ts:1-27`
- Create: `__tests__/redis-singleton.test.ts`

- [ ] **Step 1: Write the test**

```ts
// __tests__/redis-singleton.test.ts
import { describe, expect, it } from 'vitest';

describe('Redis singleton', () => {
  it('lighthouse-scores does not import Redis directly', async () => {
    // If this file imports Redis itself it creates a second pool.
    // Verify the module source has no direct Redis.fromEnv() call.
    const src = await import('fs').then((fs) =>
      fs.promises.readFile('lib/lighthouse-scores.ts', 'utf8'),
    );
    expect(src).not.toContain('Redis.fromEnv()');
    expect(src).not.toContain("from '@upstash/redis'");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm vitest run __tests__/redis-singleton.test.ts
```

Expected: FAIL — file currently has both `Redis.fromEnv()` and the import.

- [ ] **Step 3: Rewrite `lib/lighthouse-scores.ts` top section**

Replace lines 1-27 with:

```ts
import { getRedis } from './rate-limit';
```

Remove the block:
```ts
// Delete all of this:
import { Redis } from '@upstash/redis';

// Lazy singleton — avoids build-time throw when Upstash env vars are absent.
let _redis: Redis | undefined;
function getRedis(): Redis {
  return (_redis ??= Redis.fromEnv());
}
```

The rest of the file (`CACHE_KEY`, `LIGHTHOUSE_TTL_S`, `getScores`) stays exactly as-is; all calls to `getRedis()` already match the exported name from `rate-limit.ts`.

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm vitest run __tests__/redis-singleton.test.ts
```

Expected: PASS.

- [ ] **Step 5: TypeScript check**

```bash
pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add lib/lighthouse-scores.ts __tests__/redis-singleton.test.ts
git commit -m "fix(redis): unify singleton — lighthouse-scores reuses rate-limit getRedis()"
```

---

## Task 3 — P0: Fix CI pnpm version pin

`.github/workflows/ci.yml` pins `pnpm version: 9` in both jobs. `package.json` declares `"packageManager": "pnpm@10.15.0"`. A version mismatch with `--frozen-lockfile` causes silent pnpm-10 lockfile feature flags to be misread by pnpm 9, risking install divergence.

**Files:**
- Modify: `.github/workflows/ci.yml:22` and `:93`

- [ ] **Step 1: Update both `pnpm/action-setup` version pins**

In `.github/workflows/ci.yml`, find the two blocks:

```yaml
      - uses: pnpm/action-setup@v4
        with:
          version: 9
```

Change both to:

```yaml
      - uses: pnpm/action-setup@v4
        with:
          version: 10
```

There are exactly two occurrences — one at line 22 (job `build-and-gate`) and one at line 93 (job `e2e`).

- [ ] **Step 2: Verify the change**

```bash
grep -n "version:" .github/workflows/ci.yml
```

Expected output:
```
22:          version: 10
93:          version: 10
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: upgrade pnpm action pin 9→10 to match packageManager field"
```

---

## Task 4 — P1: Move shell commands to content/

`InteractiveShell.tsx` has all `localCommand` responses hardcoded as JSX strings, violating CLAUDE.md's content discipline rule. Create `content/shell-commands.ts` as a Zod-validated module and update the shell to look up responses from it.

**Files:**
- Create: `content/shell-commands.ts`
- Modify: `content/schemas.ts` — add `ShellResponseSchema`
- Modify: `scripts/validate-content.mjs` — validate shell-commands
- Modify: `components/client/InteractiveShell.tsx:217-264` — replace `localCommand` switch

- [ ] **Step 1: Add schema to `content/schemas.ts`**

At the bottom of `content/schemas.ts`, before the `// Exported types` comment, add:

```ts
// InteractiveShell — local command responses
export const ShellResponseSchema = z.object({
  commands: z.array(z.string()).min(1),
  kind: z.enum(['output', 'error']).default('output'),
  text: z.string().min(1),
});
export const ShellCommandsSchema = z.array(ShellResponseSchema).min(1);
```

At the bottom of the exported types block, add:

```ts
export type ShellResponse = z.infer<typeof ShellResponseSchema>;
```

- [ ] **Step 2: Create `content/shell-commands.ts`**

```ts
// content/shell-commands.ts
import type { ShellResponse } from './schemas';

const SHELL_RESPONSES: ShellResponse[] = [
  {
    commands: ['help'],
    kind: 'output',
    text: 'commands: help, whoami, whoami --recursive, ls, cat skills.md, cat ~/.now, contact, face, hire, clear, ask <q>',
  },
  {
    commands: ['whoami'],
    kind: 'output',
    text: 'erik — senior software engineer, frontend specialization',
  },
  {
    commands: ['whoami --recursive'],
    kind: 'output',
    text: 'erik → engineer → builder → student → curious → 9yo with a guitar',
  },
  {
    commands: ['ls'],
    kind: 'output',
    text: 'README.md  ~/.now  ~/.guitar_rig  ~/.visa  ~/.unknowns  ~/.community  ~/.credentials  hottest_takes.md  contact',
  },
  {
    commands: ['cat skills.md'],
    kind: 'output',
    text: 'angular, react, next.js, typescript, node, rxjs, ngrx, web components, ai tooling',
  },
  {
    commands: ['cat ~/.now'],
    kind: 'output',
    text: 'shipping multi-currency settlement · Betsson cashier (PCI-DSS)',
  },
  {
    commands: ['contact', 'hire'],
    kind: 'output',
    text: 'mailto: erikhenriquealvescunha@gmail.com',
  },
  {
    commands: ['face'],
    kind: 'output',
    text: '(•_•) ( •_•)>⌐■-■ (⌐■_■)',
  },
];

export default SHELL_RESPONSES;
```

- [ ] **Step 3: Add validation to `scripts/validate-content.mjs`**

Open `scripts/validate-content.mjs`. Find the block that imports and validates a content module (follow the existing pattern). Add a new validation for shell-commands after the existing validations:

```js
// At the top with other imports:
import shellCommandsModule from '../content/shell-commands.ts' with { type: 'module' };
import { ShellCommandsSchema } from '../content/schemas.ts' with { type: 'module' };

// In the validation section, add:
validate('shell-commands', ShellCommandsSchema, shellCommandsModule.default);
```

- [ ] **Step 4: Run content validation**

```bash
node scripts/validate-content.mjs
```

Expected: passes with no errors.

- [ ] **Step 5: Update `localCommand` in `InteractiveShell.tsx`**

At the top of `components/client/InteractiveShell.tsx`, add the import:

```ts
import SHELL_RESPONSES from '@/content/shell-commands';
```

Replace the entire `localCommand` function (lines 217-264) with:

```ts
function localCommand(cmd: string): Omit<Line, 'id'>[] {
  const entry = SHELL_RESPONSES.find((r) => r.commands.includes(cmd));
  if (entry) return [{ kind: entry.kind, text: entry.text }];
  return [{ kind: 'error', text: `command not found: ${cmd}. type 'help'` }];
}
```

- [ ] **Step 6: TypeScript check**

```bash
pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Smoke-test the shell**

```bash
pnpm dev
```

Open `http://localhost:3000`, type `whoami` in the shell. Expected: `erik — senior software engineer, frontend specialization`. Type an unknown command. Expected: `command not found: foo. type 'help'`.

- [ ] **Step 8: Commit**

```bash
git add content/shell-commands.ts content/schemas.ts scripts/validate-content.mjs components/client/InteractiveShell.tsx
git commit -m "refactor(shell): move localCommand responses to content/shell-commands.ts"
```

---

## Task 5 — P1: Fix not-found.tsx — CSS class + CRTOverlay

`app/not-found.tsx` uses raw `style={{}}` props with hardcoded hex values (`#000000`, `#E6FFE6`, `#00FF41`), bypassing CSS custom properties. It also skips the CRT overlay, breaking visual consistency with the rest of the site.

**Files:**
- Modify: `app/not-found.tsx`
- Modify: `app/globals.css` — add `.not-found` class at end of BASE section (around line 131)

- [ ] **Step 1: Add `.not-found` CSS class to `globals.css`**

At the end of the BASE section (after the `@media (max-width: 768px)` block, around line 131), add:

```css
.not-found {
  min-height: 100svh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  background: var(--bg);
  color: var(--fg);
  font-family: var(--font-mono-stack);
  font-size: clamp(0.8rem, 2vw, 1rem);
  position: relative;
}
```

- [ ] **Step 2: Rewrite `app/not-found.tsx`**

```tsx
import { CRTOverlay } from '@/components/responsive/CRTOverlay';
import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="not-found">
      <CRTOverlay />
      <pre style={{ lineHeight: 1.8 }}>
        <span style={{ color: 'var(--signal)', opacity: 0.6 }}>{'erik@portfolio:~$ '}</span>
        <span>{'navigate /dev/null'}</span>
        {'\n'}
        <span>{'bash: navigate: /dev/null: Not a directory'}</span>
        {'\n\n'}
        <span style={{ color: 'var(--signal)' }}>{'ERROR 404 — PAGE_NOT_FOUND'}</span>
        {'\n\n'}
        <Link
          href="/"
          style={{
            color: 'var(--signal)',
            textDecoration: 'none',
            borderBottom: '1px solid var(--signal)',
          }}
        >
          {'← cd ~'}
        </Link>
        <span style={{ opacity: 0.5 }}>{'  ·  return to portfolio'}</span>
      </pre>
    </main>
  );
}
```

Note: The three `style` props that remain reference CSS custom properties (`var(--signal)`, `var(--fg)`), not hardcoded hex. The layout is now in the CSS class. `CRTOverlay` requires `position: relative` on the parent, which is in `.not-found`.

- [ ] **Step 3: TypeScript check**

```bash
pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Visual check**

```bash
pnpm dev
```

Navigate to `http://localhost:3000/does-not-exist`. Verify the 404 page has the CRT scanlines overlay and uses the same green palette as the rest of the site.

- [ ] **Step 5: Commit**

```bash
git add app/not-found.tsx app/globals.css
git commit -m "fix(404): replace inline hex styles with CSS vars, add CRTOverlay"
```

---

## Task 6 — P1: Add ErrorBoundary to remaining client islands

`ShellSection` and `ContactSection` already wrap their client islands in `ErrorBoundary`, but `Hero`, `Footer`, `MatrixRain`, and `CRTOverlay` are unguarded. A runtime error in any of them crashes the whole page.

**Files:**
- Modify: `app/page.tsx` — wrap `<Hero />` and `<Footer />`
- Modify: `components/AppShell.client.tsx` — wrap `<MatrixRain />` and `<CRTOverlay />`

- [ ] **Step 1: Update `app/page.tsx`**

Add the import at the top of `app/page.tsx`:

```ts
import { ErrorBoundary } from '@/components/ErrorBoundary.client';
```

Wrap `<Hero />` (line 46):

```tsx
// Before:
          <Hero />
// After:
          <ErrorBoundary>
            <Hero />
          </ErrorBoundary>
```

Wrap `<Footer />` (line 66, inside `<AppShell>`):

```tsx
// Before:
        <Footer />
// After:
        <ErrorBoundary>
          <Footer />
        </ErrorBoundary>
```

- [ ] **Step 2: Update `components/AppShell.client.tsx`**

Add the import:

```ts
import { ErrorBoundary } from './ErrorBoundary.client';
```

Wrap `<MatrixRain ... />`:

```tsx
// Before:
      <MatrixRain
        fontSize={isMobile ? 14 : 16}
        ...
      />
// After:
      <ErrorBoundary>
        <MatrixRain
          fontSize={isMobile ? 14 : 16}
          ...
        />
      </ErrorBoundary>
```

Wrap `<CRTOverlay />`:

```tsx
// Before:
      <CRTOverlay />
// After:
      <ErrorBoundary>
        <CRTOverlay />
      </ErrorBoundary>
```

- [ ] **Step 3: TypeScript check**

```bash
pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx components/AppShell.client.tsx
git commit -m "fix(resilience): wrap Hero, Footer, MatrixRain, CRTOverlay in ErrorBoundary"
```

---

## Task 7 — P1: Split globals.css into focused partials

`app/globals.css` is 2408 lines — all concerns in one file. Split into 10 partials under `app/css/`. The new `globals.css` becomes a thin index with `@import` directives. No style rules change; this is a pure structural reorganisation.

**Files:**
- Create: `app/css/_tokens.css` (lines 5-31 of current globals.css)
- Create: `app/css/_base.css` (lines 32-131)
- Create: `app/css/_crt.css` (lines 132-254)
- Create: `app/css/_layout.css` (lines 255-551)
- Create: `app/css/_sections.css` (lines 552-1513)
- Create: `app/css/_chrome.css` (lines 1514-1819)
- Create: `app/css/_shell.css` (lines 1820-1951)
- Create: `app/css/_contact.css` (lines 1952-2053)
- Create: `app/css/_footer.css` (lines 2054-2285)
- Create: `app/css/_responsive.css` (lines 2286-2408)
- Modify: `app/globals.css` — replace content with @imports

- [ ] **Step 1: Create the `app/css/` directory and extract partials**

Run these commands in sequence. Each `sed` command extracts a line range and writes it to a new file. Line numbers are relative to the current `app/globals.css` (verify with `wc -l app/globals.css` — expected 2408).

```bash
mkdir -p app/css
sed -n '5,31p'   app/globals.css > app/css/_tokens.css
sed -n '32,131p' app/globals.css > app/css/_base.css
sed -n '132,254p' app/globals.css > app/css/_crt.css
sed -n '255,551p' app/globals.css > app/css/_layout.css
sed -n '552,1513p' app/globals.css > app/css/_sections.css
sed -n '1514,1819p' app/globals.css > app/css/_chrome.css
sed -n '1820,1951p' app/globals.css > app/css/_shell.css
sed -n '1952,2053p' app/globals.css > app/css/_contact.css
sed -n '2054,2285p' app/globals.css > app/css/_footer.css
sed -n '2286,2408p' app/globals.css > app/css/_responsive.css
```

- [ ] **Step 2: Verify line counts add up**

```bash
wc -l app/css/*.css
```

Expected total: approximately 2404 lines (line 1-4 of globals.css contains `@import "tailwindcss"` and blank lines which stay in the main file).

- [ ] **Step 3: Replace `app/globals.css` with the import index**

```css
/* app/globals.css */

@import "tailwindcss";

@import "./css/_tokens.css";
@import "./css/_base.css";
@import "./css/_crt.css";
@import "./css/_layout.css";
@import "./css/_sections.css";
@import "./css/_chrome.css";
@import "./css/_shell.css";
@import "./css/_contact.css";
@import "./css/_footer.css";
@import "./css/_responsive.css";
```

- [ ] **Step 4: Build to verify no style regressions**

```bash
pnpm build
```

Expected: build succeeds, no CSS errors. If PostCSS reports an import error, check that `postcss.config.mjs` includes `postcss-import` or that Tailwind v4's built-in import handling covers relative imports (it does).

- [ ] **Step 5: Visual smoke-test**

```bash
pnpm start
```

Open `http://localhost:3000`. Verify: CRT scanlines visible, hero boot sequence runs, green palette intact, mobile layout correct.

- [ ] **Step 6: Commit**

```bash
git add app/globals.css app/css/
git commit -m "refactor(css): split 2408-line globals.css into 10 focused partials"
```

---

## Task 8 — P2: Memoize `runCommand` in InteractiveShell

`nextId` is wrapped in `useCallback` but `runCommand` is not, despite being referenced in the `<form onSubmit>` handler and closing over `isMobile`, `busy`, `history`, and `nextId`. This causes an unnecessary new function reference every render, which also means the ESLint exhaustive-deps rule would flag it. Wrap it.

**Files:**
- Modify: `components/client/InteractiveShell.tsx:61-148`

- [ ] **Step 1: Wrap `runCommand` in `useCallback`**

In `components/client/InteractiveShell.tsx`, change the function declaration from:

```ts
async function runCommand(cmd: string) {
```

to:

```ts
const runCommand = useCallback(async (cmd: string) => {
```

And close it with `}, [isMobile, nextId]);` replacing the closing `}` of the function. The full deps array for `runCommand` is `[isMobile, nextId]` — `history` is read via the functional updater form (`setHistory((h) => [...])`) which doesn't close over the stale value, and `busy` is read from the closure but only after the early return guard, so `nextId` and `isMobile` are the stable deps.

The function signature block in full after the edit:

```ts
const runCommand = useCallback(async (cmd: string) => {
    window.dispatchEvent(new CustomEvent('shell-cmd-run'));
    setHistory((h) => [...h, { id: nextId(), kind: 'prompt', text: `erik@portfolio:~$ ${cmd}` }]);
    setInput('');
    setBusy(true);

    if (cmd === 'clear') {
      setHistory(withIds(isMobile ? MOBILE_INITIAL : INITIAL_LINES, nextId));
      setBusy(false);
      return;
    }

    // ... rest of the function body unchanged ...

    setBusy(false);
  }, [isMobile, nextId]);
```

- [ ] **Step 2: TypeScript check**

```bash
pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/client/InteractiveShell.tsx
git commit -m "perf(shell): memoize runCommand with useCallback"
```

---

## Task 9 — P2: Explicit SSR guard on `useLayoutEffect` in DesktopTopbar

`DesktopTopbar` uses `useLayoutEffect` to read and apply motion preference. This is correct for the client (avoids flash), but the component is inside `AppShell.client.tsx` which is a client island — so Next.js SSR will never execute `useLayoutEffect` on the server. The guard is implicit. Making it explicit documents the intent and removes the potential for "useLayoutEffect does nothing on the server" warnings if the component tree ever shifts.

**Files:**
- Modify: `components/responsive/DesktopTopbar.tsx:9-13`

- [ ] **Step 1: Add typeof guard around `useLayoutEffect` body**

In `components/responsive/DesktopTopbar.tsx`, change:

```ts
  useLayoutEffect(() => {
    const on = readMotion();
    setMotionOn(on);
    applyMotion(on);
  }, []);
```

to:

```ts
  useLayoutEffect(() => {
    if (typeof window === 'undefined') return;
    const on = readMotion();
    setMotionOn(on);
    applyMotion(on);
  }, []);
```

- [ ] **Step 2: TypeScript check**

```bash
pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/responsive/DesktopTopbar.tsx
git commit -m "fix(topbar): explicit typeof-window guard in useLayoutEffect"
```

---

## Final verification

After all 9 tasks are complete:

- [ ] **Full test suite**

```bash
pnpm vitest run
```

Expected: all tests pass including the two new tests from Tasks 1 and 2.

- [ ] **Full build**

```bash
pnpm build
```

Expected: build succeeds, no TypeScript errors, no CSS errors.

- [ ] **TypeScript strict check**

```bash
pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Content validation**

```bash
node scripts/validate-content.mjs
```

Expected: all content modules validate, including the new `shell-commands` module.

- [ ] **Push to origin**

```bash
git push origin main
```
