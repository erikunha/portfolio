import { describe, expect, it } from 'vitest';
import { elementLabel } from '@/lib/vitals/element-label';

describe('elementLabel', () => {
  it.each([
    ['section#bio>div>h1', { tag: 'h1', landmark: 'bio' }],
    ['main#main-content>p.lead', { tag: 'p', landmark: 'main-content' }],
    ['button#send', { tag: 'button', landmark: 'send' }],
    ['div.card>img', { tag: 'img' }],
    ['SECTION#sec-projects>H2:nth-child(2)', { tag: 'h2', landmark: 'sec-projects' }],
    ['h1', { tag: 'h1' }],
    ['#sec-projects', { landmark: 'sec-projects' }],
    ['#bio', { landmark: 'bio' }],
    ['#contact-email', { landmark: 'contact-email' }],
  ])('reduces %s to a tag and a landmark id', (selector, label) => {
    expect(elementLabel(selector)).toEqual(label);
  });

  it('returns nothing for a missing or empty selector', () => {
    expect(elementLabel(undefined)).toEqual({});
    expect(elementLabel('')).toEqual({});
  });

  it('never carries classes, attributes or text content into the label', () => {
    const label = elementLabel('section#bio>div.secret-class[data-user="ada"]>span.private');

    expect(JSON.stringify(label)).not.toMatch(/secret|ada|private/);
  });

  it('bounds the work on a very long selector', () => {
    expect(elementLabel(`${'div>'.repeat(10_000)}h1`)).toEqual({ tag: 'div' });
  });
});
