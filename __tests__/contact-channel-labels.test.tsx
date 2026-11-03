import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ContactSection } from '@/components/sections/ContactSection/ContactSection';
import { contactCopy } from '@/content/contact-copy';
import { social } from '@/content/social';

const ARROW_GLYPH = '↗';
const GITHUB_NAME = 'github.com/erikunha (opens in a new tab)';

function spokenWords(text: string): string {
  return text.replace(ARROW_GLYPH, '').replaceAll('_', ' ').trim().toLowerCase();
}

function expectLabelInName(link: HTMLAnchorElement): void {
  const visible = spokenWords(link.textContent ?? '');
  const name = (link.getAttribute('aria-label') ?? '').toLowerCase();
  expect(
    name.includes(visible),
    `WCAG 2.5.3: the accessible name "${name}" must contain the visible words "${visible}" in order, or voice control cannot activate the link by what it reads`,
  ).toBe(true);
}

function renderChannels(): HTMLElement {
  const host = document.createElement('div');
  host.innerHTML = renderToStaticMarkup(<ContactSection />);
  const card = host.querySelector('.contact-channels');
  expect(card, 'the contact section carries a channels block').not.toBeNull();
  return card as HTMLElement;
}

describe('the contact channel actions name what they show', () => {
  it('gives the LinkedIn CTA an accessible name that contains its visible text literally', () => {
    const card = renderChannels();
    const links = [...card.querySelectorAll<HTMLAnchorElement>(`a[href="${social.linkedin}"]`)];

    expect(links.length, 'the channels block carries one LinkedIn action').toBeGreaterThan(0);
    for (const link of links) {
      const visible = [...link.childNodes]
        .filter((node) => !(node instanceof HTMLElement && node.matches('[aria-hidden], .sr-only')))
        .map((node) => node.textContent)
        .join('')
        .trim();
      const name = [...link.childNodes]
        .filter((node) => !(node instanceof HTMLElement && node.matches('[aria-hidden]')))
        .map((node) => node.textContent)
        .join('')
        .replace(/\s+/g, ' ')
        .trim();
      expect(link.getAttribute('aria-label'), 'the name comes from the content').toBeNull();
      expect(visible).toBe(contactCopy.channels.linkedinCta);
      expect(name, 'WCAG 2.5.3: the name starts with the literal visible text').toBe(
        `${contactCopy.channels.linkedinCta} ${contactCopy.channels.linkedinNewTabNote}`,
      );
    }
  });

  it('gives the GitHub link an accessible name that contains its visible words', () => {
    const card = renderChannels();
    const links = [...card.querySelectorAll<HTMLAnchorElement>(`a[href="${social.github}"]`)];

    expect(links.length, 'the channels block carries one GitHub action').toBeGreaterThan(0);
    for (const link of links) {
      expect(link.textContent?.trim()).toBe(`${social.githubLabel}${ARROW_GLYPH}`);
      expect(link.getAttribute('aria-label')).toBe(GITHUB_NAME);
      expectLabelInName(link);
    }
  });
});
