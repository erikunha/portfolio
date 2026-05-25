// __tests__/sections-smoke.test.tsx
// Smoke render tests for section components with zero function coverage.
// Locks down: each section renders without throwing; the Module header appears
// in the summary element; meaningful first-piece of content data is present.

import { type ComponentType, createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type MountedClient, mountClient } from './helpers/render';

function firstOf<T>(arr: readonly T[]): T {
  expect(arr.length).toBeGreaterThan(0);
  // biome-ignore lint/style/noNonNullAssertion: length asserted by expect above
  return arr[0]!;
}

// ContactSection imports ContactFormLazy — stub it so no lazy/Suspense setup needed.
vi.mock('@/components/client/ContactForm', () => ({
  ContactFormLazy: () => null,
}));

// ShellSection imports InteractiveShellLazy — same treatment.
vi.mock('@/components/client/InteractiveShell', () => ({
  InteractiveShellLazy: () => null,
}));

// ---------------------------------------------------------------------------
// CommunitySection
// ---------------------------------------------------------------------------
describe('CommunitySection', () => {
  let mounted: MountedClient;

  afterEach(() => {
    mounted?.unmount();
  });

  async function render(props: { defer?: boolean } = {}) {
    const { CommunitySection } = await import(
      '@/components/sections/CommunitySection/CommunitySection'
    );
    mounted = await mountClient(
      createElement(CommunitySection as ComponentType<{ defer?: boolean }>, props),
    );
    return mounted.container;
  }

  it('renders the CAT ~/.COMMUNITY module header', async () => {
    const container = await render();
    const summary = container.querySelector('summary');
    expect(summary?.textContent).toContain('CAT ~/.COMMUNITY');
  });

  it('renders community event content', async () => {
    const container = await render();
    const { communityEvent } = await import('@/content/community');
    expect(container.textContent).toContain(communityEvent.name);
  });

  it('renders without error with defer prop', async () => {
    const container = await render({ defer: true });
    expect(container.querySelector('summary')).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// ContactSection
// ---------------------------------------------------------------------------
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
    const summary = container.querySelector('summary');
    expect(summary?.textContent).toContain('SUDO CONTACT --INIT');
  });

  it('renders without error with defer prop', async () => {
    const container = await render({ defer: true });
    expect(container.querySelector('summary')).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// CredentialsSection
// ---------------------------------------------------------------------------
describe('CredentialsSection', () => {
  let mounted: MountedClient;

  afterEach(() => {
    mounted?.unmount();
  });

  async function render(props: { defer?: boolean } = {}) {
    const { CredentialsSection } = await import(
      '@/components/sections/CredentialsSection/CredentialsSection'
    );
    mounted = await mountClient(
      createElement(CredentialsSection as ComponentType<{ defer?: boolean }>, props),
    );
    return mounted.container;
  }

  it('renders the CAT ~/.CREDENTIALS module header', async () => {
    const container = await render();
    const summary = container.querySelector('summary');
    expect(summary?.textContent).toContain('CAT ~/.CREDENTIALS');
  });

  it('renders at least one credential row', async () => {
    const container = await render();
    const { credentials } = await import('@/content/credentials');
    expect(container.textContent).toContain(firstOf(credentials).label);
  });

  it('renders without error with defer prop', async () => {
    const container = await render({ defer: true });
    expect(container.querySelector('summary')).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// HottestTakesSection
// ---------------------------------------------------------------------------
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
    const summary = container.querySelector('summary');
    expect(summary?.textContent).toContain('CAT ~/HOTTEST_TAKES.MD');
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
    expect(container.querySelector('summary')).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// NpmStackSection
// ---------------------------------------------------------------------------
describe('NpmStackSection', () => {
  let mounted: MountedClient;

  afterEach(() => {
    mounted?.unmount();
  });

  async function render(props: { defer?: boolean } = {}) {
    const { NpmStackSection } = await import(
      '@/components/sections/NpmStackSection/NpmStackSection'
    );
    mounted = await mountClient(
      createElement(NpmStackSection as ComponentType<{ defer?: boolean }>, props),
    );
    return mounted.container;
  }

  it('renders the NPM LIST --GLOBAL module header', async () => {
    const container = await render();
    const summary = container.querySelector('summary');
    expect(summary?.textContent).toContain('NPM LIST --GLOBAL');
  });

  it('renders at least one npm stack item', async () => {
    const container = await render();
    const { npmStack } = await import('@/content/npm-stack');
    expect(container.textContent).toContain(firstOf(npmStack).label);
  });

  it('renders without error with defer prop', async () => {
    const container = await render({ defer: true });
    expect(container.querySelector('summary')).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// NowSection
// ---------------------------------------------------------------------------
describe('NowSection', () => {
  let mounted: MountedClient;

  afterEach(() => {
    mounted?.unmount();
  });

  async function render() {
    const { NowSection } = await import('@/components/sections/NowSection/NowSection');
    mounted = await mountClient(createElement(NowSection));
    return mounted.container;
  }

  it('renders the CAT ~/.NOW module header', async () => {
    const container = await render();
    const summary = container.querySelector('summary');
    expect(summary?.textContent).toContain('CAT ~/.NOW');
  });

  it('renders at least one now row', async () => {
    const container = await render();
    const { nowRows } = await import('@/content/now');
    expect(container.textContent).toContain(firstOf(nowRows).k);
  });
});

// ---------------------------------------------------------------------------
// ResponsibilitiesSection
// ---------------------------------------------------------------------------
describe('ResponsibilitiesSection', () => {
  let mounted: MountedClient;

  afterEach(() => {
    mounted?.unmount();
  });

  async function render(props: { defer?: boolean } = {}) {
    const { ResponsibilitiesSection } = await import(
      '@/components/sections/ResponsibilitiesSection/ResponsibilitiesSection'
    );
    mounted = await mountClient(
      createElement(ResponsibilitiesSection as ComponentType<{ defer?: boolean }>, props),
    );
    return mounted.container;
  }

  it('renders the LS -LA ~/RESPONSIBILITIES module header', async () => {
    const container = await render();
    const summary = container.querySelector('summary');
    expect(summary?.textContent).toContain('LS -LA ~/RESPONSIBILITIES');
  });

  it('renders at least one responsibility entry', async () => {
    const container = await render();
    const { responsibilities } = await import('@/content/responsibilities');
    expect(container.textContent).toContain(firstOf(responsibilities).name);
  });

  it('renders without error with defer prop', async () => {
    const container = await render({ defer: true });
    expect(container.querySelector('summary')).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// ShellSection
// ---------------------------------------------------------------------------
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
    const summary = container.querySelector('summary');
    expect(summary?.textContent).toContain('./EXEC INTERACTIVE_SHELL');
  });

  it('renders without throwing', async () => {
    const container = await render();
    expect(container).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// SysHealthSection
// ---------------------------------------------------------------------------
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
    const summary = container.querySelector('summary');
    expect(summary?.textContent).toContain('SYS_HEALTH_MONITOR');
  });

  it('renders at least one sys health stat', async () => {
    const container = await render();
    const { sysStats } = await import('@/content/sys-health');
    expect(container.textContent).toContain(firstOf(sysStats).label);
  });

  it('renders without error with defer prop', async () => {
    const container = await render({ defer: true });
    expect(container.querySelector('summary')).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// UnknownsSection
// ---------------------------------------------------------------------------
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
    const summary = container.querySelector('summary');
    expect(summary?.textContent).toContain('CAT ~/.UNKNOWNS');
  });

  it('renders learning items', async () => {
    const container = await render();
    const { unknowns } = await import('@/content/unknowns');
    expect(container.textContent).toContain(firstOf(unknowns.learning).claim);
  });

  it('renders without error with defer prop', async () => {
    const container = await render({ defer: true });
    expect(container.querySelector('summary')).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// ManPageDesktop
// ---------------------------------------------------------------------------
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
