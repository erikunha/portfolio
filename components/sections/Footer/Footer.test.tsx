import { fireEvent, render, waitFor } from '@testing-library/react';
import { act } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AiMetricsSection } from '@/components/sections/AiMetricsSection';
import { ContactSection } from '@/components/sections/ContactSection';
import { GitLogSection } from '@/components/sections/GitLogSection';
import { GuitarSection } from '@/components/sections/GuitarSection';
import { HottestTakesSection } from '@/components/sections/HottestTakesSection';
import { ProjectsSection } from '@/components/sections/ProjectsSection';
import { ReadmeSection } from '@/components/sections/ReadmeSection';
import { ShellSection } from '@/components/sections/ShellSection';
import { Footer } from './index';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function serverFooter() {
  const host = document.createElement('div');
  host.innerHTML = renderToStaticMarkup(<Footer />);
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
    expect(host.querySelector('.footer-timestamp')?.textContent).toBe('[ 0.001]');
    for (const link of [
      { label: 'Home', href: '#main-content' },
      { label: 'About', href: '#sec-readme' },
      { label: 'Projects', href: '#sec-projects' },
      { label: 'Career', href: '#sec-git-log' },
      { label: 'Interactive shell', href: '#sec-shell' },
      { label: 'Measured', href: '#sec-live-perf' },
      { label: 'Opinions', href: '#sec-hottest-takes' },
      { label: 'Guitar and mixer', href: '#sec-guitar' },
      { label: 'Contact', href: '#sec-contact' },
      { label: 'DESIGN_SYSTEM', href: '/design-system' },
      { label: 'LINK_IN_BIO', href: '/links' },
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
          <ReadmeSection />
          <ShellSection />
          <AiMetricsSection />
          <ProjectsSection />
          <GitLogSection />
          <HottestTakesSection defer />
          <GuitarSection defer />
          <ContactSection defer />
        </main>
        <Footer />
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

  it('renders six directory groups with nested link lists and hidden tree connectors', () => {
    const host = serverFooter();
    const groups = host.querySelectorAll('.sm-groups > li');
    expect([...groups].map((group) => group.querySelector('.sm-title')?.textContent)).toEqual([
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
      links.forEach((link) => {
        const connector = link.querySelector('.tr');
        expect(connector?.getAttribute('aria-hidden')).toBe('true');
        expect(connector?.textContent).toBe('');
      });
    }
    expect(host.querySelector('.footer-dmesg')?.getAttribute('aria-hidden')).toBe('true');
    expect(
      host.querySelector('a[aria-label="press R to reboot, back to top"]')?.getAttribute('href'),
    ).toBe('#main-content');
  });

  it('keeps the visible reboot text inside the accessible name (WCAG 2.5.3 label in name)', () => {
    const host = render(<Footer />).container;
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
    const mounted = render(<Footer />);
    expect(mounted.container.querySelector('[data-sess="halt"]')?.textContent).toBe('14:05:09');
  });

  it('copies the visible netstat rows as plain text using the design-system control', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const mounted = render(<Footer />);
    fireEvent.click(mounted.getByRole('button', { name: 'Copy netstat rows' }));
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        'tcp  ESTABLISHED  github.com/erikunha\n' +
          'tcp  LISTEN  linkedin.com/in/erikunha\n' +
          'tcp  ESTABLISHED  erikunha.dev\n' +
          'tcp  ESTABLISHED  ~/design_system',
      ),
    );
    expect(mounted.getByRole('button', { name: 'Copy netstat rows' }).textContent).toBe('COPIED');
  });

  it('starts uptime at page navigation and counts commands before the footer is reached', () => {
    vi.useFakeTimers();
    vi.spyOn(performance, 'now').mockReturnValue(65_000);
    vi.stubGlobal('IntersectionObserver', undefined);
    const mounted = render(<Footer />);
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
        <Footer />
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
    const treeLink = mounted.getByRole('link', { name: 'Projects' });
    treeLink.focus();
    fireEvent.keyDown(treeLink, { key: 'r' });
    expect(document.activeElement).toBe(heading);
    expect(scrollTo).toHaveBeenCalledTimes(3);
  });

  it('lets the reboot link navigate natively when the page has no heading to focus', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const mounted = render(<Footer />);
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
      'sec-live-perf',
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
          <section data-testid="hero-mobile" />
          <section id="unrelated" />
        </main>
        <Footer />
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
