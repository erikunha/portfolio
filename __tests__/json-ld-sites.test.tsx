import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const HOSTILE_NAME = '</script><img src=x onerror=alert(1)>';

vi.mock('next/font/local', () => ({ default: () => ({ variable: 'font-var' }) }));
vi.mock('@/content/seo', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/content/seo')>()),
  personSchema: { name: HOSTILE_NAME },
}));
vi.mock('@/components/client/GlobalMotion', () => ({ GlobalMotion: () => null }));
vi.mock('@/components/NoscriptBar', () => ({ NoscriptBar: () => null }));

describe('root layout person JSON-LD', () => {
  it('escapes a closing script tag inside a value so the block cannot be ended early', async () => {
    const { default: RootLayout } = await import('@/app/layout');
    const html = renderToStaticMarkup(<RootLayout>body</RootLayout>);
    const block = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html);
    expect(block).not.toBeNull();
    expect(block?.[1]).toContain('\\u003c/script>');
    expect(html).not.toContain(HOSTILE_NAME);
  });
});
