# Mobile Responsive Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add fully responsive mobile layout at the 768px breakpoint — 4 mobile chrome components, SectionReveal accordion with IntersectionObserver matrix typing/erasing animation, quick-command shell chips, and page-level wiring.

**Architecture:** `SectionReveal` is a client component wrapping every non-hero RSC section; it owns both the matrix animation (desktop + mobile) and the mobile accordion. Pure animation utilities are extracted to `lib/section-reveal-utils.ts` for testing. Four mobile-only components render as phone chrome. CSS utility classes `.mobile-only`/`.desktop-only` gate visibility at 768px.

**Tech Stack:** React 19 `'use client'`, TypeScript strict, IntersectionObserver, requestAnimationFrame, TreeWalker DOM API, CSS media queries.

---

## File map

**Created:**
- `vitest.config.ts` — vitest config with jsdom environment
- `lib/section-reveal-utils.ts` — pure functions: `collectTextNodes`, `charsPerFrame`, `AnimationQueue`
- `__tests__/section-reveal-utils.test.ts` — unit tests
- `components/client/section-reveal.client.tsx` — animation + accordion wrapper
- `components/client/mobile-statusbar.client.tsx` — phone status bar (client, sticky)
- `components/sections/mobile-appbar.tsx` — macOS-style app bar (RSC)
- `components/client/mobile-dock.client.tsx` — 5-tab bottom navigation (client, fixed)
- `components/client/mobile-totop.client.tsx` — floating scroll-to-top (client, fixed)

**Modified:**
- `app/globals.css` — add `.reveal-mask`, `.mobile-only`, `.desktop-only`, `.mobile-flex`, accordion rules, media queries
- `app/page.tsx` — wrap 18 sections in SectionReveal, add mobile chrome, hide Hero on mobile
- `components/client/shell.client.tsx` — add `data-no-reveal` + quick-command chips
- `components/sections/contact.tsx` — add `data-no-reveal` to panel div

---

## Task 1: CSS foundations

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Append mobile/desktop utility classes and accordion rules at the end of globals.css**

```css
/* ── Hydration-flash prevention ── */
.reveal-mask { opacity: 0; }

/* ── Visibility utilities ── */
.desktop-only { /* visible by default */ }
.mobile-only  { display: none; }
.mobile-flex  { display: none; }

/* ── Accordion ── */
.mod-body--closed { display: none !important; }

@media (max-width: 768px) {
  .desktop-only { display: none !important; }
  .mobile-only  { display: block; }
  .mobile-flex  { display: flex !important; }

  body {
    padding-bottom: calc(64px + env(safe-area-inset-bottom, 0px) + 8px);
  }

  .mod-head {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 0;
    background: none;
    border: none;
    border-bottom: 1px solid var(--color-signal-dim);
    color: var(--color-signal);
    font-family: var(--font-mono);
    font-size: 12px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    cursor: pointer;
    margin-bottom: 12px;
  }
}

@media (min-width: 769px) {
  .mod-head         { display: none !important; }
  .mod-body--closed { display: block !important; }
}
```

- [ ] **Step 2: Run Biome formatter**

```bash
pnpm check:fix
```

Expected: exits 0 (no new errors).

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "feat: add mobile/desktop utility classes and accordion CSS"
```

---

## Task 2: Vitest config + pure animation utilities

**Files:**
- Create: `vitest.config.ts`
- Create: `lib/section-reveal-utils.ts`

- [ ] **Step 1: Create vitest.config.ts**

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
```

- [ ] **Step 2: Create lib/section-reveal-utils.ts**

```typescript
// lib/section-reveal-utils.ts
const SKIP_TAGS = new Set(['INPUT', 'TEXTAREA', 'BUTTON', 'CANVAS', 'SCRIPT', 'STYLE']);

export function collectTextNodes(root: Element): Array<{ node: Text; original: string }> {
  const results: Array<{ node: Text; original: string }> = [];

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ALL, {
    acceptNode(node) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as Element;
        if (
          SKIP_TAGS.has(el.tagName) ||
          el.hasAttribute('data-no-reveal') ||
          el.getAttribute('aria-hidden') === 'true'
        ) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_SKIP;
      }
      if (node.nodeType === Node.TEXT_NODE) {
        const text = (node as Text).textContent ?? '';
        if (text.trim().length === 0) return NodeFilter.FILTER_SKIP;
        return NodeFilter.FILTER_ACCEPT;
      }
      return NodeFilter.FILTER_SKIP;
    },
  });

  let node: Node | null;
  while ((node = walker.nextNode()) !== null) {
    if (node.nodeType === Node.TEXT_NODE) {
      const textNode = node as Text;
      const original = textNode.textContent ?? '';
      if (original.trim().length > 0) results.push({ node: textNode, original });
    }
  }

  return results;
}

export function charsPerFrame(totalChars: number): number {
  return Math.max(1, Math.floor(totalChars / 15));
}

export class AnimationQueue {
  private active = 0;
  private readonly waiting: Array<() => void> = [];
  private readonly max: number;

  constructor(max = 2) {
    this.max = max;
  }

  enqueue(start: () => void): void {
    if (this.active < this.max) {
      this.active++;
      start();
    } else {
      this.waiting.push(start);
    }
  }

  release(): void {
    this.active = Math.max(0, this.active - 1);
    if (this.waiting.length > 0) {
      this.active++;
      const next = this.waiting.shift()!;
      next();
    }
  }
}
```

- [ ] **Step 3: Run typecheck**

```bash
pnpm typecheck
```

Expected: no errors on the new files.

- [ ] **Step 4: Commit**

```bash
git add vitest.config.ts lib/section-reveal-utils.ts
git commit -m "feat: add animation utility functions and vitest config"
```

---

## Task 3: Unit tests for animation utilities

**Files:**
- Create: `__tests__/section-reveal-utils.test.ts`

- [ ] **Step 1: Write the tests**

Note: test DOM is built with `createElement`/`appendChild`/`createTextNode` — no unsafe markup injection.

```typescript
// __tests__/section-reveal-utils.test.ts
import { describe, it, expect } from 'vitest';
import { collectTextNodes, charsPerFrame, AnimationQueue } from '@/lib/section-reveal-utils';

// Helper: build a div > p > [text, span > text] without markup injection
function makeNestedDiv(): HTMLElement {
  const div = document.createElement('div');
  const p = document.createElement('p');
  p.appendChild(document.createTextNode('hello '));
  const span = document.createElement('span');
  span.appendChild(document.createTextNode('world'));
  p.appendChild(span);
  div.appendChild(p);
  return div;
}

describe('charsPerFrame', () => {
  it('returns 1 for small text', () => {
    expect(charsPerFrame(1)).toBe(1);
    expect(charsPerFrame(14)).toBe(1);
    expect(charsPerFrame(15)).toBe(1);
  });
  it('scales proportionally for large text', () => {
    expect(charsPerFrame(30)).toBe(2);
    expect(charsPerFrame(150)).toBe(10);
    expect(charsPerFrame(300)).toBe(20);
  });
});

describe('AnimationQueue', () => {
  it('starts tasks immediately when under limit', () => {
    const q = new AnimationQueue(2);
    const calls: number[] = [];
    q.enqueue(() => calls.push(1));
    q.enqueue(() => calls.push(2));
    expect(calls).toEqual([1, 2]);
  });
  it('queues third task when at limit of 2', () => {
    const q = new AnimationQueue(2);
    const calls: number[] = [];
    q.enqueue(() => calls.push(1));
    q.enqueue(() => calls.push(2));
    q.enqueue(() => calls.push(3));
    expect(calls).toEqual([1, 2]);
    q.release();
    expect(calls).toEqual([1, 2, 3]);
  });
  it('does not throw on extra releases', () => {
    const q = new AnimationQueue(2);
    expect(() => q.release()).not.toThrow();
  });
  it('drains queue correctly across multiple releases', () => {
    const q = new AnimationQueue(1);
    const calls: number[] = [];
    q.enqueue(() => calls.push(1));
    q.enqueue(() => calls.push(2));
    q.enqueue(() => calls.push(3));
    expect(calls).toEqual([1]);
    q.release();
    expect(calls).toEqual([1, 2]);
    q.release();
    expect(calls).toEqual([1, 2, 3]);
  });
});

describe('collectTextNodes', () => {
  it('collects text nodes from nested elements', () => {
    const div = makeNestedDiv();
    const nodes = collectTextNodes(div);
    expect(nodes.map((n) => n.original)).toEqual(['hello ', 'world']);
  });

  it('skips data-no-reveal subtrees', () => {
    const div = document.createElement('div');
    const visible = document.createElement('p');
    visible.appendChild(document.createTextNode('visible'));
    const hidden = document.createElement('div');
    hidden.setAttribute('data-no-reveal', 'true');
    const hiddenP = document.createElement('p');
    hiddenP.appendChild(document.createTextNode('hidden'));
    hidden.appendChild(hiddenP);
    div.appendChild(visible);
    div.appendChild(hidden);
    expect(collectTextNodes(div).map((n) => n.original)).toEqual(['visible']);
  });

  it('skips aria-hidden subtrees', () => {
    const div = document.createElement('div');
    const visible = document.createElement('p');
    visible.appendChild(document.createTextNode('visible'));
    const hidden = document.createElement('div');
    hidden.setAttribute('aria-hidden', 'true');
    const hiddenP = document.createElement('p');
    hiddenP.appendChild(document.createTextNode('hidden'));
    hidden.appendChild(hiddenP);
    div.appendChild(visible);
    div.appendChild(hidden);
    expect(collectTextNodes(div).map((n) => n.original)).toEqual(['visible']);
  });

  it('skips button and canvas elements and their children', () => {
    const div = document.createElement('div');
    const visible = document.createElement('p');
    visible.appendChild(document.createTextNode('visible'));
    const btn = document.createElement('button');
    btn.appendChild(document.createTextNode('click'));
    const canvas = document.createElement('canvas');
    canvas.appendChild(document.createTextNode('draw'));
    div.appendChild(visible);
    div.appendChild(btn);
    div.appendChild(canvas);
    expect(collectTextNodes(div).map((n) => n.original)).toEqual(['visible']);
  });

  it('skips whitespace-only text nodes', () => {
    const div = document.createElement('div');
    const empty = document.createElement('p');
    empty.appendChild(document.createTextNode('   '));
    const real = document.createElement('p');
    real.appendChild(document.createTextNode('real'));
    div.appendChild(empty);
    div.appendChild(real);
    expect(collectTextNodes(div).map((n) => n.original)).toEqual(['real']);
  });

  it('returns empty array for empty element', () => {
    const div = document.createElement('div');
    expect(collectTextNodes(div)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests and verify they pass**

```bash
pnpm test
```

Expected: all tests PASS, zero failures.

- [ ] **Step 3: Commit**

```bash
git add __tests__/section-reveal-utils.test.ts
git commit -m "test: unit tests for section-reveal animation utilities"
```

---

## Task 4: SectionReveal client component

**Files:**
- Create: `components/client/section-reveal.client.tsx`

- [ ] **Step 1: Create the component**

```typescript
// components/client/section-reveal.client.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimationQueue, charsPerFrame, collectTextNodes } from '@/lib/section-reveal-utils';

const GLYPHS =
  'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEF';

function randomGlyph(): string {
  return GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
}

const queue = new AnimationQueue(2);

type AnimState = 'IDLE' | 'TYPING' | 'TYPED' | 'ERASING';

interface TextRecord {
  node: Text;
  originalChars: string[];
  chars: string[];
  glitch: number[];
}

export interface SectionRevealProps {
  id: string;
  label: string;
  icon: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export function SectionReveal({
  id,
  label,
  icon,
  defaultOpen = true,
  children,
}: SectionRevealProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const stateRef = useRef<AnimState>('IDLE');
  const recordsRef = useRef<TextRecord[]>([]);
  const flatRef = useRef<Array<{ ri: number; ci: number }>>([]);
  const flatIdxRef = useRef(0);
  const hasSlotRef = useRef(false);
  const [open, setOpen] = useState(defaultOpen ?? true);

  // MobileDock sets data-open="true" on the wrapper to expand and scroll to this section
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const obs = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.attributeName === 'data-open' && el.getAttribute('data-open') === 'true') {
          el.removeAttribute('data-open');
          setOpen(true);
        }
      }
    });
    obs.observe(el, { attributes: true, attributeFilter: ['data-open'] });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Lock layout height to prevent CLS during animation
    // Skip for collapsed mobile sections (offsetHeight is 0 when closed)
    const isMobile = window.innerWidth <= 768;
    if (!isMobile || defaultOpen) {
      const h = el.offsetHeight;
      if (h > 0) el.style.minHeight = `${h}px`;
    }

    // Remove SSR mask — element becomes visible (text is blank until animation plays)
    el.classList.remove('reveal-mask');

    if (reduced) return;

    // Collect all text nodes under this wrapper, replace each with equal-length spaces
    const collected = collectTextNodes(el);
    const records: TextRecord[] = collected.map(({ node, original }) => {
      const originalChars = Array.from(original);
      const chars = originalChars.map(() => ' ');
      const glitch = new Array<number>(originalChars.length).fill(0);
      node.textContent = chars.join('');
      return { node, originalChars, chars, glitch };
    });
    recordsRef.current = records;

    const flat: Array<{ ri: number; ci: number }> = records.flatMap((r, ri) =>
      r.originalChars.map((_, ci) => ({ ri, ci })),
    );
    flatRef.current = flat;
    flatIdxRef.current = 0;

    function cancelRaf() {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
    }

    function acquireSlot(start: () => void) {
      if (hasSlotRef.current) {
        start();
      } else {
        queue.enqueue(() => {
          hasSlotRef.current = true;
          start();
        });
      }
    }

    function releaseSlot() {
      if (hasSlotRef.current) {
        hasSlotRef.current = false;
        queue.release();
      }
    }

    function flushNodes() {
      for (const r of records) r.node.textContent = r.chars.join('');
    }

    function tickGlitch() {
      for (const r of records) {
        for (let i = 0; i < r.glitch.length; i++) {
          if (r.glitch[i] > 0) {
            r.glitch[i]--;
            r.chars[i] = r.glitch[i] === 0 ? (r.originalChars[i] ?? ' ') : randomGlyph();
          }
        }
      }
    }

    function hasActiveGlitch(): boolean {
      return records.some((r) => r.glitch.some((g) => g > 0));
    }

    function scheduleTyping() {
      el.setAttribute('aria-busy', 'true');
      const N = charsPerFrame(flat.length);

      function frame() {
        if (stateRef.current !== 'TYPING') return;
        tickGlitch();

        for (let i = 0; i < N; i++) {
          const pos = flat[flatIdxRef.current];
          if (!pos) break;
          const r = records[pos.ri];
          if (!r) break;
          r.chars[pos.ci] = randomGlyph();
          r.glitch[pos.ci] = Math.random() < 0.5 ? 2 : 1;
          flatIdxRef.current++;
        }

        flushNodes();

        if (flatIdxRef.current >= flat.length) {
          function resolveFrame() {
            tickGlitch();
            flushNodes();
            if (hasActiveGlitch()) {
              rafRef.current = requestAnimationFrame(resolveFrame);
            } else {
              stateRef.current = 'TYPED';
              el.removeAttribute('aria-busy');
              releaseSlot();
            }
          }
          rafRef.current = requestAnimationFrame(resolveFrame);
        } else {
          rafRef.current = requestAnimationFrame(frame);
        }
      }

      rafRef.current = requestAnimationFrame(frame);
    }

    function scheduleErasing() {
      const N = charsPerFrame(flat.length);

      function frame() {
        if (stateRef.current !== 'ERASING') return;

        for (let i = 0; i < N; i++) {
          const idx = flatIdxRef.current - 1;
          if (idx < 0) break;
          const pos = flat[idx];
          if (!pos) break;
          const r = records[pos.ri];
          if (!r) break;
          r.chars[pos.ci] = ' ';
          r.glitch[pos.ci] = 0;
          flatIdxRef.current--;
        }

        flushNodes();

        if (flatIdxRef.current <= 0) {
          stateRef.current = 'IDLE';
          el.removeAttribute('aria-busy');
          releaseSlot();
        } else {
          rafRef.current = requestAnimationFrame(frame);
        }
      }

      rafRef.current = requestAnimationFrame(frame);
    }

    function onEntry() {
      if (stateRef.current === 'TYPED') return;
      cancelRaf();
      if (stateRef.current === 'ERASING') {
        stateRef.current = 'TYPING';
        scheduleTyping();
      } else if (stateRef.current === 'IDLE') {
        stateRef.current = 'TYPING';
        acquireSlot(scheduleTyping);
      }
    }

    function onExit() {
      if (stateRef.current === 'IDLE') return;
      cancelRaf();
      if (stateRef.current === 'TYPING') {
        stateRef.current = 'ERASING';
        scheduleErasing();
      } else if (stateRef.current === 'TYPED') {
        stateRef.current = 'ERASING';
        acquireSlot(scheduleErasing);
      }
    }

    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        if (entry.isIntersecting && entry.intersectionRatio >= 0.1) {
          onEntry();
        } else if (!entry.isIntersecting) {
          onExit();
        }
      },
      { threshold: [0, 0.1] },
    );
    io.observe(el);

    return () => {
      cancelRaf();
      io.disconnect();
      releaseSlot();
      for (const r of records) r.node.textContent = r.originalChars.join('');
    };
  }, [defaultOpen]);

  return (
    <div
      id={id}
      ref={wrapperRef}
      data-section-id={id}
      className="reveal-mask"
    >
      <button
        type="button"
        className="mod-head"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-controls={`${id}-body`}
      >
        <span aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'center' }}>
          {icon}
        </span>
        <span>{label}</span>
        <span
          aria-hidden="true"
          style={{
            marginLeft: 'auto',
            fontSize: '10px',
            transition: 'transform 200ms',
            transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
          }}
        >
          {'>'}
        </span>
      </button>
      <div id={`${id}-body`} className={open ? undefined : 'mod-body--closed'}>
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add components/client/section-reveal.client.tsx
git commit -m "feat: add SectionReveal with matrix animation and mobile accordion"
```

---

## Task 5: MobileStatusbar

**Files:**
- Create: `components/client/mobile-statusbar.client.tsx`

- [ ] **Step 1: Create the component**

```typescript
// components/client/mobile-statusbar.client.tsx
'use client';

import { useEffect, useState } from 'react';

function formatTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function MobileStatusbar() {
  const [time, setTime] = useState(() => formatTime(new Date()));

  useEffect(() => {
    const id = setInterval(() => setTime(formatTime(new Date())), 15_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      className="mobile-flex mobile-only"
      style={{
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 6px)',
        paddingBottom: '6px',
        paddingLeft: '16px',
        paddingRight: '16px',
        background: 'var(--color-bg)',
        borderBottom: '1px solid var(--color-signal-dim)',
      }}
    >
      <span style={{ color: 'var(--color-fg)', fontSize: '12px', fontWeight: 600 }}>
        {time}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <div
          aria-hidden="true"
          style={{ display: 'flex', alignItems: 'flex-end', gap: '2px' }}
        >
          {([4, 6, 8, 10] as const).map((h, i) => (
            <div
              key={h}
              style={{
                width: '3px',
                height: `${h}px`,
                background: 'var(--color-signal)',
                opacity: i === 3 ? 0.5 : 1,
              }}
            />
          ))}
        </div>
        <span
          aria-hidden="true"
          style={{ color: 'var(--color-signal)', fontSize: '11px', fontWeight: 700 }}
        >
          5G
        </span>
        <div
          aria-hidden="true"
          style={{ display: 'flex', alignItems: 'center', gap: '1px' }}
        >
          <div
            style={{
              width: '22px',
              height: '11px',
              border: '1px solid var(--color-signal)',
              borderRadius: '2px',
              padding: '1px',
            }}
          >
            <div style={{ width: '78%', height: '100%', background: 'var(--color-signal)' }} />
          </div>
          <div
            style={{
              width: '2px',
              height: '5px',
              background: 'var(--color-signal)',
              borderRadius: '0 1px 1px 0',
            }}
          />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/client/mobile-statusbar.client.tsx
git commit -m "feat: add MobileStatusbar component"
```

---

## Task 6: MobileAppbar (RSC)

**Files:**
- Create: `components/sections/mobile-appbar.tsx`

- [ ] **Step 1: Create the component**

```typescript
// components/sections/mobile-appbar.tsx
export function MobileAppbar() {
  return (
    <div
      className="mobile-flex mobile-only"
      style={{
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 16px',
        background: 'var(--color-bg)',
        borderBottom: '1px solid var(--color-signal-dim)',
      }}
    >
      <div
        aria-hidden="true"
        style={{ display: 'flex', gap: '6px', alignItems: 'center' }}
      >
        <div
          style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#FF5F57' }}
        />
        <div
          style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#FEBC2E' }}
        />
        <div
          style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#28C840' }}
        />
      </div>
      <span
        style={{
          color: 'var(--color-signal)',
          fontWeight: 700,
          fontSize: '13px',
          letterSpacing: '0.08em',
        }}
      >
        PORTFOLIO.SH
      </span>
      <a
        href="/erik-cunha-cv.pdf"
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: 'var(--color-signal)', fontSize: '12px', fontWeight: 600 }}
      >
        CV
        {' '}
        {'↗'}
      </a>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/sections/mobile-appbar.tsx
git commit -m "feat: add MobileAppbar RSC"
```

---

## Task 7: MobileDock

**Files:**
- Create: `components/client/mobile-dock.client.tsx`

- [ ] **Step 1: Create the component**

```typescript
// components/client/mobile-dock.client.tsx
'use client';

import { useEffect, useState } from 'react';

const TABS = [
  {
    label: 'HOME',
    target: 'sec-readme',
    icon: (
      <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" strokeWidth="1.5" aria-hidden="true">
        <path d="M3 12L12 3l9 9" />
        <path d="M9 21V12h6v9" />
      </svg>
    ),
  },
  {
    label: 'WORK',
    target: 'sec-projects',
    icon: (
      <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" strokeWidth="1.5" aria-hidden="true">
        <rect x="2" y="7" width="20" height="14" rx="1" />
        <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
      </svg>
    ),
  },
  {
    label: 'PERF',
    target: 'sec-perf-receipts',
    icon: (
      <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" strokeWidth="1.5" aria-hidden="true">
        <polyline points="2,12 6,12 9,5 12,19 15,12 18,12 22,12" />
      </svg>
    ),
  },
  {
    label: 'SHELL',
    target: 'sec-shell',
    icon: (
      <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" strokeWidth="1.5" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="1" />
        <path d="M7 8l4 4-4 4M13 16h4" />
      </svg>
    ),
  },
  {
    label: 'HIRE',
    target: 'sec-contact',
    icon: (
      <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" strokeWidth="1.5" aria-hidden="true">
        <rect x="2" y="4" width="20" height="16" rx="1" />
        <path d="M2 7l10 7 10-7" />
      </svg>
    ),
  },
] as const;

export function MobileDock() {
  const [active, setActive] = useState<string>('sec-readme');

  useEffect(() => {
    const sectionEls = Array.from(
      document.querySelectorAll<HTMLElement>('[data-section-id]'),
    );
    const intersecting = new Set<string>();

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const sectionId = (entry.target as HTMLElement).dataset.sectionId;
          if (!sectionId) continue;
          if (entry.isIntersecting) {
            intersecting.add(sectionId);
          } else {
            intersecting.delete(sectionId);
          }
        }
        let topId: string | null = null;
        let topY = Infinity;
        for (const sectionId of intersecting) {
          const el = document.getElementById(sectionId);
          if (!el) continue;
          const y = el.getBoundingClientRect().top;
          if (y < topY) {
            topY = y;
            topId = sectionId;
          }
        }
        if (topId) setActive(topId);
      },
      { threshold: 0.1 },
    );

    for (const el of sectionEls) io.observe(el);
    return () => io.disconnect();
  }, []);

  function navigateTo(target: string) {
    const el = document.getElementById(target);
    if (!el) return;
    el.setAttribute('data-open', 'true');
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <nav
      className="mobile-flex mobile-only"
      aria-label="Section navigation"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 120,
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)',
        backdropFilter: 'blur(8px)',
        background: 'rgba(0,0,0,0.92)',
        borderTop: '1px solid var(--color-signal-dim)',
      }}
    >
      {TABS.map((tab) => (
        <button
          key={tab.target}
          type="button"
          onClick={() => navigateTo(tab.target)}
          aria-label={`Go to ${tab.label}`}
          aria-current={active === tab.target ? 'location' : undefined}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '3px',
            padding: '10px 4px 4px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color:
              active === tab.target
                ? 'var(--color-signal)'
                : 'var(--color-fg-muted)',
            fontSize: '9px',
            letterSpacing: '0.08em',
            fontFamily: 'var(--font-mono)',
            fontWeight: active === tab.target ? 700 : 400,
            transition: 'color 120ms',
          }}
        >
          {tab.icon}
          <span>{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/client/mobile-dock.client.tsx
git commit -m "feat: add MobileDock with IntersectionObserver active-tab tracking"
```

---

## Task 8: MobileTotop

**Files:**
- Create: `components/client/mobile-totop.client.tsx`

- [ ] **Step 1: Create the component**

```typescript
// components/client/mobile-totop.client.tsx
'use client';

import { useEffect, useState } from 'react';

export function MobileTotop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <button
      type="button"
      className="mobile-only"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Scroll to top"
      aria-hidden={!visible}
      style={{
        position: 'fixed',
        bottom: 'calc(72px + env(safe-area-inset-bottom, 0px) + 14px)',
        right: '16px',
        zIndex: 115,
        width: '40px',
        height: '40px',
        background: 'var(--color-bg)',
        border: '1px solid var(--color-signal)',
        color: 'var(--color-signal)',
        fontSize: '18px',
        fontFamily: 'var(--font-mono)',
        cursor: 'pointer',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(8px)',
        transition: 'opacity 200ms, transform 200ms',
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      {'↑'}
    </button>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/client/mobile-totop.client.tsx
git commit -m "feat: add MobileTotop floating scroll-to-top button"
```

---

## Task 9: Shell chips + data-no-reveal

**Files:**
- Modify: `components/client/shell.client.tsx`

- [ ] **Step 1: Add `data-no-reveal="true"` to the ShellClient root div**

Find the return statement's root div at approximately line 232:

```tsx
// BEFORE:
<div
  role="application"
  aria-label="interactive terminal"
  className="panel"
  style={{ padding: 0, overflow: 'hidden', cursor: 'text' }}
  onClick={() => inputRef.current?.focus()}
>

// AFTER:
<div
  role="application"
  aria-label="interactive terminal"
  className="panel"
  data-no-reveal="true"
  style={{ padding: 0, overflow: 'hidden', cursor: 'text' }}
  onClick={() => inputRef.current?.focus()}
>
```

- [ ] **Step 2: Add quick-command chip row after the input area div**

After the closing `</div>` of the input area (the div with `borderTop: '1px solid var(--color-signal-dim)'` containing the prompt and input), and before the closing `</div>` of the root div, insert:

```tsx
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '6px',
          padding: '8px 16px',
          borderTop: '1px solid var(--color-signal-dim)',
        }}
      >
        {(['whoami', 'ls', 'cat skills.md', 'cat ~/.now', 'contact', 'hire', 'help', 'clear'] as const).map(
          (cmd) => (
            <button
              key={cmd}
              type="button"
              disabled={busy}
              onClick={() => {
                setInput('');
                void run(cmd);
              }}
              style={{
                background: 'none',
                border: '1px solid var(--color-signal-dim)',
                color: 'var(--color-fg-muted)',
                fontSize: '11px',
                padding: '2px 8px',
                fontFamily: 'var(--font-mono)',
                cursor: busy ? 'not-allowed' : 'pointer',
                letterSpacing: '0.06em',
                opacity: busy ? 0.5 : 1,
              }}
            >
              {cmd}
            </button>
          ),
        )}
      </div>
```

- [ ] **Step 3: Run Biome and typecheck**

```bash
pnpm check:fix && pnpm typecheck
```

Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add components/client/shell.client.tsx
git commit -m "feat: add shell quick-command chips and data-no-reveal"
```

---

## Task 10: Contact data-no-reveal

**Files:**
- Modify: `components/sections/contact.tsx`

- [ ] **Step 1: Add `data-no-reveal` to the panel div surrounding ContactFormClient**

```tsx
// BEFORE:
      <div className="panel">
        <ContactFormClient />
      </div>

// AFTER:
      <div className="panel" data-no-reveal="true">
        <ContactFormClient />
      </div>
```

- [ ] **Step 2: Commit**

```bash
git add components/sections/contact.tsx
git commit -m "feat: add data-no-reveal to ContactSection panel"
```

---

## Task 11: page.tsx — wire all components

**Files:**
- Modify: `app/page.tsx`
- Possibly modify: `components/sections/topbar.tsx`

- [ ] **Step 1: Read topbar.tsx to check if it accepts className prop**

Open `components/sections/topbar.tsx`. If the component does not accept or spread a `className` prop on its root element, add it:

```tsx
// Add className prop to the Topbar signature and root element:
export function Topbar({ className }: { className?: string }) {
  return (
    <header className={className} ...>
```

- [ ] **Step 2: Replace the full content of app/page.tsx**

```tsx
// app/page.tsx
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { SectionReveal } from '@/components/client/section-reveal.client';
import { MobileDock } from '@/components/client/mobile-dock.client';
import { MobileStatusbar } from '@/components/client/mobile-statusbar.client';
import { MobileTotop } from '@/components/client/mobile-totop.client';
import { CommunitySection } from '@/components/sections/community';
import { ContactSection } from '@/components/sections/contact';
import { CredentialsSection } from '@/components/sections/credentials';
import { FooterSection } from '@/components/sections/footer';
import { GitLogSection } from '@/components/sections/git-log';
import { GuitarRigSection } from '@/components/sections/guitar-rig';
import { HeroSection } from '@/components/sections/hero';
import { HottestTakesSection } from '@/components/sections/hottest-takes';
import { LivePerfSection } from '@/components/sections/live-perf';
import { ManPageSection } from '@/components/sections/man-page';
import { MobileAppbar } from '@/components/sections/mobile-appbar';
import { NowSection } from '@/components/sections/now';
import { NpmStackSection } from '@/components/sections/npm-stack';
import { PerfReceiptsSection } from '@/components/sections/perf-receipts';
import { ProjectsSection } from '@/components/sections/projects';
import { ReadmeSection } from '@/components/sections/readme';
import { ResponsibilitiesSection } from '@/components/sections/responsibilities';
import { ShellSection } from '@/components/sections/shell-section';
import { SysHealthSection } from '@/components/sections/sys-health';
import { Topbar } from '@/components/sections/topbar';
import { UnknownsSection } from '@/components/sections/unknowns';
import { VisaSection } from '@/components/sections/visa';

// SVG icon constants for mobile accordion headers (14x14, signal-green stroke)
const Icons = {
  readme: <svg viewBox="0 0 24 24" width="14" height="14" stroke="var(--color-signal)" fill="none" strokeWidth="1.4" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="1" /><path d="M7 8l4 4-4 4M13 16h4" /></svg>,
  man:    <svg viewBox="0 0 24 24" width="14" height="14" stroke="var(--color-signal)" fill="none" strokeWidth="1.4" aria-hidden="true"><path d="M4 6h16M4 10h16M4 14h10" /></svg>,
  now:    <svg viewBox="0 0 24 24" width="14" height="14" stroke="var(--color-signal)" fill="none" strokeWidth="1.4" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></svg>,
  proj:   <svg viewBox="0 0 24 24" width="14" height="14" stroke="var(--color-signal)" fill="none" strokeWidth="1.4" aria-hidden="true"><path d="M3 7h5l2-2h11v14H3z" /></svg>,
  git:    <svg viewBox="0 0 24 24" width="14" height="14" stroke="var(--color-signal)" fill="none" strokeWidth="1.4" aria-hidden="true"><circle cx="6" cy="18" r="2" /><circle cx="6" cy="6" r="2" /><circle cx="18" cy="6" r="2" /><path d="M6 8v8M8 6h5a5 5 0 0 1 5 5" /></svg>,
  stack:  <svg viewBox="0 0 24 24" width="14" height="14" stroke="var(--color-signal)" fill="none" strokeWidth="1.4" aria-hidden="true"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>,
  pulse:  <svg viewBox="0 0 24 24" width="14" height="14" stroke="var(--color-signal)" fill="none" strokeWidth="1.4" aria-hidden="true"><polyline points="2,12 6,12 9,5 12,19 15,12 18,12 22,12" /></svg>,
  bar:    <svg viewBox="0 0 24 24" width="14" height="14" stroke="var(--color-signal)" fill="none" strokeWidth="1.4" aria-hidden="true"><path d="M4 20V10M9 20V4M14 20v-8M19 20V7" /></svg>,
  receipt:<svg viewBox="0 0 24 24" width="14" height="14" stroke="var(--color-signal)" fill="none" strokeWidth="1.4" aria-hidden="true"><rect x="4" y="2" width="16" height="20" /><path d="M8 7h8M8 11h8M8 15h5" /></svg>,
  flame:  <svg viewBox="0 0 24 24" width="14" height="14" stroke="var(--color-signal)" fill="none" strokeWidth="1.4" aria-hidden="true"><path d="M12 2s3 5 3 8a3 3 0 0 1-6 0c0-3 3-8 3-8z" /></svg>,
  user:   <svg viewBox="0 0 24 24" width="14" height="14" stroke="var(--color-signal)" fill="none" strokeWidth="1.4" aria-hidden="true"><circle cx="12" cy="7" r="4" /><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" /></svg>,
  unk:    <svg viewBox="0 0 24 24" width="14" height="14" stroke="var(--color-signal)" fill="none" strokeWidth="1.4" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M10 9.5a2 2 0 1 1 2 2c0 1 0 1.5-.5 2M12 17v.5" /></svg>,
  music:  <svg viewBox="0 0 24 24" width="14" height="14" stroke="var(--color-signal)" fill="none" strokeWidth="1.4" aria-hidden="true"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>,
  globe:  <svg viewBox="0 0 24 24" width="14" height="14" stroke="var(--color-signal)" fill="none" strokeWidth="1.4" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c-4 2-6 5-6 9s2 7 6 9M12 3c4 2 6 5 6 9s-2 7-6 9" /></svg>,
  badge:  <svg viewBox="0 0 24 24" width="14" height="14" stroke="var(--color-signal)" fill="none" strokeWidth="1.4" aria-hidden="true"><path d="M12 2l2.5 5 5.5.8-4 3.9.9 5.5L12 14.8l-4.9 2.4.9-5.5-4-3.9L9.5 7z" /></svg>,
  people: <svg viewBox="0 0 24 24" width="14" height="14" stroke="var(--color-signal)" fill="none" strokeWidth="1.4" aria-hidden="true"><circle cx="8" cy="7" r="3" /><path d="M2 21c0-3.3 2.7-6 6-6M14 21c0-3.3-2.7-6-6-6" /><circle cx="16" cy="7" r="3" /><path d="M22 21c0-3.3-2.7-6-6-6" /></svg>,
  term:   <svg viewBox="0 0 24 24" width="14" height="14" stroke="var(--color-signal)" fill="none" strokeWidth="1.4" aria-hidden="true"><rect x="2" y="3" width="20" height="18" rx="1" /><path d="M6 8l4 4-4 4M13 16h5" /></svg>,
  mail:   <svg viewBox="0 0 24 24" width="14" height="14" stroke="var(--color-signal)" fill="none" strokeWidth="1.4" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="1" /><path d="M2 7l10 7 10-7" /></svg>,
};

export default function Home() {
  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {/* Sticky mobile chrome wrapper — stacks statusbar and appbar */}
      <div
        className="mobile-only"
        style={{ position: 'sticky', top: 0, zIndex: 110 }}
      >
        <MobileStatusbar />
        <MobileAppbar />
      </div>

      <Topbar className="desktop-only" />

      <main
        id="main-content"
        style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px' }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '56px',
            paddingBottom: '64px',
          }}
        >
          <div className="desktop-only">
            <HeroSection />
          </div>

          <SectionReveal id="sec-readme" label="CAT README.MD" icon={Icons.readme}>
            <ReadmeSection />
          </SectionReveal>

          <SectionReveal id="sec-man-page" label="ERIK.1 --MANUAL" icon={Icons.man}>
            <ManPageSection />
          </SectionReveal>

          <SectionReveal id="sec-now" label="CAT ~/.NOW" icon={Icons.now}>
            <NowSection />
          </SectionReveal>

          <SectionReveal id="sec-projects" label="LS PROJECTS/" icon={Icons.proj}>
            <ProjectsSection />
          </SectionReveal>

          <SectionReveal id="sec-git-log" label="GIT LOG" icon={Icons.git}>
            <GitLogSection />
          </SectionReveal>

          <SectionReveal id="sec-npm-stack" label="NPM LIST --GLOBAL" icon={Icons.stack}>
            <NpmStackSection />
          </SectionReveal>

          <SectionReveal id="sec-sys-health" label="SYS HEALTH" icon={Icons.pulse}>
            <SysHealthSection />
          </SectionReveal>

          <SectionReveal id="sec-live-perf" label="LIVE PERF" icon={Icons.bar}>
            <LivePerfSection />
          </SectionReveal>

          <SectionReveal id="sec-perf-receipts" label="PERF RECEIPTS" icon={Icons.receipt}>
            <PerfReceiptsSection />
          </SectionReveal>

          <SectionReveal id="sec-hottest-takes" label="HOTTEST TAKES" icon={Icons.flame}>
            <HottestTakesSection />
          </SectionReveal>

          <SectionReveal id="sec-responsibilities" label="RESPONSIBILITIES" icon={Icons.user}>
            <ResponsibilitiesSection />
          </SectionReveal>

          <SectionReveal id="sec-unknowns" label="CAT ~/.UNKNOWNS" icon={Icons.unk}>
            <UnknownsSection />
          </SectionReveal>

          <SectionReveal id="sec-guitar-rig" label="CAT ~/.GUITAR_RIG" icon={Icons.music}>
            <GuitarRigSection />
          </SectionReveal>

          <SectionReveal id="sec-visa" label="CAT ~/.VISA" icon={Icons.globe}>
            <VisaSection />
          </SectionReveal>

          <SectionReveal id="sec-credentials" label="CAT ~/.CREDENTIALS" icon={Icons.badge}>
            <CredentialsSection />
          </SectionReveal>

          <SectionReveal id="sec-community" label="CAT ~/.COMMUNITY" icon={Icons.people}>
            <CommunitySection />
          </SectionReveal>

          <SectionReveal id="sec-shell" label="INTERACTIVE_SHELL" icon={Icons.term}>
            <ShellSection />
          </SectionReveal>

          <SectionReveal id="sec-contact" label="SUDO CONTACT --INIT" icon={Icons.mail}>
            <ContactSection />
          </SectionReveal>
        </div>
      </main>

      <FooterSection />

      <MobileDock />
      <MobileTotop />

      <Analytics />
      <SpeedInsights />
    </>
  );
}
```

- [ ] **Step 3: Run typecheck**

```bash
pnpm typecheck
```

Expected: no errors. If Topbar does not accept className, fix it first (see Step 1).

- [ ] **Step 4: Run full build**

```bash
pnpm build
```

Expected: clean build, route table unchanged (`/` and API routes).

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx components/sections/topbar.tsx
git commit -m "feat: wire SectionReveal and mobile chrome into page"
```

---

## Task 12: Build verification + smoke test

- [ ] **Step 1: Run full CI pipeline**

```bash
pnpm ci
```

Expected: all steps pass — biome, typecheck, validate-content, vitest (tests pass), build, bundle-check.

- [ ] **Step 2: Start dev server**

```bash
pnpm dev
```

- [ ] **Step 3: Verify mobile layout at 375px**

Open `http://localhost:3000`, resize to 375px width. Check:
- Status bar renders at top: time, signal bars, 5G label, battery
- App bar renders below it: traffic lights, PORTFOLIO.SH, CV link
- Bottom dock fixed with 5 tabs (HOME, WORK, PERF, SHELL, HIRE)
- Sections show accordion toggle buttons with icons and labels
- Section text starts blank then types in as you scroll
- Tapping WORK scrolls to and expands the projects section
- After scrolling 400px+, the floating arrow button appears
- Tapping it scrolls back to top

- [ ] **Step 4: Verify desktop layout at 1200px**

- Status bar, app bar, dock, and totop are all hidden
- No accordion buttons visible; all section bodies expanded
- Hero section is visible
- Matrix typing animation plays on scroll, reverses on scroll out
- Desktop layout unchanged from pre-feature state

---

## Spec coverage matrix

| Spec requirement | Task |
|---|---|
| `.reveal-mask`, `.mobile-only`, `.desktop-only`, `.mobile-flex` CSS | 1 |
| `.mod-body--closed`, `.mod-head` styles, media queries | 1 |
| `body padding-bottom` for dock clearance | 1 |
| `collectTextNodes` skips `[data-no-reveal]`, `input`, `button`, `canvas`, `[aria-hidden]`, `script`, `style` | 2 |
| `charsPerFrame = Math.max(1, Math.floor(total / 15))` | 2 |
| `AnimationQueue` caps concurrent at 2, queues excess | 2 |
| Unit tests for all three utilities | 3 |
| Mount: measure height, set min-height, collect+blank text, remove reveal-mask | 4 |
| IO threshold 0.1 for entry, 0 for exit | 4 |
| State machine: IDLE/TYPING/TYPED/ERASING with mid-animation direction reversal | 4 |
| Matrix glyph scramble 1-2 frames per char | 4 |
| `aria-busy` set/cleared during animation | 4 |
| `prefers-reduced-motion` instant reveal | 4 |
| MutationObserver for `data-open` attribute from MobileDock | 4 |
| `data-section-id` on wrapper for IO tracking | 4 |
| MobileStatusbar: live clock, signal bars, 5G, 78% battery, safe-area-inset | 5 |
| MobileAppbar: traffic-light dots, PORTFOLIO.SH, CV link | 6 |
| MobileDock: 5 tabs, expand+scroll on tap, IO-based active tab | 7 |
| MobileTotop: appears at scrollY > 400, smooth scroll to top | 8 |
| ShellClient `data-no-reveal` + 8 quick-command chips | 9 |
| ContactSection panel `data-no-reveal` | 10 |
| HeroSection hidden on mobile via `desktop-only` div | 11 |
| Topbar hidden on mobile via `className="desktop-only"` | 11 |
| Sticky mobile header wrapping both statusbar and appbar | 11 |
| All 18 non-hero sections wrapped in SectionReveal | 11 |
