import { act, createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mountClient } from '@/__tests__/helpers/render';
import { ROLES, RoleTyper } from './RoleTyper';

vi.mock('@/lib/motion', () => ({
  readMotion: vi.fn(() => true),
}));

function getDOM() {
  const html = renderToStaticMarkup(createElement(RoleTyper));
  return new DOMParser().parseFromString(html, 'text/html');
}

function getPill() {
  return getDOM().querySelector('[data-role-pill]');
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

describe('RoleTyper: role vocabulary', () => {
  it('never names a Staff or Principal role', () => {
    expect(
      ROLES.some((role) => /staff|principal/i.test(role)),
      'owner decision 2026-10-30: no Staff or Principal wording on the hiring surface',
    ).toBe(false);
  });

  it('offers Senior, the level the resume and the copy state', () => {
    expect(ROLES).toContain('Senior');
  });
});

describe('RoleTyper: slot sizing', () => {
  it('reserves the slot from the full role text instead of a fixed em reservation', () => {
    const doc = getDOM();
    const slot = doc.querySelector('.role-typer');
    expect(slot, 'the pill sits in a slot that owns the reserved width').not.toBeNull();
    const sizer = slot?.querySelector('.role-typer-sizer');
    expect(sizer?.getAttribute('data-role-text')).toBe(`[${ROLES[0]}]`);
    expect(
      doc.querySelector('.min-w-\\[9em\\]'),
      'the fixed 9em slot left a gap after the badge',
    ).toBe(null);
  });
});

describe('RoleTyper: typing', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('types the role once and holds it, so the badge never empties itself', async () => {
    const { RoleTyper } = await import('./RoleTyper');
    const mounted = await mountClient(<RoleTyper />);
    const pill = mounted.container.querySelector('[data-role-pill]');
    expect(pill).not.toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(pill?.textContent, 'the role is fully typed').toBe(`[${ROLES[0]}]`);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });
    expect(pill?.textContent, 'the role stays typed instead of erasing and retyping').toBe(
      `[${ROLES[0]}]`,
    );

    mounted.unmount();
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
