import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installMatchMedia } from '@/__tests__/helpers/match-media';
import { TaglineTyper } from './TaglineTyper.client';

const PHRASE = 'Senior Software Engineer, AI Engineer';
const OTHER = 'Going global as a dev';
const TAIL = 'AI Engineer';
const TYPE_MS = 70;

describe('TaglineTyper keeps the last two words of a phrase together', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.setItem('erik.motion', 'on');
    installMatchMedia(true);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('puts the tail of the server-rendered phrase in one nowrap span', () => {
    localStorage.setItem('erik.motion', 'off');
    const { container } = render(<TaglineTyper phrases={[PHRASE, OTHER]} />);
    const tail = container.querySelector('.keep-together');
    expect(tail?.textContent).toBe(TAIL);
    expect(container.querySelector('[aria-hidden="true"]')?.textContent).toBe(PHRASE);
  });

  it('keeps the typed text equal to the written text at every step', () => {
    const { container } = render(<TaglineTyper phrases={[PHRASE, OTHER]} />);
    const visible = container.querySelector('[aria-hidden="true"]');
    expect(visible?.textContent).toBe(PHRASE.slice(0, 1));
    for (let chars = 2; chars <= PHRASE.length; chars += 1) {
      act(() => {
        vi.advanceTimersByTime(TYPE_MS);
      });
      expect(visible?.textContent).toBe(PHRASE.slice(0, chars));
    }
    expect(container.querySelector('.keep-together')?.textContent).toBe(TAIL);
  });

  it('moves the next phrase into its own head and tail without leftovers', () => {
    const { container } = render(<TaglineTyper phrases={[PHRASE, OTHER]} />);
    const visible = container.querySelector('[aria-hidden="true"]');
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    const shown = visible?.textContent ?? '';
    expect(PHRASE.startsWith(shown) || OTHER.startsWith(shown)).toBe(true);
  });
});
