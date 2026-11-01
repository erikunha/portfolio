import { render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { contactLanguages } from '@/content/contact';
import { contactCopy } from '@/content/contact-copy';
import { profile } from '@/content/profile';
import { social } from '@/content/social';
import { ContactSection } from './ContactSection';

describe('ContactSection', () => {
  it('renders the channels card with every row a reader needs', () => {
    const host = document.createElement('div');
    host.innerHTML = renderToStaticMarkup(<ContactSection />);
    const card = host.querySelector('.contact-channels');
    expect(card, 'the contact section carries a channels card').not.toBeNull();
    expect(card?.querySelector('a[href^="mailto:"]')?.textContent).toBe(social.email);
    expect(card?.querySelector('a[href$="/in/erikunha/"]')?.textContent).toContain(
      contactCopy.channels.linkedinCta,
    );
    expect(card?.querySelector('a[href="https://github.com/erikunha"]')?.textContent).toContain(
      social.githubLabel,
    );
    expect(card?.textContent).toContain(contactCopy.channels.replyValue);
    expect(card?.textContent).toContain(contactLanguages);
    expect(card?.textContent).toContain(profile.timezone);
  });

  it('gives the linkedin row a real outbound link', () => {
    const host = document.createElement('div');
    host.innerHTML = renderToStaticMarkup(<ContactSection />);
    const cta = host.querySelector('.contact-channel-cta');
    expect(cta?.getAttribute('href')).toBe(social.linkedin);
    expect(cta?.getAttribute('target')).toBe('_blank');
    expect(cta?.getAttribute('rel')).toContain('noopener');
  });

  it('keeps a copy control next to the address', () => {
    render(<ContactSection />);
    const copy = screen.getByRole('button', { name: contactCopy.section.copyEmail });
    expect(copy).toBeTruthy();
  });
});
