// __tests__/roletyper-a11y.test.ts
// Behavioral test (Phase 4 a11y): RoleTyper live-region ARIA contract.
//
// Guarantees under test:
//   - role="status" is present (makes it a live region; implies aria-live="polite")
//   - aria-live="polite" is present (redundant but explicit, aids AT compat)
//   - role="img" is NOT present (old pattern that silenced dynamic updates)
//   - no static aria-label (live region content flows through text content)
//
// Uses renderToStaticMarkup + DOMParser (jsdom env) for element-scoped queries
// instead of substring scanning the full HTML blob — safe as the tree grows.

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { RoleTyper } from '@/components/client/RoleTyper';

function getSpan() {
  const html = renderToStaticMarkup(createElement(RoleTyper));
  return new DOMParser().parseFromString(html, 'text/html').querySelector('span.pill');
}

describe('RoleTyper ARIA live-region contract', () => {
  it('carries role="status" so screen readers treat it as a live region', () => {
    expect(getSpan()?.getAttribute('role')).toBe('status');
  });

  it('carries aria-live="polite" for explicit AT compatibility', () => {
    expect(getSpan()?.getAttribute('aria-live')).toBe('polite');
  });

  it('does NOT carry role="img" (static image role silences dynamic updates)', () => {
    expect(getSpan()?.getAttribute('role')).not.toBe('img');
  });

  it('does NOT carry a static aria-label (live region content is announced via text)', () => {
    expect(getSpan()?.hasAttribute('aria-label')).toBe(false);
  });
});
