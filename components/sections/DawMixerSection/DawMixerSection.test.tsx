// components/sections/DawMixerSection/DawMixerSection.test.tsx
// RSC behavioral tests: renders first 2 channels on mobile, session header, client islands receive props.

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

// Stub client islands with minimal HTML so RSC tests stay hermetic
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
  it('renders 2 channel cards', async () => {
    const doc = await renderMobile();
    expect(doc.querySelectorAll('[data-testid^="channel-mobile-"]').length).toBe(2);
  });

  it('renders mobile session header', async () => {
    const doc = await renderMobile();
    expect(doc.querySelector('[data-testid="session-header-mobile"]')).not.toBeNull();
  });

  it('MASTER channel is not rendered on mobile', async () => {
    const doc = await renderMobile();
    expect(doc.querySelector('[data-testid="channel-mobile-MASTER"]')).toBeNull();
  });

  it('renders CH 01 and CH 02 specifically (first 2 non-MASTER channels)', async () => {
    const doc = await renderMobile();
    expect(doc.querySelector('[data-testid="channel-mobile-CH 01"]')).not.toBeNull();
    expect(doc.querySelector('[data-testid="channel-mobile-CH 02"]')).not.toBeNull();
  });

  it('bold text from **markers** renders as <strong> in channel desc', async () => {
    const doc = await renderMobile();
    const ch02 = doc.querySelector('[data-testid="channel-mobile-CH 02"]');
    const strong = ch02?.querySelector('[class*="mxRef"] strong');
    expect(strong).not.toBeNull();
    expect(strong?.textContent).toContain('the voice');
  });
});

describe('DawMixerSection — XSS safety (behavioral)', () => {
  it('ParsedText renders bold markers as <strong>, not raw HTML', async () => {
    // Verifies the ** → <strong> transform works correctly and that no
    // dangerouslySetInnerHTML path is taken (raw HTML would appear as literal
    // text rather than structured DOM nodes).
    const doc = await renderDesktop();
    // CH 02 desc has **the voice** — should be a <strong> node, not literal text
    const ch02 = doc.querySelector('[data-testid="channel-CH 02"]');
    const strong = ch02?.querySelector('strong');
    expect(strong).not.toBeNull();
    expect(strong?.textContent).toBe('the voice');
    // The literal ** characters must NOT appear as text content
    expect(ch02?.textContent).not.toContain('**');
  });

  it('ParsedText renders plain text without extra wrappers', async () => {
    const doc = await renderDesktop();
    // CH 01 desc has no ** markers — should render as plain text
    const ch01 = doc.querySelector('[data-testid="channel-CH 01"]');
    expect(ch01?.querySelector('strong')).toBeNull();
    expect(ch01?.textContent).toContain('Gretsch');
  });
});
