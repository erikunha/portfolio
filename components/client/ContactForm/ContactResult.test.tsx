import { fireEvent, within } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type MountedClient, mountClient } from '@/__tests__/helpers/render';
import { contactCopy } from '@/content/contact-copy';
import { SITE_LOCALE } from '@/content/site-locale';
import { ContactResult } from './ContactResult';
import { CONTACT_STATUS } from './useContactSubmit';

const copy = contactCopy[SITE_LOCALE.en];

describe('ContactResult', () => {
  let mounted: MountedClient | undefined;

  afterEach(() => {
    mounted?.unmount();
    mounted = undefined;
  });

  async function show(props: {
    status: typeof CONTACT_STATUS.SUCCESS | typeof CONTACT_STATUS.QUEUED;
    receipt?: { at: Date } | null;
    onDismiss?: () => void;
  }) {
    mounted = await mountClient(
      createElement(ContactResult, {
        copy,
        status: props.status,
        receipt: props.receipt ?? null,
        onDismiss: props.onDismiss ?? (() => undefined),
      }),
    );
    return mounted.container;
  }

  it('announces a delivered message and takes focus', async () => {
    const container = await show({ status: CONTACT_STATUS.SUCCESS });
    const panel = container.querySelector('[data-testid="contact-success"]') as HTMLElement;
    expect(panel.getAttribute('role')).toBe('status');
    expect(panel.textContent).toContain(copy.success.title);
    expect(panel.textContent).toContain(copy.success.message);
    expect(document.activeElement).toBe(panel);
    expect(container.querySelector('[data-testid="contact-queued"]')).toBeNull();
  });

  it('shows the receipt only when a ref came back', async () => {
    const without = await show({ status: CONTACT_STATUS.SUCCESS });
    expect(without.querySelector('[data-testid="contact-receipt"]')).toBeNull();
    mounted?.unmount();

    const withRef = await show({
      status: CONTACT_STATUS.SUCCESS,
      receipt: { at: new Date('2026-11-08T12:42:00Z') },
    });
    expect(withRef.querySelector('[data-testid="contact-receipt"]')).not.toBeNull();
  });

  it('announces a queued message with the faster-contact link and takes focus', async () => {
    const container = await show({ status: CONTACT_STATUS.QUEUED });
    const panel = container.querySelector('[data-testid="contact-queued"]') as HTMLElement;
    expect(panel.getAttribute('role')).toBe('status');
    expect(panel.textContent).toContain(copy.queued.title);
    expect(panel.querySelector('a')?.getAttribute('href')).toBe(copy.queued.linkHref);
    expect(document.activeElement).toBe(panel);
    expect(container.querySelector('[data-testid="contact-success"]')).toBeNull();
  });

  it('renders no request id line in the queued state', async () => {
    const container = await show({ status: CONTACT_STATUS.QUEUED });
    expect(container.querySelector('[data-testid="contact-queued-ref"]')).toBeNull();
    expect(container.querySelector('code')).toBeNull();
  });

  it.each([CONTACT_STATUS.SUCCESS, CONTACT_STATUS.QUEUED])(
    'puts the dismiss button at the far right of the action row (%s)',
    async (status) => {
      const onDismiss = vi.fn();
      const container = await show({ status, onDismiss });
      const row = container.querySelector('.contact-action-row') as HTMLElement;
      const button = within(row).getByRole('button', { name: copy.dismiss.aria });

      expect(button.textContent).toBe(copy.dismiss.label);
      expect(row.lastElementChild).toBe(button);
      expect(row.firstElementChild?.textContent?.trim()).not.toBe('');

      await fireEvent.click(button);
      expect(onDismiss).toHaveBeenCalledOnce();
    },
  );

  it('keeps the faster contact link on the left of the queued action row', async () => {
    const container = await show({ status: CONTACT_STATUS.QUEUED });
    const row = container.querySelector('.contact-action-row') as HTMLElement;

    expect(row.firstElementChild?.textContent).toContain(copy.queued.fasterLabel);
    expect(row.querySelector('a')?.getAttribute('href')).toBe(copy.queued.linkHref);
  });
});
