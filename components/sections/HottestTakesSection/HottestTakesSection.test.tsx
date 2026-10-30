import { getByRole } from '@testing-library/dom';
import { render } from '@testing-library/react';
import { parse } from 'postcss';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { readComponentsCss } from '@/__tests__/helpers/components-css';
import { hottestTakes } from '@/content/hottest-takes';
import { HottestTakesSection } from './HottestTakesSection';

function renderOpinions() {
  const container = document.createElement('div');
  container.innerHTML = renderToStaticMarkup(<HottestTakesSection defer />);
  return container;
}

describe('home opinions', () => {
  it('shows a visible Opinions name outside the decorative icon box', () => {
    const { container } = render(<HottestTakesSection defer />);
    const heading = getByRole(container, 'heading', { level: 2 });
    expect(heading.textContent).toContain('Opinions');
    expect(heading.textContent).toContain('CAT ~/HOTTEST_TAKES.MD');
    const visibleLabel = heading.querySelector('.module-name');
    expect(visibleLabel?.textContent).toBe('Opinions');
    expect(visibleLabel?.closest('[aria-hidden="true"]')).toBeNull();
    expect(heading.querySelector('.sr-only')).toBeNull();
  });

  it('keeps opinions component rules from targeting the screen-reader-only utility', () => {
    // behavioral-test-allow: CSS selectors define the screen-reader utility isolation contract.
    const stylesheet = readComponentsCss();
    parse(stylesheet).walkRules((rule) => {
      if (rule.selector.includes('#sec-hottest-takes')) {
        expect(rule.selector).not.toContain('.sr-only');
      }
    });
  });

  it('shows exactly four ordered takes with readable headings and sequential numbers', () => {
    const container = renderOpinions();
    const items = container.querySelectorAll('[data-testid="hottest-takes-list"] > li');
    expect(items).toHaveLength(4);
    expect(Array.from(items, (item) => item.querySelector('h3 span')?.textContent)).toEqual([
      'ARCH',
      'MFE',
      'TEST',
      'AI',
    ]);
    expect(Array.from(items, (item) => item.firstElementChild?.textContent)).toEqual([
      '01.',
      '02.',
      '03.',
      '04.',
    ]);
    expect(container.querySelector('h2')?.textContent).toContain('Opinions');
    expect(container.textContent).toContain(
      'Playwright and WireMock flows told me whether payments were at risk.',
    );
    expect(items[3]?.textContent).toContain(
      'Spec-first is the only disciplined way to ship with LLMs and agents.',
    );
    expect(items[3]?.textContent).toContain('every automated action reviewable.');
  });

  it('nests both unknowns groups inside the same deferred section', () => {
    const container = renderOpinions();
    expect(container.querySelectorAll('section')).toHaveLength(1);
    const section = container.querySelector('#sec-hottest-takes');
    expect(section?.getAttribute('data-cv-defer')).toBe('true');
    const groups = section?.querySelectorAll('.opinions-unknowns > div');
    expect(groups).toHaveLength(2);
    expect(groups?.[0]?.querySelector('h3')?.textContent).toBe("# things i'm actively learning");
    expect(groups?.[1]?.querySelector('h3')?.textContent).toBe(
      "# things i've chosen not to specialize in (yet)",
    );
    expect(groups?.[0]?.querySelectorAll('li')).toHaveLength(5);
    expect(groups?.[1]?.querySelectorAll('li')).toHaveLength(3);
    expect(container.querySelector('#sec-unknowns')).toBeNull();
    expect(groups?.[0]?.querySelectorAll('.opinions-context')).toHaveLength(3);
    expect(groups?.[1]?.querySelectorAll('.opinions-context')).toHaveLength(3);
  });

  it('retains the canonical DS opinion for documentation and excludes it from home', () => {
    const opinion = hottestTakes.find((take) => take.category === 'DS');
    expect(opinion).toMatchObject({
      num: '07.',
      placement: 'docs',
      order: 7,
      thesis: 'Framework-agnostic design systems lose unless the contract is shipping, not theory.',
    });
    expect(opinion?.body).toContain('Stencil at Betsson worked because Angular, React, and Ember');
    const container = renderOpinions();
    expect(container.textContent).not.toContain(opinion?.thesis);
    expect(container.querySelector('a[href="/design-system#opinion-07"]')).toBeNull();
    expect(container.textContent).not.toContain(
      'the design-system opinion lives in the design system docs',
    );
    expect(hottestTakes).toHaveLength(5);
  });
});
