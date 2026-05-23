// __tests__/css-paint-cost.test.ts
// Behavioral test (CG3): the shell command hint must not advertise an
// `ask <question>` command — proven by rendering the real InteractiveShell
// and inspecting its committed DOM.
//
// The paint-cost CSS rules (no text-shadow / no optimizeLegibility on body,
// crt-flicker duration >= 3s) are build assets. jsdom does not evaluate
// stylesheet paint properties or @keyframes timing, so the shipped
// stylesheet's text is the strongest verifiable signal — those three reads
// carry behavioral-test-allow tags.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type MountedClient, mountClient } from './helpers/render';

vi.mock('@/lib/use-breakpoint.client', () => ({
  useBreakpoint: () => ({ isMobile: false }),
}));

vi.mock('@/lib/motion', () => ({
  readMotion: () => false,
}));

vi.mock('@/content/shell-commands', () => ({
  default: [],
}));

describe('shell command hint', () => {
  let mounted: MountedClient;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    mounted?.unmount();
    vi.restoreAllMocks();
  });

  it('does not list "ask <question>" as a command in the rendered shell', async () => {
    const { InteractiveShell } = await import('@/components/client/InteractiveShell');

    mounted = await mountClient(createElement(InteractiveShell));
    const { container } = mounted;

    // The desktop command hint is rendered; it must route free-form input to
    // Claude implicitly, never advertise an explicit `ask <question>` verb.
    const hint = container.querySelector('[data-testid="shell-commands"]');
    expect(hint).not.toBeNull();
    expect(hint?.textContent ?? '').not.toContain('ask <question>');
  });
});

describe('paint cost CSS (shipped build assets)', () => {
  it('the body rule carries no text-shadow and no optimizeLegibility', () => {
    // behavioral-test-allow: reads the shipped stylesheet build asset; jsdom cannot evaluate paint cost
    const base = readFileSync(path.resolve(__dirname, '../app/css/_base.css'), 'utf-8');
    // Leading \s* tolerates any indentation level; the @layer base wrapper was
    // removed during the CSS Modules migration.
    const bodyBlock = base.match(/^\s*html,\s*\n\s*body\s*\{[^}]+\}/m)?.[0];
    expect(bodyBlock).toBeDefined();
    expect(bodyBlock).not.toContain('text-shadow');
    expect(bodyBlock).not.toContain('optimizeLegibility');
  });

  it('the crt-flicker animation runs at >= 3s (cheap, not jittery)', () => {
    // behavioral-test-allow: reads the shipped stylesheet build asset; jsdom cannot evaluate @keyframes timing
    const crt = readFileSync(
      path.resolve(__dirname, '../components/responsive/CRTOverlay.module.css'),
      'utf-8',
    );
    const flicker = crt.match(/\.flicker\s*\{[^}]+\}/)?.[0] ?? '';
    const dur = flicker.match(/animation:\s*crt-flicker\s+([\d.]+)s/)?.[1];
    expect(Number(dur)).toBeGreaterThanOrEqual(3);
  });
});
