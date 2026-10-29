import { type ComponentType, createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type MountedClient, mountClient } from './helpers/render';

function firstOf<T>(arr: readonly T[]): T {
  expect(arr.length).toBeGreaterThan(0);
  // biome-ignore lint/style/noNonNullAssertion: length asserted by expect above
  return arr[0]!;
}

vi.mock('@/components/client/ContactForm', () => ({
  ContactFormLazy: () => null,
}));

vi.mock('@/components/client/InteractiveShell', () => ({
  InteractiveShellLazy: () => null,
}));

describe('About', () => {
  let mounted: MountedClient;

  afterEach(() => {
    mounted?.unmount();
  });

  it('renders the merged panels without standalone section wrappers', async () => {
    const { About } = await import('@/components/sections/About');
    const { aboutContent } = await import('@/content/about');
    mounted = await mountClient(createElement(About));
    const container = mounted.container;

    expect(container.querySelector('#sec-about')).not.toBeNull();
    expect(container.querySelector('#sec-readme')).not.toBeNull();
    expect(
      [...container.querySelectorAll('.ab-panel > header h3')].map((title) => title.textContent),
    ).toEqual([
      aboutContent.whoami.title,
      aboutContent.now.title,
      aboutContent.responsibilities.title,
      aboutContent.stack.title,
      aboutContent.code.title,
    ]);
    expect(container.querySelector('#sec-now, #sec-npm-stack, #sec-responsibilities')).toBeNull();
    expect(container.querySelector('.ab-role')?.textContent).toBe(aboutContent.whoami.role);
    expect(container.querySelector('[role="status"], [aria-live]')).toBeNull();
  });
});

describe('Home page', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders exactly one h1 element', async () => {
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
    const { default: Home } = await import('@/app/page');
    const doc = new DOMParser().parseFromString(
      renderToStaticMarkup(createElement(Home)),
      'text/html',
    );
    expect(doc.querySelectorAll('h1')).toHaveLength(1);
  });

  it('resolves every in-page topbar link to a rendered section id', async () => {
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
    const { default: Home } = await import('@/app/page');
    const { DesktopTopbar } = await import(
      '@/components/responsive/DesktopTopbar/DesktopTopbar.client'
    );
    const page = new DOMParser().parseFromString(
      renderToStaticMarkup(createElement(Home)),
      'text/html',
    );
    const topbar = new DOMParser().parseFromString(
      renderToStaticMarkup(createElement(DesktopTopbar)),
      'text/html',
    );
    const targets = [...topbar.querySelectorAll('a[href^="/#"]')].map((link) =>
      (link.getAttribute('href') ?? '').slice('/#'.length),
    );
    expect(targets.length).toBeGreaterThan(0);
    const dangling = targets.filter((id) => page.getElementById(id) === null);
    expect(
      dangling,
      'a topbar link points at an id no section renders; re-point it or restore the section',
    ).toEqual([]);
  });
});

describe('ContactSection', () => {
  let mounted: MountedClient;

  afterEach(() => {
    mounted?.unmount();
  });

  async function render(props: { defer?: boolean } = {}) {
    const { ContactSection } = await import('@/components/sections/ContactSection/ContactSection');
    mounted = await mountClient(
      createElement(ContactSection as ComponentType<{ defer?: boolean }>, props),
    );
    return mounted.container;
  }

  it('renders the SUDO CONTACT --INIT module header', async () => {
    const container = await render();
    const heading = container.querySelector('h2');
    expect(heading?.textContent).toContain('SUDO CONTACT --INIT');
  });

  it('renders without error with defer prop', async () => {
    const container = await render({ defer: true });
    expect(container.querySelector('h2')).not.toBeNull();
  });
});

describe('CredentialsSection', () => {
  let mounted: MountedClient;

  afterEach(() => {
    mounted?.unmount();
  });

  async function render() {
    const { CredentialsSection } = await import(
      '@/components/sections/CredentialsSection/CredentialsSection'
    );
    mounted = await mountClient(createElement(CredentialsSection));
    return mounted.container;
  }

  it('renders named certification, education and community groups under Career', async () => {
    const container = await render();
    const { careerCredentials } = await import('@/content/credentials');
    const groups = [...container.querySelectorAll('[role="group"]')];
    const headings = [...container.querySelectorAll('h3')];
    const expectedGroups = [
      careerCredentials.certifications,
      careerCredentials.education,
      careerCredentials.community,
    ];
    expect(groups).toHaveLength(expectedGroups.length);
    expectedGroups.forEach((group, index) => {
      const heading = headings[index];
      expect(heading?.textContent).toContain(group.label);
      expect(heading?.textContent).toContain(group.command);
      expect(groups[index]?.getAttribute('aria-labelledby')).toBe(heading?.id);
    });
    expect(container.querySelector('h2')).toBeNull();
  });

  it('renders at least one credential row', async () => {
    const container = await render();
    const { credentials } = await import('@/content/credentials');
    expect(container.textContent).toContain(firstOf(credentials).label);
  });

  it('inherits deferral from Career while retaining credential and community anchors', async () => {
    const { GitLogSection } = await import('@/components/sections/GitLogSection');
    const container = document.createElement('div');
    container.innerHTML = renderToStaticMarkup(<GitLogSection defer />);
    const career = container.querySelector('#sec-git-log');
    expect(career?.querySelector('h2')?.textContent).toContain('Career');
    expect(career?.classList.contains('module-deferred')).toBe(true);
    expect(career?.getAttribute('data-cv-defer')).toBe('true');
    expect(container.querySelectorAll('[data-cv-defer]')).toHaveLength(1);
    const credentials = career?.querySelector('#sec-credentials');
    expect(credentials).not.toBeNull();
    expect(credentials?.querySelectorAll('[role="group"]')).toHaveLength(3);
    expect(credentials?.querySelector('#sec-community')).not.toBeNull();
  });
});

describe('HottestTakesSection', () => {
  let mounted: MountedClient;

  afterEach(() => {
    mounted?.unmount();
  });

  async function render(props: { defer?: boolean } = {}) {
    const { HottestTakesSection } = await import(
      '@/components/sections/HottestTakesSection/HottestTakesSection'
    );
    mounted = await mountClient(
      createElement(HottestTakesSection as ComponentType<{ defer?: boolean }>, props),
    );
    return mounted.container;
  }

  it('renders the CAT ~/HOTTEST_TAKES.MD module header', async () => {
    const container = await render();
    const heading = container.querySelector('h2');
    expect(heading?.textContent).toContain('CAT ~/HOTTEST_TAKES.MD');
  });

  it('renders the hottest-takes list', async () => {
    const container = await render();
    const list = container.querySelector('[data-testid="hottest-takes-list"]');
    expect(list).not.toBeNull();
  });

  it('renders at least one take item', async () => {
    const container = await render();
    const { hottestTakes } = await import('@/content/hottest-takes');
    expect(container.textContent).toContain(firstOf(hottestTakes).thesis);
  });

  it('renders without error with defer prop', async () => {
    const container = await render({ defer: true });
    expect(container.querySelector('h2')).not.toBeNull();
  });
});

describe('ShellSection', () => {
  let mounted: MountedClient;

  afterEach(() => {
    mounted?.unmount();
  });

  async function render() {
    const { ShellSection } = await import('@/components/sections/ShellSection/ShellSection');
    mounted = await mountClient(createElement(ShellSection));
    return mounted.container;
  }

  it('renders the ./EXEC INTERACTIVE_SHELL module header', async () => {
    const container = await render();
    const heading = container.querySelector('h2');
    expect(heading?.textContent).toContain('./EXEC INTERACTIVE_SHELL');
  });

  it('renders without throwing', async () => {
    const container = await render();
    expect(container).not.toBeNull();
  });
});

describe('SysHealthSection', () => {
  let mounted: MountedClient;

  afterEach(() => {
    mounted?.unmount();
  });

  async function render(props: { defer?: boolean } = {}) {
    const { SysHealthSection } = await import(
      '@/components/sections/SysHealthSection/SysHealthSection'
    );
    mounted = await mountClient(
      createElement(SysHealthSection as ComponentType<{ defer?: boolean }>, props),
    );
    return mounted.container;
  }

  it('renders the SYS_HEALTH_MONITOR module header', async () => {
    const container = await render();
    const heading = container.querySelector('h2');
    expect(heading?.textContent).toContain('SYS_HEALTH_MONITOR');
  });

  it('renders at least one sys health stat', async () => {
    const container = await render();
    const { sysStats } = await import('@/content/sys-health');
    expect(container.textContent).toContain(firstOf(sysStats).label);
  });

  it('renders without error with defer prop', async () => {
    const container = await render({ defer: true });
    expect(container.querySelector('h2')).not.toBeNull();
  });
});

describe('UnknownsSection', () => {
  let mounted: MountedClient;

  afterEach(() => {
    mounted?.unmount();
  });

  async function render(props: { defer?: boolean } = {}) {
    const { UnknownsSection } = await import(
      '@/components/sections/UnknownsSection/UnknownsSection'
    );
    mounted = await mountClient(
      createElement(UnknownsSection as ComponentType<{ defer?: boolean }>, props),
    );
    return mounted.container;
  }

  it('renders the CAT ~/.UNKNOWNS module header', async () => {
    const container = await render();
    const heading = container.querySelector('h2');
    expect(heading?.textContent).toContain('CAT ~/.UNKNOWNS');
  });

  it('renders learning items', async () => {
    const container = await render();
    const { unknowns } = await import('@/content/unknowns');
    expect(container.textContent).toContain(firstOf(unknowns.learning).claim);
  });

  it('renders without error with defer prop', async () => {
    const container = await render({ defer: true });
    expect(container.querySelector('h2')).not.toBeNull();
  });
});

describe('ManPageDesktop', () => {
  let mounted: MountedClient;

  afterEach(() => {
    mounted?.unmount();
  });

  async function render() {
    const { ManPageDesktop } = await import('@/components/sections/ManPageSection/ManPageDesktop');
    mounted = await mountClient(createElement(ManPageDesktop));
    return mounted.container;
  }

  it('renders a pre element with man page content', async () => {
    const container = await render();
    expect(container.querySelector('pre')).not.toBeNull();
  });

  it('renders the NAME section', async () => {
    const container = await render();
    expect(container.textContent).toContain('NAME');
  });

  it('renders man page author name from content', async () => {
    const container = await render();
    const { manPage } = await import('@/content/man-page');
    expect(container.textContent).toContain(manPage.name);
  });
});
