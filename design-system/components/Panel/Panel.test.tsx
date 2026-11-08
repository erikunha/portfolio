import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import * as designSystem from '@/design-system';
import { Panel } from './Panel';

describe('Panel', () => {
  it('is exported from the design-system barrel', () => {
    expect(designSystem.Panel).toBe(Panel);
  });

  it('renders the marker hidden from assistive technology and the title as an h3', () => {
    const { container } = render(
      <Panel title="whoami" marker="[+]">
        <p>body</p>
      </Panel>,
    );
    const root = container.firstElementChild;
    expect(root?.tagName).toBe('DIV');
    expect(root?.classList.contains('panel')).toBe(true);
    expect(container.querySelector('.panel-marker')?.getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelector('h3.panel-title')?.textContent).toBe('whoami');
    expect(container.querySelector('p')?.textContent).toBe('body');
  });

  it('names a landmark by its title when given an id and a landmark tag', () => {
    const { container } = render(
      <Panel as="aside" title="tz" marker="[~]" titleId="tz-title" className="extra">
        x
      </Panel>,
    );
    const root = container.firstElementChild;
    expect(root?.tagName).toBe('ASIDE');
    expect(root?.getAttribute('aria-labelledby')).toBe('tz-title');
    expect(container.querySelector('h3')?.id).toBe('tz-title');
    expect(root?.classList.contains('extra')).toBe(true);
  });

  it('marks the heading for scroll typing only when asked', () => {
    const typed = render(
      <Panel title="a" marker="m" reveal>
        x
      </Panel>,
    );
    expect(typed.container.querySelector('h3')?.hasAttribute('data-type-reveal')).toBe(true);
    const plain = render(
      <Panel title="a" marker="m">
        x
      </Panel>,
    );
    expect(plain.container.querySelector('h3')?.hasAttribute('data-type-reveal')).toBe(false);
  });

  it('renders an action after the title and passes extra attributes to the root', () => {
    const { container } = render(
      <Panel title="a" marker="m" action={<a href="/x">go</a>} data-locale="en">
        x
      </Panel>,
    );
    expect(container.querySelector('header a')?.textContent).toBe('go');
    expect(container.firstElementChild?.getAttribute('data-locale')).toBe('en');
  });
});
