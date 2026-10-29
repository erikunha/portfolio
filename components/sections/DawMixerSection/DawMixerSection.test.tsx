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

async function renderMixer(): Promise<Document> {
  const { DawMixerSection } = await import('./DawMixerSection');
  const html = renderToStaticMarkup(createElement(DawMixerSection));
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('DawMixerSection', () => {
  it('renders one mixer with all six channels and their interactive islands', async () => {
    const doc = await renderMixer();
    expect(doc.querySelectorAll('#sec-daw-mixer').length).toBe(1);
    expect(doc.querySelectorAll('[data-testid="daw-mixer-desktop"]').length).toBe(1);
    expect(doc.querySelectorAll('[data-testid^="channel-"]').length).toBe(6);
    expect(doc.querySelectorAll('[data-testid^="fader-"]').length).toBe(6);
    expect(doc.querySelectorAll('[data-testid^="vu-"]').length).toBe(6);
    expect(doc.querySelectorAll('[data-testid^="knob-"]').length).toBe(12);
    expect(doc.querySelectorAll('[data-testid^="rms-"]').length).toBe(6);
  });

  it('renders CH 01 through CH 05 and MASTER', async () => {
    const doc = await renderMixer();
    for (const id of ['CH 01', 'CH 02', 'CH 03', 'CH 04', 'CH 05', 'MASTER']) {
      expect(doc.querySelector(`[data-testid="channel-${id}"]`)).not.toBeNull();
    }
  });

  it('renders the session header with session name', async () => {
    const doc = await renderMixer();
    const header = doc.querySelector('[data-testid="session-header"]');
    expect(header?.textContent).toContain('YELLOW_TAKE_03.ALS');
  });

  it('CH 02 has focused class (active channel indicator)', async () => {
    const doc = await renderMixer();
    const ch02 = doc.querySelector('[data-testid="channel-CH 02"]');
    expect(ch02?.hasAttribute('data-focused')).toBe(true);
  });

  it('MASTER channel row has data-channel="master"', async () => {
    const doc = await renderMixer();
    const masterRow = doc.querySelector('[data-testid="channel-MASTER"]');
    expect(masterRow?.getAttribute('data-channel')).toBe('master');
  });

  it('MASTER row shows LUFS data', async () => {
    const doc = await renderMixer();
    const master = doc.querySelector('[data-testid="channel-MASTER"]');
    expect(master?.textContent).toContain('-14');
  });

  it('each channel renders a VuMeter with correct initial level', async () => {
    const doc = await renderMixer();
    const vu = doc.querySelector('[data-testid="vu-RHYTHM GTR"]');
    expect(vu?.getAttribute('data-level')).toBe('71');
  });
});

describe('DawMixerSection accessibility', () => {
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

describe('DawMixerSection skip link', () => {
  it('renders the accessible skip link with its class and existing target', async () => {
    const doc = await renderMixer();
    const link = Array.from(doc.querySelectorAll('a')).find(
      (anchor) => anchor.textContent === 'Skip mixer',
    );

    expect(link).toBeDefined();
    expect(link?.getAttribute('aria-label') ?? link?.textContent).toBe('Skip mixer');
    expect(link?.classList.contains('mx-skip')).toBe(true);
    expect(link?.getAttribute('href')).toBe('#daw-mixer-end');
    expect(doc.getElementById('daw-mixer-end')).not.toBeNull();
  });
});

describe('DawMixerSection XSS safety (behavioral)', () => {
  it('ParsedText renders bold markers as <strong>, not raw HTML', async () => {
    const doc = await renderMixer();
    const ch02 = doc.querySelector('[data-testid="channel-CH 02"]');
    const strong = ch02?.querySelector('strong');
    expect(strong).not.toBeNull();
    expect(strong?.textContent).toBe('the voice');
    expect(ch02?.textContent).not.toContain('**');
  });

  it('ParsedText renders plain text without extra wrappers', async () => {
    const doc = await renderMixer();
    const ch01 = doc.querySelector('[data-testid="channel-CH 01"]');
    expect(ch01?.querySelector('strong')).toBeNull();
    expect(ch01?.textContent).toContain('Gretsch');
  });
});
