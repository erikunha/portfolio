import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { contactCopy } from '@/content/contact-copy';
import { SITE_LOCALE } from '@/content/site-locale';
import { messageStore } from '../ContactForm/messageStore';
import { ContactTimezone } from './ContactTimezone.client';
import { ProposeSlot } from './ProposeSlot.client';

const detected = vi.hoisted(() => ({ zone: 'Europe/Berlin' }));
const mapRenders = vi.hoisted(() => ({ count: 0 }));

vi.mock('@/lib/timezone/zones', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/timezone/zones')>()),
  detectTimeZone: () => detected.zone,
}));

vi.mock('./ContactTimezoneMap', () => ({
  ContactTimezoneMap: () => {
    mapRenders.count += 1;
    return null;
  },
}));

const { timezone: copy } = contactCopy[SITE_LOCALE.en];
const ONLINE_INSTANT = new Date('2026-01-15T15:00:00Z');
const SLOT = { you: '14:00', erik: '10:00' };
const LINE = 'Would a call at 14:00 work for you?';

const proposeButton = () => screen.getByRole('button', { name: copy.propose.label });

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(ONLINE_INSTANT);
  messageStore.reset();
  mapRenders.count = 0;
});

afterEach(() => {
  vi.useRealTimers();
  act(() => messageStore.reset());
});

describe('ProposeSlot', () => {
  it('shows the slot times and no confirmation before a proposal', () => {
    render(<ProposeSlot copy={copy} slot={SLOT} slotLine={LINE} />);

    expect(screen.getByTestId('ctz-slot-you').textContent).toBe('14:00');
    expect(screen.getByTestId('ctz-slot-erik').textContent).toBe('10:00');
    expect(screen.queryByTestId('ctz-proposed')).toBeNull();
  });

  it('appends the line to the message and confirms it', () => {
    render(<ProposeSlot copy={copy} slot={SLOT} slotLine={LINE} />);

    fireEvent.click(proposeButton());

    expect(messageStore.getSnapshot()).toBe(LINE);
    expect(screen.getByTestId('ctz-proposed').textContent).toBe(copy.propose.added);
  });

  it('drops the confirmation when the visitor deletes the proposed line', () => {
    render(<ProposeSlot copy={copy} slot={SLOT} slotLine={LINE} />);
    fireEvent.click(proposeButton());

    act(() => messageStore.set(''));

    expect(screen.queryByTestId('ctz-proposed')).toBeNull();
  });

  it('drops the confirmation when the slot line changes', () => {
    const { rerender } = render(<ProposeSlot copy={copy} slot={SLOT} slotLine={LINE} />);
    fireEvent.click(proposeButton());

    rerender(<ProposeSlot copy={copy} slot={SLOT} slotLine={`${LINE} Later.`} />);

    expect(screen.queryByTestId('ctz-proposed')).toBeNull();
  });

  it('focuses the message field from the confirmation link', () => {
    const field = document.createElement('textarea');
    field.id = 'msg-field';
    document.body.append(field);
    render(<ProposeSlot copy={copy} slot={SLOT} slotLine={LINE} />);
    let unbind: (() => void) | null = null;
    act(() => {
      unbind = messageStore.bindField('msg-field');
    });
    fireEvent.click(proposeButton());

    fireEvent.click(screen.getByRole('link', { name: copy.propose.focusLink }));

    expect(document.activeElement).toBe(field);
    act(() => unbind?.());
    field.remove();
  });

  it('offers no button and says so when there is no slot', () => {
    render(<ProposeSlot copy={copy} slot={null} slotLine={null} />);

    expect(screen.queryByRole('button', { name: copy.propose.label })).toBeNull();
    expect(screen.getByTestId('ctz-slot').textContent).toContain(copy.slot.none);
  });

  it('keeps focus on the propose button after a keyboard activation', () => {
    render(<ProposeSlot copy={copy} slot={SLOT} slotLine={LINE} />);
    const button = proposeButton();
    button.focus();

    fireEvent.click(button);

    expect(document.activeElement).toBe(button);
    expect(screen.getByTestId('ctz-proposed')).not.toBeNull();
  });
});

describe('ContactTimezone slot state isolation', () => {
  it('does not re-render the panel when a slot is proposed or the message changes', () => {
    detected.zone = 'Europe/Berlin';
    render(<ContactTimezone copy={copy} />);
    const before = mapRenders.count;

    fireEvent.click(proposeButton());
    expect(screen.getByTestId('ctz-proposed')).not.toBeNull();
    act(() => messageStore.set(''));

    expect(screen.queryByTestId('ctz-proposed')).toBeNull();
    expect(mapRenders.count).toBe(before);
  });
});
