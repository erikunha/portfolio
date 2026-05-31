// components/client/RoleTyper/RoleTyper.test.tsx
// Behavioral test (Phase 4 a11y): RoleTyper two-span ARIA contract.
//
// Structure under test:
//   - <span aria-hidden="true"> — animated visual; AT-invisible; className passed via prop
//   - <span.sr-only role="status" aria-live="polite"> — live region;
//     updated only when a full role name is completed (not per-character)
//
// Guarantees under test:
//   - animated pill is aria-hidden (AT ignores per-character mutations)
//   - sr-only span carries role="status" (live region, implies aria-live="polite")
//   - sr-only span carries aria-live="polite" (explicit AT compat)
//   - no static aria-label on the live region (content flows through text)
//
// Uses renderToStaticMarkup + DOMParser (jsdom env) for element-scoped queries
// instead of substring scanning the full HTML blob — safe as the tree grows.

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ROLES, RoleTyper } from './RoleTyper';

function getDOM() {
  const html = renderToStaticMarkup(createElement(RoleTyper));
  return new DOMParser().parseFromString(html, 'text/html');
}

function getPill() {
  return getDOM().querySelector('span[aria-hidden="true"]');
}

function getLiveRegion() {
  return getDOM().querySelector('span.sr-only[role="status"]');
}

// Guards the pill min-width budget via Tailwind min-w-[9em] utility.
// The CSS reserves 9em for the longest role including brackets.
// At 14px body / 0.6em-per-char in JetBrains Mono: 9em = 126px outer,
// minus 12px padding = 114px content; [Principal] = 11 chars ≈ 92px + letter-spacing.
// If a role longer than [Principal] is added, the pill will reflow.
describe('RoleTyper: ROLES length budget', () => {
  it('no role exceeds 9 chars (so [role] stays ≤ 11 chars, within the 9em CSS budget)', () => {
    const longest = Math.max(...ROLES.map((r) => r.length));
    // bracket wrap adds 2 chars, so pill text = role.length + 2
    // 9 chars + 2 brackets = 11 chars; matches min-width: 9em budget
    expect(longest).toBeLessThanOrEqual(9);
  });
});

describe('RoleTyper ARIA contract — animated pill', () => {
  it('is aria-hidden so AT ignores per-character textContent mutations', () => {
    expect(getPill()?.getAttribute('aria-hidden')).toBe('true');
  });

  it('does NOT carry role="status" (AT-hidden; live region is the sr-only sibling)', () => {
    expect(getPill()?.getAttribute('role')).not.toBe('status');
  });
});

describe('RoleTyper ARIA contract — sr-only live region', () => {
  it('carries role="status" so screen readers treat it as a live region', () => {
    expect(getLiveRegion()).not.toBeNull();
  });

  it('carries aria-live="polite" for explicit AT compatibility', () => {
    expect(getLiveRegion()?.getAttribute('aria-live')).toBe('polite');
  });

  it('does NOT carry a static aria-label (live region content is announced via text)', () => {
    expect(getLiveRegion()?.hasAttribute('aria-label')).toBe(false);
  });
});
