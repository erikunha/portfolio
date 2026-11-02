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

describe('ContactSection timezone panel first paint', () => {
  const { facts } = contactCopy.timezone;

  function serverPanel(): HTMLElement {
    const host = document.createElement('div');
    host.innerHTML = renderToStaticMarkup(<ContactSection />);
    return host;
  }

  const factValue = (host: HTMLElement, label: string) =>
    [...host.querySelectorAll('.ctz-fact')]
      .find((row) => row.querySelector('dt')?.textContent === label)
      ?.querySelector('dd')?.textContent;

  it('puts the panel in the right column beside the form', () => {
    const host = serverPanel();

    expect(host.querySelector('.contact-layout > .contact-main')).not.toBeNull();
    expect(
      host.querySelector(
        '.contact-layout > .contact-channels [data-testid="contact-timezone-static"]',
      ),
    ).not.toBeNull();
  });

  it('draws the whole map dim with Erik pinned and no clock ticking', () => {
    const host = serverPanel();

    expect(
      host.querySelector('[data-testid="ctz-land-dim"]')?.getAttribute('d')?.length,
    ).toBeGreaterThan(0);
    expect(host.querySelector('[data-testid="ctz-land-lit"]')?.getAttribute('d')).toBe('');
    expect(host.querySelector('[data-testid="ctz-pin-erik"]')).not.toBeNull();
    expect(host.querySelector('[data-testid^="ctz-clock"]')).toBeNull();
    expect(host.querySelector('[data-testid="ctz-pin-you"]')).toBeNull();
    expect(host.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('states the facts from content and invents nothing', () => {
    const host = serverPanel();

    expect(factValue(host, facts.availabilityLabel)).toBe(profile.availability);
    expect(factValue(host, facts.modeLabel)).toBe(facts.modeValue);
    expect(factValue(host, facts.relocationLabel)).toBe(facts.relocationValue);
    expect(factValue(host, facts.engagementLabel)).toBe(facts.engagementValue);
    expect(factValue(host, facts.replyLabel)).toBe(facts.replyValue);
    expect(factValue(host, contactCopy.channels.languagesLabel)).toBe(contactLanguages);
    expect(factValue(host, contactCopy.channels.timezoneLabel)).toBe(profile.timezone);
    expect(host.textContent).not.toMatch(/NaN|undefined|\{\w+\}/);
  });

  it('keeps the email, copy control, LinkedIn and GitHub in the panel footer', () => {
    const footer = serverPanel().querySelector('.ctz-footer');

    expect(footer?.querySelector('a[href^="mailto:"]')?.textContent).toBe(social.email);
    expect(footer?.querySelector('a[href="https://github.com/erikunha"]')).not.toBeNull();
    expect(footer?.querySelector('a[href$="/in/erikunha/"]')?.textContent).toContain(
      contactCopy.channels.linkedinCta,
    );
  });

  it('gives every id once', () => {
    const ids = [...serverPanel().querySelectorAll('[id]')].map((node) => node.id);

    expect(new Set(ids).size).toBe(ids.length);
  });
});
