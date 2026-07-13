import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Breadcrumb } from './Breadcrumb';

const TRAIL = [
  { name: 'Home', path: '/' },
  { name: 'Design System', path: '/design-system' },
  { name: 'Tokens', path: '/design-system/tokens' },
];

describe('Breadcrumb', () => {
  it('renders a labelled breadcrumb nav with a link per non-final crumb', () => {
    const { container } = render(<Breadcrumb trail={TRAIL} />);
    const nav = container.querySelector('nav[aria-label="Breadcrumb"]');
    expect(nav).not.toBeNull();
    expect(nav?.querySelector('a[href="/design-system"]')).not.toBeNull();
    // final crumb is current page: not a link
    expect(nav?.querySelector('a[href="/design-system/tokens"]')).toBeNull();
  });

  it('emits BreadcrumbList JSON-LD matching the trail', () => {
    const { container } = render(<Breadcrumb trail={TRAIL} />);
    const script = container.querySelector('script[type="application/ld+json"]');
    const data = JSON.parse(script?.textContent ?? '{}');
    expect(data['@type']).toBe('BreadcrumbList');
    expect(data.itemListElement).toHaveLength(3);
    expect(data.itemListElement[2].item).toBe('https://erikunha.dev/design-system/tokens');
  });
});
