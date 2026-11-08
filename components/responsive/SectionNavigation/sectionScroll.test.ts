import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MAIN_CONTENT_ID } from '@/components/PageMain';
import { jumpTarget, jumpToSection } from './sectionScroll';

const SECTION = 'sec-contact';
const OTHER_SECTION = 'sec-projects';
const SHIFTED_TOP = 2800;
const SETTLED_TOP = 60;
const CORRECTION_TIMEOUT_PAST_MS = 5000;

let scrollIntoView: ReturnType<typeof vi.fn>;

function mount() {
  document.body.innerHTML = `<main id="${MAIN_CONTENT_ID}" tabindex="-1"><section id="${SECTION}" tabindex="-1"></section><section id="${OTHER_SECTION}" tabindex="-1"></section></main>`;
}

function section(id: string) {
  return document.getElementById(id) as HTMLElement;
}

function placeAt(id: string, top: number) {
  vi.spyOn(section(id), 'getBoundingClientRect').mockReturnValue({ top } as DOMRect);
}

function scrollEnds() {
  window.dispatchEvent(new Event('scrollend'));
}

describe('sectionScroll', () => {
  beforeEach(() => {
    mount();
    scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView =
      scrollIntoView as unknown as typeof Element.prototype.scrollIntoView;
    window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  });

  afterEach(() => {
    jumpToSection('bio');
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('resolves Home to the main landmark and any other id to its own element', () => {
    expect(jumpTarget('bio')).toBe(section(MAIN_CONTENT_ID));
    expect(jumpTarget(SECTION)).toBe(section(SECTION));
    expect(jumpTarget('sec-missing')).toBeNull();
  });

  it('reports a missing target without scrolling or moving focus', () => {
    expect(jumpToSection('sec-missing')).toBe(false);
    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  it('scrolls to a section, focuses it and reports the jump', () => {
    expect(jumpToSection(SECTION)).toBe(true);
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    expect(document.activeElement).toBe(section(SECTION));
  });

  it('sends Home to the top and focuses the main landmark', () => {
    expect(jumpToSection('bio')).toBe(true);
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
    expect(document.activeElement).toBe(section(MAIN_CONTENT_ID));
  });

  it('corrects once when the target is still off its mark as the scroll ends', () => {
    placeAt(SECTION, SHIFTED_TOP);
    jumpToSection(SECTION);
    scrollEnds();
    expect(scrollIntoView).toHaveBeenCalledTimes(2);
    scrollEnds();
    expect(
      scrollIntoView,
      'the correction listener is spent after one scroll end',
    ).toHaveBeenCalledTimes(2);
  });

  it('leaves a jump alone when the target settled inside the limit', () => {
    placeAt(SECTION, SETTLED_TOP);
    jumpToSection(SECTION);
    scrollEnds();
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['wheel', () => new Event('wheel')],
    ['touchstart', () => new Event('touchstart')],
    ['keydown', () => new KeyboardEvent('keydown', { key: 'ArrowDown' })],
    ['pointerdown', () => new Event('pointerdown')],
  ])('cancels the correction when the visitor scrolls by %s', (_, makeEvent) => {
    placeAt(SECTION, SHIFTED_TOP);
    jumpToSection(SECTION);
    window.dispatchEvent(makeEvent());
    scrollEnds();
    expect(
      scrollIntoView,
      'a correction after the visitor took over would fight their scroll',
    ).toHaveBeenCalledTimes(1);
  });

  it('cancels a correction that never saw its scroll end', () => {
    vi.useFakeTimers();
    placeAt(SECTION, SHIFTED_TOP);
    jumpToSection(SECTION);
    vi.advanceTimersByTime(CORRECTION_TIMEOUT_PAST_MS);
    scrollEnds();
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it('replaces the pending correction with the newer jump', () => {
    placeAt(SECTION, SHIFTED_TOP);
    placeAt(OTHER_SECTION, SHIFTED_TOP);
    jumpToSection(SECTION);
    jumpToSection(OTHER_SECTION);
    scrollEnds();
    expect(scrollIntoView).toHaveBeenCalledTimes(3);
    expect(scrollIntoView.mock.contexts.at(-1)).toBe(section(OTHER_SECTION));
  });

  it('drops the pending correction when the next jump is Home', () => {
    placeAt(SECTION, SHIFTED_TOP);
    jumpToSection(SECTION);
    jumpToSection('bio');
    scrollEnds();
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });
});
