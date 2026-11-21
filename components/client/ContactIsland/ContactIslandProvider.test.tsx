import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushMicrotasks } from '@/__tests__/helpers/render';
import { contactCopy } from '@/content/contact-copy';
import { SITE_LOCALE } from '@/content/site-locale';
import { contactChrome } from '@/content/terminal-chrome';
import { ContactForm } from '../ContactForm/ContactForm';
import { messageStore } from '../ContactForm/messageStore';
import { ProposeSlot } from '../ContactTimezone/ProposeSlot.client';
import { ContactIslandProvider } from './ContactIslandProvider.client';

const copy = contactCopy[SITE_LOCALE.en];
const SLOT = { you: '14:00', erik: '10:00' };
const LINE = 'Would a call at 14:00 work for you?';
const MESSAGE_LABEL = '$ message:';

function Pair({ testId }: { testId: string }) {
  return (
    <section data-testid={testId}>
      <ContactIslandProvider>
        <ContactForm copy={copy} chrome={contactChrome[SITE_LOCALE.en]} />
        <ProposeSlot copy={copy.timezone} slot={SLOT} slotLine={LINE} />
      </ContactIslandProvider>
    </section>
  );
}

const pair = (testId: string) => within(screen.getByTestId(testId));
const messageOf = (testId: string) =>
  pair(testId).getByLabelText(MESSAGE_LABEL) as HTMLTextAreaElement;

afterEach(() => {
  act(() => messageStore.reset());
  vi.unstubAllGlobals();
});

describe('ContactIslandProvider', () => {
  it('keeps the message of two form and slot pairs apart', () => {
    render(
      <>
        <Pair testId="first" />
        <Pair testId="second" />
      </>,
    );

    fireEvent.click(pair('first').getByRole('button', { name: copy.timezone.propose.label }));

    expect(messageOf('first').value).toBe(LINE);
    expect(pair('first').getByTestId('ctz-proposed')).not.toBeNull();
    expect(messageOf('second').value).toBe('');
    expect(pair('second').queryByTestId('ctz-proposed')).toBeNull();
    expect(messageStore.getSnapshot()).toBe('');
  });

  it('starts a remounted pair empty because unmounting drops its store', () => {
    const first = render(<Pair testId="pair" />);
    fireEvent.change(messageOf('pair'), { target: { value: 'typed before leaving' } });
    first.unmount();

    render(<Pair testId="pair" />);

    expect(messageOf('pair').value).toBe('');
  });

  it('clears the pair message after a delivered send', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ ok: true })),
    );
    const { container } = render(<Pair testId="pair" />);
    fireEvent.change(container.querySelector('input[name="name"]') as HTMLInputElement, {
      target: { value: 'Ada' },
    });
    fireEvent.change(container.querySelector('input[name="email"]') as HTMLInputElement, {
      target: { value: 'ada@example.com' },
    });
    fireEvent.change(messageOf('pair'), {
      target: { value: 'A platform engineering opportunity.' },
    });

    await act(async () => {
      fireEvent.submit(container.querySelector('form') as HTMLFormElement);
    });
    await flushMicrotasks();
    fireEvent.click(pair('pair').getByRole('button', { name: copy.dismiss.aria }));

    expect(messageOf('pair').value, 'the sent text must not outlive the send').toBe('');
  });
});
