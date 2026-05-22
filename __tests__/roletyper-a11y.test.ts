// __tests__/roletyper-a11y.test.ts
// Behavioral test (Phase 4 a11y): RoleTyper two-span ARIA contract.
//
// Structure under test:
//   - <span.pill aria-hidden="true"> — animated visual; AT-invisible
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
import { RoleTyper } from '@/components/client/RoleTyper';

function getDOM() {
  const html = renderToStaticMarkup(createElement(RoleTyper));
  return new DOMParser().parseFromString(html, 'text/html');
}

function getPill() {
  return getDOM().querySelector('span.pill');
}

function getLiveRegion() {
  return getDOM().querySelector('span.sr-only[role="status"]');
}

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
