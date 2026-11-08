import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { parse } from 'postcss';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readComponentsCss } from '@/__tests__/helpers/components-css';
import { declValue, rulesWithSelector } from '@/__tests__/helpers/css-rules';
import { contactCopy } from '@/content/contact-copy';
import { contactHoursPhrase, fillCopy } from '@/content/contact-rules';
import { SITE_LOCALE } from '@/content/site-locale';
import { messageStore } from '../ContactForm/messageStore';
import { ContactTimezone } from './ContactTimezone.client';
import { ContactTimezoneStatic } from './ContactTimezoneStatic';

const detected = vi.hoisted(() => ({ zone: 'Europe/Berlin' }));

vi.mock('@/lib/timezone/zones', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/timezone/zones')>()),
  detectTimeZone: () => detected.zone,
}));

const { timezone: copy } = contactCopy[SITE_LOCALE.en];
const MAP_NAME_PATTERN = new RegExp(copy.map.ariaLabel.slice(0, copy.map.ariaLabel.indexOf('.')));
const ONLINE_INSTANT = new Date('2026-01-15T15:00:00Z');
const OFF_HOURS_INSTANT = new Date('2026-01-15T22:00:00Z');
const SECOND = 1000;
const MINUTE = 60_000;
const HOURS_PER_ROW = 24;

const testId = (id: string) => screen.getByTestId(id);
const input = () => screen.getByRole('combobox', { name: copy.search.label });

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: state });
  document.dispatchEvent(new Event('visibilitychange'));
}

const visibilityDescriptor = Object.getOwnPropertyDescriptor(document, 'visibilityState');

function restoreVisibility() {
  if (visibilityDescriptor) {
    Object.defineProperty(document, 'visibilityState', visibilityDescriptor);
  } else {
    Reflect.deleteProperty(document, 'visibilityState');
  }
}

function renderAt(instant: Date, zone = 'Europe/Berlin') {
  detected.zone = zone;
  vi.setSystemTime(instant);
  return render(<ContactTimezone copy={contactCopy[SITE_LOCALE.en].timezone} />);
}

beforeEach(() => {
  vi.useFakeTimers();
  setVisibility('visible');
});

afterEach(() => {
  vi.useRealTimers();
  messageStore.reset();
  restoreVisibility();
});

describe('ContactTimezone status and clocks', () => {
  it('reads ONLINE NOW while it is working hours in Sao Paulo', () => {
    renderAt(ONLINE_INSTANT);

    expect(testId('ctz-status').textContent).toContain(copy.status.online);
    expect(testId('ctz-status').getAttribute('data-online')).toBe('true');
  });

  it('reads OFF HOURS with the hours until Erik is back', () => {
    renderAt(OFF_HOURS_INSTANT);

    expect(testId('ctz-status').textContent).toContain(
      fillCopy(copy.status.offHours, { hours: 15 }),
    );
    expect(testId('ctz-status').getAttribute('data-online')).toBe('false');
  });

  it('shows both clocks with seconds, one per zone', () => {
    renderAt(ONLINE_INSTANT);

    expect(testId('ctz-clock-erik').textContent).toBe('12:00:00');
    expect(testId('ctz-clock-you').textContent).toBe('16:00:00');
  });

  it('ticks the clocks every second while the panel is in view', () => {
    renderAt(ONLINE_INSTANT);

    act(() => {
      vi.advanceTimersByTime(3 * SECOND);
    });

    expect(testId('ctz-clock-erik').textContent).toBe('12:00:03');
    expect(testId('ctz-clock-you').textContent).toBe('16:00:03');
  });

  it('stops ticking while the tab is hidden and catches up when it returns', () => {
    renderAt(ONLINE_INSTANT);
    act(() => setVisibility('hidden'));

    act(() => {
      vi.advanceTimersByTime(30 * SECOND);
    });
    expect(testId('ctz-clock-erik').textContent).toBe('12:00:00');

    act(() => setVisibility('visible'));
    expect(testId('ctz-clock-erik').textContent).toBe('12:00:30');
  });

  it('keeps the live region silent on load and while the minute ticks over', () => {
    renderAt(ONLINE_INSTANT);
    const announce = testId('ctz-announce');
    expect(announce.getAttribute('role')).toBe('status');
    expect(announce.textContent).toBe('');

    act(() => {
      vi.advanceTimersByTime(MINUTE * 3);
    });
    expect(announce.textContent).toBe('');
  });

  it('announces the new zone and both local times, minutes only, when the zone changes', () => {
    renderAt(ONLINE_INSTANT);
    const field = input();
    fireEvent.change(field, { target: { value: 'tokyo' } });
    fireEvent.keyDown(field, { key: 'Enter' });

    const announce = testId('ctz-announce');
    expect(announce.textContent).toBe(
      fillCopy(copy.announce, { place: 'Japan', erik: '12:00', you: '00:00' }),
    );
    expect(announce.textContent).not.toMatch(/\d\d:\d\d:\d\d/);

    act(() => {
      vi.advanceTimersByTime(MINUTE * 2);
    });
    expect(announce.textContent).toBe(
      fillCopy(copy.announce, { place: 'Japan', erik: '12:00', you: '00:00' }),
    );
  });

  it('announces again when the same zone is picked a second time', () => {
    renderAt(ONLINE_INSTANT);
    const field = input();
    fireEvent.change(field, { target: { value: 'tokyo' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    const first = testId('ctz-announce').firstChild;

    fireEvent.change(field, { target: { value: 'tokyo' } });
    fireEvent.keyDown(field, { key: 'Enter' });

    expect(testId('ctz-announce').firstChild).not.toBe(first);
  });
});

describe('ContactTimezone location and overlap', () => {
  it('names the detected country and zone', () => {
    renderAt(ONLINE_INSTANT);

    expect(testId('ctz-place').textContent).toBe('Germany');
    expect(testId('ctz-youare').textContent).toBe(`${copy.location.youAre} Germany`);
    expect(testId('ctz-detected').textContent).toBe(
      fillCopy(copy.location.detectedAuto, { zone: 'Europe/Berlin' }),
    );
  });

  it('falls back to the city when the zone is not curated', () => {
    renderAt(ONLINE_INSTANT, 'Africa/Nairobi');

    expect(testId('ctz-place').textContent).toBe('Nairobi');
  });

  it('states the overlap in hours and the range in the visitor time', () => {
    renderAt(ONLINE_INSTANT);

    expect(testId('ctz-overlap').textContent).toBe(
      `${fillCopy(copy.overlap.summary, { hours: contactHoursPhrase(copy.hours, 4) })}${copy.overlap.separator}${fillCopy(copy.overlap.range, { range: '14:00 to 18:00' })}`,
    );
  });

  it('offers the async line when nothing overlaps', () => {
    renderAt(ONLINE_INSTANT, 'Asia/Tokyo');

    expect(testId('ctz-overlap').textContent).toBe(copy.overlap.none);
  });

  it('invents no value: every placeholder is filled and no number is NaN', () => {
    const { container } = renderAt(ONLINE_INSTANT);

    const text = container.textContent ?? '';
    expect(text, 'a visible {placeholder} means a copy key was not filled').not.toMatch(/\{\w+\}/);
    expect(text).not.toContain('NaN');
    expect(text).not.toContain('undefined');
  });

  it('draws the three 24-cell rows and outlines the visitor current hour', () => {
    renderAt(ONLINE_INSTANT);

    for (const row of ['erik', 'you', 'both']) {
      const cells = within(testId(`ctz-row-${row}`)).getAllByTestId('ctz-cell');
      expect(cells).toHaveLength(HOURS_PER_ROW);
      expect(cells.filter((cell) => cell.hasAttribute('data-now'))).toHaveLength(1);
      expect(cells[16]?.hasAttribute('data-now')).toBe(true);
    }
    const both = within(testId('ctz-row-both')).getAllByTestId('ctz-cell');
    expect(
      both.flatMap((cell, hour) => (cell.getAttribute('data-on') === 'true' ? [hour] : [])),
    ).toEqual([14, 15, 16, 17]);
  });

  it('labels the 00/06/12/18/24 axis', () => {
    renderAt(ONLINE_INSTANT);

    expect(
      within(testId('ctz-axis'))
        .getAllByText(/^\d\d$/)
        .map((node) => node.textContent),
    ).toEqual(copy.axis);
  });

  it('keeps the hour rows out of the accessibility tree because the text says the same', () => {
    renderAt(ONLINE_INSTANT);

    expect(testId('ctz-rows').getAttribute('aria-hidden')).toBe('true');
  });
});

describe('ContactTimezone map', () => {
  it('is an image named with both places and the overlap', () => {
    renderAt(ONLINE_INSTANT);

    const map = screen.getByRole('img', { name: MAP_NAME_PATTERN });
    expect(map.tagName.toLowerCase()).toBe('svg');
    expect(map.getAttribute('aria-label')).toBe(
      fillCopy(copy.map.ariaLabel, {
        erikPlace: copy.map.erikPlace,
        place: 'Germany',
        overlap: '4 hours',
      }),
    );
  });

  it('shows a label box for each pin with its code and local time', () => {
    renderAt(ONLINE_INSTANT);

    expect(testId('ctz-label-erik').textContent).toContain('erik · SAO');
    expect(testId('ctz-label-erik').textContent).toContain('12:00');
    expect(testId('ctz-label-you').textContent).toContain('you · BER');
    expect(testId('ctz-label-you').textContent).toContain('16:00');
  });

  it('draws a dashed route between distant pins', () => {
    renderAt(ONLINE_INSTANT);

    expect(testId('ctz-route').getAttribute('d')).toMatch(/^M[\d.]+ [\d.]+ Q/);
  });

  it('keeps both pins and labels but draws no route when the visitor is near Erik', () => {
    renderAt(ONLINE_INSTANT, 'America/Sao_Paulo');

    expect(screen.queryByTestId('ctz-route')).toBeNull();
    expect(testId('ctz-pin-erik')).toBeTruthy();
    expect(testId('ctz-pin-you')).toBeTruthy();
    expect(testId('ctz-label-erik')).toBeTruthy();
    expect(testId('ctz-label-you')).toBeTruthy();
  });

  it('lights land by the solar hour: the lit layer is not empty at noon UTC', () => {
    renderAt(new Date('2026-01-15T12:00:00Z'));

    expect(testId('ctz-land-lit').getAttribute('d')?.length).toBeGreaterThan(0);
    expect(testId('ctz-land-dim').getAttribute('d')?.length).toBeGreaterThan(0);
  });

  it('recomputes the land only when the minute changes', () => {
    renderAt(ONLINE_INSTANT);
    const before = testId('ctz-land-lit').getAttribute('d');
    const lit = testId('ctz-land-lit');

    act(() => {
      vi.advanceTimersByTime(20 * SECOND);
    });
    expect(testId('ctz-land-lit')).toBe(lit);
    expect(lit.getAttribute('d')).toBe(before);

    act(() => {
      vi.advanceTimersByTime(4 * 60 * MINUTE);
    });
    expect(lit.getAttribute('d')).not.toBe(before);
  });
});

describe('ContactTimezone combobox', () => {
  it('wires the WAI-ARIA combobox attributes and starts closed', () => {
    renderAt(ONLINE_INSTANT);

    const field = input();
    const listbox = screen.getByRole('listbox', { hidden: true });
    expect(field.getAttribute('aria-expanded')).toBe('false');
    expect(field.getAttribute('aria-controls')).toBe(listbox.id);
    expect(field.getAttribute('aria-autocomplete')).toBe('list');
    expect(listbox.hasAttribute('hidden')).toBe(true);
  });

  it('opens on ArrowDown and moves the active option without leaving the input', () => {
    renderAt(ONLINE_INSTANT);
    const field = input();
    field.focus();

    fireEvent.keyDown(field, { key: 'ArrowDown' });

    expect(field.getAttribute('aria-expanded')).toBe('true');
    const options = screen.getAllByRole('option');
    expect(options.length).toBeGreaterThan(1);
    expect(field.getAttribute('aria-activedescendant')).toBe(options[0]?.id);
    expect(options[0]?.getAttribute('aria-selected')).toBe('true');

    fireEvent.keyDown(field, { key: 'ArrowDown' });
    expect(field.getAttribute('aria-activedescendant')).toBe(options[1]?.id);
    expect(options[0]?.getAttribute('aria-selected')).toBe('false');

    fireEvent.keyDown(field, { key: 'ArrowUp' });
    expect(field.getAttribute('aria-activedescendant')).toBe(options[0]?.id);
    expect(document.activeElement).toBe(field);
  });

  it('filters by what is typed and shows country, city and UTC offset', () => {
    renderAt(ONLINE_INSTANT);
    const field = input();

    fireEvent.change(field, { target: { value: 'tokyo' } });

    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(1);
    expect(options[0]?.textContent).toContain('Japan');
    expect(options[0]?.textContent).toContain('Tokyo');
    expect(options[0]?.textContent).toContain('UTC+9');
  });

  it('picks the active option with Enter, closes, and keeps focus in the input', () => {
    renderAt(ONLINE_INSTANT);
    const field = input();
    field.focus();

    fireEvent.change(field, { target: { value: 'tokyo' } });
    fireEvent.keyDown(field, { key: 'Enter' });

    expect(testId('ctz-place').textContent).toBe('Japan');
    expect(testId('ctz-detected').textContent).toBe(
      fillCopy(copy.location.detectedManual, { zone: 'Asia/Tokyo' }),
    );
    expect(field.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(field);
    expect((field as HTMLInputElement).value).toBe('');
    expect(testId('ctz-label-you').textContent).toContain('you · TYO');
  });

  it('closes on Escape without changing the zone', () => {
    renderAt(ONLINE_INSTANT);
    const field = input();
    fireEvent.keyDown(field, { key: 'ArrowDown' });

    fireEvent.keyDown(field, { key: 'Escape' });

    expect(field.getAttribute('aria-expanded')).toBe('false');
    expect(testId('ctz-place').textContent).toBe('Germany');
    expect(document.activeElement === field || document.activeElement === document.body).toBe(true);
  });

  it('picks an option on click without taking focus from the input', () => {
    renderAt(ONLINE_INSTANT);
    const field = input();
    field.focus();
    fireEvent.change(field, { target: { value: 'new york' } });
    const option = screen.getByRole('option');

    expect(fireEvent.mouseDown(option)).toBe(false);
    fireEvent.click(option);

    expect(testId('ctz-place').textContent).toBe('United States');
    expect(document.activeElement).toBe(field);
  });

  it('says how many zones match', () => {
    renderAt(ONLINE_INSTANT);

    fireEvent.change(input(), { target: { value: 'tokyo' } });

    expect(testId('ctz-count').textContent).toMatch(/^1 of \d+ timezones/);
  });

  it('announces the match count through a live region that is always rendered', () => {
    renderAt(ONLINE_INSTANT);
    const live = testId('ctz-count-live');
    expect(live.getAttribute('role')).toBe('status');
    expect(live.closest('[hidden]')).toBeNull();
    expect(live.textContent).toBe('');

    fireEvent.change(input(), { target: { value: 'tokyo' } });
    expect(live.textContent).toMatch(/^1 of \d+ timezones/);

    fireEvent.change(input(), { target: { value: 'zzzzzz' } });
    expect(live.textContent).toMatch(/^0 of \d+ timezones/);
  });

  it('clears the count announcement when the list closes', () => {
    renderAt(ONLINE_INSTANT);
    const field = input();
    fireEvent.change(field, { target: { value: 'tokyo' } });
    fireEvent.keyDown(field, { key: 'Escape' });

    expect(testId('ctz-count-live').textContent).toBe('');
  });

  it('shows an empty result without a selected option', () => {
    renderAt(ONLINE_INSTANT);
    const field = input();

    fireEvent.change(field, { target: { value: 'zzzzzz' } });

    expect(screen.queryAllByRole('option')).toHaveLength(0);
    expect(field.hasAttribute('aria-activedescendant')).toBe(false);
  });

  it('gives two panels distinct ids', () => {
    detected.zone = 'Europe/Berlin';
    vi.setSystemTime(ONLINE_INSTANT);
    const { container } = render(
      <>
        <ContactTimezone copy={copy} />
        <ContactTimezone copy={copy} />
      </>,
    );

    const ids = [...container.querySelectorAll('[id]')].map((node) => node.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('ContactTimezone best slot and propose', () => {
  it('joins the two slot times with the separator from content', () => {
    renderAt(ONLINE_INSTANT);

    const times = testId('ctz-slot-you').parentElement as HTMLElement;
    expect(times.textContent).toContain(`${copy.slot.you}${copy.slot.separator}`);
  });

  const expectedLine =
    'Would a call at 14:00 my time (Berlin) work for you? That is 10:00 for you in São Paulo.';

  it('asks for one time when the visitor shares the clock with Erik', () => {
    renderAt(ONLINE_INSTANT, 'America/Sao_Paulo');
    messageStore.set('');

    fireEvent.click(screen.getByRole('button', { name: copy.propose.label }));

    expect(messageStore.getSnapshot()).toBe(
      'Would a call at 10:00 work for you? We are on the same clock.',
    );
  });

  it('shows the earliest shared half hour in both zones', () => {
    renderAt(ONLINE_INSTANT);

    expect(testId('ctz-slot-you').textContent).toBe('14:00');
    expect(testId('ctz-slot-erik').textContent).toBe('10:00');
  });

  it('appends the slot line to the contact message through the shared store', () => {
    renderAt(ONLINE_INSTANT);
    messageStore.set('Hi Erik');

    fireEvent.click(screen.getByRole('button', { name: copy.propose.label }));

    expect(messageStore.getSnapshot()).toBe(`Hi Erik\n${expectedLine}`);
    expect(testId('ctz-proposed').textContent).toBe(copy.propose.added);
  });

  it('does not add the same line twice', () => {
    renderAt(ONLINE_INSTANT);
    const button = screen.getByRole('button', { name: copy.propose.label });

    fireEvent.click(button);
    fireEvent.click(button);

    expect(messageStore.getSnapshot()).toBe(expectedLine);
  });

  it('forgets the confirmation once the slot changes', () => {
    renderAt(ONLINE_INSTANT);
    fireEvent.click(screen.getByRole('button', { name: copy.propose.label }));
    expect(screen.queryByTestId('ctz-proposed')).not.toBeNull();

    const field = screen.getByRole('combobox', { name: copy.search.label });
    fireEvent.change(field, { target: { value: 'new york' } });
    fireEvent.keyDown(field, { key: 'Enter' });

    expect(screen.queryByTestId('ctz-proposed')).toBeNull();
  });

  it('offers no propose button when there is no live window', () => {
    renderAt(ONLINE_INSTANT, 'Asia/Tokyo');

    expect(testId('ctz-slot').textContent).toContain(copy.slot.none);
    expect(screen.queryByRole('button', { name: copy.propose.label })).toBeNull();
  });
});

describe('ContactTimezone link back to the message field', () => {
  const FIELD_ID = 'contact-message-field';

  function renderWithField() {
    const unbind = messageStore.bindField(FIELD_ID);
    const view = renderAt(ONLINE_INSTANT);
    const field = document.createElement('textarea');
    field.id = FIELD_ID;
    document.body.append(field);
    return {
      field,
      cleanup: () => {
        unbind();
        field.remove();
        view.unmount();
      },
    };
  }

  const focusLink = () => screen.queryByRole('link', { name: copy.propose.focusLink });

  it('shows no link until a slot was added to the message', () => {
    const { cleanup } = renderWithField();

    expect(focusLink()).toBeNull();

    cleanup();
  });

  it('offers a link to the message field once the slot was added', () => {
    const { cleanup } = renderWithField();

    fireEvent.click(screen.getByRole('button', { name: copy.propose.label }));

    expect(testId('ctz-proposed').textContent).toBe(copy.propose.added);
    expect(focusLink()?.getAttribute('href')).toBe(`#${FIELD_ID}`);

    cleanup();
  });

  it('moves keyboard focus to the message field when the link is used', () => {
    const { field, cleanup } = renderWithField();
    fireEvent.click(screen.getByRole('button', { name: copy.propose.label }));

    const link = focusLink() as HTMLElement;
    const proceeded = fireEvent.click(link);

    expect(proceeded, 'the click is handled, so the page does not jump to a hash').toBe(false);
    expect(document.activeElement).toBe(field);

    cleanup();
  });

  it('drops the confirmation and the link when the form clears the message after a send', () => {
    const { cleanup } = renderWithField();
    fireEvent.click(screen.getByRole('button', { name: copy.propose.label }));
    expect(screen.queryByTestId('ctz-proposed')).not.toBeNull();

    act(() => {
      messageStore.reset();
    });

    expect(screen.queryByTestId('ctz-proposed'), 'no stale confirmation').toBeNull();
    expect(focusLink(), 'no link to a field that is gone').toBeNull();

    cleanup();
  });

  it('drops the confirmation when the visitor deletes the proposed line', () => {
    const { cleanup } = renderWithField();
    fireEvent.click(screen.getByRole('button', { name: copy.propose.label }));

    act(() => {
      messageStore.set('hello');
    });

    expect(screen.queryByTestId('ctz-proposed')).toBeNull();

    cleanup();
  });

  it('keeps the confirmation while the visitor types around the proposed line', () => {
    const { cleanup } = renderWithField();
    fireEvent.click(screen.getByRole('button', { name: copy.propose.label }));

    act(() => {
      messageStore.set(`Hi Erik\n${messageStore.getSnapshot()}\nThanks`);
    });

    expect(screen.queryByTestId('ctz-proposed')).not.toBeNull();

    cleanup();
  });

  it('confirms again when the same slot is proposed after the message was cleared', () => {
    const { cleanup } = renderWithField();
    fireEvent.click(screen.getByRole('button', { name: copy.propose.label }));
    act(() => {
      messageStore.reset();
    });

    fireEvent.click(screen.getByRole('button', { name: copy.propose.label }));

    expect(screen.queryByTestId('ctz-proposed')).not.toBeNull();

    cleanup();
  });

  it('keeps the link out of the live region so the announcement stays the confirmation', () => {
    const { cleanup } = renderWithField();
    fireEvent.click(screen.getByRole('button', { name: copy.propose.label }));

    const region = testId('ctz-proposed').closest('[role="status"]') as HTMLElement;

    expect(region.textContent).toBe(copy.propose.added);
    expect(region.contains(focusLink())).toBe(false);

    cleanup();
  });

  it('offers no link when no form field is mounted to receive focus', () => {
    renderAt(ONLINE_INSTANT);

    fireEvent.click(screen.getByRole('button', { name: copy.propose.label }));

    expect(testId('ctz-proposed').textContent).toBe(copy.propose.added);
    expect(focusLink()).toBeNull();
  });

  it('offers the link as soon as the form field mounts after the slot was added', () => {
    renderAt(ONLINE_INSTANT);
    fireEvent.click(screen.getByRole('button', { name: copy.propose.label }));
    expect(focusLink()).toBeNull();

    let unbind: () => void = vi.fn();
    act(() => {
      unbind = messageStore.bindField(FIELD_ID);
    });

    expect(
      focusLink()?.getAttribute('href'),
      'the panel and the form hydrate as separate islands, so the field can mount after the click',
    ).toBe(`#${FIELD_ID}`);

    act(() => {
      unbind();
    });

    expect(focusLink(), 'no link to a field that unmounted').toBeNull();
  });
});

describe('ContactTimezone pins and the map box', () => {
  it('positions the pins against the land map alone, so stacked labels never shift them', () => {
    renderAt(ONLINE_INSTANT);

    const frame = testId('ctz-pin-erik').closest('.ctz-map-frame') as HTMLElement;

    expect(frame, 'the pins live in a frame that wraps only the drawing').not.toBeNull();
    expect(frame.querySelector('svg')).not.toBeNull();
    expect(frame.querySelector('[data-testid="ctz-pin-you"]')).not.toBeNull();
    expect(
      frame.querySelector('.ctz-labels'),
      'the labels sit outside the frame: below 24rem they flow under the map and would stretch it',
    ).toBeNull();
  });
});

describe('ContactTimezone motion switch', () => {
  const stylesheet = parse(readComponentsCss());
  const ANIMATED = ['.ctz-pulse', '.ctz-route'];

  it('stops the pulse and the dash animation under the in-page motion switch', () => {
    // behavioral-test-allow: motion is stylesheet-only and jsdom cannot evaluate a body attribute selector
    for (const selector of ANIMATED) {
      const rules = rulesWithSelector(stylesheet, `body[data-motion="reduce"] ${selector}`);
      expect(rules, `${selector} must stop animating when the motion switch is off`).toHaveLength(
        1,
      );
      expect(declValue(rules[0], 'animation')).toBe('none');
    }
  });
});

describe.each(Object.values(SITE_LOCALE))('ascii spinner on the static panel (%s)', (locale) => {
  const { timezone } = contactCopy[locale];
  const stylesheet = parse(readComponentsCss());

  function renderStatic(rows: readonly string[] = []) {
    return render(<ContactTimezoneStatic loadingLabel={timezone.loading} placeholderRows={rows} />);
  }

  it('says it is syncing clocks, in one status line, with the four glyphs hidden from readers', () => {
    const { container } = renderStatic();

    const spin = container.querySelector('[data-testid="ctz-spin"]') as HTMLElement;
    expect(spin.getAttribute('aria-hidden')).toBe('true');
    const frames = Array.from(spin.querySelectorAll('.ctz-spin-frame')).map(
      (frame) => frame.textContent,
    );
    expect(frames).toEqual(['|', '/', '-', '\\']);
    expect(spin.textContent?.startsWith('[ ')).toBe(true);
    expect(spin.textContent?.endsWith(' ]')).toBe(true);
    const status = screen.getByRole('status');
    expect(status.textContent).toBe(timezone.loading);
    expect(timezone.loading).toBe(
      locale === SITE_LOCALE.pt
        ? 'sincronizando relógios com seu fuso horário'
        : 'syncing clocks with your timezone',
    );
  });

  it('keeps Erik and the visitor as dashed placeholder rows under the line', () => {
    const rows = [
      fillCopy(timezone.map.erikLabel, { code: 'SAO' }).concat(' --:--'),
      fillCopy(timezone.map.youLabel, { code: '---' }).concat(' --:--'),
    ];
    const { container } = renderStatic(rows);

    const shown = Array.from(container.querySelectorAll('.ctz-sync-row')).map(
      (row) => row.textContent,
    );
    expect(shown).toEqual(rows);
    expect(shown[1]).toContain('---');
  });

  it('freezes on the first glyph under the motion toggle', () => {
    // behavioral-test-allow: motion is stylesheet-only and jsdom cannot evaluate a body attribute selector
    const toggle = rulesWithSelector(stylesheet, 'body[data-motion="reduce"] .ctz-spin-frame');

    expect(declValue(toggle[0], 'animation')).toBe('none');
  });

  it('steps through the glyphs instead of fading between them', () => {
    // behavioral-test-allow: motion is stylesheet-only and jsdom cannot evaluate keyframes
    const [frame] = rulesWithSelector(stylesheet, '.ctz-spin-frame');

    expect(declValue(frame, 'animation')).toMatch(/steps\(1/);
  });
});
