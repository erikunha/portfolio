import { within } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { type MountedClient, mountClient } from '@/__tests__/helpers/render';
import { contactCopy } from '@/content/contact-copy';
import { SITE_LOCALE } from '@/content/site-locale';
import { ContactReceipt } from './ContactReceipt';

const AT = new Date('2026-11-08T12:42:00Z');
const copy = contactCopy[SITE_LOCALE.en];
const text = copy.success.receipt;

describe('ContactReceipt', () => {
  let mounted: MountedClient | undefined;

  async function open() {
    mounted = await mountClient(createElement(ContactReceipt, { copy, receipt: { at: AT } }));
    return mounted.container;
  }

  afterEach(() => {
    mounted?.unmount();
    mounted = undefined;
  });

  it('shows the send time as a machine-readable timestamp', async () => {
    const container = await open();
    const time = container.querySelector('time');
    expect(time?.getAttribute('datetime')).toBe(AT.toISOString());
    expect(time?.textContent).toMatch(/\d{4}.*\d{2}:\d{2}/);
  });

  it('labels the timestamp with the at marker', async () => {
    const container = await open();
    expect(container.querySelector('dt')?.textContent).toBe(text.atLabel);
    expect(container.querySelector('dd time')).not.toBeNull();
  });

  it('offers no control, no reference and no erase affordance', async () => {
    const container = await open();
    expect(within(container).queryAllByRole('button')).toHaveLength(0);
    expect(container.querySelector('a[href^="mailto:"]')).toBeNull();
    expect(container.querySelector('.ref-chip')).toBeNull();
    expect(container.querySelector('[data-testid="contact-forget-status"]')).toBeNull();
    expect(container.querySelector('.contact-receipt-actions')).toBeNull();
  });
});
