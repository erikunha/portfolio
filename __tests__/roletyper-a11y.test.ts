// __tests__/roletyper-a11y.test.ts
// Behavioral test (Phase 4 a11y): RoleTyper live-region ARIA contract.
//
// Guarantees under test:
//   - role="status" is present (makes it a live region; implies aria-live="polite")
//   - aria-live="polite" is present (redundant but explicit, aids AT compatibility)
//   - role="img" is NOT present (the old incorrect pattern that silenced updates)
//   - no static aria-label (live region content must flow through text content)
//
// Uses renderToStaticMarkup to assert on the committed static HTML — the same
// pattern as hero-rsc.test.ts. useEffect/useRef effects do not run under
// renderToStaticMarkup, so only the initial JSX attributes are examined.

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { RoleTyper } from '@/components/client/RoleTyper';

const render = () => renderToStaticMarkup(createElement(RoleTyper));

describe('RoleTyper ARIA live-region contract', () => {
  it('carries role="status" so screen readers treat it as a live region', () => {
    const html = render();
    expect(html).toContain('role="status"');
  });

  it('carries aria-live="polite" for explicit AT compatibility', () => {
    const html = render();
    expect(html).toContain('aria-live="polite"');
  });

  it('does NOT carry role="img" (static image role silences dynamic updates)', () => {
    const html = render();
    expect(html).not.toContain('role="img"');
  });

  it('does NOT carry a static aria-label (live region content is announced via text)', () => {
    const html = render();
    expect(html).not.toContain('aria-label=');
  });
});
