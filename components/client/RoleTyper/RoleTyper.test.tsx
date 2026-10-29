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

describe('RoleTyper: ROLES length budget', () => {
  it('no role exceeds 9 chars (so [role] stays ≤ 11 chars, within the 9em CSS budget)', () => {
    const longest = Math.max(...ROLES.map((r) => r.length));
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
