import { parse, type Rule } from 'postcss';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { readComponentsCss } from '@/__tests__/helpers/components-css';
import { declValue } from '@/__tests__/helpers/css-rules';
import { CvPage } from '@/components/reading/CvPage';
import { SummaryPage } from '@/components/reading/SummaryPage';
import { About } from '@/components/sections/About';
import { ContactSection } from '@/components/sections/ContactSection';
import { GitLogSection } from '@/components/sections/GitLogSection';
import { GuitarSection } from '@/components/sections/GuitarSection';
import { Hero } from '@/components/sections/Hero';
import { HottestTakesSection } from '@/components/sections/HottestTakesSection';
import { ProjectsSection } from '@/components/sections/ProjectsSection';
import { SITE_LOCALE } from '@/content/site-locale';

vi.mock('@/lib/ua', () => ({ getIsMobile: async () => false }));
vi.mock('@/components/client/ContactForm', () => ({ ContactFormLazy: () => null }));
vi.mock('@/components/client/InteractiveShell', () => ({ InteractiveShellLazy: () => null }));

const SIGNAL_TOKEN = 'var(--color-primary-500)';
const SENTENCE_WORDS = 4;
const WORD = /[A-Za-z]{2,}/;
const TERMINAL_STATUS_LINES: ReadonlySet<string> = new Set(['ctz-loading', 'mixer-boot-current']);

function directText(element: Element): string {
  return Array.from(element.childNodes)
    .filter((node) => node.nodeType === Node.TEXT_NODE)
    .map((node) => node.textContent ?? '')
    .join('')
    .trim();
}

function isSentence(text: string): boolean {
  const words = text.split(/\s+/).filter((token) => WORD.test(token));
  return words.length >= SENTENCE_WORDS && text !== text.toUpperCase();
}

function sentenceClasses(document: Document): Set<string> {
  const classes = new Set<string>();
  for (const element of document.querySelectorAll('[class]')) {
    if (!isSentence(directText(element)) || element.closest('h1,h2,h3,h4,h5,h6,[role="heading"]'))
      continue;
    for (const name of element.classList) {
      if (!TERMINAL_STATUS_LINES.has(name)) {
        classes.add(name);
      }
    }
  }
  return classes;
}

function subjectClasses(rule: Rule): string[] {
  return rule.selector.split(',').flatMap((selector) => {
    const subject =
      selector
        .trim()
        .split(/[\s>+~]+/)
        .pop() ?? '';
    return Array.from(subject.matchAll(/\.([\w-]+)/g), (match) => match[1] ?? '');
  });
}

describe('sentence text never uses the signal colour', () => {
  it('colours every class that carries a sentence with the body token, not --color-primary-500', async () => {
    const sections = [
      Hero,
      About,
      ProjectsSection,
      GitLogSection,
      HottestTakesSection,
      GuitarSection,
      ContactSection,
    ];
    const pages = [CvPage, SummaryPage];
    const markup = [...sections, ...pages]
      .flatMap((Component) =>
        Object.values(SITE_LOCALE).map((locale) =>
          renderToStaticMarkup(createElement(Component, { locale })),
        ),
      )
      .join('');
    const sentences = sentenceClasses(new DOMParser().parseFromString(markup, 'text/html'));

    const offenders: string[] = [];
    parse(readComponentsCss()).walkRules((rule) => {
      if (declValue(rule, 'color') !== SIGNAL_TOKEN) return;
      for (const name of subjectClasses(rule)) {
        if (sentences.has(name)) offenders.push(`.${name}`);
      }
    });
    expect(
      [...new Set(offenders)].sort(),
      'the signal green fails WCAG AA for paragraph text and is reserved for headings, accents and large text; use var(--color-tertiary-50) for sentences',
    ).toEqual([]);
  });
});
