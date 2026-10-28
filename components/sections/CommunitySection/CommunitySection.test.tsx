import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { communityEvent } from '@/content/community';
import { CommunitySection } from './CommunitySection';

function render() {
  const host = document.createElement('div');
  host.innerHTML = renderToStaticMarkup(createElement(CommunitySection));
  return host;
}

describe('Community tags within About', () => {
  it('renders the git command without a standalone section', () => {
    const host = render();
    expect(host.textContent).toContain("$ git tag --list 'community/*'");
    expect(host.textContent).toContain('open to CFP submissions for 2027');
    expect(host.querySelector('section')).toBeNull();
  });

  it('states the talk count the official program shows', () => {
    expect(render().textContent).toContain('curated 8 talks');
  });

  it('links the event name and every reference to devopsdays.org in a new tab', () => {
    const anchors = [...render().querySelectorAll('a')];
    expect(anchors.map((a) => a.getAttribute('href'))).toEqual([
      'https://devopsdays.org/events/2024-campinas/welcome/',
      'https://devopsdays.org/events/2024-campinas/program/',
      'https://devopsdays.org/events/2024-campinas/contact/',
    ]);
    for (const anchor of anchors) {
      expect(anchor.getAttribute('target')).toBe('_blank');
      expect(anchor.getAttribute('rel')).toContain('noopener');
      expect(anchor.querySelector('.sr-only')?.textContent?.trim()).toBe(
        communityEvent.newTabLabel,
      );
    }
    expect(anchors[0]?.textContent).toContain(communityEvent.name);
  });
});
