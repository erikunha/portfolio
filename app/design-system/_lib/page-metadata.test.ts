import { describe, expect, it } from 'vitest';
import { dsPageMetadata } from './page-metadata';

describe('dsPageMetadata', () => {
  it('sets a self-referential relative canonical for a subpage', () => {
    const m = dsPageMetadata({ slug: 'tokens', title: 'T', description: 'D' });
    expect(m.alternates?.canonical).toBe('/design-system/tokens');
    // og:url must match the canonical path so search + social agree
    expect((m.openGraph as { url?: string }).url).toBe('/design-system/tokens');
  });

  it('maps the empty slug to the section root', () => {
    const m = dsPageMetadata({ slug: '', title: 'T', description: 'D' });
    expect(m.alternates?.canonical).toBe('/design-system');
    expect((m.openGraph as { url?: string }).url).toBe('/design-system');
  });

  it('passes title and description through to both the page and openGraph', () => {
    const m = dsPageMetadata({
      slug: 'components',
      title: 'Comps',
      description: 'Nine primitives',
    });
    expect(m.title).toBe('Comps');
    expect(m.description).toBe('Nine primitives');
    expect((m.openGraph as { title?: string }).title).toBe('Comps');
    expect((m.openGraph as { description?: string }).description).toBe('Nine primitives');
  });

  it('does not emit an absolute URL (resolves against metadataBase)', () => {
    const m = dsPageMetadata({ slug: 'tokens', title: 'T', description: 'D' });
    expect(String(m.alternates?.canonical)).not.toMatch(/^https?:/);
    expect(String((m.openGraph as { url?: string }).url)).not.toMatch(/^https?:/);
  });

  it('re-specifies openGraph fields that Next would otherwise drop when the object is replaced', () => {
    // Next merges metadata shallowly: setting `openGraph` REPLACES the root's, so siteName/locale/
    // image must be restated here or the subpages silently lose them.
    const og = dsPageMetadata({ slug: 'tokens', title: 'T', description: 'D' }).openGraph as {
      siteName?: string;
      locale?: string;
      images?: { url: string; alt?: string }[];
    };
    expect(og.siteName).toBe('erikunha.dev');
    expect(og.locale).toBe('en_US');
    expect(og.images?.[0]?.url).toBe('/og.png');
    expect(og.images?.[0]?.alt).toBe('T'); // per-page alt, not the homepage title
  });

  it('sets a per-page twitter card so subpages do NOT inherit the homepage twitter copy', () => {
    const tw = dsPageMetadata({ slug: 'tokens', title: 'Tokens page', description: 'Token docs' })
      .twitter as { card?: string; title?: string; description?: string };
    expect(tw.card).toBe('summary_large_image');
    expect(tw.title).toBe('Tokens page');
    expect(tw.description).toBe('Token docs');
  });
});
