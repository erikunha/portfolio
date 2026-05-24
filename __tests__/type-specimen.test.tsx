// __tests__/type-specimen.test.tsx
// Behavioral tests for app/design-system/_components/TypeSpecimen/TypeSpecimen.tsx.
// Locks down: renders token name and resolved font size; returns null for
// unknown tokens.

import { createElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { type MountedClient, mountClient } from './helpers/render';

describe('TypeSpecimen', () => {
  let mounted: MountedClient;

  afterEach(() => {
    mounted?.unmount();
  });

  async function render(props: { token: string }) {
    const { TypeSpecimen } = await import(
      '@/app/design-system/_components/TypeSpecimen/TypeSpecimen'
    );
    mounted = await mountClient(createElement(TypeSpecimen, props));
    return mounted.container;
  }

  it('renders the token name in a <code> element', async () => {
    const container = await render({ token: 'ds-text-size-base' });
    const code = container.querySelector('code');
    expect(code).not.toBeNull();
    expect(code?.textContent).toContain('ds-text-size-base');
  });

  it('renders the resolved font size value', async () => {
    const container = await render({ token: 'ds-text-size-base' });
    // ds-text-size-base = 14px
    expect(container.textContent).toContain('14px');
  });

  it('renders null for an unknown token', async () => {
    const container = await render({ token: 'nonexistent-token' });
    expect(container.firstChild).toBeNull();
  });

  it('applies the font size as inline style on the specimen element', async () => {
    const container = await render({ token: 'ds-text-size-lg' });
    // ds-text-size-lg = 22px
    const specimen = container.querySelector('[aria-hidden="true"]') as HTMLElement | null;
    expect(specimen).not.toBeNull();
    expect(specimen?.style.fontSize).toBe('22px');
  });

  it('renders "Aa" sample text in the specimen', async () => {
    const container = await render({ token: 'ds-text-size-sm' });
    const specimen = container.querySelector('[aria-hidden="true"]');
    expect(specimen?.textContent).toBe('Aa');
  });
});
