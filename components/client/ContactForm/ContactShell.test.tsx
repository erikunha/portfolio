import { afterEach, describe, expect, it } from 'vitest';
import { type MountedClient, mountClient } from '@/__tests__/helpers/render';
import { SITE_LOCALE } from '@/content/site-locale';
import { contactChrome } from '@/content/terminal-chrome';
import { ContactShell } from './ContactShell';

describe('ContactShell', () => {
  let mounted: MountedClient | undefined;

  afterEach(() => {
    mounted?.unmount();
    mounted = undefined;
  });

  it('wraps its children in the terminal chrome and body', async () => {
    mounted = await mountClient(
      <ContactShell chrome={contactChrome[SITE_LOCALE.en]}>
        <p data-testid="inside">child</p>
      </ContactShell>,
    );
    const shell = mounted.container.querySelector('.contact-shell') as HTMLElement;
    expect(shell.querySelector('.contact-chrome')).not.toBeNull();
    expect(shell.querySelector('.contact-body [data-testid="inside"]')?.textContent).toBe('child');
  });
});
