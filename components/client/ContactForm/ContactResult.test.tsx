import { createElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { type MountedClient, mountClient } from '@/__tests__/helpers/render';
import { contactCopy } from '@/content/contact-copy';
import { SITE_LOCALE } from '@/content/site-locale';
import { ContactResult } from './ContactResult';
import { CONTACT_STATUS } from './useContactSubmit';

const REF = '7f3a9c2e-41b0-4d8e-9a77-3c51d0b2e8aa';
const copy = contactCopy[SITE_LOCALE.en];

describe('ContactResult', () => {
  let mounted: MountedClient | undefined;

  afterEach(() => {
    mounted?.unmount();
    mounted = undefined;
  });

  async function show(props: {
    status: typeof CONTACT_STATUS.SUCCESS | typeof CONTACT_STATUS.QUEUED;
    receipt?: { ref: string; at: Date } | null;
    queuedRef?: string;
  }) {
    mounted = await mountClient(
      createElement(ContactResult, {
        copy,
        status: props.status,
        receipt: props.receipt ?? null,
        queuedRef: props.queuedRef ?? '',
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
      receipt: { ref: REF, at: new Date('2026-11-08T12:42:00Z') },
    });
    expect(withRef.querySelector('[data-testid="contact-receipt"]')).not.toBeNull();
  });

  it('announces a queued message with the faster-contact link and takes focus', async () => {
    const container = await show({ status: CONTACT_STATUS.QUEUED, queuedRef: REF });
    const panel = container.querySelector('[data-testid="contact-queued"]') as HTMLElement;
    expect(panel.getAttribute('role')).toBe('status');
    expect(panel.textContent).toContain(copy.queued.title);
    expect(panel.querySelector('a')?.getAttribute('href')).toBe(copy.queued.linkHref);
    expect(document.activeElement).toBe(panel);
    expect(container.querySelector('[data-testid="contact-queued-ref"]')?.textContent).toBe(
      `${copy.queued.refLabel} ${REF}`,
    );
    expect(container.querySelector('[data-testid="contact-success"]')).toBeNull();
  });

  it('omits the ref line when the queued response carried none', async () => {
    const container = await show({ status: CONTACT_STATUS.QUEUED });
    expect(container.querySelector('[data-testid="contact-queued-ref"]')).toBeNull();
  });
});
