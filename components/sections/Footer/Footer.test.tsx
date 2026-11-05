import { fireEvent, render } from '@testing-library/react';
import { act } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { About } from '@/components/sections/About';
import { AiMetricsSection } from '@/components/sections/AiMetricsSection';
import { ContactSection } from '@/components/sections/ContactSection';
import { GitLogSection } from '@/components/sections/GitLogSection';
import { GuitarSection } from '@/components/sections/GuitarSection';
import { HottestTakesSection } from '@/components/sections/HottestTakesSection';
import { ProjectsSection } from '@/components/sections/ProjectsSection';
import { ShellSection } from '@/components/sections/ShellSection';
import { SITE_LOCALE } from '@/content/site-locale';
import { Footer } from './index';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function serverFooter() {
  const host = document.createElement('div');
  host.innerHTML = renderToStaticMarkup(<Footer locale={SITE_LOCALE.en} />);
  return host;
}

describe('Footer server output', () => {
  it('renders both cards, shutdown and every link without running client effects', () => {
    const host = serverFooter();
    expect(host.textContent).toContain('SESSION_REPORT');
    expect(host.textContent).toContain('NETSTAT -AN');
    expect(host.textContent).toContain('[SYSTEM SHUTDOWN INITIATED]');
    expect(host.textContent).toContain('Power down.');
    expect(host.textContent).toContain('this session ends here');
    expect(host.querySelector('canvas')).toBeNull();
    expect(host.querySelector('.footer-timestamp')?.textContent).toBe('[ 0.349]');
    expect(host.textContent).toContain('closing 3 connections');
    for (const link of [
      { label: 'Home', href: '#main-content' },
      { label: 'About', href: '#sec-readme' },
      { label: 'Projects', href: '#sec-projects' },
      { label: 'Career', href: '#sec-git-log' },
      { label: 'Interactive shell', href: '#sec-shell' },
      { label: 'Measured', href: '#sec-live-metrics' },
      { label: 'Opinions', href: '#sec-hottest-takes' },
      { label: 'Guitar and mixer', href: '#sec-guitar' },
      { label: 'Contact', href: '#sec-contact' },
      { label: '30S_SUMMARY', href: '/summary' },
      { label: 'DESIGN_SYSTEM', href: '/design-system' },
      { label: 'LINK_IN_BIO', href: '/links' },
      { label: 'VIEW_CV', href: '/cv' },
      { label: 'github.com/erikunha', href: 'https://github.com/erikunha' },
      { label: 'linkedin.com/in/erikunha', href: 'https://www.linkedin.com/in/erikunha/' },
      { label: 'erikunha.dev', href: 'https://www.erikunha.dev' },
      { label: '~/design_system', href: '/design-system' },
    ]) {
      const match = [...host.querySelectorAll('a')].find(
        (a) => a.getAttribute('href') === link.href && a.textContent?.includes(link.label),
      );
      expect(match, `${link.label} must be available before hydration`).toBeDefined();
    }
  });

  it('links in-page footer links to top-level sections rendered by the page', () => {
    const host = document.createElement('div');
    host.innerHTML = renderToStaticMarkup(
      <>
        <main id="main-content">
          <About locale={SITE_LOCALE.en} />
          <ShellSection locale={SITE_LOCALE.en} />
          <AiMetricsSection locale={SITE_LOCALE.en} />
          <ProjectsSection locale={SITE_LOCALE.en} />
          <GitLogSection locale={SITE_LOCALE.en} />
          <HottestTakesSection locale={SITE_LOCALE.en} defer />
          <GuitarSection locale={SITE_LOCALE.en} defer />
          <ContactSection locale={SITE_LOCALE.en} defer />
        </main>
        <Footer locale={SITE_LOCALE.en} />
      </>,
    );
    const main = host.querySelector('main');
    const topLevelSectionIds = new Set([
      main?.id,
      ...[...(main?.children ?? [])].map((section) => section.id),
    ]);
    const inPageLinks = [...host.querySelectorAll('footer a[href^="#"]')];

    expect(inPageLinks.length).toBeGreaterThan(0);
    for (const link of inPageLinks) {
      const targetId = link.getAttribute('href')?.slice(1);
      expect(
        topLevelSectionIds.has(targetId ?? ''),
        `${link.textContent} must target a top-level section`,
      ).toBe(true);
    }
  });

  it('renders six directory groups, each a folder row with its file count over a link list', () => {
    const host = serverFooter();
    const groups = host.querySelectorAll('.sm-groups > li');
    expect([...groups].map((group) => group.querySelector('.sm-dir')?.textContent)).toEqual([
      './whoami/',
      './work/',
      './measured/',
      './off_hours/',
      './contact/',
      './pages/',
    ]);
    for (const group of groups) {
      const links = group.querySelectorAll('ul > li > a');
      expect(links.length).toBeGreaterThan(0);
      expect(group.querySelector('.sm-count')?.textContent).toBe(
        `${links.length} ${links.length === 1 ? 'file' : 'files'}`,
      );
    }
    expect(host.querySelector('.footer-dmesg')?.getAttribute('aria-hidden')).toBe('true');
    expect(
      host.querySelector('a[aria-label="press R to reboot, back to top"]')?.getAttribute('href'),
    ).toBe('#main-content');
  });

  it('renders the phone site map as one exclusive accordion with a file count per folder', () => {
    const host = serverFooter();
    const folds = [...host.querySelectorAll('.sm-folds > details.sm-fold')];
    expect(folds.map((fold) => fold.getAttribute('name'))).toEqual(Array(6).fill('footer-sitemap'));
    expect(folds.map((fold) => fold.hasAttribute('open'))).toEqual([
      false,
      true,
      false,
      false,
      false,
      false,
    ]);
    expect(folds.map((fold) => fold.querySelector('summary')?.textContent)).toEqual([
      './whoami/2 files',
      './work/2 files',
      './measured/2 files',
      './off_hours/2 files',
      './contact/1 file',
      './pages/4 files',
    ]);
    const columnLinks = [...host.querySelectorAll('.sm-groups a')].map((a) =>
      a.getAttribute('href'),
    );
    const foldLinks = [...host.querySelectorAll('.sm-folds a')].map((a) => a.getAttribute('href'));
    expect(foldLinks).toEqual(columnLinks);
  });

  it('lists the four page destinations under ./pages/', () => {
    const host = serverFooter();
    const pages = [...host.querySelectorAll('.sm-groups > li')].find(
      (group) => group.querySelector('.sm-dir')?.textContent === './pages/',
    );
    const links = [...(pages?.querySelectorAll('ul > li > a') ?? [])].map((link) => [
      link.textContent,
      link.getAttribute('href'),
    ]);
    expect(links).toEqual([
      ['30S_SUMMARY', '/summary'],
      ['DESIGN_SYSTEM', '/design-system'],
      ['LINK_IN_BIO', '/links'],
      ['VIEW_CV', '/cv'],
    ]);
  });

  it('keeps the visible reboot text inside the accessible name (WCAG 2.5.3 label in name)', () => {
    const host = render(<Footer locale={SITE_LOCALE.en} />).container;
    const link = host.querySelector('.footer-reboot');
    const visible = (link?.textContent ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
    const name = (link?.getAttribute('aria-label') ?? '').toLowerCase();
    expect(visible).toBe('press r to reboot');
    expect(name.startsWith(visible)).toBe(true);
  });
});

describe('Footer live session', () => {
  it('leaves the server clock empty and sets the visitor clock after hydration', () => {
    expect(serverFooter().querySelector('[data-sess="halt"]')?.textContent).toBe('');
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 23, 14, 5, 9));
    const mounted = render(<Footer locale={SITE_LOCALE.en} />);
    expect(mounted.container.querySelector('[data-sess="halt"]')?.textContent).toBe('14:05:09');
  });

  it('offers every netstat endpoint as a link and no copy control', () => {
    const mounted = render(<Footer locale={SITE_LOCALE.en} />);
    const endpoints = [...mounted.container.querySelectorAll('.footer-netstat tbody a')];
    expect(endpoints.map((link) => link.getAttribute('href'))).toEqual([
      'https://github.com/erikunha',
      'https://www.linkedin.com/in/erikunha/',
      'https://www.erikunha.dev',
      '/design-system',
    ]);
    expect(
      endpoints.map((link) => link.querySelector('.footer-link-glyph')?.textContent ?? null),
      'only external endpoints carry the opens-externally glyph',
    ).toEqual(['↗', '↗', '↗', null]);
    expect(
      mounted.queryByRole('button', { name: 'Copy netstat rows' }),
      'the netstat table links out, it does not copy',
    ).toBeNull();
  });

  it('starts uptime at page navigation and counts commands before the footer is reached', () => {
    vi.useFakeTimers();
    vi.spyOn(performance, 'now').mockReturnValue(65_000);
    vi.stubGlobal('IntersectionObserver', undefined);
    const mounted = render(<Footer locale={SITE_LOCALE.en} />);
    expect(mounted.container.querySelector('[data-sess="uptime"]')?.textContent).toBe('00:01:05');
    fireEvent(window, new CustomEvent('shell-cmd-run'));
    fireEvent(window, new CustomEvent('shell-cmd-run'));
    expect(mounted.container.querySelector('[data-sess="commands"]')?.textContent).toBe('2');
    mounted.unmount();
  });
});

describe('Footer reboot controls', () => {
  it('ignores editors, modifier keys and repeats, then focuses the heading without resetting the session', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const scrollTo = vi.fn();
    vi.stubGlobal('scrollTo', scrollTo);
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const mounted = render(
      <>
        <main>
          <h1>Erik Cunha</h1>
          <input aria-label="command" />
          <textarea aria-label="message" />
          <select aria-label="choice">
            <option>One</option>
          </select>
          <div contentEditable suppressContentEditableWarning>
            <span>editor</span>
          </div>
          {/* biome-ignore lint/a11y/useSemanticElements: exercise shortcut guards for custom editors. */}
          <div role="textbox" tabIndex={0}>
            custom editor
          </div>
        </main>
        <Footer locale={SITE_LOCALE.en} />
      </>,
    );
    const heading = mounted.getByRole('heading', { level: 1 });
    const status = mounted.getByTestId('footer-reboot-status');
    fireEvent.keyDown(document.body, { key: 'r' });
    expect(status.textContent).toBe('');
    for (const target of mounted.container.querySelectorAll(
      'input, textarea, select, [contenteditable] span, [role="textbox"]',
    )) {
      fireEvent.keyDown(target, { key: 'r' });
      expect(document.activeElement).not.toBe(heading);
      expect(status.textContent).toBe('');
    }
    for (const guard of [
      { ctrlKey: true },
      { altKey: true },
      { metaKey: true },
      { shiftKey: true },
      { repeat: true },
    ]) {
      fireEvent.keyDown(mounted.getByRole('link', { name: 'press R to reboot, back to top' }), {
        key: 'r',
        ...guard,
      });
      expect(status.textContent).toBe('');
    }
    fireEvent(window, new CustomEvent('shell-cmd-run'));
    expect(mounted.container.querySelector('[data-sess="commands"]')?.textContent).toBe('1');
    fireEvent.click(mounted.getByRole('link', { name: 'press R to reboot, back to top' }));
    expect(document.activeElement).toBe(heading);
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'instant' });
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(status.textContent).toContain('Session rebooted');
    expect(mounted.container.querySelector('[data-sess="commands"]')?.textContent).toBe('1');
    const rebootLink = mounted.getByRole('link', { name: 'press R to reboot, back to top' });
    rebootLink.focus();
    fireEvent.keyDown(rebootLink, { key: 'r' });
    expect(document.activeElement).toBe(heading);
    expect(scrollTo).toHaveBeenCalledTimes(2);
    const [treeLink] = mounted.getAllByRole('link', { name: 'Projects' });
    if (!treeLink) throw new Error('site map link missing');
    treeLink.focus();
    fireEvent.keyDown(treeLink, { key: 'r' });
    expect(document.activeElement).toBe(heading);
    expect(scrollTo).toHaveBeenCalledTimes(3);
  });

  it('lets the reboot link navigate natively when the page has no heading to focus', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const mounted = render(<Footer locale={SITE_LOCALE.en} />);
    const rebootLink = mounted.getByRole('link', { name: 'press R to reboot, back to top' });
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    rebootLink.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(false);
    const key = new KeyboardEvent('keydown', { key: 'r', bubbles: true, cancelable: true });
    rebootLink.dispatchEvent(key);
    expect(key.defaultPrevented).toBe(false);
  });

  it('tracks the nine logical sections once and keeps maximum scroll depth', () => {
    let notify: IntersectionObserverCallback | undefined;
    const observe = vi.fn();
    const disconnect = vi.fn();
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback: IntersectionObserverCallback) {
          notify = callback;
        }
        observe = observe;
        disconnect = disconnect;
      },
    );
    const sectionIds = [
      'bio',
      'sec-readme',
      'sec-projects',
      'sec-git-log',
      'sec-shell',
      'sec-live-metrics',
      'sec-hottest-takes',
      'sec-guitar',
      'sec-contact',
    ];
    const mounted = render(
      <>
        <main>
          {sectionIds.map((id) => (
            <section key={id} id={id} />
          ))}
          <section id="bio-mobile" data-testid="hero-mobile" />
          <section id="unrelated" />
        </main>
        <Footer locale={SITE_LOCALE.en} />
      </>,
    );
    expect(observe).toHaveBeenCalledTimes(10);
    expect(observe).not.toHaveBeenCalledWith(mounted.container.querySelector('#unrelated'));
    const targets = [
      mounted.container.querySelector('#bio'),
      mounted.getByTestId('hero-mobile'),
      mounted.container.querySelector('#sec-readme'),
    ];
    act(() =>
      notify?.(
        targets.map((target) => ({ target, isIntersecting: true })) as IntersectionObserverEntry[],
        {} as IntersectionObserver,
      ),
    );
    expect(mounted.container.querySelector('[data-sess="seen"]')?.textContent).toBe('2');
    vi.spyOn(document.documentElement, 'scrollHeight', 'get').mockReturnValue(2000);
    vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(1000);
    vi.stubGlobal('scrollY', 500);
    fireEvent.scroll(window);
    expect(mounted.container.querySelector('[data-sess="depth"]')?.textContent).toBe('50%');
    vi.stubGlobal('scrollY', 100);
    fireEvent.scroll(window);
    expect(mounted.container.querySelector('[data-sess="depth"]')?.textContent).toBe('50%');
    expect(mounted.container.querySelector('meter')?.value).toBe(50);
    mounted.unmount();
    expect(disconnect).toHaveBeenCalledOnce();
  });
});
