import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { social } from '@/content/social';
import { visaRows } from '@/content/visa';
import { ContactSection } from './ContactSection';

vi.mock('../../client/ContactForm', () => ({ ContactFormLazy: () => null }));

afterEach(() => vi.unstubAllGlobals());

describe('ContactSection', () => {
  it('renders direct contact, a reply expectation, and authorization before hydration', () => {
    const host = document.createElement('div');
    host.innerHTML = renderToStaticMarkup(<ContactSection />);
    expect(host.querySelector(`a[href="mailto:${social.email}"]`)?.textContent).toBe(social.email);
    expect(host.querySelector(`a[href="${social.linkedin}"]`)?.textContent).toContain(
      'Message me there',
    );
    expect(host.textContent).toContain('Replies within 48h');
    expect(host.querySelector('table caption')?.textContent).toContain('Work authorization');
    expect(host.querySelectorAll('tbody tr')).toHaveLength(visaRows.length);
  });

  it('copies the canonical email and announces completion', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    render(<ContactSection />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy email' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(social.email));
    expect(screen.getByRole('button', { name: 'Copy email' }).textContent).toBe('COPIED');
  });
});
