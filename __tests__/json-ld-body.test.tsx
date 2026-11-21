import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { SITE_LOCALE } from '@/content/site-locale';

vi.mock('next/font/local', () => ({ default: () => ({ variable: 'font-var' }) }));
vi.mock('@/components/client/GlobalMotion', () => ({ GlobalMotion: () => null }));
vi.mock('@/components/NoscriptBar', () => ({ NoscriptBar: () => null }));

const JSON_LD_SCRIPT = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;

async function renderShell() {
  const { RootShell } = await import('@/components/RootShell');
  return renderToStaticMarkup(<RootShell locale={SITE_LOCALE.en}>content</RootShell>);
}

describe('RootShell JSON-LD placement', () => {
  it('renders no manual head element', async () => {
    expect(await renderShell()).not.toMatch(/<head[\s>]/);
  });

  it('renders exactly one JSON-LD script, inside the body, as valid JSON', async () => {
    const html = await renderShell();
    const bodyStart = html.indexOf('<body');
    const bodyEnd = html.indexOf('</body>');
    const blocks = [...html.matchAll(JSON_LD_SCRIPT)];
    expect(blocks).toHaveLength(1);
    const position = blocks[0]?.index ?? -1;
    expect(position).toBeGreaterThan(bodyStart);
    expect(position).toBeLessThan(bodyEnd);
    expect(() => JSON.parse(blocks[0]?.[1] ?? '')).not.toThrow();
  });
});
