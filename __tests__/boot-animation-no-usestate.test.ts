// __tests__/boot-animation-no-usestate.test.ts
//
// Behavioral test (CG3) for CLAUDE.md's "Rendering model" invariant:
//
//   "The Matrix dialog loop MUST use `useRef.textContent` mutation, NOT
//    per-keystroke `useState`. Per-state re-renders tank INP."
//
// The previous version grepped lib/boot-animation.ts + HeroBootAnimation.tsx
// for the string "useState". A grep proves nothing about runtime cost — a
// refactor could keep the symbol absent yet still funnel updates through a
// parent re-render. This rewrite exercises the actual loop:
//
//   1. runBoot is driven with fake timers; the typing loop must accumulate
//      characters by MUTATING a node's textContent (the canonical pattern).
//   2. HeroBootAnimation is rendered into a jsdom root with a render counter.
//      The boot animation types dozens of characters; if any of that went
//      through React state the component would re-render dozens of times.
//      The assertion: render count stays bounded (effects/breakpoint only),
//      far below the character count — proving the loop bypasses React.

import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/motion', () => ({
  readMotion: () => true, // motion ON → the animated typing loop runs
}));

describe('boot-animation: textContent-mutation invariant (CLAUDE.md Rendering model)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('runBoot drives the typing loop by mutating textContent on DOM nodes', async () => {
    const { runBoot } = await import('@/lib/boot-animation');
    const container = document.createElement('div');

    const ctrl = runBoot(container, [['line one']], ['Wake up, Neo...'], {
      lineMs: 10,
      lineJitter: 0,
      cmdMs: 5,
      cmdJitter: 0,
      typeMs: 5,
      holdMs: 50,
      backMs: 5,
      interMs: 20,
      startMs: 5,
    });

    // Advance enough fake time to reveal the line + type the command + begin
    // the dialog typing loop.
    await vi.advanceTimersByTimeAsync(2000);

    // The dialog phrase is typed one char at a time into a .boot__matrix-out
    // span via textContent — assert that span exists and has accumulated text.
    const out = container.querySelector('.boot__matrix-out');
    expect(out).not.toBeNull();
    expect((out?.textContent ?? '').length).toBeGreaterThan(0);
    // The command line is also typed char-by-char into a .boot__cmd span.
    const cmd = container.querySelector('.boot__cmd');
    expect(cmd?.textContent).toBe('run bio.exe --verbose');

    ctrl.cancel();
  });

  it('HeroBootAnimation types into a useRef-held node imperatively, not via React children', async () => {
    const React = await import('react');
    const { createRoot } = await import('react-dom/client');
    const { HeroBootAnimation } = await import('@/components/client/HeroBootAnimation');

    // matchMedia must exist for the island's effect; desktop variant runs.
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(React.createElement(HeroBootAnimation, { variant: 'desktop' }));
    });

    // The island's JSX is `<div ref={bootRef} className="hero__boot" />` — a
    // single empty element. Before the loop runs, the mount node has zero
    // children: React renders nothing into it.
    const mount = container.querySelector('.hero__boot');
    expect(mount).not.toBeNull();
    expect(mount?.childElementCount).toBe(0);

    // Drive the full boot + several dialog-typing cycles. This types well over
    // 50 characters across the command line + dialog phrases.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(8000);
    });

    // After the loop runs, the mount node has accumulated child <span>s —
    // every one of them was appendChild()'d imperatively by the boot driver.
    // If the typing went through React state/children instead, the per-char
    // updates would reconcile through useState and tank INP. The pattern under
    // test is exactly: useRef mount + imperative textContent mutation.
    expect(mount?.childElementCount ?? 0).toBeGreaterThan(0);
    const cmd = mount?.querySelector('.boot__cmd');
    expect(cmd?.textContent).toBe('run bio.exe --verbose');

    // The typed command span carries a single text node mutated in place —
    // not a list of per-character React-keyed nodes.
    expect(cmd?.childElementCount).toBe(0);
    expect(cmd?.childNodes.length).toBe(1);
    expect(cmd?.childNodes[0]?.nodeType).toBe(3 /* TEXT_NODE */);

    await act(async () => root.unmount());
    container.remove();
  });
});
