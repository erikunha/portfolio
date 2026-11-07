import { afterEach, describe, expect, it } from 'vitest';
import { isRendered } from '@/lib/dom/is-rendered';

function mount(html: string): HTMLElement {
  const host = document.createElement('div');
  host.innerHTML = html;
  document.body.appendChild(host);
  return host.querySelector('[data-target]') as HTMLElement;
}

describe('isRendered', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('accepts a plain connected element', () => {
    expect(isRendered(mount('<h1 data-target>x</h1>'))).toBe(true);
  });

  it('rejects an element with a display:none ancestor', () => {
    expect(isRendered(mount('<div style="display:none"><h1 data-target>x</h1></div>'))).toBe(false);
  });

  it('rejects an element hidden by visibility, the hidden attribute or inert', () => {
    expect(isRendered(mount('<h1 data-target style="visibility:hidden">x</h1>'))).toBe(false);
    expect(isRendered(mount('<h1 data-target hidden>x</h1>'))).toBe(false);
    expect(isRendered(mount('<h1 data-target inert>x</h1>'))).toBe(false);
  });

  it('rejects an element that is not connected', () => {
    expect(isRendered(document.createElement('h1'))).toBe(false);
  });
});
