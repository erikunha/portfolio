import { render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { contactLanguages } from '@/content/contact';
import { contactCopy } from '@/content/contact-copy';
import { profile } from '@/content/profile';
import { SITE_LOCALE } from '@/content/site-locale';
import { social } from '@/content/social';
import { ContactSection } from './ContactSection';

describe('ContactSection', () => {
  it('renders a channels block with its own heading and every way to reach Erik', () => {
    const host = document.createElement('div');
    host.innerHTML = renderToStaticMarkup(<ContactSection locale={SITE_LOCALE.en} />);
    const block = host.querySelector('.contact-main .contact-channels');
    expect(block, 'the channels block sits in the left column').not.toBeNull();
    expect(block?.querySelector('h3')?.textContent).toBe(
      contactCopy[SITE_LOCALE.en].channels.title,
    );
    expect(block?.getAttribute('aria-labelledby')).toBe(block?.querySelector('h3')?.id);
    expect(block?.querySelector('a[href^="mailto:"]')?.textContent).toBe(social.email);
    expect(block?.querySelector('a[href$="/in/erikunha/"]')?.textContent).toContain(
      contactCopy[SITE_LOCALE.en].channels.linkedinCta,
    );
    expect(block?.querySelector('a[href="https://github.com/erikunha"]')?.textContent).toContain(
      social.githubLabel,
    );
  });

  it('gives the linkedin row a real outbound link', () => {
    const host = document.createElement('div');
    host.innerHTML = renderToStaticMarkup(<ContactSection locale={SITE_LOCALE.en} />);
    const cta = host.querySelector('.contact-channel-cta');
    expect(cta?.getAttribute('href')).toBe(social.linkedin);
    expect(cta?.getAttribute('target')).toBe('_blank');
    expect(cta?.getAttribute('rel')).toContain('noopener');
  });

  it('keeps a copy control next to the address', () => {
    render(<ContactSection locale={SITE_LOCALE.en} />);
    const copy = screen.getByRole('button', {
      name: contactCopy[SITE_LOCALE.en].section.copyEmail,
    });
    expect(copy).toBeTruthy();
  });
});

describe('ContactSection timezone panel first paint', () => {
  const { facts } = contactCopy[SITE_LOCALE.en].timezone;

  function serverPanel(): HTMLElement {
    const host = document.createElement('div');
    host.innerHTML = renderToStaticMarkup(<ContactSection locale={SITE_LOCALE.en} />);
    return host;
  }

  const factValue = (host: HTMLElement, label: string) =>
    [...host.querySelectorAll('.contact-fact')]
      .find((row) => row.querySelector('dt')?.textContent === label)
      ?.querySelector('dd')?.textContent;

  it('puts the panel in the right column beside the form column', () => {
    const host = serverPanel();

    expect(host.querySelector('.contact-layout > .contact-main')).not.toBeNull();
    expect(
      host.querySelector(
        '.contact-layout > .contact-timezone [data-testid="contact-timezone-static"]',
      ),
    ).not.toBeNull();
  });

  it('titles the panel with the timezone heading, not the channels heading', () => {
    const panel = serverPanel().querySelector('.contact-layout > .contact-timezone');
    const heading = panel?.querySelector('h3');

    expect(heading?.textContent).toBe(contactCopy[SITE_LOCALE.en].timezone.title);
    expect(heading?.textContent).not.toBe(contactCopy[SITE_LOCALE.en].channels.title);
    expect(panel?.getAttribute('aria-labelledby')).toBe(heading?.id);
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
    expect(factValue(host, facts.engagementLabel)).toBe(facts.engagementValue);
    expect(factValue(host, facts.replyLabel)).toBe(facts.replyValue);
    expect(factValue(host, contactCopy[SITE_LOCALE.en].channels.languagesLabel)).toBe(
      contactLanguages,
    );
    expect(host.textContent).not.toMatch(/NaN|undefined|\{\w+\}/);
  });

  it('lists five facts and drops the timezone fact the clocks already state', () => {
    const labels = [...serverPanel().querySelectorAll('.contact-main .contact-fact dt')].map(
      (label) => label.textContent,
    );

    expect(labels).toEqual([
      facts.availabilityLabel,
      facts.modeLabel,
      facts.engagementLabel,
      facts.replyLabel,
      contactCopy[SITE_LOCALE.en].channels.languagesLabel,
    ]);
    expect(serverPanel().textContent).not.toContain(profile.timezone);
  });

  it('keeps the email, copy control, LinkedIn and GitHub out of the timezone panel', () => {
    const panel = serverPanel().querySelector('.contact-timezone');

    expect(panel?.querySelector('a[href^="mailto:"]')).toBeNull();
    expect(panel?.querySelector('a[href$="/in/erikunha/"]')).toBeNull();
    expect(panel?.querySelector('a[href="https://github.com/erikunha"]')).toBeNull();
    expect(panel?.querySelector('.contact-fact')).toBeNull();
  });

  it('orders the source form, channels, facts, panel so the stack reads as it looks', () => {
    const host = serverPanel();
    const form = host.querySelector('.contact-main > :first-child') as Element;
    const channels = host.querySelector('.contact-channels') as Element;
    const factList = host.querySelector('.contact-facts') as Element;
    const panel = host.querySelector('.contact-timezone') as Element;
    const FOLLOWING = Node.DOCUMENT_POSITION_FOLLOWING;

    expect(form.contains(channels), 'the form region does not wrap the channels block').toBe(false);
    expect(form.compareDocumentPosition(channels) & FOLLOWING).toBe(FOLLOWING);
    expect(channels.compareDocumentPosition(factList) & FOLLOWING).toBe(FOLLOWING);
    expect(factList.compareDocumentPosition(panel) & FOLLOWING).toBe(FOLLOWING);
  });

  it('adds no footer element: the site footer stays the only one on the page', () => {
    expect(
      serverPanel().querySelectorAll('footer'),
      'a second <footer> makes page.locator("footer") ambiguous in the footer specs',
    ).toHaveLength(0);
  });

  it('gives every id once', () => {
    const ids = [...serverPanel().querySelectorAll('[id]')].map((node) => node.id);

    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe.each(Object.values(SITE_LOCALE))('ContactSection without JavaScript (%s)', (locale) => {
  const { section, timezone } = contactCopy[locale];
  const markup = renderToStaticMarkup(<ContactSection locale={locale} />);

  it('says the form needs JavaScript and offers a mailto, inside a noscript element', () => {
    const [, inside = ''] = /<noscript>([\s\S]*?)<\/noscript>/.exec(markup) ?? [];

    expect(inside).toContain(section.noscript);
    expect(inside).toContain(`href="mailto:${section.email}"`);
  });

  it('puts that hint in the form column, right after the form', () => {
    const host = document.createElement('div');
    host.innerHTML = markup;
    const main = host.querySelector('.contact-main');

    expect(main?.querySelector('noscript')).not.toBeNull();
    expect(main?.children[0]?.tagName).not.toBe('NOSCRIPT');
  });

  it('labels the timezone panel as loading before the live panel mounts', () => {
    const host = document.createElement('div');
    host.innerHTML = markup;
    const label = host.querySelector(
      '[data-testid="contact-timezone-static"] [data-testid="ctz-loading"]',
    );

    expect(label?.textContent).toBe(timezone.loading);
    expect(label?.getAttribute('role')).toBe('status');
  });

  it('marks the panel with its locale so the reserved height follows the copy', () => {
    const host = document.createElement('div');
    host.innerHTML = markup;

    expect(host.querySelector('.contact-timezone')?.getAttribute('data-locale')).toBe(locale);
  });
});
