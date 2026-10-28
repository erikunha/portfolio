import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/client/DawMixer/VuMeter/VuMeter.client', () => ({
  VuMeter: ({ channelName, initialLevel }: { channelName: string; initialLevel: number }) =>
    createElement('div', { 'data-testid': `vu-${channelName}`, 'data-level': initialLevel }),
}));
vi.mock('@/components/client/DawMixer/FaderIsland/FaderDbIsland.client', () => ({
  FaderDbIsland: ({
    channelName,
    initialPct,
    footer,
  }: {
    channelName: string;
    initialPct: number;
    footer?: { lufs: string; pk: string };
  }) =>
    createElement(
      'div',
      { 'data-testid': `fader-${channelName}`, 'data-pct': initialPct },
      footer ? createElement('span', null, `LUFS ${footer.lufs} · PK ${footer.pk}`) : null,
    ),
  pctToDb: (pct: number) => String(pct),
}));
vi.mock('@/components/client/DawMixer/KnobIsland/KnobIsland.client', () => ({
  KnobIsland: ({ label }: { label: string }) =>
    createElement('div', { 'data-testid': `knob-${label}` }),
}));
vi.mock('@/components/client/DawMixer/RmsButtons/RmsButtons.client', () => ({
  RmsButtons: ({ buttons }: { buttons: string[] }) =>
    createElement('div', { 'data-testid': `rms-${buttons.join('-')}` }),
}));

async function renderDesktop(): Promise<Document> {
  const { DawMixerDesktop } = await import('./DawMixerDesktop');
  const html = renderToStaticMarkup(createElement(DawMixerDesktop));
  return new DOMParser().parseFromString(html, 'text/html');
}

async function renderMobile(): Promise<Document> {
  const { DawMixerMobile } = await import('./DawMixerSection');
  const html = renderToStaticMarkup(createElement(DawMixerMobile));
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('DawMixerSection — desktop', () => {
  it('renders 6 channel rows', async () => {
    const doc = await renderDesktop();
    expect(doc.querySelectorAll('[data-testid^="channel-"]').length).toBe(6);
  });

  it('renders CH 01 through CH 05 and MASTER', async () => {
    const doc = await renderDesktop();
    for (const id of ['CH 01', 'CH 02', 'CH 03', 'CH 04', 'CH 05', 'MASTER']) {
      expect(doc.querySelector(`[data-testid="channel-${id}"]`)).not.toBeNull();
    }
  });

  it('renders the session header with session name', async () => {
    const doc = await renderDesktop();
    const header = doc.querySelector('[data-testid="session-header"]');
    expect(header?.textContent).toContain('YELLOW_TAKE_03.ALS');
  });

  it('CH 02 has focused class (active channel indicator)', async () => {
    const doc = await renderDesktop();
    const ch02 = doc.querySelector('[data-testid="channel-CH 02"]');
    expect(ch02?.hasAttribute('data-focused')).toBe(true);
  });

  it('MASTER channel row has data-channel="master"', async () => {
    const doc = await renderDesktop();
    const masterRow = doc.querySelector('[data-testid="channel-MASTER"]');
    expect(masterRow?.getAttribute('data-channel')).toBe('master');
  });

  it('MASTER row shows LUFS data', async () => {
    const doc = await renderDesktop();
    const master = doc.querySelector('[data-testid="channel-MASTER"]');
    expect(master?.textContent).toContain('-14');
  });

  it('each channel renders a VuMeter with correct initial level', async () => {
    const doc = await renderDesktop();
    const vu = doc.querySelector('[data-testid="vu-RHYTHM GTR"]');
    expect(vu?.getAttribute('data-level')).toBe('71');
  });
});

describe('DawMixerSection — mobile', () => {
  it('renders all 6 channel rows with the existing interactive islands', async () => {
    const doc = await renderMobile();
    expect(doc.querySelectorAll('[data-testid^="channel-"]').length).toBe(6);
    expect(doc.querySelector('[data-testid="fader-RHYTHM GTR"]')).not.toBeNull();
    expect(doc.querySelector('[data-testid="vu-RHYTHM GTR"]')).not.toBeNull();
    expect(doc.querySelector('[data-testid="knob-GAIN"]')).not.toBeNull();
    expect(doc.querySelector('[data-testid="rms-R-M-S"]')).not.toBeNull();
  });

  it('renders mobile session header', async () => {
    const doc = await renderMobile();
    expect(doc.querySelector('[data-testid="session-header"]')).not.toBeNull();
  });

  it('renders CH 01 through CH 05 and MASTER on mobile', async () => {
    const doc = await renderMobile();
    for (const id of ['CH 01', 'CH 02', 'CH 03', 'CH 04', 'CH 05', 'MASTER']) {
      expect(doc.querySelector(`[data-testid="channel-${id}"]`)).not.toBeNull();
    }
  });

  it('bold text from **markers** renders as <strong> in channel desc', async () => {
    const doc = await renderMobile();
    const ch02 = doc.querySelector('[data-testid="channel-CH 02"]');
    const strong = ch02?.querySelector('strong');
    expect(strong).not.toBeNull();
    expect(strong?.textContent).toContain('the voice');
  });
});

describe.each([
  ['desktop', renderDesktop],
  ['mobile', renderMobile],
] as const)('DawMixerSection accessibility on %s', (_variant, renderMixer) => {
  it('labels the region containing all six channels', async () => {
    const doc = await renderMixer();
    const region = doc.querySelector('[role="region"][aria-label="Mixer channels"]');
    expect(region).not.toBeNull();
    expect(region?.querySelectorAll('[data-testid^="channel-"]').length).toBe(6);
    expect(region?.hasAttribute('tabindex')).toBe(false);
  });

  it('provides a skip link to a focusable target after the mixer controls', async () => {
    const doc = await renderMixer();
    const link = Array.from(doc.querySelectorAll('a')).find(
      (anchor) => anchor.textContent === 'Skip mixer',
    );
    expect(link).toBeDefined();
    const target = doc.getElementById(link?.hash.slice(1) ?? '');
    expect(target).not.toBeNull();
    expect(target?.getAttribute('tabindex')).toBe('-1');
    const region = doc.querySelector('[role="region"]');
    expect(region?.contains(target ?? null)).toBe(false);
    expect(
      (link?.compareDocumentPosition(region as Node) ?? 0) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      (region?.compareDocumentPosition(target as Node) ?? 0) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});

describe('DawMixerSection skip link styles', () => {
  it('reveals the accessible skip link on focus', () => {
    const styles = readFileSync(path.resolve(process.cwd(), 'app/css/components.css'), 'utf-8');
    const skipRule = styles.match(/\.mx-skip\s*\{([^}]*)\}/)?.[1] ?? '';
    const focusRule = styles.match(/\.mx-skip:focus-visible\s*\{([^}]*)\}/)?.[1] ?? '';

    expect(skipRule).toMatch(/clip-path:\s*inset\(50%\)/);
    expect(skipRule).toMatch(/overflow:\s*hidden/);
    expect(focusRule).toMatch(/clip-path:\s*inset\(0\)/);
    expect(focusRule).toMatch(/overflow:\s*visible/);
    expect(focusRule).toMatch(/outline:\s*var\(--border-width\) solid var\(--color-primary-500\)/);
  });
});

describe('DawMixerSection — XSS safety (behavioral)', () => {
  it('ParsedText renders bold markers as <strong>, not raw HTML', async () => {
    const doc = await renderDesktop();
    const ch02 = doc.querySelector('[data-testid="channel-CH 02"]');
    const strong = ch02?.querySelector('strong');
    expect(strong).not.toBeNull();
    expect(strong?.textContent).toBe('the voice');
    expect(ch02?.textContent).not.toContain('**');
  });

  it('ParsedText renders plain text without extra wrappers', async () => {
    const doc = await renderDesktop();
    const ch01 = doc.querySelector('[data-testid="channel-CH 01"]');
    expect(ch01?.querySelector('strong')).toBeNull();
    expect(ch01?.textContent).toContain('Gretsch');
  });
});
