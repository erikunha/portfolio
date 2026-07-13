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
});
