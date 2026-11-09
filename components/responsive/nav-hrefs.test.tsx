import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const NAV_DIR = 'components/responsive';
const BARE_FRAGMENT_HREF = /href\s*[:=]\s*\{?\s*["'`](#[^"'`]+)["'`]/g;

function navClientFiles(): string[] {
  const dir = path.join(process.cwd(), NAV_DIR);
  return readdirSync(dir, { recursive: true })
    .filter((entry): entry is string => typeof entry === 'string' && entry.endsWith('.client.tsx'))
    .map((entry) => path.posix.join(NAV_DIR, entry))
    .sort();
}

describe('nav hrefs survive being mounted off the homepage', () => {
  it.each(navClientFiles())('%s has no bare fragment href', (file) => {
    // behavioral-test-allow: the property is "root-relative on every route this chrome renders
    // on", and a render only ever proves the one route it mounted. Asserting the href literal
    // needs the source.
    const source = readFileSync(path.join(process.cwd(), file), 'utf-8');
    const bare = [...source.matchAll(BARE_FRAGMENT_HREF)].map((m) => m[1]);

    expect(
      bare,
      'These sections live on / only. A bare "#sec-projects" resolves against whatever page is current, so the moment this chrome renders anywhere but / — a second route mounting AppShell, or the Dock\'s own DS item navigating to /design-system and back — the link points at a section that does not exist there and silently does nothing. "/#sec-projects" resolves from anywhere. The skip link in AppShell.client.tsx is page-local by design and is not matched here.',
    ).toEqual([]);
  });
});
