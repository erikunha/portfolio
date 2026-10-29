import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DesignSystemOpinion } from '@/app/design-system/_components/DesignSystemOpinion';
import { hottestTakes } from '@/content/hottest-takes';

describe('design-system opinion', () => {
  it('renders the DS take under the opinion-07 anchor with its tag and text', () => {
    const container = document.createElement('div');
    container.innerHTML = renderToStaticMarkup(<DesignSystemOpinion />);
    const block = container.querySelector('#opinion-07');
    expect(block).not.toBeNull();
    expect(block?.querySelector('h2')?.textContent).toBe('Opinion 07: design systems');
    expect(block?.textContent).toContain('DS');
    expect(block?.textContent).toContain(
      'Framework-agnostic design systems lose unless the contract is shipping, not theory.',
    );
    expect(block?.textContent).toContain('Stencil at Betsson worked because');
  });

  it('keeps no docs-placement take without a render path', () => {
    const docs = hottestTakes.filter((take) => take.placement === 'docs');
    expect(docs.map((take) => take.category)).toEqual(['DS']);
  });
});
