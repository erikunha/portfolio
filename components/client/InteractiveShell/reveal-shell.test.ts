import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { revealShell, SHELL_LIVE_PROPS } from './reveal-shell';

const VIEWPORT_HEIGHT = 640;

function mount(rect: { top: number; bottom: number }) {
  const [attribute] = Object.keys(SHELL_LIVE_PROPS);
  document.body.innerHTML = `<div ${attribute}><span id="inside"></span></div><p id="outside"></p>`;
  const live = document.querySelector<HTMLElement>(`[${attribute}]`);
  if (!live) throw new Error('shell live region missing');
  const scroll = vi.fn();
  live.scrollIntoView = scroll;
  live.getBoundingClientRect = () => ({ ...rect }) as DOMRect;
  return {
    scroll,
    inside: document.getElementById('inside'),
    outside: document.getElementById('outside'),
  };
}

describe('revealShell', () => {
  beforeEach(() => {
    vi.stubGlobal('innerHeight', VIEWPORT_HEIGHT);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('scrolls the shell to the nearest edge, instantly, when part of it is on screen', () => {
    const { scroll, inside } = mount({ top: -18, bottom: 360 });
    revealShell(inside);
    expect(scroll).toHaveBeenCalledOnce();
    expect(scroll).toHaveBeenCalledWith({ block: 'nearest', inline: 'nearest', behavior: 'auto' });
  });

  it('leaves the page alone when the visitor has scrolled the shell out of sight', () => {
    const above = mount({ top: -900, bottom: -300 });
    revealShell(above.inside);
    expect(above.scroll).not.toHaveBeenCalled();
    const below = mount({ top: VIEWPORT_HEIGHT + 40, bottom: VIEWPORT_HEIGHT + 400 });
    revealShell(below.inside);
    expect(below.scroll).not.toHaveBeenCalled();
  });

  it('does nothing for an element outside the shell', () => {
    const { scroll, outside } = mount({ top: 0, bottom: 300 });
    revealShell(outside);
    revealShell(null);
    expect(scroll).not.toHaveBeenCalled();
  });
});
