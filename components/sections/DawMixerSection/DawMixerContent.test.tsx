import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { dawMixer, dawMixerCopy } from '@/content/daw-mixer';
import { SITE_LOCALE, type SiteLocale } from '@/content/site-locale';

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

async function renderDesktop(locale: SiteLocale = SITE_LOCALE.en): Promise<Document> {
  const { DawMixerDesktop } = await import('./DawMixerDesktop');
  const html = renderToStaticMarkup(
    createElement(DawMixerDesktop, { mixer: dawMixer[locale], copy: dawMixerCopy[locale] }),
  );
  return new DOMParser().parseFromString(html, 'text/html');
}

async function renderMobile(locale: SiteLocale = SITE_LOCALE.en): Promise<Document> {
  const { DawMixerMobile } = await import('./DawMixerContent');
  const html = renderToStaticMarkup(
    createElement(DawMixerMobile, { mixer: dawMixer[locale], copy: dawMixerCopy[locale] }),
  );
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('DawMixerContent: desktop', () => {
  it('renders 3 channel rows', async () => {
    const doc = await renderDesktop();
    expect(doc.querySelectorAll('[data-testid^="channel-"]').length).toBe(3);
  });

  it('renders CH 01, CH 02 and MASTER', async () => {
    const doc = await renderDesktop();
    for (const id of ['CH 01', 'CH 02', 'MASTER']) {
      expect(doc.querySelector(`[data-testid="channel-${id}"]`)).not.toBeNull();
    }
    for (const id of ['CH 03', 'CH 04', 'CH 05']) {
      expect(doc.querySelector(`[data-testid="channel-${id}"]`)).toBeNull();
    }
  });

  it('counts the guitar tracks in the session header', async () => {
    const doc = await renderDesktop();
    expect(doc.querySelector('[data-testid="session-header"]')?.textContent).toContain(
      '2 GTR TRACKS + MASTER',
    );
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

describe('DawMixerContent: mobile', () => {
  it('renders 3 channel cards', async () => {
    const doc = await renderMobile();
    expect(doc.querySelectorAll('[data-testid^="channel-mobile-"]').length).toBe(3);
  });

  it('counts the guitar tracks once, in the session header', async () => {
    const doc = await renderMobile();
    expect(doc.querySelector('[data-testid="session-header-mobile"]')?.textContent).toContain(
      '2 GTR TRACKS + MASTER',
    );
    const whole = doc.querySelector('[data-testid="daw-mixer-mobile"]')?.textContent ?? '';
    expect(whole.match(/GTR[^·]*MASTER/g)).toHaveLength(1);
  });

  it('renders mobile session header', async () => {
    const doc = await renderMobile();
    expect(doc.querySelector('[data-testid="session-header-mobile"]')).not.toBeNull();
  });

  it('renders CH 01, CH 02 and MASTER with its terminal lines', async () => {
    const doc = await renderMobile();
    expect(doc.querySelector('[data-testid="channel-mobile-CH 01"]')).not.toBeNull();
    expect(doc.querySelector('[data-testid="channel-mobile-CH 02"]')).not.toBeNull();
    const master = doc.querySelector('[data-testid="channel-mobile-MASTER"]');
    expect(master?.getAttribute('data-channel')).toBe('master');
    expect(master?.textContent).toContain('fewer plugins, more space');
  });

  it('bold text from **markers** renders as <strong> in channel desc', async () => {
    const doc = await renderMobile();
    const ch02 = doc.querySelector('[data-testid="channel-mobile-CH 02"]');
    const strong = ch02?.querySelector('[data-testid="mx-ref"] strong');
    expect(strong).not.toBeNull();
    expect(strong?.textContent).toContain('the voice');
  });
});

describe('DawMixerContent: copy per locale', () => {
  it('speaks Portuguese in the desktop session header and column labels', async () => {
    const doc = await renderDesktop(SITE_LOCALE.pt);
    const header = doc.querySelector('[data-testid="session-header"]')?.textContent ?? '';
    expect(header).toContain('SESSÃO:');
    expect(header).toContain('2 FAIXAS DE GTR + MASTER');
    const labels = doc.querySelector('.daw-mixer-labels')?.textContent ?? '';
    expect(labels).toContain('CADEIA DE PLUGINS');
    expect(labels).not.toContain('PLUGIN CHAIN');
  });

  it('speaks Portuguese in the mobile header, signal flow title and lead legend', async () => {
    const doc = await renderMobile(SITE_LOCALE.pt);
    const header = doc.querySelector('[data-testid="session-header-mobile"]')?.textContent ?? '';
    expect(header).toContain('SESSÃO:');
    const whole = doc.querySelector('[data-testid="daw-mixer-mobile"]')?.textContent ?? '';
    expect(whole).toContain('// fluxo do sinal');
    expect(whole).toContain('CH 02 = principal');
    expect(whole).not.toContain('signal flow');
  });

  it('keeps English labels on the English locale', async () => {
    const doc = await renderMobile(SITE_LOCALE.en);
    const whole = doc.querySelector('[data-testid="daw-mixer-mobile"]')?.textContent ?? '';
    expect(whole).toContain('// signal flow');
    expect(whole).toContain('CH 02 = lead');
  });
});

describe('DawMixerContent: XSS safety (behavioral)', () => {
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

vi.mock('@/lib/ua', () => ({ getIsMobile: async () => true }));

describe('DawMixerContent variant selection', () => {
  it('serves the mobile mixer to mobile user agents, in the requested locale', async () => {
    const { DawMixerContent } = await import('./DawMixerContent');
    for (const locale of [SITE_LOCALE.en, SITE_LOCALE.pt]) {
      const html = renderToStaticMarkup(await DawMixerContent({ locale }));
      const doc = new DOMParser().parseFromString(html, 'text/html');
      expect(doc.querySelector('[data-testid="daw-mixer-mobile"]')).not.toBeNull();
      expect(doc.querySelectorAll('[data-testid^="channel-mobile-"]')).toHaveLength(3);
      expect(doc.body.textContent).toContain(dawMixer[locale].channels[0]?.desc.split(' · ')[0]);
    }
  });
});
