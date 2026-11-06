import { parse as parseCss } from 'postcss';
import { createElement, isValidElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { readComponentsCss } from '@/__tests__/helpers/components-css';
import { declValue, rulesWithSelector } from '@/__tests__/helpers/css-rules';
import { dawMixer } from '@/content/daw-mixer';
import { GUITAR_MODULE_HEADER, guitarPresentation, guitarRig } from '@/content/guitar-rig';
import { SECTION_LABELS } from '@/content/section-labels';
import { SITE_LOCALE } from '@/content/site-locale';
import { DawMixerContent } from '../DawMixerSection';
import { GuitarContent, GuitarSection } from './GuitarSection';

vi.mock('@/lib/ua', () => ({ getIsMobile: async () => false }));

const EN = SITE_LOCALE.en;
const PT = SITE_LOCALE.pt;

function parse(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

function renderContent(locale: typeof EN | typeof PT = EN): Document {
  return parse(renderToStaticMarkup(GuitarContent({ locale })));
}

function renderSection(locale: typeof EN | typeof PT = EN): Document {
  return parse(renderToStaticMarkup(createElement(GuitarSection, { locale })));
}

function findElements(node: ReactNode, type: unknown, found: unknown[] = []): unknown[] {
  if (Array.isArray(node)) {
    for (const child of node) findElements(child, type, found);
  } else if (isValidElement<{ children?: ReactNode }>(node)) {
    if (node.type === type) found.push(node);
    findElements(node.props.children, type, found);
  }
  return found;
}

describe('GuitarSection EQ strip', () => {
  it('opens the module with one EQ spectrum strip above the signal chain', () => {
    const doc = renderContent();
    const strips = doc.querySelectorAll('[data-testid="eq-spectrum"]');
    expect(strips).toHaveLength(1);
    const presentation = doc.querySelector('.guitar-presentation');
    expect(presentation?.firstElementChild?.contains(strips[0] ?? null)).toBe(true);
    const chain = doc.querySelector('.guitar-chain');
    expect(strips[0]?.compareDocumentPosition(chain as Node)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it('shows the gear chain label as visible text above the EQ strip', () => {
    const doc = renderContent();
    const label = doc.querySelector('.guitar-chain-label');
    expect(label?.textContent).toBe(guitarRig[EN].eqSpectrum.label);
    expect(doc.querySelector('[data-testid="eq-spectrum"] .eq-label')).toBeNull();
  });

  it('names the plot as one image with the EQ bands in its accessible name', () => {
    const doc = renderContent();
    const plot = doc.querySelector('[data-testid="eq-spectrum"] [role="img"]');
    expect(plot).not.toBeNull();
    const name = plot?.getAttribute('aria-label') ?? '';
    expect(name).toContain(guitarRig[EN].eqSpectrum.ariaLabel.prefix);
    expect(name).toContain('140 Hz');
    expect(name).toContain('2.8 kHz');
    expect(plot?.getAttribute('aria-hidden')).toBeNull();
  });

  it('draws every bar, the grid, the curve and the axis without scripts', () => {
    const doc = renderContent();
    const strip = doc.querySelector('[data-testid="eq-spectrum"]');
    expect(strip?.querySelectorAll('.eq-bar')).toHaveLength(guitarRig[EN].eqSpectrum.barCount);
    expect(strip?.querySelector('.eq-bars')?.getAttribute('aria-hidden')).toBe('true');
    expect(strip?.querySelector('.eq-curve path')?.getAttribute('d')).toMatch(/^M/);
    expect(strip?.querySelector('.eq-grid path')?.getAttribute('d')).toMatch(/^M/);
    expect(
      Array.from(strip?.querySelectorAll('.eq-axis-tick') ?? [], (tick) => tick.textContent),
    ).toEqual(guitarRig[EN].eqSpectrum.axis.map((tick) => tick.label));
    expect(strip?.querySelector('.eq-axis')?.getAttribute('aria-hidden')).toBe('true');
    expect(strip?.querySelector('script')).toBeNull();
  });

  it('gives each bar its own height and groove timing through custom properties', () => {
    const doc = renderContent();
    const bars = Array.from(doc.querySelectorAll<HTMLElement>('.eq-bar'));
    for (const bar of bars) {
      expect(bar.style.getPropertyValue('--eq-bar-height')).toMatch(/^[\d.]+%$/);
      expect(bar.style.getPropertyValue('--eq-bar-delay')).toMatch(/^[\d.]+s$/);
      expect(Number(bar.style.getPropertyValue('--eq-bar-cycle'))).toBeGreaterThanOrEqual(1);
    }
    const heights = new Set(bars.map((bar) => bar.style.getPropertyValue('--eq-bar-height')));
    expect(heights.size).toBeGreaterThan(10);
  });

  it('keeps ids out of the markup so the strip can render twice', () => {
    const doc = renderContent();
    expect(doc.querySelector('[data-testid="eq-spectrum"] [id]')).toBeNull();
  });
});

describe('GuitarSection signal chain and details', () => {
  it('renders exactly INPUT, AMP and OUT in signal order', () => {
    const doc = renderContent();
    const nodes = Array.from(doc.querySelectorAll('[data-testid^="signal-node-"]'));
    expect(nodes.map((node) => node.getAttribute('data-testid'))).toEqual([
      'signal-node-INPUT',
      'signal-node-AMP',
      'signal-node-OUT',
    ]);
    for (const node of guitarPresentation[EN].signalChain) {
      const displayed = doc.querySelector(`[data-testid="signal-node-${node.role}"]`);
      expect(displayed?.textContent).toContain(node.name);
      expect(displayed?.textContent).toContain(node.subtitle);
    }
    expect(guitarRig[EN].signalChain.map((node) => node.name)).toEqual(
      guitarPresentation[EN].signalChain.map((node) => node.name),
    );
  });

  it('exposes each node signal strength as a named image matching the visible bars', () => {
    const doc = renderContent();
    const expectedNames = ['4 of 8', '3 of 8', '5 of 8'];
    expect(doc.querySelectorAll('.guitar-bars')).toHaveLength(expectedNames.length);
    for (const [index, node] of guitarPresentation[EN].signalChain.entries()) {
      const displayed = doc.querySelector(`[data-testid="signal-node-${node.role}"]`);
      const bars = displayed?.querySelector('.guitar-bars[role="img"]');
      expect(bars?.getAttribute('aria-label')).toBe(expectedNames[index]);
      expect(bars?.getAttribute('aria-hidden')).toBeNull();
      expect(bars?.querySelectorAll('.guitar-bar')).toHaveLength(8);
      expect(bars?.querySelectorAll('[data-filled="true"]')).toHaveLength(node.strengthDots);
    }
  });

  it('translates the node subtitles and strength names for pt-BR', () => {
    const doc = renderContent(PT);
    const input = doc.querySelector('[data-testid="signal-node-INPUT"]');
    expect(input?.textContent).toContain(guitarPresentation[PT].signalChain[0].subtitle);
    expect(input?.querySelector('.guitar-bars')?.getAttribute('aria-label')).toBe('4 de 8');
  });

  it('labels every chain node with its role prefix', () => {
    const doc = renderContent();
    expect(
      Array.from(doc.querySelectorAll('.guitar-node .guitar-label'), (label) => label.textContent),
    ).toEqual(['// INPUT', '// AMP', '// OUT']);
  });

  it('renders the live signal chain strip above the chain', () => {
    const doc = renderContent();
    const strip = doc.querySelector('.guitar-signal-strip');
    expect(strip?.textContent).toContain(guitarPresentation[EN].signalStrip.live);
    expect(strip?.textContent).toContain(guitarPresentation[EN].signalStrip.tail);
    const chain = doc.querySelector('.guitar-chain');
    expect(strip?.compareDocumentPosition(chain as Node)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('reads influences, Now Playing, stats and photo after the signal flow', () => {
    const doc = renderContent();
    const prose = doc.querySelector('p.guitar-influences');
    expect(prose?.textContent).toContain(guitarPresentation[EN].influences.label);
    expect(prose?.textContent).toContain(guitarPresentation[EN].influences.text);
    expect(prose?.textContent).toContain(guitarPresentation[EN].nowPlaying.label);
    expect(prose?.textContent).toContain(guitarPresentation[EN].nowPlaying.text);
    const stats = Array.from(doc.querySelectorAll('[data-testid^="stat-"]'));
    expect(stats).toHaveLength(guitarPresentation[EN].stats.length);
    for (const [index, stat] of guitarPresentation[EN].stats.entries()) {
      expect(stats[index]?.textContent).toContain(stat.label);
      expect(stats[index]?.textContent).toContain(stat.value);
      expect(stats[index]?.textContent).toContain(stat.sub);
    }
    const ordered = Array.from(
      doc.querySelectorAll(
        '[data-testid="eq-spectrum"], [data-testid^="signal-node-"], p.guitar-influences, [data-testid^="stat-"], img',
      ),
    );
    expect(ordered).toEqual([
      doc.querySelector('[data-testid="eq-spectrum"]'),
      ...doc.querySelectorAll('[data-testid^="signal-node-"]'),
      prose,
      ...stats,
      doc.querySelector('img'),
    ]);
  });

  it('delivers the photo through the image optimizer with meaningful alt and reserved dimensions', () => {
    const doc = renderContent();
    const photo = doc.querySelector('img');
    expect(photo?.getAttribute('alt')).toBe(guitarPresentation[EN].photo.alt);
    expect(photo?.getAttribute('alt')).toContain('Erik playing guitar');
    expect(photo?.getAttribute('width')).toBe(String(guitarPresentation[EN].photo.width));
    expect(photo?.getAttribute('height')).toBe(String(guitarPresentation[EN].photo.height));
    expect(photo?.getAttribute('src')).toContain(
      encodeURIComponent(guitarPresentation[EN].photo.src),
    );
    expect(photo?.getAttribute('srcset')).toBeTruthy();
    expect(doc.body.textContent).toContain(guitarRig[EN].liveCam.caption);
  });

  it('keeps the camera status and label above the photo, with no overlaid HUD', () => {
    const doc = renderContent();
    const labels = doc.querySelector('.guitar-camera-labels');
    expect(labels?.textContent).toContain(guitarRig[EN].liveCam.status);
    expect(labels?.textContent).toContain(guitarRig[EN].liveCam.cameraLabel);
    expect(doc.querySelector('.guitar-photo-frame')?.textContent).toBe('');
  });

  it('sizes the photo for a full-width source up to 767px', () => {
    const doc = renderContent();
    expect(doc.querySelector('img')?.getAttribute('sizes')).toBe('(max-width: 767px) 100vw, 320px');
  });
});

describe('GuitarSection module', () => {
  it('exposes a readable section heading and descriptive node headings', () => {
    const doc = renderSection();
    const section = doc.querySelector('section');
    const heading = doc.getElementById(section?.getAttribute('aria-labelledby') ?? '');
    expect(heading?.textContent).toContain(SECTION_LABELS[EN]['sec-guitar']);
    expect(Array.from(doc.querySelectorAll('h3'), (node) => node.textContent)).toEqual(
      guitarPresentation[EN].signalChain.map((node) => node.name),
    );
  });

  it('shows the section name and the terminal command in the header', () => {
    const doc = renderSection();
    const heading = doc.querySelector('h2');
    expect(heading?.textContent).toContain(GUITAR_MODULE_HEADER);
    expect(heading?.querySelector('.module-name')?.textContent).toBe(
      SECTION_LABELS[EN]['sec-guitar'],
    );
  });

  it('holds the mixer slot in the same module and no standalone mixer section', () => {
    const doc = renderSection();
    const section = doc.querySelector('section#sec-guitar');
    expect(section).not.toBeNull();
    expect(section?.querySelectorAll('.guitar-mixer')).toHaveLength(1);
    expect(doc.querySelectorAll('section#sec-daw-mixer')).toHaveLength(0);
    expect(GUITAR_MODULE_HEADER).toContain('./MIX --LIVE');
  });

  it('places the mixer below the photo pair and hands it the mixer for the active locale', async () => {
    for (const locale of [EN, PT]) {
      const tree = GuitarContent({ locale });
      const mixers = findElements(tree, DawMixerContent) as {
        props: { locale: typeof EN | typeof PT };
      }[];
      expect(mixers).toHaveLength(1);
      expect(mixers[0]?.props.locale).toBe(locale);
      const resolved = await DawMixerContent({ locale });
      expect((resolved.props as { mixer: unknown }).mixer).toBe(dawMixer[locale]);
    }
    const doc = renderContent();
    const pair = doc.querySelector('.guitar-pair');
    expect(pair?.nextElementSibling?.className).toBe('guitar-mixer');
  });
});

describe('mixer loading state', () => {
  it.each(Object.values(SITE_LOCALE))(
    'announces the mixer while it streams in (%s)',
    async (locale) => {
      const { MixerLoading } = await import('./GuitarSection');
      const html = renderToStaticMarkup(createElement(MixerLoading, { locale }));
      expect(html).toContain('role="status"');
      expect(html).toContain(dawMixer[locale].loadingLabel);
    },
  );
});

describe('mixer loading state: boot log', () => {
  const renderLoading = async (locale: typeof EN | typeof PT = EN) => {
    const { MixerLoading } = await import('./GuitarSection');
    return parse(renderToStaticMarkup(createElement(MixerLoading, { locale })));
  };
  const linesOf = (doc: Document) =>
    Array.from(doc.querySelectorAll('.daw-mixer-loading > *'), (line) => line.textContent);

  it('logs the real session, tempo and channels around the line being loaded', async () => {
    const { bpm, timeSignature, sessionName, channels } = dawMixer[EN];
    const doc = await renderLoading();
    expect(linesOf(doc)).toEqual([
      `[ ok ] session ${sessionName}`,
      `[ ok ] ${bpm} bpm · ${timeSignature}`,
      '[ .. ] loading the mixer channels_',
      `[    ] ${channels.map((channel) => channel.name).join(' · ')}`,
    ]);
  });

  it('writes the log in Portuguese on the pt site', async () => {
    const lines = linesOf(await renderLoading(PT));
    expect(lines[0]).toBe(`[ ok ] sessão ${dawMixer[PT].sessionName}`);
    expect(lines[2]).toBe('[ .. ] carregando os canais do mixer_');
  });

  it('reuses the hero boot line styles for the finished lines', async () => {
    const doc = await renderLoading();
    const lines = Array.from(doc.querySelectorAll('.daw-mixer-loading > *'));
    expect(lines).toHaveLength(4);
    for (const line of lines) expect(line.classList.contains('hero-boot-line')).toBe(true);
    for (const line of lines.slice(0, 2)) {
      expect(line.querySelector('.hero-boot-ok')?.textContent).toBe('[ ok ]');
    }
  });

  it('announces only the line being loaded', async () => {
    const doc = await renderLoading();
    const announced = doc.querySelectorAll('[role="status"], [aria-live]');
    expect(announced).toHaveLength(1);
    expect(announced[0]?.getAttribute('aria-live')).toBe('polite');
    expect(announced[0]?.textContent).toContain(dawMixer[EN].loadingLabel);
    const silent = Array.from(doc.querySelectorAll('.daw-mixer-loading > *')).filter(
      (line) => line !== announced[0],
    );
    expect(silent).toHaveLength(3);
    for (const line of silent) expect(line.getAttribute('aria-hidden')).toBe('true');
  });

  it('hides the blinking cursor from assistive technology', async () => {
    const doc = await renderLoading();
    const cursor = doc.querySelector('.mixer-boot-cursor');
    expect(cursor?.textContent).toBe('_');
    expect(cursor?.getAttribute('aria-hidden')).toBe('true');
  });

  it('blinks the cursor in steps only where motion is allowed, and keeps the mixer height', () => {
    // behavioral-test-allow: blink, reduced-motion and height contracts live in the shipped stylesheet; jsdom runs no animations
    const stylesheet = parseCss(readComponentsCss());
    const blinkRules: Array<{ selector: string; animation: string; guarded: boolean }> = [];
    stylesheet.walkRules((rule) => {
      const animation = declValue(rule, 'animation');
      if (!animation?.includes('mixer-boot-blink')) return;
      const parent = rule.parent;
      blinkRules.push({
        selector: rule.selector,
        animation,
        guarded:
          parent?.type === 'atrule' &&
          /prefers-reduced-motion:\s*no-preference/.test((parent as { params: string }).params),
      });
    });
    expect(blinkRules).toEqual([
      {
        selector: 'body:not([data-motion="reduce"]) .mixer-boot-cursor',
        animation: expect.stringMatching(/steps\(/),
        guarded: true,
      },
    ]);
    const box = rulesWithSelector(stylesheet, '.daw-mixer-loading');
    expect(box.map((rule) => declValue(rule, 'min-height'))).toContain(
      'var(--daw-mixer-loading-height)',
    );
  });
});
