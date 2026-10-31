import { beforeEach, describe, expect, it, vi } from 'vitest';

const TOPBAR_CHROME = { brandMark: '■', brandLabel: 'ERIK_CUNHA.SH', brandClose: '×' };

describe('TopbarChromeSchema', () => {
  it('accepts the shipped topbar chrome', async () => {
    const { topbarChrome } = await import('./terminal-chrome');
    const { TopbarChromeSchema } = await import('./schemas');

    expect(TopbarChromeSchema.parse(topbarChrome)).toEqual(TOPBAR_CHROME);
  });

  it.each(['brandMark', 'brandLabel', 'brandClose'])('rejects an empty %s', async (field) => {
    const { TopbarChromeSchema } = await import('./schemas');

    expect(
      TopbarChromeSchema.safeParse({ ...TOPBAR_CHROME, [field]: '' }).success,
      `topbarChrome.${field} must be a non-empty string: the brand badge is rendered from it at every desktop width, so an empty value silently drops a visible control`,
    ).toBe(false);
  });
});

describe('build-time content gate', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('rejects a topbar chrome with an empty brand label', async () => {
    vi.doMock('./terminal-chrome', () => ({
      shellChrome: {
        promptLabel: 'erik@portfolio · /bin/sh',
        rightTag: 'SESSION_ID: 0xDEADBEEF',
        mobileLabel: 'ZSH',
      },
      contactChrome: { promptLabel: 'erik@portfolio · contact', rightTag: 'SECURE_CHANNEL' },
      topbarChrome: { ...TOPBAR_CHROME, brandLabel: '' },
    }));

    await expect(
      import('./_validate-client-content'),
      'the build gate must parse topbarChrome: content/terminal-chrome.ts is imported by client components, so it carries no runtime parse of its own and an unparsed schema fails open',
    ).rejects.toThrow();
  });
});
