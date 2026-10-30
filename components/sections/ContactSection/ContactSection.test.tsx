import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { contactLanguageLine } from '@/content/contact';
import { social } from '@/content/social';
import { ContactSection } from './ContactSection';

vi.mock('../../client/ContactForm', () => ({ ContactFormLazy: () => null }));

afterEach(() => vi.unstubAllGlobals());

describe('ContactSection', () => {
  it('renders direct contact and a reply expectation before hydration', () => {
    const host = document.createElement('div');
    host.innerHTML = renderToStaticMarkup(<ContactSection />);
    expect(host.querySelector(`a[href="mailto:${social.email}"]`)?.textContent).toBe(social.email);
    expect(host.querySelector(`a[href="${social.linkedin}"]`)?.textContent).toContain(
      'Message me there',
    );
    expect(host.textContent).toContain('Replies within 48h');
  });

  it('renders no work authorization rows', () => {
    const host = document.createElement('div');
    host.innerHTML = renderToStaticMarkup(<ContactSection />);
    expect(host.querySelector('table')).toBeNull();
    expect(host.textContent).not.toContain('Work authorization');
    expect(host.textContent).not.toContain('SPONSORSHIP');
  });

  it('renders the language line in the prototype format', () => {
    const host = document.createElement('div');
    host.innerHTML = renderToStaticMarkup(<ContactSection />);
    expect(host.querySelector('.contact-languages')?.textContent).toBe(contactLanguageLine);
    expect(contactLanguageLine).toBe('// PT (native) · EN (C1) · ES (B1) · FR (A2)');
  });

  it('labels the copy control as the prototype copy email action', () => {
    const host = document.createElement('div');
    host.innerHTML = renderToStaticMarkup(<ContactSection />);
    const button = host.querySelector('button.contact-copy-btn');
    expect(button?.textContent).toBe('[COPY EMAIL]');
    expect(button?.getAttribute('aria-label')).toBe('Copy email address');
  });

  it('copies the canonical email and announces completion', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    render(<ContactSection />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy email address' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(social.email));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Copy email address' }).textContent).toBe(
        '[COPIED]',
      ),
    );
  });
});
